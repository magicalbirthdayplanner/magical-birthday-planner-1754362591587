# Roadmap

Nothing here is built unless stated. Current functionality: [../README.md](../README.md) and [FEATURES.md](FEATURES.md).
The v1.0 baseline is frozen ([LAUNCH_BASELINE.md](LAUNCH_BASELINE.md)); every item below starts on a feature branch.

## Now (v1.0, in production)

Mobile-first party planning (wizard, Google venue discovery and map, saved venues, checklist, themes, activities,
party plan, budget), Guests & RSVP with duplicate protection, invitations by link and email, 11 AI features across
Starter/Plus/Pro, per-party Dodo billing (live), Super Admin, Sentry observability.

## Near term (after the first real users)

- Watch and confirm the first real live purchases end to end; tune alerts on `PAYMENT_UNRESOLVED`.
- Individual (per-guest) RSVP links in emailed invitations — exact invitee identity, removes the email-matching
  trade-off; link host-added guests without an email.
- RSVP UX polish based on real guest behaviour.
- Create the party automatically after email confirmation (no wizard repeat).
- Durable (shared) rate limiting and global/per-account email caps; require a confirmed email before bulk invitations.
- Flush Sentry telemetry at the end of serverless requests; dashboards for funnel → checkout → purchase.
- Rotate credentials from early Git history; replace the personal Sentry token with an org token; Supabase custom auth
  domain so Google sign-in shows the product's domain.
- Homepage copy/design alignment with the app (e.g. the "Try Demo" button).

## Medium term

- Better budget reasoning in the Budget Assistant (respect actual spend, include recommended missing costs in the
  projection).
- Improved AI recommendations and personalisation across parties (siblings, repeat guests, preferences).
- Re-date checklist tasks when the party date changes; manual budget and shopping entry.
- Upgrade credit/proration between plans for the same party (product decision).
- Richer first-party analytics and product insight dashboards.
- Mobile/PWA improvements (party-day mode: live timeline, host prompts and checklist on one screen).

## Long term

- Additional AI party-day assistance beyond Party Host / Party Experience.
- Additional integrations (vendor booking, calendars, messaging) and post-party thank-yous sent from the app.
- Marketing and referral capabilities.
- AI capacity scaling (provider plan, caching of similar requests) as usage grows; retire legacy tables.
