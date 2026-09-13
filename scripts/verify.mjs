#!/usr/bin/env node
/**
 * Root verification gate: runs every quality gate for the repo in one command.
 *
 *   npm run verify            (from the repo root)
 *
 * Gates, in order:
 *   1. server  — Vitest unit/contract tests (offline, no docker needed)
 *   2. server  — nest build
 *   3. client  — react-router typegen + tsc
 *   4. client  — react-router build
 *
 * Each gate streams its output live; a summary prints at the end and the
 * process exits non-zero if any gate failed, so CI can use it as-is.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const GATES = [
  { name: 'server tests', cwd: 'server', command: 'npm', args: ['test'] },
  { name: 'server build', cwd: 'server', command: 'npm', args: ['run', 'build'] },
  { name: 'client typecheck', cwd: 'client', command: 'npm', args: ['run', 'typecheck'] },
  { name: 'client build', cwd: 'client', command: 'npm', args: ['run', 'build'] },
];

function runGate(gate) {
  return new Promise((resolve) => {
    const started = Date.now();
    console.log(`\n▶ ${gate.name} (${gate.cwd})`);
    const child = spawn(gate.command, gate.args, {
      cwd: path.join(ROOT, gate.cwd),
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('close', (code) =>
      resolve({ gate, code, durationMs: Date.now() - started }),
    );
    child.on('error', (err) => {
      console.error(`  failed to start: ${err.message}`);
      resolve({ gate, code: 1, durationMs: Date.now() - started });
    });
  });
}

const results = [];
for (const gate of GATES) {
  results.push(await runGate(gate));
}

const failed = results.filter((r) => r.code !== 0);
const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

console.log('\n' + '═'.repeat(56));
for (const { gate, code, durationMs } of results) {
  const mark = code === 0 ? '✓' : '✗';
  console.log(`${mark} ${gate.name.padEnd(20)} ${seconds(durationMs)}`);
}
console.log('═'.repeat(56));

if (failed.length > 0) {
  console.error(`verify FAILED: ${failed.map((f) => f.gate.name).join(', ')}`);
  process.exit(1);
}
console.log('verify passed: all gates green');
