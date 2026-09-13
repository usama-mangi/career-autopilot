import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regression tests for repo hygiene (backlog TASK-03 / TASK-05):
 * .env.example must only ever contain placeholder values, and git must not
 * track backups, logs, or .env files. Both rules run offline.
 */

const SERVER_ROOT = process.cwd();

/** Repo files per git, or null when not running inside a git checkout. */
function trackedFiles(): string[] | null {
  try {
    const out = execFileSync('git', ['ls-files', '-z'], {
      cwd: SERVER_ROOT,
      encoding: 'utf8',
    });
    return out.split('\0').filter(Boolean);
  } catch {
    return null;
  }
}

function parseEnvValues(content: string): Array<{ key: string; value: string }> {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const eq = line.indexOf('=');
      return eq === -1
        ? null
        : { key: line.slice(0, eq).trim(), value: line.slice(eq + 1).trim() };
    })
    .filter((pair): pair is { key: string; value: string } => pair !== null);
}

const PLACEHOLDER_HINT =
  /(your|example|placeholder|change-?me|fixme|dummy|sample|xxx|<|>)/i;

/**
 * True when a value contains a credential-shaped run: 32+ consecutive
 * base64/hex characters. Placeholder words and separator-dotted strings
 * (like auth secrets written as words) do not match.
 */
function looksLikeRealSecret(value: string): boolean {
  if (PLACEHOLDER_HINT.test(value)) return false;
  return /[A-Za-z0-9+/=]{32,}/.test(value);
}

describe('repo hygiene', () => {
  it('.env.example contains only placeholder values, never real keys', () => {
    const values = parseEnvValues(readFileSync(join(SERVER_ROOT, '.env.example'), 'utf8'));
    expect(values.length).toBeGreaterThan(0);

    for (const { key, value } of values) {
      // Local development URLs are expected defaults; only credential shapes
      // are guarded here.
      if (/localhost|127\.0\.0\.1/.test(value)) continue;
      expect(looksLikeRealSecret(value), `${key} looks like a real secret; commit placeholders only`).toBe(false);
    }
  });

  it('does not track backups, logs, or .env files', () => {
    const files = trackedFiles();
    if (files === null) return; // not a git checkout — nothing to assert

    const offenders = files.filter(
      (file) =>
        /\.(bak|log)$/.test(file) ||
        (/\/\.env($|\.)/.test(`/${file}`) || file.startsWith('.env')) &&
          !/\.env\.example$/.test(file),
    );
    expect(offenders).toEqual([]);
  });
});
