# System design: Career Autopilot hardening phase

Status: decided, 2026-09-12.
Scope: the architecture for making the platform correct, testable, and trustworthy. The feature architecture is already built; this doc governs how we harden it.

## Step 1: Requirements

Functional:
- One primary user (the developer, personal use) drives every flow through the web client. The browser extension reads profile data for autofill.
- Critical flows: (1) upload or generate a resume and get an ATS-scored match against a job description, (2) search aggregated jobs and bookmark or track them, (3) move applications through the kanban pipeline with communications and interview notes attached, (4) compare offers and generate negotiation material, (5) extension autofill of application forms.
- Inputs: resume files (pdf, docx, txt, html), search queries, job descriptions, offer terms, form data from the extension. Outputs: parsed resumes, AI analyses as JSON, tracked application records, generated documents, autofilled forms.
- Operations: CRUD across 25 modules, search through the JSearch API, background jobs for alert scheduling, file upload and static serving, LLM chat and embeddings.

Non-functional, stated as reality rather than aspiration:

| Dimension | Today | Target for this phase |
|-----------|-------|----------------------|
| Scale | 1 user, local plus one deployed instance | unchanged, but per-user query scoping must actually hold |
| Latency | LLM calls dominate (seconds), DB is local | no change |
| Availability | best effort, single instance | no change |
| Consistency | single Postgres, strong | no change |
| Durability | uploads on local disk, DB in a docker volume | uploads are the loss risk; document a backup story |
| Data volume | hundreds of rows, MB-scale uploads | trivial |
| Read/write ratio | read-heavy UI, write bursts during import | irrelevant at this scale |

Constraints:
- Runtime: Node 20, npm (the Docker build runs npm ci). TypeScript everywhere.
- Solo developer working with AI agents. Tests must run headlessly, offline, and fast.
- Budget: hobby project. JSearch and LLM APIs are metered, so tests must never hit them.
- Deployment: single container plus postgres and redis; no serverless.

Security:
- Data classification: PII throughout (resumes, profile, salary data).
- Access model: Better Auth session cookies; every /api query must be scoped by userId.
- Encryption: TLS at deploy time; secrets in env only.
- Auditability: none today. Backlog candidate, not a hardening blocker.

Defects this phase must address, from the code audit:
1. Zero tests anywhere (0 test files, no test runner configured).
2. Committed secrets: server/.env.example carries real-looking API keys.
3. Dead code and noise: client/app/lib/api.ts.bak, server/server.log, user uploads committed to git.
4. Documentation drift: a stale template README, and path/runtime claims that do not match the repo.
5. Ad hoc error contract: services throw raw Error with upstream bodies; the client surfaces whatever arrives.
6. Type safety gaps: `any` in the AI response path; client typecheck exists but sits outside any verification loop.

Intent: a job seeker can trust every score, generated document, and tracked record this platform produces, and an agent can verify any change with a fast, offline test suite.

## Step 2: Capacity estimation

Back-of-envelope, sized for the test harness rather than the infra.
- QPS: one user, maybe 200 actions a day across 4 active hours, is 0.014 average QPS and under 1 QPS at peak. The only rates that matter are external: JSearch monthly quota and roughly 2k to 8k LLM tokens per analysis.
- Storage: 50 resumes at 200 KB is 10 MB, plus KB-scale Postgres growth. Trivial.
- Bandwidth: multi-MB PDF uploads on loopback. Trivial.
- Latency budget: no user-facing p99 target beyond "the LLM call eventually returns". The budget that matters is the test suite: under 30 seconds, no network.
- Conclusion: no scalability work is justified. Capacity effort goes to keeping metered APIs out of tests and dev loops.

## Step 3: Component decomposition

```
client (React Router 7, port 5173)
   -> REST /api (NestJS, port 3000)
        -> Prisma (Postgres 5432)
        -> RedisService / BullMQ (Redis 6379)
        -> AiService (OpenAI-compatible, metered)   <- most brittle dependency
        -> JSearch API (metered, quota-limited)     <- second most brittle
   <- browser extension (MV3) reads profile, autofills forms
```

Failure analysis:
- The component that fails most in practice is AiService: upstream 4xx and 5xx, malformed JSON inside message content, truncated responses. It has no retry, no timeout, and no schema validation of returned JSON. Design for that first.
- Second is the JSearch integration: quota exhaustion mid-search. A per-user Redis limiter exists, but failures surface as raw exceptions.
- Single point of failure: one Postgres and one Redis serve everything. Acceptable for one user. Tests must not depend on either.

## Step 4: Data flow and API contract

Read path: client loader fetches /api/... with the session cookie, the controller validates a DTO, the service calls Prisma, the AI wrapper, or Redis, JSON returns to the loader, React renders. The write path is the same plus side effects such as alert-queue jobs.

Contract conventions, formalized here so tests can pin them:
- Success: 200 with the resource JSON the service returns. No envelope; endpoints are resource-shaped.
- Errors: currently ad hoc (a raw Error becomes a 500 with whatever message it carries). Decision in Step 7: typed exceptions mapping to { statusCode, message, error }; AI upstream failures become 502, DTO validation 400 (the ValidationPipe already does this), missing auth 401, missing resource 404. The client's api.ts maps non-2xx to thrown errors that preserve the message.
- Idempotency: CRUD endpoints are idempotent. Generation endpoints (tailor, cover letter) are not, and each call costs tokens, so the client never auto-retries them; regenerating is explicit user intent.
- Versioning: none. This is a single-user product; breaking API changes are allowed with a doc note. Revisit if the extension and client ever need to ship independently.

The contract tests in TASK-02 pin three things: DTO rejection shapes, userId scoping (a request for another user's resource returns 404), and the 502 mapping when the AI upstream fails.

## Step 5: Options considered

Option A: In-place hardening. Chosen.
- What it is: keep NestJS and React Router exactly as they are. Add Vitest to the server with the AI wrapper and JSearch mocked at module boundaries, wire the client typecheck into a verification script, formalize the error contract, delete dead code, scrub secrets, fix docs.
- Key flow: every task lands with tests green and typecheck clean; no runtime changes.
- Pros: zero migration risk; tests target behavior users actually see; the suite needs no docker or network; tasks ship independently; the existing module conventions stay intact.
- Cons: the Node-vs-Bun documentation confusion persists until docs are fixed; no end-to-end coverage early; keeps the hand-rolled fetch wrapper instead of an SDK.
- Choose it when the product works and trust is the problem. That is exactly the situation.

Option B: Platform consolidation first, tests second.
- What it is: commit to one runtime (Bun or Node), delete the other lockfile family, extract shared types into a workspace package, swap the AI wrapper for the official SDK, then test.
- Key flow: refactors land before any test exists.
- Pros: a cleaner base; shared types end client/server drift for good.
- Cons: weeks of churn with no safety net; every refactor lands untested, which is precisely when regressions hide; it delays the user's stated priority.
- Choose it only after a test harness exists, as a follow-on phase.

Option C: End-to-end first.
- What it is: Playwright suites against the running stack for the five critical flows, unit tests later.
- Key flow: full-stack runs through postgres, redis, and mocked upstreams for every test.
- Pros: tests what users do; catches integration breaks that unit tests miss.
- Cons: needs postgres and redis for every run, so it is slow and flaky; covers little logic per minute of runtime; a failing e2e is hard to diagnose against an LLM backend. The wrong first tool here.
- Revisit as a thin smoke suite once unit coverage exists.

Trade-offs accepted:
- Speed of verification over depth: unit tests before e2e. Acceptable because flows are stable and the risk is logic-level (parsing, scoring, scoping), which units cover cheaply.
- Simplicity over flexibility: keep the hand-rolled AI wrapper. Acceptable because it is 221 understood lines that are easy to mock; an SDK adds little at one user.
- Doc effort over repeated audits: documentation is fixed once this phase, then maintained in-change rather than re-audited.
- Test fidelity over metered API realism: mock the AI and JSearch boundaries. Acceptable because their failure modes (5xx, malformed JSON, quota errors) are easy to fake and expensive to hit for real.

## Step 6: Validation and measurement

Hypotheses to test, not assume:
1. The AI wrapper fails safely upstream. Experiment: unit tests force 429, 500, and invalid-JSON responses; assert a typed error, no crash, and that message content survives. Measure: every branch of AiService covered.
2. Queries are user-scoped. Experiment: contract tests call a sample of services as user A requesting user B's resource; assert 404. Measure: at least resumes, jobs, applications, interview-prep, and offers pinned.
3. The client still compiles after every change. Experiment: typegen plus tsc in a verification script. Measure: zero errors today, gated afterwards.
4. The suite stays fast and offline. Measure: wall clock under 30 seconds with no network and no docker.

PoC scope: TASK-01 is the PoC (Vitest plus mocks plus AiService tests). If mocking the AI wrapper takes more than an afternoon, or tests need live services, stop and revisit Option A's mock boundary.

PoC outcome (2026-09-12): succeeded. One 40-line fetch-stub helper covers both metered APIs; 23 AiService tests run offline in under a second with no docker; `nest build` is unaffected. The mock boundary holds, so Option A stands.

Coverage-breadth evidence (2026-09-13): TASK-09 took the suite from 23 to 93 tests across 6 spec files (AiService, JobsService, ResumesService, ResumeParserService, DeadlinesService, ExtensionService), still fully offline in ~3s with a clean `nest build`. The boundary kept holding — and the breadth push immediately paid for itself: testing `getExtensionAnalytics` date filters exposed a real bug where a second object spread silently dropped the `createdAt.gte` bound whenever both start and end dates were set.

Contract-test evidence (2026-09-13): TASK-02 added supertest-over-Nest contract tests (extension + jobs controllers, 23 tests) running the real ValidationPipe from main.ts with only external boundaries mocked. Wiring the DTOs and pinning the boundary caught three real bugs in one pass: (1) the extension controller accepted `any` bodies and `updateApplicationBundle` spread them into Prisma — a mass-assignment hole (`userId` overwrite) now closed by the whitelist; (2) `GET /extension/applications/analytics` was unreachable, shadowed by `GET /applications/:id` matching `analytics` as an id; (3) AI failures in `analyzeJobMatch`/`batchMatchJobs` escaped as raw 500s with upstream error text — they now map to 502 with a stable client-safe message (404s still pass through).

Error-contract rollout (2026-09-13): TASK-07 extracted the 502 mapping into `server/src/common/ai-gateway.ts` (`withAiGateway`, `AiUnavailableException`, one shared message) and applied it to 21 hard-fail AI paths across five services: linkedin (analyze/reanalyze), interview-prep (briefing, assessment, behavioral bank, cheat sheet, mock-interview turns/feedback), offer-negotiation (comparison, coach, equity, benefits, decision, resignation letter), post-onboarding (all six generators), and interview-process (follow-up email, case study). JobsService now reuses the shared exception. Deliberate exclusions: batches (best-effort with its own retry) and resumes (half its AI paths are best-effort by design — needs its own pass). Suite at 154 tests / 14 files, all offline, build clean.

Client-side contract adoption (2026-09-13): the React client now consumes the error contract. `api.ts` gained a typed `ApiError`, `isRetryableError`/`isAiUnavailableError`/`describeError` helpers, a mirrored `AI_UNAVAILABLE_MESSAGE`, and fixed the retry loop (timeouts were marked retryable but never retried; the retry path re-fetched with an already-aborted controller — both fixed with a fresh AbortController + timeout per attempt). `reportError` + `ErrorBanner` (components/ui) give AI routes a uniform catch: transient 502s render amber with a Retry action, permanent 4xxs stay red without one. Converted 20 AI-generation routes. Typecheck also surfaced and fixed pre-existing duplicate `formatDate`/`getNextStatuses` declarations shadowing the `status-config` imports in `applications.tsx` — the client typecheck gate is green again.

Root verification gate (2026-09-13): TASK-06 added `scripts/verify.mjs` plus a root `package.json` exposing `npm run verify`: server tests → server build → client typecheck → client build, streamed live with a duration summary and non-zero exit on any failure. Verified all four gates green end to end (~70s total).

App-wide error UX (2026-09-13): the transient/permanent ErrorBanner treatment extended beyond the AI-generation routes to every server-error surface in the client. Non-AI CRUD routes (applications, application-detail, offer comparison, portfolio, cover-letter templates, interview notes/schedule/feedback, panel interviews, references, login, register, share, saved searches, job alerts, profile, company detail, batch/upload/onboarding, both analytics pages) now use the same `reportError` + `ErrorBanner` pair; route-level analytics pages render a retryable banner instead of silently swallowing load failures. `ErrorBanner` also gained a documented message-pattern classifier for routes that persist only the error string: the pinned 502 message, timeouts, rate limits, and 5xx default copy read as transient (amber, retryable) — 404/validation text stays permanent (red). Secondary catches (deletes, updates, loads) across the remaining routes were swept onto `reportError` so toast titles and retry affordances follow the same classification everywhere.

Resumes contract pass (2026-09-13): TASK-10 closed the last AI-heavy gap. Classification: seven hard-fail paths wrapped in `withAiGateway` (cover letter, skill gap, interview questions, salary estimate, template suggestions, multi-JD, tailored resume — the tailored path persists *inside* the wrapper so an AI failure creates no orphan resume), while `create()`'s analysis, `generateFromProfile`'s generation + trailing feedback, and the tailored-resume trailing ATS pass stay deliberately best-effort, now pinned by tests. Two behavior fixes: an embeddings outage in `generateFromProfile` no longer 500s the best-effort path (falls back to unranked projects), and `create()` actually stores its shaped `fallbackFeedback` on analysis failure — the `feedback || fallbackFeedback` expression was dead code because `feedback` is always at least `{}`. Suite at 186 tests.

Parser regression pass (2026-09-13): TASK-08 extended the AiService spec (23 → 36 tests) around `parseAIResponse`'s fallback ladder and the chat → getResponseText → parseAIResponse composite contract: truncated `finish_reason: 'length'` completions and refusal surfacing, ladder precedence (pure JSON beats fence-looking strings), first-of-multiple fences, fence content polluted by trailing prose, uppercase fence hints, arrays, nested-object brace extraction, and pinned failure modes (trailing commas, mid-object truncation, empty content). The greedy first-brace-to-last-brace limitation was confirmed real and pinned as a documented behavior, so a future smarter extraction is a deliberate change, not an accident. Suite at 169 tests.

Repo hygiene pass (2026-09-13): TASK-03 removed the tracked `client/app/lib/api.ts.bak` and `server/server.log`, plus the tracked `server/.env.migrate` (local `DATABASE_URL` only, nothing referenced it; working-tree copy preserved and now ignored). `.gitignore` gained `*.bak`/`*.log` globally and `/server/.env.*` with a `!/server/.env.example` exception; `server/uploads/` files were never tracked and stayed untouched. TASK-05 replaced the two real keys in `server/.env.example` (an llm7.io OpenAI-compatible key and a RapidAPI JSearch key — both live credentials committed in the template) with placeholders. Both rules are pinned by `server/src/repo-hygiene.spec.ts`: placeholder-only shape detection (verified to catch both leaked keys) and a no-tracked-bak/log/env assertion. Suite at 156 tests.

## Step 7: Decision and delivery

Decision: Option A, in-place hardening. Evidence: the audit found stable features with zero tests and concrete hygiene defects; the cheapest path to trustworthy behavior is tests at the module boundary, not a migration.

Delivery order, matching the backlog:
1. TASK-01 test harness (foundation); TASK-03 dead code, TASK-05 secrets scrub, TASK-04 README, all independent.
2. TASK-02 contract tests for the AI wrapper and one feature service, then widen module by module.
3. TASK-06 client verification script; TASK-07 error contract rollout.
Deferred: e2e smoke suite, uploads backup story, audit logging, shared-types workspace.

Rollout: local only, no canary. Each task merges with its tests green and typecheck clean.

Migration: none. No schema changes in this phase; the uploads backup note is a deliverable, not a migration.

Operations: server/.env.example stays the source of truth for variable names after scrubbing; AGENTS.md gains the test command when TASK-01 lands.

Revisit triggers:
- A third metered integration appears, or a second user deploys: rerun Step 1 with multi-user constraints.
- The suite exceeds 30 seconds or needs docker: revisit the mock boundary or split out integration tests.
- Client and server type drift causes a shipped bug: revisit Option B's shared-types package.
- The product opens to external users: a security audit (sessions, upload validation, PII retention) becomes a blocking phase.
