# Changelog

Major milestones, newest first. Dates and commits are from Git history (`git log`). Configuration-only changes
(no commit) are marked as such.

## 2026-10-04

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
