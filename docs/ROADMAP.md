# Roadmap

Everything under **Next** and **Future** is not built unless stated. Current functionality: [FEATURES.md](FEATURES.md).

## Now (in production)

Mobile-first party planning: wizard, venue discovery with Google Places and maps, saved venues, guests, invitations,
idempotent RSVP, checklist, themes, activities, timeline, shopping, budget, menu, Party Host; six live AI features
(Plan My Party, Theme Ideas, AI Checklist, Activity Studio, Party Host, Party Experience); live billing; Sentry;
Super Admin.

## Next (identified, high value)

- Launch copy and trust fixes listed in [LAUNCH_STATUS.md](LAUNCH_STATUS.md) (pricing/terms consistency, social
  proof, invitation help link, social preview image, privacy policy processors).
- Create the party automatically after email confirmation (no wizard repeat).
- Individual RSVP links in emailed invitations (exact invitee identity; removes email-based matching trade-off).
- Durable rate limiting and global/per-account email caps.
- Flush Sentry telemetry at the end of serverless requests; alerts for webhook signature failures and payment-failure rate.
- Re-date checklist tasks when the party date changes; manual budget and shopping entry.
- Decide which implemented-but-disabled AI features to enable (budget assistant, food planner, invitation writer,
  timeline, shopping list, "why these places") and align plan copy with what each tier unlocks.

## Future

- Party-day mode: live timeline, host prompts and checklist in one screen.
- Deeper personalisation across parties (sibling parties, repeat guests, preferences).
- Richer execution help: vendor booking, reminders to families, post-party thank-yous sent from the app.
- Product analytics and insight dashboards for the team (beyond Sentry operational telemetry).
- AI capacity scaling (provider plan, caching of similar requests) as usage grows.
