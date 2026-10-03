# AI upgrade — production-readiness audit (2026-10-03, second pass)

Scope: everything on `feat/ai-upgrade` (from `mobile-first` @ a50a5fb) before launch. Code read end to end: provider,
client, handler, usage, capabilities, context engine, safety, prompts, schemas, features, apply, routes, UI, tests, migration 0800.
Baseline before changes: typecheck ✔, unit 191 ✔, integration 167 ✔.

## Per-feature audit

Columns are the 20 checks from the brief, condensed. "Real backend / real context / structured / server auth / key server-side /
loading / timeout / failure / empty / retry / 44 px" hold for **every** feature (shared factory `lib/ai/handler.ts`, shared sheet
`AIToolSheet`, zod schemas, `server-only` modules), so only the differences are listed.

| Feature | Status | Problems found | Fix required | Priority |
|---|---|---|---|---|
| Party Planner | Implemented, useful plan | **Activities, shopping items and budget lines are written to tables no screen ever reads** — "Added to your activities" leads nowhere (fake functionality). No "Add all". No next steps (venues / invitation / checklist). Re-opening the sheet throws the plan away (a new generation costs a suggestion). Planner theme applies without decorations/activities. Overrides (interests/theme/food/city) reach the prompt unsanitised. | Show saved activities / shopping list / budget on the Plan page; Add all; next-step links; restore last plan; theme carries decorations; sanitise overrides | P0 |
| Theme Suggestions | Implemented | No way to say "loves unicorns but not pink" (sheet auto-runs, no input). No description / food / invitation idea. Two AI theme sections on `/plan/theme` (new + legacy Azure "AI ideas"). | Optional input before generating; richer theme fields saved with the theme; hide legacy section when the new one is on | P0 |
| Smart Checklist | Implemented, good (date clamp, dedupe, venue-aware) | Titles can be generic ("Buy decorations") | Prompt: specific quantities/theme words in titles | P1 |
| Activity Planner | Implemented | No indoor/outdoor per activity; added activities invisible (see planner) | Add `setting`; show saved activities | P1 |
| Budget Assistant | Implemented, server-computed totals | No place to see budget lines; no distinction between estimates and what was actually spent | Budget view with "estimate" vs "actual spent" (`actual_amount`, never written by AI) | P1 |
| Food Planner | Implemented, allergy disclaimer server-side | Shopping items invisible after adding; no "Add all" | Shopping list view; Add all | P1 |
| Invitation Writer | Implemented, fills the editor, never sends | — | — | P2 OK |
| Timeline | Implemented, prep tasks → checklist | View/copy only (no storage) — acceptable | — | P2 OK |
| Shopping List | Implemented, deterministic merge | Result invisible after adding (same root cause) | Shopping list view | P2 |
| Discover explanations | Implemented, supplied candidates only | Fine | — | P2 OK |

## Security / cost findings

| # | Finding | Severity | Fix |
|---|---|---|---|
| S1 | **Usage-limit bypass:** `ai_finalize` was executable by `authenticated`. A user can read their own pending row id (owner SELECT) while the provider call runs and finalize it as `failed`/`rejected`; the server's own finalize then no-ops, the response still returns the plan, and the generation never counts. Unlimited generations. | **Blocker** | Migration 0900: finalize is service-role only and must name the owner; server finalizes with the service role; AI fails closed without it |
| S2 | Per-user hourly cap counted only `pending`/`success`. Start-then-cancel (or prompts that force invalid output) burn provider tokens without counting. Global breaker had the same gap. | Important | User caps and global breaker count `failed` too (per-party cap still doesn't — parents aren't charged for our failures) |
| S3 | No per-user daily cap: Free users get 3 per *party* and can create parties freely → up to 10/h, 240/day each. | Important | `AI_USER_DAILY_LIMIT` (default 30 / rolling 24 h, all parties) |
| S4 | No request-size limit (`req.json()` buffers anything). | Important | Streamed 16 KB cap on every AI route incl. apply |
| S5 | Undo could run twice (second undo restored stale theme/budget values over later edits). | Polish | Undo only if the latest entry for that item is an apply |
| S6 | Post-processing exceptions left generations `pending` for 10 min. | Polish | Finalize as failed |
| S7 | Failed generations didn't record tokens (cost blind spot). | Polish | Tokens kept on failures |

Verified fine (no change): key only in `lib/ai/config.ts` (server-only) and the Authorization header; client bundle scan;
identity from the bearer token (`getAuthedRequest`); plan from `getUserPlan` (service role, trusted) with trial = Free and Super
Admin from the user's own `user_roles` row (no self-insert policy); ownership via RLS on every read/write; apply reads items
from the stored generation, never from the client; AI output is plain text (HTML/URLs stripped, rendered as React text,
colours regex-checked); prompts delimit parent text; `reasoning_content` discarded; logs carry no prompts/keys.

## Migration 0800
Additive, idempotent, RLS on all four tables, no existing table/function changed. One defect (S1) — fixed in a new
migration 0900 rather than by editing 0800 (0800 may already exist in some environment; both are unapplied in production).
