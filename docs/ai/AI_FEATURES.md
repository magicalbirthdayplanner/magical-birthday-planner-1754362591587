# AI planning assistant — features and architecture

Current as of 2026-10-04 (`master` after migration `20251004001200`). Source of truth: `lib/ai/*`,
`app/api/ai/*`, `supabase/migrations/20251003000800…`, `…0900…`, `…1000…`, `…1200…`.
Design history: [DECISIONS.md](DECISIONS.md), [AI_PRODUCTION_READINESS_REPORT.md](AI_PRODUCTION_READINESS_REPORT.md),
[../experience/README.md](../experience/README.md).

MBP uses AI as a **planning assistant**, not a chatbot. Each feature takes the party's real context, asks the
model for a **structured JSON result** validated against a schema, post-processes it on the server, stores it,
and shows it as items the parent can **review and add** to the party. Nothing changes the party until the parent
taps *Add / Use / Save*.

## Status

| Feature id | Name | Status | Min plan | Route | UI |
|---|---|---|---|---|---|
| `party_planner` | Plan My Party | **LIVE** | Free | `/api/ai/party-planner` | `components/ai/PlanWithAICard.tsx` (Home, Plan) |
| `theme_ideas` | AI Theme Ideas | **LIVE** | Free | `/api/ai/theme-ideas` | `components/ai/ThemeIdeasSection.tsx` (Plan → Theme) |
| `checklist` | AI Checklist ("What am I forgetting?") | **LIVE** | Starter | `/api/ai/checklist` | `components/ai/ChecklistAIButton.tsx` (Plan → Checklist) |
| `activity_studio` | Activity Studio | **LIVE** | Plus | `/api/ai/activity` | `components/activities/ActivityCreatorSheet.tsx`, `ActivityDetailSheet.tsx` |
| `host_content` | Party Host | **LIVE** | Starter | `/api/ai/host` | `components/experience/HostStudioSheet.tsx` (Plan → Party Magic, activity intros) |
| `party_experience` | Party Experience | **LIVE** | Plus | `/api/ai/party-experience` | `components/experience/ExperienceSheet.tsx` (Plan → Party Magic) |
| `budget_optimizer` | Budget assistant | IMPLEMENTED, DISABLED | Pro | `/api/ai/budget` | hidden |
| `activities` | Activity planner (list) | IMPLEMENTED, DISABLED | Plus | `/api/ai/activities` | hidden (superseded by Activity Studio) |
| `food` | Food planner | IMPLEMENTED, DISABLED | Pro | `/api/ai/food` | hidden |
| `invitation` | Invitation writer | IMPLEMENTED, DISABLED | Starter | `/api/ai/invitation` | hidden |
| `timeline` | Party-day timeline | IMPLEMENTED, DISABLED | Starter | `/api/ai/timeline` | hidden |
| `shopping_list` | Shopping list | IMPLEMENTED, DISABLED | Plus | `/api/ai/shopping-list` | hidden |
| `discover_explain` | "Why these places might work" | IMPLEMENTED, DISABLED | Plus | `/api/ai/discover-explain` | hidden |

LIVE = listed in production `AI_ENABLED_FEATURES` (with `AI_ENABLED=true`, and `NEXT_PUBLIC_EXPERIENCE_ENABLED=true`
for the Party Experience surfaces). A disabled feature returns `503 ai_disabled` **before** any reservation or model
call, so it cannot spend credits (covered by tests).

Plan gating lives in one place: `lib/ai/capabilities.ts` (`FEATURE_MIN_TIER`, `PARTY_CAP`). A sign-up trial counts
as **Free** for AI. Super Admins bypass plan gates and per-party/user caps (not the global breaker).

## Shared behaviour (all features)

| Concern | Behaviour |
|---|---|
| Authentication | `Authorization: Bearer <Supabase JWT>`; missing/invalid → `401 unauthenticated` |
| Input | zod schema, `.strict()` (unknown fields → `400`), body streamed with a 16 KB cap, free text sanitised and capped at 1,500 chars |
| Ownership | the party is read with the **user's RLS session**; someone else's or a deleted party → `404 not_found` |
| Context | `lib/ai/context.ts` `buildPartyAIContext` (see below) |
| Reservation | server-only `ai_reserve(p_user, …)` via the service role; enforces the global daily breaker atomically |
| Caps | rank-after-reserve (race-safe): per party (Free 3 · Starter 10 · Plus 25 · Pro 50), per user 10/hour and `AI_USER_DAILY_LIMIT`/24 h (10 in production) |
| Model call | `lib/ai/client.ts`: timeout 45 s (55 s for "long" features), JSON repair, **at most one retry** and only for invalid/truncated/leaking output (never for timeouts or 5xx) |
| Validation | zod result schema; prompt-leak check; URLs/HTML/franchise names stripped (`lib/ai/safety.ts`) |
| Post-processing | server recomputes ids, totals, dates and durations — model arithmetic is never trusted |
| Persistence | `ai_generations` row: status, provider, model, tokens, duration, error code, validated result |
| Reopening | the UI restores the last stored result (read via RLS) — **no new generation** |
| Apply | `POST /api/ai/apply` replays an item from the stored result (never from the client) into party tables via RLS; dedupe by unique keys; per-item undo |
| Errors | `401` unauthenticated · `400` invalid_input · `403` forbidden_plan (+`upgradeTo`) · `404` not_found · `429` limit_reached · `503` ai_disabled / high_demand · `504` timeout · `502` provider_error / invalid_response — friendly copy, party data untouched |
| Failure accounting | failed (incl. timeout, cancelled) generations count toward hourly/daily/global limits but **not** the per-party allowance; rejected (over-cap) requests count toward nothing |
| Telemetry | Sentry: `gen_ai.chat` span per call, `AI_REQUEST_*` events, `ai.limit.*`, `ai.reserve.unauthorized` (see [../OBSERVABILITY.md](../OBSERVABILITY.md)); no prompts or outputs |

### Party context sent to the model

`PartyAIContext` (aggregates only): child age and interests, party date and days until it, city/state, guest
estimate (planned count, or confirmed RSVPs when higher), RSVP aggregates (kids, adults, awaiting, dietary notes
typed by guests), start time and duration, budget, venue name/type/booked, theme, indoor/outdoor, food preferences,
existing activities, timeline, menu, checklist titles, budget lines and shopping items, and the AI tier.

Not sent: emails, phone numbers, ZIP, exact location, guest names, the child's name ("the birthday child") —
**except** Party Host, which may use the child's first name, confirmed guests' first names and the venue for
speeches and thank-you messages (`includeInvitationFields`). Parent notes are wrapped as data, not instructions.

## Feature details

### 1. Plan My Party — `party_planner` (LIVE, Free)
- **Does:** a complete party plan from the party facts and optional notes.
- **UI:** "Plan My Party" card on Home and Plan; optional "Details" text; progress copy (15–40 s).
- **Generates:** summary, concept, theme (name, why, palette), 3–5 activities (materials, difficulty, timing),
  food, budget lines with a server-recomputed total and over-budget amount, a 30-item-style shopping list, a timeline,
  decorations, backup plan, assumptions, follow-up questions.
- **Parent can:** "Use this theme", add activities / shopping items / budget lines one by one or "Add all".
- **Applies to:** `parties.theme`, `party_ai_activities`, `party_shopping_items`, `party_budget_lines`.
- **Reopen:** restores the last plan; "Make a new plan" uses a generation.
- **Limits/timeout:** shared caps; long feature (55 s), up to 3,000 output tokens.
- **Code/tests:** `lib/ai/features/partyPlanner.ts`, `lib/ai/prompts/partyPlanner.ts`;
  `tests/integration/ai-planner.test.ts`, `ai-quality.test.ts`, `ai-usage*.test.ts`, `tests/e2e/ai.spec.ts`.

### 2. AI Theme Ideas — `theme_ideas` (LIVE, Free)
- **Does:** five original themes from the child's interests and the parent's likes/dislikes.
- **UI:** Plan → Theme → "Dream up themes with AI" (alongside the curated catalogue).
- **Generates:** name, emoji, description, why it fits, palette, decorations, activities, food idea, invitation idea.
- **Parent can:** "Use this theme" (stored as an AI theme on the party) or dismiss.
- **Applies to:** `parties.theme` / `theme_details`; the theme then appears on Plan, Activities and the invitation.
- **Limits/timeout:** long (55 s), 3,000 tokens. **Code/tests:** `lib/ai/features/themeIdeas.ts`; `tests/integration/ai-features.test.ts`, `tests/unit/ai-themes.test.ts`.

### 3. AI Checklist — `checklist` (LIVE, Starter)
- **Does:** "What am I forgetting?" — missing tasks given days until the party, venue status and existing tasks.
- **UI:** Plan → Checklist; Free/trial users see an upgrade prompt.
- **Generates:** tasks with title, detail, category and a server-computed due date (never after the party).
- **Applies to:** `checklist_items` (deduped by task key). Timeout 45 s, 1,500 tokens.
- **Code/tests:** `lib/ai/features/checklist.ts`; `tests/integration/ai-features.test.ts`.

### 4. Activity Studio — `activity_studio` (LIVE, Plus)
- **Does:** creates one detailed activity from the parent's words, or revises an existing one (cheaper, easier,
  shorter/longer, indoor/outdoor, less messy, younger/older, more guests, theme, free text). The target activity is
  checked server-side (`precheck`).
- **Generates:** name, description, duration, materials scaled to guests, cost estimate, difficulty, setting,
  prep, instructions, host script, safety notes, variations, backup.
- **Applies to:** `party_ai_activities` (new or updated), with optional prep tasks (`checklist_items`), supplies
  (`party_shopping_items`), cost (`party_budget_lines`) and a timeline slot (`party_timeline_items`).
- Timeout 45 s, 1,800 tokens. **Code/tests:** `lib/ai/features/activityStudio.ts`; `tests/integration/experience.test.ts`, `tests/e2e/experience.spec.ts`.

### 5. Party Host — `host_content` (LIVE, Starter)
- **Does:** what to say: welcome speech, activity intro, cake announcement, closing speech, reminder message,
  thank-you to all families or per confirmed guest; tones warm / playful / short and sweet / excited.
- **Context:** standard context plus the child's first name, venue and (for per-guest thank-yous) confirmed
  guests' first names.
- **Applies to:** `party_host_content` (saved drafts). Timeout 45 s, 1,400 tokens.
- **Code/tests:** `lib/ai/features/hostContent.ts`, `lib/ai/prompts/experience.ts`; `tests/integration/experience.test.ts`.

### 6. Party Experience — `party_experience` (LIVE, Plus)
- **Does:** the multi-section plan: theme, activities, timeline, food, shopping, host lines, checklist, budget —
  each section applied independently.
- **Applies to:** `parties.theme`, `party_ai_activities`, `party_timeline_items`, `party_food_items`,
  `party_shopping_items`, `party_host_content`, `checklist_items`, `party_budget_lines`.
- Long (55 s), up to 4,000 output tokens (per-feature override of the env default).
- **Code/tests:** `lib/ai/features/partyExperience.ts`; `tests/integration/experience.test.ts`, `tests/e2e/experience.spec.ts`.

## Usage accounting and security

- `ai_generations` is the usage ledger. Users can **read** their own rows (RLS) but cannot insert, update or delete.
- `ai_reserve` and `ai_finalize` are **service-role only**; the server passes the user it authenticated.
  `ai_global_count_today` is service-role only.
- `party_id` and `user_id` use `ON DELETE SET NULL`: deleting a party or account **never** reduces usage. A trigger
  strips `result`, `input_summary` and `applied` from detached rows, keeping only accounting fields.
- Stale `pending` rows are failed after 10 minutes (crash safety).
- Attack-level tests: `tests/integration/ai-usage-security.test.ts` (direct RPC, global DoS, party/account
  deletion, party hopping, account cycling, concurrency, forged/foreign/deleted ids, telemetry, all LIVE features).

## Production configuration (names only — values live in Vercel)

`AI_ENABLED`, `AI_ENABLED_FEATURES`, `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY` (server-only), `AI_BASE_URL`,
`AI_THINKING` (off), `AI_TIMEOUT_MS` (45000), `AI_LONG_TIMEOUT_MS` (default 55000), `AI_MAX_RETRIES` (1),
`AI_MAX_OUTPUT_TOKENS` (3000 default; features may set their own), `AI_USER_DAILY_LIMIT` (10),
`AI_GLOBAL_DAILY_LIMIT` (50), `NEXT_PUBLIC_EXPERIENCE_ENABLED`.

## Known limitations

- Latency: typical successful calls take 15–35 s; long features can approach the 55 s budget.
- Global capacity: 50 generations/day across all users (sized to the provider budget); when reached, users see
  "very busy" until UTC midnight and Sentry raises `ai-global-limit`.
- The AI summary can describe a plan as "within budget" while the server-computed total is over; the numbers shown
  are always the server's.
- A new account starts with fresh per-user limits (no device tracking by design); the global breaker still applies.
