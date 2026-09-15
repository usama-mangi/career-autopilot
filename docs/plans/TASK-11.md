# TASK-11 — UI/UX slop removal and design-system init

## Goal

Remove AI-slop visual and copy patterns from the client surface and bring the UI under the four UI gates (slop, a11y, system, knowledge). This task initializes `design.yaml` for the project and hardens the design-system base so future screens inherit a clean token set.

## Audit findings (read-only, before any change)

### Slop violations found

**Color**
- Purple/indigo as ad-hoc accent in ~20 route files: interview-questions, mock-interview, interview-schedule, interview-prep, interview-analytics, companies, behavioral-bank, application-detail, ResumeCard, linkedin-profile, skill-refresh, multi-jd, resumes.$id, references, onboarding-plan, jobs, First90PlanView, NegotiationStrategyView, BatchComparison, applications-analytics
- 4 blue→indigo gradient panels (templates, share, resume-versions, resignation-letter)
- Violet→blue gradient in score visuals: ScoreGuage (#2563eb→#7c3aed), ScoreCircle, ui/Score + ui/ScoreDisplay ScoreBar gradients, `.score-bar-blue` (blue→purple gradient)
- Dead `primary-gradient`/`primary-gradient-hover` utilities (raw #2563eb, zero usages)
- `badge-purple` token + `bg-badge-purple` in ResumeCard html type
- ATS component `bg-gradient-to-b from-green/yellow/red-100 to-white` tinted-gradient card
- ScoreGuage track `#e5e7eb` (cool gray, off-token)

**Imagery**
- ~95 emoji-as-icon hits in ~20 files (📞💻⚙️💡📋🏆📚 etc.) — interview-notes, interview-schedule, interview-questions, mock-interview, follow-up-emails, skill-gap, dashboard, application-detail, share, interview-prep

**Copy**
- Landing meta "Your Career Traverse Starts Here" + "sherpa" claims — passes name-swap only in spirit; meta reads AI-authored
- "The compound advantage" + "no other tool threads this signal" — name-swap fail, no concrete mechanism
 "Oops!" ErrorBoundary headline — chatbot-ish
- Dead footer links (/privacy, /terms, /contact → 404)

### A11y violations found

- Modal.tsx: no focus trap; only Escape handler. Violates "every modal traps focus"
- Button: `size="sm"` 28px and `size="icon"` 36px tall — under 44px touch target (mobile nav triggers use sm/icon in dense spots)
- PageShell `SectionHeader` + `app.css .section-title` use `text-gray-400` ≈ 3.1:1 — fails AA for normal text
- ErrorBoundary headline "Oops!" (tone, not strictly a11y)

### System-check violations

- Raw hex in components (#2563eb, #e5e7eb, #7c3aed) instead of tokens
- Missing warm `gray-300`/`gray-500` tiers in app.css @theme — components using `gray-300`/`gray- sweeping` silently fall back to Tailwind's cool gray
- `gradient-border` name implies a gradient that does not exist (literal, not semantic naming)
- 4 competing score visuals (ScoreGuage, ScoreCircle, ui/Score, ui/ScoreDisplay) with divergent palettes

## Scope decision

The four competing score components stay (each serves a real consumer), but they are visually unified on flat semantic tokens. Consolidating them is a separate task because it touches 15+ consumer files.

## Plan

1. **design.yaml init** — brand block from AGENTS.md (warm field-journal voice, direct tone, no hype), semantic token set matching the existing Expedition Journal palette, components with state matrices, key screens with dominant action + CTA count.
2. **app.css token cleanup**
   - Flat semantic score-bar fills: green `#16a34a`, yellow `#d97706`, red `#dc2626`, blue `#1E5F8C` (matches `--color-info`)
   - Delete `primary-gradient`/`primary-gradient-hover` utilities (dead)
   - Rename `gradient-border` → `panel-soft` (warm parchment panel, no gradient), update 3 consumers (share, FileUploader, MultiFileUploader)
   - Rename `badge-purple` → `badge-neutral` (warm parchment) and `badge-purple-text` → `badge-neutral-text`, update ResumeCard
   - Add warm `gray-300: #C9BBA9` and `gray-500: #7A6D5F` tiers to @theme (fills the scale gap; gray-500 at 4.6:1 on parchment)
   - Fix `.section-title` gray-400 → gray-500 (AA), PageShell SectionHeader to match
   - ATS: replace tinted gradient card with flat `panel-soft`-style card, semantic flat score bar
3. **Score components** — ScoreGuage, ScoreCircle, ui/Score, ui/ScoreDisplay: flat semantic colors (no gradients), warm `#E8DDD1` track, tokens referenced by name
4. **A11y fixes**
   - Modal: real focus trap (Tab/Shift+Tab cycle within modal), restore focus on close
   - Button: sm 36px, icon 44px, md/lg already ≥40; sm bump to py-2.5 (36px) — dense desktop spots keep sm, mobile nav/menu triggers use md
   - ErrorBoundary: "Something went wrong" + "Back to dashboard" action
5. **Color sweep** — replace all purple/indigo/pink accents with semantic palette tokens: interviewing/advanced → warning amber, panel/video/second-stage → info blue, "generated"/html → badge-neutral, company sources → info/danger/info, negotiation bullets → primary
6. **Emoji sweep** — replace emoji with inline SVG glyphs (stroke style matching Sidebar, `aria-hidden`), same semantic colors; keep ★/☆ rating (functional glyphs, screen-reader labels added where they carry meaning) and ✓ checkmarks (functional, paired with text). "→" in CTAs/arrows are functional indicators, keep.
7. **Copy pass** — landing meta/hero support copy through the name-swap test, "compound advantage" → concrete mechanism sentence, ErrorBoundary copy, dead footer links → rendered as plain text copyright line
8. **Verify** — `npm run typecheck` + `npm run build`, re-run four gates, update design.yaml statuses, record-progress

## Out of scope

- Consolidating the 4 score components into one (separate task; touches 15+ consumers)
- Server-side changes (none needed)
- New features; new components (none — three-real-requests rule)
