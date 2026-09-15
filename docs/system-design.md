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

UX flow restructure (2026-09-13): the prototype treated job search as the center of the app and the tracker as an 8-column drag kanban; both choices fought the actual product. The IA is now job-lifecycle-first. (1) The applications board is stage lanes: five ordered active stages (Draft → Applied → Screen → Interview → Offer) each showing "what happens here," plus closed outcomes (accepted/rejected/withdrawn) collapsed into an archive; DnD-kit drag was removed — the next action per job is a single click on the card, keyboard and touch work for free. (2) The dashboard is a "Today" brief that sorts cross-stage nudges (interviews happening, stale applied jobs needing follow-up, offers to review, drafts to finish) instead of leading with aggregate stats and job-search CTAs. (3) Navigation regroups around the lifecycle verbs (Find → Prepare → Track → Interview → Land → After), with everything else under a collapsed Library section. (4) Cross-stage links stitch the tools to the job: application detail shows a lifecycle strip and one-click "Schedule an interview" (passes `applicationId` + company/role via query params — the server DTO already accepted it, the UI never sent it), "Compare offers"/"Negotiate" at offer stage, "Plan your first 90 days" on acceptance, and "View job posting" when the application came from search; job detail detects an existing tracked application and offers "Continue This Application" instead of a second "Mark Applied"; the schedule form pre-fills from those query params and interview cards link back to their application. (5) Rejected/withdrawn jobs now have reopen transitions in `status-config` so closures aren't dead ends. Shared helpers: `StageLanes` (components), `ACTIVE_STAGES`/`CLOSED_STATUSES`/`STAGE_HINTS` (lib/status-config). All verify gates green.

Offers-to-lifecycle linkage (2026-09-13): offer comparisons and first-90-days trackers now carry a real relation to the JobApplication they came from instead of floating free. Schema: `OfferComparison.applicationId` and `First90DaysTracker.applicationId` FKs (both `SetNull`, indexed; migration `20260913115536_link_offers_and_first90_to_application` — it also absorbs pre-existing drift by dropping the stale `Job_sourceUrl_key` unique index the schema no longer declares). Server: `createComparison` validates the application belongs to the user before persisting the link (foreign ownership → 404, nothing persisted), and read paths include a summary of the linked application; pinned by four new service tests. Client: the offer-comparison form gains a "Linked application" selector (all of the user's applications) that pre-fills from `?applicationId&company&role` when arriving from an application's "Compare offers" link; comparison cards and offers-hub cards link back to the source application. The first-90-days form pre-fills and links from `?applicationId&company&role&startDate`, reached from the accepted-application banner, the accepted state's "Plan your first 90 days" link, and a new dashboard nudge for accepted jobs. The offer → first-90-days loop is now: track job → mark offer → compare (linked) → accept → plan seeded with company/role/applicationId, no manual re-entry. All verify gates green.

Negotiation-coach linkage (2026-09-13): the third offer artifact joined the application graph. Schema: `NegotiationCoach` already had an unused `applicationId` column — it now has a real Prisma relation + FK + index (migration `20260913122007_link_negotiation_coach_to_application`, no drift). Server: `createCoach` validates application ownership before persisting (foreign id → 404, nothing written) and list/get include the linked application summary; four new service tests pin persist/reject/no-link/include. Client bug found on the way: `api.ts` pointed every coach call at `/offer-negotiation/coach` (singular) while the controller registers `/coaches` — every negotiation-coach request had been 404ing; fixed to `/coaches`. The page previously sent only companyName+roleTitle (dropping the salary/equity the user typed, so the AI strategy had no offer to negotiate) and `listCoaches` selected only four fields (so the expanded strategy/email/script view rendered empty); both fixed, and the `NegotiationCoach` client type now mirrors the real rows. The page gains a "Linked application" selector with query-param prefill from the application-detail "Negotiation coach" link (`?applicationId&company&role`), and coach cards link back to their application. All verify gates green.

Offers hub rebuild (2026-09-13): the hub's data contract had been wrong since inception — it called `listComparisons` (which returns OfferComparison *rows*: `{ name, offers[], weights, scores, application }`) and treated each row as a single offer, reading `companyName`/`status`/`baseSalary` fields that don't exist at the top level. Consequence: cards rendered blank titles and, since `status` was always undefined, the Active Offers list never matched — the page always showed the empty state, and both card buttons pointed at params nothing read (`?offers=<comparisonId>`, `?offer=<rowId>`). Now: rows are flattened into per-offer cards (`ComparisonOfferEntry` × parent context via the new `OfferComparisonRow` type, which replaces the fictional `OfferComparisonItem` shape everywhere in `api.ts`). Negotiate builds a real prefill link (`company/baseSalary/equity/bonus/location` + `applicationId&role` from the linked application) that the salary-negotiation page consumes alongside its existing application-params prefill; Compare/Open deep-links to `?comparison=<id>` which auto-expands that comparison on the hub page. The page also gained a Comparisons index section. All verify gates green.

Offer toolkit panel (2026-09-13): applications at the offer/accepted stage now show a state-aware "offer toolkit" in the detail header instead of scattered always-visible buttons. The panel loads the application's linked artifacts client-side (comparisons, coach sessions, 90-day trackers filtered by `applicationId` from the three list endpoints — no new server surface) and renders one card per artifact type: existing items link straight to them via deep links (`?comparison=<id>` auto-expands on the comparison page, `?session=<id>` expands the coach strategy, `?tracker=<id>` expands the 90-day plan — all three pages gained the read-param-and-expand effect), and an empty type shows a "+ Create" prompt whose link pre-fills the target form with `applicationId/company/role`. The toolkit appears for accepted applications too, so the 90-day plan prompt lives with the job that triggered it. `First90DaysTracker` client type gained the optional `applicationId` it always persisted. All verify gates green.

Single-artifact detail views: toolkit and list deep links now land on dedicated routes — `/offers/negotiate/:id` (one coach session with its strategy, email templates, and scripts, plus application back-link) and `/onboarding/first-90-days/:id` (one 90-day plan with application back-link). Both list pages link to the detail route instead of expanding in place, and their rendering is shared with the detail pages via `NegotiationStrategyView` and `First90PlanView` in `client/app/components/`. This surfaced that the client's `First90Milestone`/`FeedbackLoop`/`EarlyWin` types described shapes no server path produces — the tracker stores phase-grouped milestones (learning/contributing/leading with goals/deliverables/successCriteria), feedback loops, and early wins per `buildFirst90DaysPrompt`; the client types now mirror reality (`First90Phase`, `First90FeedbackLoop`, `First90EarlyWin`) and the list page's `any[]` tracker state is typed. `Skeleton` was never a ui export, so the detail pages use the repo's `animate-pulse` convention.

Stage toolkit on every application: the toolkit panel on application detail now appears for every open stage (hidden only for rejected/withdrawn), with stage-appropriate artifacts — draft/applied show a prepare panel (interview notes create prompt, framed as prep capture); phone_screen/interviewing add the interview schedule and notes as first-class rows with deep links (`/interview-schedule?schedule=<id>` opens that interview's edit modal, `/interview-notes?note=<id>` opens that note for editing); offer/accepted keep the offer toolkit. Artifact lists are fetched for all open stages, each best-effort. This forced fixing the interview-notes page, whose create payload was broken (sent `companyName: ""`, omitted required `roleTitle`, so the server 500'd) and whose forms/rendered fields (`questions`, `note.type`, `note.interviewerName`, `/10` ratings, `followUpNeeded`) matched no persisted column — it now sends the real contract (`questionsAsked`, `selfRating` /5, `interviewDate`, required company/role/type) and renders `companyName`/`roleTitle`/`interviewType`/`roundNumber`, with an application-link prefill and company/role/type/round/date/rating inputs. The client `InterviewNote`, `InterviewQA`, `InterviewNoteCreateRequest`, and `InterviewNoteUpdateRequest` types were corrected to the actual InterviewNote schema (`questionsAsked` JSON of `{question, category, myAnswer, rating}`).

Interview note DTOs: `POST /api/interview-process/notes` and `PATCH .../notes/:id` now validate through `CreateInterviewNoteDto` / `UpdateInterviewNoteDto` (server/src/interview-process/interview-process.dto.ts) instead of accepting untyped bodies. Required: `companyName`, `roleTitle`, `interviewType` (constrained to the schema's values), `interviewDate` (date string), `questionsAsked` (array of nested `InterviewQaDto` with non-empty question and 1–10 rating), `selfRating` (1–5); optional: `applicationId`/`scheduleId` (ownership enforced by the service), `roundNumber`, strengths/weaknesses/followUpItems string arrays, `generalNotes`. The global whitelist strips unknown fields, so mass-assignment (`userId`) and schema-illegal values are rejected with 400 before the service runs. The contract harness registers `InterviewProcessController`, and `interview-process.controller.contract.spec.ts` pins the 400 paths, whitelist behavior, and userId scoping over real HTTP.

Follow-up items become emails: each follow-up item on an interview note is now a chip on the notes page card — clicking it opens a generate → review → save draft flow (AI context seeded with the item plus the note's strengths, editable type/context, editable generated subject/body) and persists through the existing `POST /api/interview-process/follow-up-emails` endpoint linked to both the note and its application. Saved emails preview inline under the note's follow-ups with copy and mark-sent (`PATCH` sets `sentAt`). Wiring this corrected the client follow-up-email types to the real `FollowUpEmail` schema (no `recipient`/`content`/`status` columns exist) and fixed the Follow-up Emails page's generate flow, which was passing the interview-note id as `applicationId`, sending a `context` blob the server never read, and dropping the note/application link on save; selecting a note now prefills company/role and propagates the application link on both the generate and manual-create modals. No server changes were needed.

Schedule-to-notes handoff: completed interviews on the Interview Schedule page get a one-click "Log Notes" link to `/interview-notes?schedule=<id>`. The notes page fetches that schedule via the existing `GET /api/interview-prep/schedule/:id`, prefills company/role/type (mapping schedule-type values like `phone`/`video`/`case_study`/`final` to the note DTO's allowed values)/date, carries the schedule's `scheduleId` and `applicationId` onto the created note, and bumps the round number past any existing notes for the same company+role. Wiring this corrected the client `InterviewScheduleEntry` type to the real `InterviewSchedule` schema (the fictional `type`/`round`/`interviewers` fields replaced by `interviewType`, etc.) and removed the dead "View Details" links pointing at the unregistered `/interviews/schedule/:id` route; Edit buttons on past cards were promoted to compensate. The notes create payload now persists `scheduleId`, which the note DTO accepts as an optional field.

Today surfaces due follow-ups: the dashboard fetches follow-up emails and interview notes alongside its existing loads (each best-effort via Promise.allSettled) and nudges for drafted-but-unsent emails (`sentAt` null), capped at 4 and urgency-aged (≥7 days → now, ≥3 → soon, else later). Each nudge deep-links to `/interview-notes?note=<noteId>&email=<emailId>` — a new `?email=` param on the notes page expands that email's preview in place ready to copy or mark sent, and when an email is targeted the note-edit modal deliberately does not open (the task there is sending, not editing); orphaned emails (no note link) fall back to the Follow-up Emails hub.

Smart follow-up defaults: `suggestFollowUp(note, item, emails)` in client/app/lib/follow-up.ts suggests the email type and send-timing guidance for one of a note's follow-up items instead of defaulting every draft to thank_you — materials/availability keywords map to additional_materials/custom; otherwise the first touch (no thank-you sent yet) is a thank-you with same-day/48-hour/late timing language keyed to days since the interview, and once a thank-you exists the suggestion shifts to a check-in around the one-week mark. The notes page's chip draft flow uses the clicked item; the Follow-up Emails hub's generate modal suggests from the selected note's first item when a note is picked. The suggested type remains user-editable in both modals, with the timing guidance shown as a hint line.

Interview-process DTOs — full coverage. Every remaining `@Body() body: any` handler in `interview-process.controller.ts` now validates through class-validator DTOs in `interview-process.dto.ts`, so the global whitelist pipe strips unknown fields (e.g. a client-sent `userId`) before the service runs and invalid payloads bounce with a 400 naming the offending field. Covered: `CreateInterviewerFeedbackDto` (`interviewerName` required — fixing the feedback page's wrong `interviewer` key), `CreatePanelInterviewDto` / `UpdatePanelInterviewDto`, `CreateCaseStudyDto` + `GenerateCaseStudyPlanDto` (enum-checked `type`, per-dimension `scores`), and the follow-up-email trio `CreateFollowUpEmailDto` / `UpdateFollowUpEmailDto` (status constrained to the schema's four values; PATCH cannot move `interviewNoteId`) / `GenerateFollowUpEmailDto` (`type` constrained to `thank_you|check_in|additional_materials|custom`, text lengths bounded). The contract spec pins validation failures, whitelist stripping, session-derived `userId`, and foreign-record 404s for the new endpoints; interview-process now has 28 tests.
