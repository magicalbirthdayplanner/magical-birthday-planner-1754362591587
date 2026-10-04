# Known limitations (v1.0 launch baseline)

Only confirmed items. Labels: **BLOCKING** (must fix before relying on the feature) · **NON-BLOCKING** (acceptable for
launch) · **FUTURE IMPROVEMENT** (works; could be better). There are **no BLOCKING items** at the baseline.

## Billing

| Item | Label |
|---|---|
| **No real live payment has gone through the live webhook yet.** Checkout opens on the correct live Dodo products and webhooks are verified by tests and sandbox payments (which carry `mbp_checkout_id` metadata), but the first real purchase should be watched end to end (party gets the plan, `unresolvedPayments` stays 0). | NON-BLOCKING (watch) |
| An unmatched paid payment unlocks nothing until an admin runs `public.reconcile_purchase(purchase, party)` (by design). The customer waits for support in that case. Alert: Sentry `PAYMENT_UNRESOLVED`, Super Admin stats. | NON-BLOCKING (by design) |
| Upgrading a party (e.g. Starter → Plus) charges the full price of the higher plan; no proration/credit. | FUTURE IMPROVEMENT |
| No in-app refund/cancel flow; refunds are done in Dodo and revoke the party's plan via webhook. | NON-BLOCKING |

## AI

| Item | Label |
|---|---|
| Latency: typically 15–35 s, long features up to ~55 s (route limit 60 s). | NON-BLOCKING |
| Capacity: global breaker 50 generations/day (production config); when reached, AI shows "very busy" until UTC midnight. Failed calls count toward user and global limits. | NON-BLOCKING (raise when usage grows) |
| Budget Assistant reasoning needs human review: it once suggested a category amount below what was already spent, and its projected total excludes the "missing" costs it recommends. Displayed totals are server-computed. | NON-BLOCKING |
| The AI summary of Plan My Party can say "within budget" while the server-computed total is over. | NON-BLOCKING |
| Per-user limits reset for a brand-new account (no device tracking by design); the global breaker still applies. | NON-BLOCKING |
| Estimated AI cost in Sentry is an estimate from published DeepSeek prices, not a bill. | NON-BLOCKING |
| "Party-day assistance" as a separate live assistant does not exist; the Pro day-of value is Party Host + Party Experience. | FUTURE IMPROVEMENT |

## RSVP & email

| Item | Label |
|---|---|
| A host-added guest without an email cannot be matched to their RSVP (a new guest row is created for the reply). | NON-BLOCKING |
| Anyone with the invitation link and a guest's exact email can update that guest's RSVP (accepted trade-off; per-guest links would remove it). | NON-BLOCKING |
| A different family on the same phone must tap "RSVP for someone else". | NON-BLOCKING |
| Email caps are per user/party and rate limits are in-memory per serverless instance (not global). | FUTURE IMPROVEMENT |
| The wizard draft is not turned into a party automatically after email confirmation (the parent repeats the wizard). | FUTURE IMPROVEMENT |

## Platform, auth & operations

| Item | Label |
|---|---|
| Google sign-in consent screen shows the Supabase project domain (no custom auth domain). | NON-BLOCKING |
| Vercel previews: environment variables are scoped to the `mobile-first` branch only; previews of other branches fail to build (expected). The preview-only `NEXT_PUBLIC_SITE_URL` variable is not read by the code. | NON-BLOCKING |
| Early Git history (2025) contains committed secrets (`npm run scan:history`: 30 fingerprints, 0 at HEAD). None matches a credential in current use; the repository is private. Rotation/clean-up recommended. | NON-BLOCKING (security hygiene) |
| A small share of Sentry logs/metrics can be lost because telemetry is not flushed at the end of serverless requests. | FUTURE IMPROVEMENT |
| Maps need WebGL (virtually all phones); without it the map area is blank. | NON-BLOCKING |
| Homepage "Try Demo" button links to the same wizard as "Get Started" (there is no separate demo). | NON-BLOCKING (copy) |
| The marketing homepage uses an older visual style (pink/purple gradient headings) than the app and pricing page. | FUTURE IMPROVEMENT |
| Checklist tasks are not re-dated automatically when the party date changes; manual budget/shopping entry exists only through activities and AI results. | FUTURE IMPROVEMENT |
| Legacy tables (`invitations`, `party_activities`, `activities`, `activity_favorites`, `theme_preferences`) and the unconfigured legacy `/api/themes/ai` route remain. | FUTURE IMPROVEMENT |
