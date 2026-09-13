# AGENTS.md - Career Autopilot

## What

Career Autopilot is a full-stack platform for individual job seekers that covers the whole hunt: search aggregated job boards, match and tailor a resume against a posting, apply, track every application through a kanban pipeline, prepare for and record interviews, compare offers, practice salary negotiation, and plan the first 90 days on the job. The core loop is resume in, ATS-scored match out, application tracked end to end. The repo grew out of an AI resume analyzer, so npm package names still read "ai-resume-analyzer".

## Why

A job hunt scatters work across tools: LinkedIn for searching, Google Docs for resumes, a spreadsheet for tracking, Notion for interview notes, mental math for comparing offers. Every handoff loses context. This project keeps one data model behind the whole pipeline, so the resume that scored 72 against one job description can be retargeted to another in minutes, interview notes link back to the application they belong to, and offer comparisons use the same profile data that fills the applications.

## Standard

MVP with real data and real integrations, no mocks. A feature is done when its flow works end to end against the real database, the real LLM API, and the real job board API. The feature surface is largely built (43 Prisma models, 25 server modules, 62 client routes), so the current phase is hardening: tests, cleanup, and correctness take priority over new features. Scope limits breadth, never depth: what is in the task is done completely.

## Non-Negotiables

- New or changed behavior ships with tests. Server behavior gets Vitest unit tests in server/src (`cd server && npm test`); they must run offline in seconds. Stub global fetch for the AI and JSearch boundaries (helper: server/src/test-helpers/fetch-mock.ts) and build services from explicit Prisma/Redis/queue mocks (helper: server/src/test-helpers/service-mocks.ts); controller-boundary contract tests use supertest over a real Nest app with the main.ts ValidationPipe (helper: server/src/test-helpers/contract-harness.ts); never reach into private fields — hold mock handles in the test. Client work adds tests as its harness allows. Bug fixes need a regression test.
- Hard-fail AI call paths (chat → parse → persist) go through `withAiGateway` from server/src/common/ai-gateway.ts so upstream AI failures return 502 with the shared client-safe message; upstream error text never reaches the client. Best-effort AI paths stay best-effort — wrap only what should fail the request. The client mirrors the contract: `client/app/lib/api.ts` classifies errors (`isRetryableError`, `isAiUnavailableError`, the mirrored `AI_UNAVAILABLE_MESSAGE`) and auto-retries transient failures; routes surface them through `reportError`/`ErrorBanner` from `client/app/components/ui/ErrorBanner.tsx` — transient (amber, retry affordance) vs permanent (red).
- Verify against the running stack before claiming done: postgres and redis via docker compose, the NestJS server, the React Router client. Commands are in Architecture.
- No secrets in git. Never copy real keys into .env.example, docs, or code. .env files stay gitignored (`/server/.env.*` with the `.env.example` exception). The repo-hygiene spec (server/src/repo-hygiene.spec.ts) enforces this: .env.example must stay placeholder-only (shape-detected) and no .bak/.log/.env file may be tracked.
- Never edit an existing Prisma migration. Create a new one with prisma migrate dev.
- External input is validated with class-validator DTOs. The global ValidationPipe strips unknown fields, so a DTO must declare every field it accepts.
- AI prompts live in src/ai/prompts.ts or a feature module's own prompts file, never inline in a service.
- No `any` in new code. Share types through Prisma-generated types or client/app/types.
- No stray files in commits: no *.bak, no logs, no uploaded user files. Delete dead code instead of renaming it to .bak.
- Documentation matches the repo. When docs drift from reality, fix the docs in the same change.

## Architecture

Three components in one repo, talking over REST.

server/ is a NestJS 11 API on Node 20 with the Express adapter. Entry point src/main.ts: global prefix /api (except static /uploads), CORS from CORS_ORIGIN, global ValidationPipe, port 3000. PostgreSQL through Prisma (prisma/schema.prisma, 43 models). Auth is Better Auth email/password with session cookies (src/auth, src/lib/auth.ts). Redis backs BullMQ queues for scheduled job alerts plus a per-user rate limiter used by jobs. The AI layer is a thin OpenAI-compatible wrapper (src/ai/ai.service.ts) that calls POST {OPENAI_BASE_URL}/chat/completions and /embeddings with fetch, no SDK. Uploads land in server/uploads via multer and are served statically.

client/ is React Router 7 in framework mode with React 19, Tailwind 4, and Zustand stores. Routes are declared in app/routes.ts and implemented as 62 files in app/routes/. Loaders and actions call the API through app/lib/api.ts (base URL from VITE_API_URL, default http://localhost:3000). Dev server runs on 5173.

browser-extension/ is a Chrome MV3 extension that reads the user's profile from the same API and autofills application forms on major job boards (content scripts, background service worker, popup).

Data flow: client loader fetches /api/..., controller validates a DTO, service calls Prisma, Redis, or the AI wrapper, JSON returns to the loader, React renders. The extension authenticates with the same session cookie.

Local development (npm, not bun; the Docker build uses npm ci):
1. docker compose up -d postgres redis   (the compose file lives in client/)
2. cd server && npm install && npm run dev
3. cd client && npm install && npm run dev

Key environment variables (server/.env, names also listed in server/.env.example): DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_SERVER_URL, BETTER_AUTH_CLIENT_URL, OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL, JSEARCH_API_KEY, JSEARCH_API_HOST, REDIS_URL, CORS_ORIGIN. Client: VITE_API_URL.

Useful checks: `npm run verify` from the repo root runs every gate in one command (server tests, server build, client typecheck, client build) and exits non-zero on failure. Individual gates: cd server && npm test (Vitest, offline), cd server && npm run build, cd client && npm run typecheck (react-router typegen then tsc).
