# Launch status

As of 2026-10-04 (v1.0 launch baseline, see [LAUNCH_BASELINE.md](LAUNCH_BASELINE.md)), production runs application
code `7da40bb` (tag `v1.0.0`) with database migrations through `20251004001400`. Earlier sections below are kept as
history. Evidence: [LAUNCH_STRESS_TEST_REPORT.md](LAUNCH_STRESS_TEST_REPORT.md) (pre-launch audit,
2026-10-03; several of its findings are fixed — see below), [ai/LAUNCH_LOG.md](ai/LAUNCH_LOG.md),
[OBSERVABILITY.md](OBSERVABILITY.md), [CHANGELOG.md](../CHANGELOG.md).

## Completed (verified in production)

- Mobile-first PWA on the production domain (HTTPS, HSTS, www/http redirects), Next.js 15 / React 19.
- Sign-up with email confirmation, sign-in, password reset, sign-out; Google sign-in starts correctly.
- Party wizard, multiple parties, venue discovery with real Google Places results, Google map, venue details,
  saved venues, add venue to party.
- Guests, invitation card, emailed invitations, public RSVP with host notification and guest confirmation (Resend).
- **RSVP idempotency** (migration `…1100`): changes, refreshes, double-taps, retries and concurrent requests keep one
  guest per invitee; notifications only on real changes — production smoke test passed.
- Checklist, themes, activities, timeline, shopping, budget, menu, Party Host content.
- AI: Plan My Party, Theme Ideas, AI Checklist, Activity Studio, Party Host, Party Experience — each exercised with
  real model calls in production on 2026-10-04.
- **AI usage hardening** (migration `…1200`): server-only reservation, atomic global breaker, usage survives party
  and account deletion — original attack paths re-tested against production and refused.
- Billing in **live mode** (Starter $4.99 / Plus $9.99 / Pro $14.99); live checkout session verified; trial users
  can buy (pricing fix deployed).
- Sentry observability with alerts and uptime monitoring; no open issues after the latest deploys.
- Super Admin with audited plan overrides.
- Automated suite: Vitest 492/492, Playwright 40/40, lint, typecheck, build, client-bundle secret scan.

## Product model (deployed 2026-10-04, `0a34b65`, Vercel `dpl_3JziktLVhM5RmvYUf2nCH692py9N`)

Free · Starter · Plus · Pro with one source of truth (`lib/entitlements.ts`), server enforcement (AI routes + RLS for
guests/RSVP, migration `20251004001300`), the five Plus AI features enabled in production, new pricing page.
Audit, risks and rollback: [PRODUCT_MODEL_AUDIT.md](PRODUCT_MODEL_AUDIT.md).

Launch polish (2026-10-04): `/help` page (linked from invitation emails and the footer), privacy policy lists the
service providers that process data and how to make data requests, Terms list Dodo Payments and only real features,
1200×630 social preview image with Open Graph / X metadata and per-page canonical URLs, the RSVP name is pre-filled
when a guest changes their reply.

## Remaining (genuinely outstanding)

Copy and trust: none open (Terms governing law set to India by the owner, 2026-10-04).

Operations / owner actions:
6. One real live purchase + refund to confirm the live webhook secret and plan activation end to end
   (no live payment has been processed yet).
7. Google OAuth: confirm the consent screen is published ("In production") and consider a Supabase custom auth
   domain or branding — the Google screen currently names the Supabase project domain.
8. Rotate credentials that were shared in chat during setup and those present in early Git history
   (`npm run scan:history` lists types/fingerprints without values); replace the personal Sentry token used for
   source-map upload with an org token; confirm Google Places quota caps and billing alerts.

Product (would improve conversion; not a blocker):
9. The wizard draft is not turned into a party automatically after email confirmation.
10. Email-abuse hardening: global and per-account email caps across parties; require a confirmed email before bulk
    invitations.

## Deferred (intentionally)

- Individual (per-guest) RSVP links; linking host-added guests without an email; RSVP authentication; link expiry by date.
- Durable (shared) rate limiting instead of per-instance memory; DMARC record.
- Flushing Sentry logs/metrics at the end of serverless requests (a small share of telemetry events can be lost).
- Automatic re-dating of checklist tasks when the party date changes; manual budget/shopping entry outside AI and activities.
- Retiring legacy tables and the unconfigured legacy `/api/themes/ai` route.

## Known limitations

- **AI latency:** 15–35 s typical; long features up to ~55 s.
- **AI capacity:** 50 generations/day across all users; failures count. When reached, AI shows "very busy" until UTC
  midnight (Sentry `ai-global-limit`).
- **AI budget variance:** the AI summary can say "within budget" while the server-computed total is over; displayed
  totals are always server-computed.
- **Per-user limits** reset for a brand-new account (no device tracking by design); the global breaker still applies.
- **RSVP identity:** a host-added guest without an email cannot be matched to their RSVP; a different family on the
  same phone must use "RSVP for someone else". Anyone with the invitation link and a guest's exact email can update
  that guest's RSVP (accepted trade-off for launch).
- **Maps** need WebGL (virtually all phones); without it the map area is blank.
- **Google sign-in branding** shows the Supabase project domain (see Remaining 7).
