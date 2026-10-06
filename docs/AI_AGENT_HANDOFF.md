# AI agent handoff — Magical Birthday Planner

For a future Claude Code / Codex / Cursor agent picking this repository up cold. Read this file, then
[README.md](../README.md) and [LAUNCH_BASELINE.md](LAUNCH_BASELINE.md). Everything here describes the **v1.0 production
baseline** (2026-10-04); verify against the code before acting — the code and `supabase/migrations/` win over docs.

## 1. Product purpose
A mobile-first web app (installable PWA) for busy parents planning a child's birthday party: create a party in a short
wizard, discover real local venues (Google Places), plan theme/activities/checklist/budget/food/timeline, manage guests,
invitations and RSVPs, and use an AI assistant that works inside the party's real data and returns structured,
reviewable suggestions.

## 2. Current production status
Live at <https://magicalbirthdayplanner.app>, `master` = production (Vercel). Dodo payments in **live mode**. At the
baseline: one real account (the owner, Super Admin), **0 purchases**, no real customer data. The code is **frozen**
until there are real users and real payment data.

## 3. Architecture
```
Browser (PWA, Supabase JS with anon key + user JWT)
  ├─ reads/writes own data directly through Supabase (RLS)
  └─ calls Next.js route handlers /api/* with Authorization: Bearer <JWT>
Vercel: Next.js 15 App Router (server components + route handlers; server-only modules for secrets)
  ├─ Supabase (Postgres/PostGIS, RLS, security-definer RPCs; service role only where required)
  ├─ Google Places (New) + Geocoding (server key) · Maps JS in the browser (restricted key)
  ├─ AI provider (OpenAI-compatible, OpenCode Go, deepseek-v4-pro) via lib/ai
  ├─ Dodo Payments (checkout create; signed webhooks → /api/webhooks/dodo)
  ├─ Resend (invitation + RSVP emails)
  └─ Sentry (errors, tracing, logs, metrics, uptime, alerts)
```
Route groups: `app/(site)` public pages · `app/(flow)` full-screen flows (wizard, auth, venue, public RSVP) ·
`app/(app)` signed-in app with bottom nav · `app/api` handlers. See README § Repository structure.

## 4. Tech stack
Next.js 15.5.27, React 19.3.0, TypeScript 5.5.4, Tailwind 3.4 + Radix + lucide-react, Nunito, Supabase JS 2.x, SWR,
zod, `openai` SDK (OpenAI-compatible), `@vis.gl/react-google-maps`, Resend, `@sentry/nextjs` 11.4, Vitest 3.2,
Playwright 1.55, Node 22.

## 5. Pricing model (as implemented — per party)
`lib/entitlements.ts` is the single source of truth (plans, capability → minimum plan, prices).
Free $0 · Starter **$9.99 per party** · Plus **$19.99 per party** · Pro **$29.99 per party**; non-recurring Dodo products,
no subscriptions. Each purchase unlocks its plan for **one party** (`billing_purchases.party_id`, `scope='party'`).
Account-wide by design: admin overrides (`plan_overrides`) and the 24 h sign-up trial (guests & RSVP only, never AI).
Legacy account-scope purchases are still honoured in code; production has none and the DB forbids new ones.

## 6. AI features (13 ids, 11 sold and enabled)
Starter: `party_planner`, `theme_ideas`, `checklist`, `activity_studio` · Plus: `food`, `budget_optimizer`,
`invitation`, `timeline`, `shopping_list` · Pro: `host_content` (welcome, activity_intro, cake, closing,
thank_you_all, thank_you_guest, reminder), `party_experience` · not sold/disabled: `activities` (legacy),
`discover_explain`. One pipeline: `createAIRoute()` in `lib/ai/handler.ts` → auth → zod body → party ownership →
flag → **party plan** (`getPartyPlan` → `tierFor` → `planAllows`) → server-only reservation (`ai_reserve`) + rank caps
(per party 10/25/50, per user 10/h and `AI_USER_DAILY_LIMIT`/24 h, global `AI_GLOBAL_DAILY_LIMIT`/UTC day) → context
(`lib/ai/context.ts`) → `callStructured` (timeout, 1 repair retry, schema validation) → post-processing → `ai_finalize`
→ Sentry. Results persist in `ai_generations`; `/api/ai/apply` copies chosen items into party tables. Full docs:
[ai/AI_FEATURES.md](ai/AI_FEATURES.md).

## 7. Integrations
Supabase, Google (Places/Maps/Geocoding), Dodo Payments, Resend, OpenCode, Sentry, Vercel, GitHub (private),
Cloudflare DNS. See README § External integrations and [INTEGRATIONS.md](INTEGRATIONS.md).

## 8. Authentication
Supabase Auth (email/password with confirmation, password reset, Google OAuth via `/auth/callback`). API routes call
`getAuthedRequest()` (`lib/server/auth.ts`) and query **as the user**. Signed-in pages redirect to `/login?next=…`
without a session (`components/app/AppShell.tsx`). Super Admin = `user_roles.role = 'super_admin'`, checked server-side
(`lib/server/admin.ts`); `/api/admin/*` returns 404 to everyone else.

## 9. Database
Supabase Postgres + PostGIS. **`supabase/migrations/` is the schema source of truth** (15 files, all applied in
production; latest `20251004001400_per_party_purchases.sql`). Types: `lib/db/database.types.ts`
(`npm run db:types` from the local stack). Core tables: `users`, `parties`, `guests`, `party_invitations`,
`checklist_items`, `saved_venues`, `party_venues`, plan-section tables (`party_ai_activities`, `party_timeline_items`,
`party_food_items`, `party_shopping_items`, `party_budget_lines`, `party_host_content`), `ai_generations`, billing
(`billing_checkouts`, `billing_purchases`, `billing_customers`, `billing_webhook_events`), `plan_overrides`,
`user_roles`, `admin_audit_log`, `email_logs`, `analytics_events`, venue cache (`venues`, `venue_searches`,
`venue_search_results`). Migrations are additive and re-runnable; apply them **before** the code that needs them.

## 10. Entitlements (where they are enforced)
| Capability | Enforcement |
|---|---|
| AI features | `lib/ai/handler.ts` (`planAllows` on the **party's** plan) and `/api/ai/capabilities` (display) |
| Guests & invitations writes | RLS policies with `public.has_paid_access(party_id)` (migration `20251004001400`) |
| Emailing invitations | `/api/invitations/send` (`has_paid_access(p_party)`) |
| Checkout | `/api/billing/checkout {plan, partyId}`: own party only; `409 already_owned` |
| Purchases → party | `lib/billing/server.ts` `processWebhookEvent` + `resolveParty` (verified checkout association only); DB trigger `billing_purchases_scope_guard` |
| Unmatched payments | unlock nothing; `PAYMENT_UNRESOLVED` (Sentry), Super Admin stats; fix with `reconcile_purchase(purchase, party)` (service role) |
| UI | `components/billing/usePlanStatus.ts` (display only, party-aware), `UpgradePrompt` |
Plan resolution: `getUserPlan` (account level: override → legacy account purchase → trial → FREE) and `getPartyPlan`
(override → party purchase → legacy → trial → FREE). `lib/entitlements.ts` maps a plan state to capabilities.

## 11. Observability
Sentry only. Wrappers: `lib/observability/telemetry.ts` (`track`, `timing`, `reportError`, `withSpan`) and domain
modules (`ai.ts`, `billing.ts`, `auth.ts`, `google.ts`); privacy scrubbing in `privacy.ts`. Metrics/events and the 12
alert monitors: [OBSERVABILITY.md](OBSERVABILITY.md). Health: `GET /api/health`.

## 12. Testing
`npm run check` (lint, typecheck, unit, build, client secret scan) · `npm run test:integration` (needs
`npm run db:start` — local Supabase in Docker) · `npm run test:e2e` (Playwright builds `.next-e2e` with `.env.e2e`,
serves on :3101 and starts the mock Google/Resend/Dodo server on :4010; free port 3101 first) · opt-in live AI:
`AI_LIVE=1 npx vitest run -c vitest.live.config.ts` (costs money). Baseline: unit+integration 532/532, E2E 57/57.

## 13. Deployment
Branch → tests → fast-forward `master` → push → Vercel production build → READY → smoke test. Migrations:
`supabase db push --dry-run` then `supabase db push --db-url <session pooler URL>` **before** the code. Rollback:
promote the previous Vercel deployment (see [LAUNCH_BASELINE.md](LAUNCH_BASELINE.md)). Runbook: [RELEASE.md](RELEASE.md).

## 14. Important environment variables (names only)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_BASE_URL`,
`GOOGLE_PLACES_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`,
`DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_SECRET`, `DODO_PAYMENTS_ENVIRONMENT`, `DODO_LIVE_PAYMENTS_ENABLED`,
`DODO_PRODUCT_{STARTER,PLUS,PRO}`, `AI_ENABLED`, `AI_ENABLED_FEATURES`, `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`,
`AI_USER_DAILY_LIMIT`, `AI_GLOBAL_DAILY_LIMIT`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_SENTRY_DSN`,
`SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_EXPERIENCE_ENABLED`. Full list: [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md).

## 15. Security rules (do not break)
- Never commit secrets or `.env*` files (only `.env.example` and the demo-only `.env.e2e`); never print secret values.
- Never put a secret in a `NEXT_PUBLIC_*` variable; server code that touches secrets imports `server-only`.
- The browser never decides entitlements; every paid capability is checked on the server per party.
- Keep RLS on every user table; party-owned data goes through `owns_party()`.
- AI usage reservation/finalization stay service-role-only; usage must survive party/account deletion.
- Billing: product and price chosen by the server; webhooks verified; purchases strictly party-scoped; never infer a
  party from "latest/active/only party"; unmatched payments unlock nothing.
- Admin endpoints return 404 to non-admins; overrides are audited.
- Keep the GitHub repository **private**; never force-push or rewrite history; never reset the production database.

## 16. Known limitations
See [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) (no blocking items at the baseline).

## 17. Current production baseline
Application code `7da40bb`, deployment `dpl_53oRVpqVyfvi4rmZ1RV2HBQqwJyQ`, tag `v1.0.0` (documentation commit on top,
same code). Details: [LAUNCH_BASELINE.md](LAUNCH_BASELINE.md).

## 18. Rules for making future changes
**Do not make production changes directly from the master branch. Create a feature branch, run the full test suite,
review the impact on entitlements/billing/AI/security, and only then merge.**

Also:
- One concern per branch (`feat/…`, `fix/…`, `improvement/…`); keep `master` = production.
- New capability → add it to `lib/entitlements.ts` first, enforce it on the server, then the UI; add tests that call
  the API/RLS directly, not only the UI.
- Schema change → a **new** migration (never edit an applied one), additive and re-runnable, applied to production
  before the code; regenerate `lib/db/database.types.ts`.
- Billing change → integration tests in `tests/integration/billing.test.ts` for every failure case; never weaken the
  per-party invariant.
- AI change → keep the pipeline in `createAIRoute`; mock-provider tests + an opt-in live check; mind the global budget.
- Before pushing `master`: lint, typecheck, build, unit + integration, E2E, `check:secrets`; after deploy: smoke test
  with temporary accounts and delete them.
