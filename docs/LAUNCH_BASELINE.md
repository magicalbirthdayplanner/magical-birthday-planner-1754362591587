# Magical Birthday Planner — Launch Baseline

**Status: PRODUCTION / FROZEN — v1.0**

This repository represents the production launch baseline. New feature development should not modify this baseline
without creating a new branch.

| | |
|---|---|
| Date | 2026-10-04 |
| Production URL | <https://magicalbirthdayplanner.app> (`www` → 308 to apex) |
| Application code baseline | commit `7da40bb` — "fix(billing): no account-wide fallback — unresolved payments unlock nothing" |
| Vercel deployment of that code | `dpl_53oRVpqVyfvi4rmZ1RV2HBQqwJyQ` (target production, READY, 2026-10-04 18:31 UTC) |
| Git tag | `v1.0.0` → the documentation commit on top of `7da40bb` (application code identical; only `README.md`, `CHANGELOG.md`, `docs/**` and comments in `.env.example` differ). Pushing it to `master` triggers a docs-only production redeploy. |
| Repository | `github.com/magicalbirthdayplanner/magical-birthday-planner-1754362591587` — **PRIVATE** |
| Production branch | `master` |
| Rollback reference | Previous production deployments: `dpl_FkrZtotWuoSfc7WUg57aJNK3FsFx` (`bf7d343`, before per-party billing), `dpl_3JziktLVhM5RmvYUf2nCH692py9N` (`0a34b65`, product model). Migrations are additive; see each file's header before rolling back code. |

## Architecture (one paragraph)

Next.js 15 App Router (React 19, TypeScript) on Vercel; Supabase (Postgres + PostGIS, RLS, Auth) as the database and
identity provider; Google Places (New) / Maps JS for venues; Dodo Payments (live) for per-party one-time plans;
Resend for transactional email; an OpenAI-compatible AI provider (OpenCode Go, `deepseek-v4-pro`) behind one server
pipeline (`lib/ai/handler.ts`); Sentry for errors, tracing, logs, metrics, AI monitoring, uptime and alerts. The browser
holds only public keys and the user's JWT; every paid capability is decided on the server.

## Major integrations

Supabase · Google Places/Maps/Geocoding · Dodo Payments (live mode) · Resend · OpenCode (AI) · Sentry · Vercel ·
GitHub (private) · Cloudflare (DNS only). Details: [README § External integrations](../README.md#external-integrations).

## Pricing model (as implemented)

Plans are priced and enforced **per party** (`lib/entitlements.ts`, migration `20251004001400`).

| Plan | Price | Adds |
|---|---|---|
| Free | $0 | Parties, venue discovery + map, saved venues, checklist, curated themes, party plan, own activities |
| Starter | $4.99 per party | Guests & RSVP, Plan My Party, AI Theme Ideas, AI Checklist, Activity Studio — 10 AI requests/party |
| Plus | $9.99 per party | Food Planner, Budget Assistant, Invitation Writer, Timeline, Shopping List — 25 AI requests/party |
| Pro | $14.99 per party | Party Host (welcome, activity intros, cake, closing, thank-yous, reminders), Party Experience — 50/party |

Account-wide by design: admin overrides and the 24 h sign-up trial (guests & RSVP only, no AI).
Dodo live products (one-time, USD): Starter `pdt_Jw4ObhU8ojSaq87wELhsm` 499, Plus `pdt_rSGRT2hBbKsoln84yQgHC` 999,
Pro `pdt_v3NFp5Zq587xbPoPLd29x` 1499 (product ids are not secrets).

> **Superseded 2026-10-06:** prices are now Starter $9.99 / Plus $19.99 / Pro $29.99 per party; the same Dodo
> products were re-priced in place (999 / 1999 / 2999). The table above records the v1.0 baseline. See CHANGELOG.md.

## AI feature matrix (production)

| Feature id | Name | Plan | `AI_ENABLED_FEATURES` |
|---|---|---|---|
| `party_planner` | Plan My Party | Starter | on |
| `theme_ideas` | AI Theme Ideas | Starter | on |
| `checklist` | AI Checklist | Starter | on |
| `activity_studio` | Activity Studio | Starter | on |
| `food` | Food Planner | Plus | on |
| `budget_optimizer` | Budget Assistant | Plus | on |
| `invitation` | Invitation Writer | Plus | on |
| `timeline` | Timeline | Plus | on |
| `shopping_list` | Shopping List | Plus | on |
| `host_content` | Party Host | Pro | on |
| `party_experience` | Party Experience | Pro | on |
| `activities` | Activity list (legacy) | Starter | off — not sold |
| `discover_explain` | "Why these places" | Plus | off — not sold |

Production AI config (non-secret): `AI_PROVIDER=opencode`, `AI_MODEL=deepseek-v4-pro`, `AI_THINKING=off`,
`AI_TIMEOUT_MS=45000`, long timeout 55 s (default), `AI_MAX_OUTPUT_TOKENS=3000`, `AI_MAX_RETRIES=1`,
`AI_USER_DAILY_LIMIT=10`, `AI_GLOBAL_DAILY_LIMIT=50`, per-user hourly cap 10 (code), per party 10/25/50 (code).

## Database migration state

All 15 migrations in `supabase/migrations/` are applied in production (`supabase db push --dry-run` reports
"Remote database is up to date"); `20251001000000_baseline_existing_schema.sql` is a local/CI reconstruction recorded
as applied. Latest: `20251004001400_per_party_purchases.sql`.

At the baseline: 0 purchases, 0 unresolved payments, 1 real account (the owner, Super Admin) — no real customer data.

## Observability

Sentry (org `magical-birthday-planner`, project `javascript-nextjs`): errors, tracing, logs, metrics, AI spans,
billing/auth/Google telemetry, 12 alert monitors, uptime on `/api/health`. No error events after the baseline deploy.
See [OBSERVABILITY.md](OBSERVABILITY.md).

## Test status (on `7da40bb`, re-verified on the documentation commit)

| Check | Result |
|---|---|
| Lint, typecheck, production build | pass |
| Unit + integration (Vitest, local Supabase) | 532/532 |
| E2E (Playwright, phone viewports, mocked Google/Resend/Dodo) | 57/57 |
| Client-bundle secret scan | clean |
| Git-history secret scan | 30 historical findings (2025 commits), 0 at HEAD; none of the credentials in current use |
| Production smoke (2026-10-04, temporary accounts, deleted afterwards) | public pages 200; pricing copy; per-party checkout opens Dodo live on the right product (no payment made); A = Starter / B = Free isolation for AI, guests and plan display; 409 `already_owned`; unsigned webhook 401; admin 404 for non-admins; `unresolvedPayments: 0`; Sentry clean |

## Known non-blocking issues

See [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md). Highlights: no real live payment has gone through the webhook yet
(watch the first one); AI latency 15–55 s; Budget Assistant reasoning needs human review; RSVP email-matching
trade-off; Google sign-in screen shows the Supabase project domain; historical secrets in early Git history should be
rotated; homepage "Try Demo" button goes to the same wizard as "Get Started".

## Future development policy

- `master` = production. It is **frozen** at this baseline until there are real users and real payment data.
- All work starts on a branch (`feat/…`, `fix/…`, `improvement/…`), runs the full suite (`npm run check`,
  `npm run test:integration`, `npm run test:e2e`), and is reviewed for impact on entitlements, billing, AI and
  security before a fast-forward merge. Migrations go to production **before** the code that needs them.
- Never force-push, rewrite history, reset the production database or make the repository public.
