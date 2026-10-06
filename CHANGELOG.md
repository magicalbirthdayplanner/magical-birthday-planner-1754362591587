# Changelog

Major milestones, newest first. Dates and commits are from Git history (`git log`). Configuration-only changes
(no commit) are marked as such.

## Unreleased — per-party price update (branch `feat/update-per-party-pricing`)

- **New prices, still per party:** Starter $4.99 → **$9.99**, Plus $9.99 → **$19.99**, Pro $14.99 → **$29.99**; Free
  stays $0. Plan names, features, AI allowances, trial and per-party billing rules are unchanged.
- Prices live in `lib/entitlements.ts` (`PLAN_INFO.priceCents`), which feeds the pricing page, homepage plans, upgrade
  prompts, checkout buttons and the webhook price-integrity check; Terms updated to match.
- Dodo: the existing live and sandbox products were re-priced in place on 2026-10-06 (same product ids, so no
  environment change). `npm run check:dodo-prices` verifies a Dodo environment against `/pricing` (read-only).
- Payments at the old prices are held for review (never granted), so a product left at an old price cannot
  undercharge.

## v1.0.0 — Launch baseline (2026-10-04)

Production at <https://magicalbirthdayplanner.app>; application code `7da40bb`, tag `v1.0.0`; **frozen** — see
[docs/LAUNCH_BASELINE.md](docs/LAUNCH_BASELINE.md). Everything below is live:

- **Four-plan model, priced per party:** Free $0 · Starter $4.99 · Plus $9.99 · Pro $14.99 (one-time Dodo products,
  no subscriptions); each purchase unlocks one party; admin overrides and the 24 h sign-up trial (guests & RSVP, no AI)
  stay account-wide. Server-side enforcement for AI, guests/invitations (RLS) and checkout.
- **AI feature expansion:** 11 sold AI features enabled in production — Starter: Plan My Party, Theme Ideas, AI
  Checklist, Activity Studio · Plus: Food Planner, Budget Assistant, Invitation Writer, Timeline, Shopping List · Pro:
  Party Host (welcome, activity intros, cake, closing, thank-yous, reminders), Party Experience. Per-party allowances
  10 / 25 / 50; server-only usage accounting.
- **RSVP protection:** one invitee = one guest row; idempotent changes, retries and double-taps; notifications once per
  real change; shared-device "RSVP for someone else"; name pre-filled when changing a reply.
- **Dodo live billing:** live products, verified webhooks, strictly party-scoped purchases (DB guard), unmatched
  payments unlock nothing and are flagged for reconciliation.
- **Sentry observability:** errors, tracing, logs, metrics, AI monitoring, billing/auth/Google telemetry, 12 alert
  monitors, uptime on `/api/health`.
- **Security:** RLS on all user tables, AI usage hardening, admin isolation, client-bundle and history secret scans.
- **Launch polish:** `/help`, privacy processor disclosures, Terms (governing law India), Open Graph image.
- **Documentation & backup:** README rewrite, launch baseline, AI-agent handoff, known limitations, roadmap, design
  system, environment variables, 42 product screenshots (`docs/screenshots/`).

## 2026-10-04

- **Per-party billing** — `f440653`, `7da40bb`. Migration `20251004001400_per_party_purchases`; checkout per party;
  no account-wide fallback for unmatched payments; `reconcile_purchase()`. Deployed (`dpl_53oRVpqVyfvi4rmZ1RV2HBQqwJyQ`).
- **Launch polish** — `02659a0`, `bf7d343`: help page, privacy/terms, social preview image, RSVP name pre-fill,
  governing law India.
- **Product model: Free · Starter · Plus · Pro** — `0a34b65` (deployed 2026-10-04 13:53 UTC). One source of
  truth `lib/entitlements.ts`; AI gating re-mapped (Free has no AI; trial = Starter's guest & RSVP features without
  AI); guests & RSVP enforced in the database (migration `20251004001300_plan_entitlements`, `has_paid_access()`);
  new pricing page / homepage plans / upgrade prompts / nav lock; funnel analytics events; food-planner text fix,
  clock times in the AI timeline, "Refresh with your new party details". See docs/PRODUCT_MODEL_AUDIT.md.
- **AI usage security hardening** — `1f96a8b`. Migration `20251004001200_ai_usage_hardening`: `ai_reserve` is
  server-only (service role) with the global daily breaker enforced atomically inside the reservation;
  `ai_global_count_today` server-only; `ai_generations` keeps usage when a party or account is deleted
  (`ON DELETE SET NULL` + content-scrubbing trigger). New Sentry events `ai.limit.*`, `ai.reserve.unauthorized`.
  Attack-reproduction suite `tests/integration/ai-usage-security.test.ts`. Deployed and re-tested in production.

## 2026-10-03

- **RSVP idempotency** — `f3027f0`, `b2ddf67`. Migration `20251004001100_rsvp_idempotency`: hashed per-device
  respondent key, exact email match within the party, per-party serialization, notifications only on real changes;
  "You already replied as…" and "RSVP for someone else" on the RSVP page. Deployed and verified in production.
- **Trial → paid conversion fix** — `f3027f0`. Trial users see and can buy every plan; a purchase replaces the trial
  in the UI as on the server; visible Starter button.
- **Sentry observability** — `1d4e90a`. Errors, request errors, tracing, structured logs and metrics (AI, billing,
  auth, Google, DB), privacy scrubbing, source maps uploaded and removed from the output; monitors and uptime
  configured in Sentry.
- **Live payments** (configuration, no commit): Dodo switched to live mode with live products.
- **Billing fix** — `613fcf0`. Sandbox Dodo customer ids are never sent to live mode.
- **Brand icon** — `4d24837`. Party-hat MBP icon across favicon, PWA, Apple and in-app logo.
- **Party Experience layer** — `8ecc1e3`, `9cfcfbb`, `e7abd03`, `2878f36` (+ fixes). Activities tab, Party Magic,
  Activity Studio, Party Host content, Party Experience generator, single party-day timeline, menu; migration
  `20251004001000_party_experience`. Launch log `102d012`.
- **AI planning assistant** — `0e06637` … `78d24f1`. Provider abstraction, party context engine, Plan My Party,
  contextual suggestions, apply-to-party, usage controls, checklist / budget / activities / food / invitation /
  timeline / shopping / discovery explanations (several kept disabled), hardening (`7f10824`; migrations `…0800`,
  `…0900`), reasoning off for structured output (`67755d9`), production launch log (`78d24f1`).
- **Typography** — `19fd6e9`. Nunito throughout, founder footer. Touch-target fixes `adce66b`.

## 2026-10-02

- **Next.js 15 + React 19** — `0495bcc`; PostCSS security patch `d0dfd86`.
- **Super Admin** — `36487e7`, `b261014`. Server-verified role, audited plan overrides, `/admin`; migration `…0700`.
- **Dodo billing launch configuration** — `9aab986`.
- **Domain launch** — `17ad4ad`, `a986cee`. The production domain became the canonical origin (Vercel, Cloudflare DNS, Resend).
- **Google Places API (New) + Maps JS** — `2fa4058` (replacing a brief Geoapify integration, `9f25ef0`); stable map
  markers `b5b2cdc`.
- **Repository consolidation** to the mobile-first product — `25a647b` (legacy desktop planner, APIs and builder files removed).
- **Launch hardening** — `bb098cb` (security, privacy, resilience), `a568299`, `40820a9`.

## 2026-10-01

- **Mobile-first rebuild** — `e9650a0` (security audit, secret scrub), `d9b965c` (Supabase migrations: PostGIS,
  discovery cache, saved venues, checklist, invitations, RLS hardening), `0af6adc` (context-aware discovery backend),
  `77bc409` (app shell, design system, auth, PWA, analytics), `eeeefeb` (wizard, discovery list/map, venue detail,
  saved shortlist), `1425052` (home, party dashboard, themes, guests, checklist, invitations).
- **Security release gate** — `25c8927`, `41a173d`, `e285cd6` (server-managed entitlements, RSVP route, Google cost
  guards, removal of debug/legacy routes).
- **Integrations** — `37bf2a9`: Dodo billing, Resend workflows, password reset.
- **Testing and CI** — `9fafd75` (mobile Playwright suite), `aaa9c71`, `055075b`; docs and runbooks `427f905`.

## 2025-07-31 → 2025-10-06 — original prototype

The first version of the app (party wizard, Azure OpenAI theme recommendations, guest list and RSVP, Supabase
auth, budget and timeline prototypes, 24-hour trial) was built between `918ea16` (2025-07-31) and `4545a4b`
(2025-10-06). It was replaced by the mobile-first rebuild above; see [docs/LEGACY_CLEANUP_REPORT.md](docs/LEGACY_CLEANUP_REPORT.md).
