# Founder Marketing Agent (X)

An autonomous, founder-voiced growth agent for Magical Birthday Planner, built inside the existing app (Next.js 15 App
Router, Supabase, Vercel, the existing AI provider and analytics). X/Twitter first; other channels plug into the same
interfaces.

**Growth engine:** cadence, cost control, content bank, media library, formats and decisions are in
[X_GROWTH_ENGINE.md](X_GROWTH_ENGINE.md) — it supersedes the 1–2 posts/day defaults and cron table below.

**Safe by default:** `MARKETING_DRY_RUN` is on and autonomous publishing is off. Nothing reaches X until the founder
sets `MARKETING_DRY_RUN=false` **and** (for the scheduler) `AUTONOMOUS_PUBLISHING=true` plus the admin switch.

```
AI draft (lib/ai client) → validation (claims, voice, length, dates) → repetition check → image (brand card / OpenAI)
→ marketing_posts (Supabase) → scheduler (Vercel Cron, claim-protected) → X API v2 → external id + URL
→ metrics (X) + attribution (analytics_events UTMs) → learning (insights, pillar weights) → next post
```

## Where things live

| Part | Path |
|---|---|
| Shared types (client-safe) | `lib/marketing/types.ts` |
| Config + safe defaults | `lib/marketing/config.ts` |
| Fact register (the only facts posts may state) | `lib/marketing/facts.ts` |
| Pillars, weekly mix, topic bank | `lib/marketing/pillars.ts` |
| Strategy (objective, pillar rotation, topics, link/image policy, UTM) | `lib/marketing/strategy.ts` |
| Founder-voice prompts + output schema | `lib/marketing/prompts.ts` |
| Pipeline `generateMarketingPost()` | `lib/marketing/generate.ts` |
| Claim / safety / date validation | `lib/marketing/validation.ts` |
| Repetition check + text utilities (X weighted length, idea fingerprint) | `lib/marketing/repetition.ts`, `lib/marketing/text.ts` |
| Publishing + duplicate protection | `lib/marketing/publish.ts` |
| Scheduler tasks (`prepare`, `publish`) | `lib/marketing/agent.ts` |
| Metrics + attribution | `lib/marketing/metrics.ts` |
| Learning loop | `lib/marketing/learning.ts` |
| Daily brief | `lib/marketing/brief.ts` |
| Persistence (`MarketingStore`) | `lib/marketing/store.ts` |
| Channel providers (`MarketingProvider`, X) | `lib/marketing/providers/` |
| Image providers (`ImageGenerationProvider`) | `lib/marketing/images/` (+ fonts/logo in `lib/marketing/assets/`) |
| Admin logic | `lib/marketing/admin.ts` |
| Admin UI | `/admin/marketing` → `components/admin/MarketingAdminScreen.tsx` |
| Admin APIs (Super Admin only, 404 otherwise) | `app/api/admin/marketing/route.ts`, `app/api/admin/marketing/posts/[id]/route.ts` |
| Scheduler endpoint (CRON_SECRET) | `app/api/cron/marketing/route.ts`, crons in `vercel.json` |
| Migration | `supabase/migrations/20251010001800_founder_marketing.sql` |

Extending to a new channel: implement `MarketingProvider` (`lib/marketing/providers/types.ts`), register it in
`providers/index.ts`, add the platform's length rule to validation. Image backends implement
`ImageGenerationProvider` and register in `images/index.ts`. Attribution sources implement `AttributionSource`
(`metrics.ts`).

## Database (migration `20251010001800_founder_marketing.sql`)

All tables: RLS on, **no policies**, all grants revoked from `anon`/`authenticated` — server (service role) only.

- `marketing_posts` — platform, content type, pillar, topic (+ `topic_key`), hook, CTA, text, link, image
  (path/prompt/alt/provider/status), status (`draft · approved · scheduled · publishing · published · failed ·
  cancelled · dry_run`), schedule/publish times, X ids/URL, platform metrics (**NULL = not available**, never a
  guessed 0), MBP attribution (visits, sign-ups, parties, checkouts, purchases, revenue), similarity to past posts,
  validation report, generation metadata, publish-claim fields, dry-run payload. Unique `(platform, external_post_id)`.
- `marketing_post_metrics` — snapshots over time (`platform` | `mbp`).
- `marketing_settings` — one row: `autonomous_enabled` (default **false**).
- `marketing_insights` — learning-loop output; `marketing_briefs` — one brief per local date;
  `marketing_audit_log` — every admin/agent action.
- `marketing_claim_post(...)` — service-role-only RPC: per-platform advisory lock + conditional status change + daily
  limit + minimum gap. Unconfirmed attempts count toward the limit.
- Storage bucket `marketing-images` — private, PNG/JPEG/WebP, 8 MB; the admin UI uses 1-hour signed URLs.

Apply to production (human step, like every migration here): `supabase db push --db-url <session pooler URL>`
**before** deploying the code. It is additive; nothing existing changes.

## Environment variables

All server-only (never `NEXT_PUBLIC_`). Defaults are safe; only the X credentials (and `CRON_SECRET`, which already
exists in Vercel Production) are needed for a live setup.

| Variable | Default | Purpose |
|---|---|---|
| `X_API_KEY`, `X_API_SECRET` | — | X app Consumer Key / Secret (OAuth 1.0a) |
| `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` | — | Access Token / Secret of the posting account, generated **after** the app has *Read and write* permission |
| `MARKETING_DRY_RUN` | `true` | Anything but the exact string `false` = dry-run: generate, illustrate, store, simulate — never post |
| `AUTONOMOUS_PUBLISHING` | `false` | Must be exactly `true` for the scheduler to publish; the admin switch must also be ON |
| `MARKETING_POSTS_PER_DAY` | `1` | 1 or 2 (hard cap 2) |
| `MARKETING_POST_TIMES` | `10:00,19:30` | Local slots; the first N are used |
| `MARKETING_TIMEZONE` | `America/New_York` | IANA zone for slots, "today", the brief |
| `MARKETING_MIN_GAP_MINUTES` | `240` | Minimum time between two scheduled posts |
| `MARKETING_PUBLISH_EARLY_MINUTES` | `90` | A post may go out this early (Hobby crons fire anywhere in the hour) |
| `MARKETING_URL_SHARE` | `0.35` | Target share of posts with the product link (max 0.4) |
| `MARKETING_X_MAX_CHARS` | `280` | Weighted-character limit for the account (raise only for a long-post account) |
| `MARKETING_IMAGE_PROVIDER` | `brand` | `brand` (on-brand card, no API) · `openai` (needs `OPENAI_API_KEY`) · `none` |
| `OPENAI_API_KEY`, `MARKETING_IMAGE_MODEL` | —, `gpt-image-1` | Only for `MARKETING_IMAGE_PROVIDER=openai` |
| `MARKETING_AI_MODEL` | (AI_MODEL) | Optional model override for copy; same provider/key as the app's AI (`AI_PROVIDER`, `AI_API_KEY`) |
| `MARKETING_AUTO_DRAFT` | `true` | With autonomous OFF, the scheduler writes one draft a day for review |
| `MARKETING_BRIEF_EMAIL` | — | Email the daily brief here (Resend, existing sender) |
| `MARKETING_LAUNCH_DATE` | `2026-10-13` | Drives the objective and launch-day invitation |
| `MARKETING_LEARNING_INTERVAL_DAYS`, `MARKETING_LEARNING_WINDOW_DAYS` | `3`, `30` | Learning cadence / window |
| `MARKETING_FORBIDDEN_TERMS` | — | Comma list that may never appear (the founder's and family's names — the founder is anonymous) |
| `MARKETING_X_USERNAME` | — | Optional handle for post URLs (otherwise learned from the connection check) |
| `CRON_SECRET` | (exists) | Bearer secret Vercel Cron sends to `/api/cron/marketing` (≥ 16 chars) |

## X API setup

1. developer.x.com → your app → **User authentication settings** → App permissions **Read and write** (OAuth 1.0a).
2. **Regenerate** the Access Token and Secret *after* changing permissions (old tokens keep the old access level).
3. Put the four values in Vercel Production (Sensitive): `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`,
   `X_ACCESS_TOKEN_SECRET`. Redeploy.
4. `/admin/marketing` → **Check X connection**: shows the handle and the token's access level (`read-write` needed).
   Locally: `X_LIVE=1 npx vitest run tests/live/x-live.test.ts -c vitest.live.config.ts` (read-only `GET /2/users/me`).
5. API access: posting uses `POST /2/media/upload` + `POST /2/tweets`; metrics use `GET /2/tweets` (public metrics;
   non-public metrics — impressions/profile/link clicks — only where the access level allows, otherwise they stay
   empty). Check the account's API plan/credits; a 402 is reported as `payment_required`.

## Image API setup

Nothing needed for the default: `brand` renders an on-brand 1600×900 card with `next/og` (already in Next.js):
cream background, party-hat logo, Nunito, purple/coral/gold confetti, one short headline (no numbers, no claims).
For AI illustrations set `MARKETING_IMAGE_PROVIDER=openai` and `OPENAI_API_KEY`. Every scene prompt is checked and
stripped of UI/screenshots, ratings/testimonials, statistics, logos, text and protected characters, and the provider
receives hard constraints (no text, no UI, no logos, no characters, no identifiable people). A failed image never
blocks a post — it goes out as text.

## Dry-run (default)

`MARKETING_DRY_RUN` unset or anything but `false`. The agent generates, illustrates, validates, stores and
"publishes" by recording exactly what would be sent (`status = dry_run`, `dry_run_payload`). Dry-run publishes count
toward the daily limit, so the schedule behaves exactly like live.

## Enabling autonomous publishing

1. Apply the migration; deploy; set the X variables (Read-and-write token) and keep `MARKETING_DRY_RUN` unset.
2. In `/admin/marketing`, generate and review a few drafts; run **Publish now (dry-run)** to see the final payload.
3. Set `AUTONOMOUS_PUBLISHING=true`, redeploy, turn the **AUTONOMOUS PUBLISHING** switch ON → the agent schedules and
   simulates for a few days (still dry-run). Check the daily brief and the simulated posts.
4. Go live: `MARKETING_DRY_RUN=false`, redeploy. Turn the switch OFF at any time to stop immediately (no redeploy).

Manual **Publish now** works without autonomous mode (the founder's explicit click), still honours dry-run, and has its
own safety ceiling (3 per day, 15 minutes apart).

## Scheduling

Vercel Hobby crons run once a day each, somewhere within the hour (`vercel.json`):

| Cron (UTC) | Task | What it does |
|---|---|---|
| `0 11 * * *` (07:00 EDT) | `prepare` | stale-claim sweep → X metrics → attribution → learning (every 3 days) → queue → daily brief |
| `0 14 * * *` (10:00 EDT) | `publish` | autonomous only: publish the due post (claim + limits), or generate one just in time |
| `30 23 * * *` (19:30 EDT) | `publish` | second slot; a no-op when `MARKETING_POSTS_PER_DAY=1` |

Queue: with autonomous ON, `prepare` fills the free slots in the next 36 h (≤ posts/day), as `scheduled` posts. With
autonomous OFF it writes one draft a day for review (max 5 waiting). Manual runs: `POST /api/cron/marketing?task=…`
with `Authorization: Bearer $CRON_SECRET`, or the buttons in `/admin/marketing`.

**Duplicate-publish protection:** every publish goes through `marketing_claim_post` (advisory lock per platform +
`approved|scheduled → publishing` conditional update + daily limit + minimum gap). Concurrent runs: exactly one wins
(tested with 3 concurrent cron calls and 10 concurrent DB claims). If X doesn't confirm a post (timeout/5xx after
sending) it becomes `failed / publish_unconfirmed` and is **never** retried automatically; it still counts toward the
daily limit. The founder checks X and either links the live post URL or confirms it was not posted. Claims stuck for
15 minutes become `publish_unconfirmed` too. Rate limits (429) put the post back in the queue.

## Analytics

- **X metrics** (`prepare`, for posts < 14 days old, every ≥ 6 h): impressions, likes, reposts, replies, quotes,
  bookmarks, profile visits, link clicks — whatever the access level returns; missing = NULL, shown as "n/a".
- **MBP attribution**: links carry
  `https://magicalbirthdayplanner.app/?utm_source=x&utm_medium=social&utm_campaign=founder_marketing&utm_content={post_id}`.
  The existing client analytics already store the device's last-touch UTM tags on every event
  (`lib/analytics/attribution.ts`), so `analytics_events` with `utm_content = post id` give landing visits
  (`landing_page_view`), sign-ups (`signup_completed`/`sign_up`), parties (`party_creation_completed`/`party_created`),
  checkouts (`checkout_started`) and purchases (`purchase_completed`), counted per distinct person. Revenue = verified
  `billing_purchases` of those users made after the post went out. Last-touch, 30-day window; nothing is estimated.

## Learning loop

Every 3 days (`marketing_insights`), from the last 30 days of published posts: by pillar, topic, hook style
(question/story/tip/statement), CTA, posting time, link, image → engagement rate, profile-visit rate, link-click
rate, sign-ups per post, sign-up/party/paid conversion, top posts. Recommendations are sentences with the real numbers
and sample sizes ("Founder journey posts got 2.4× the profile-visit rate of Product education posts (2.4% vs 1.0%; 3
vs 3 posts)"), only between groups with ≥ 2 posts and ≥ 100 impressions. With fewer than 3 posts with impressions it
says "Not enough data yet" and changes nothing. With ≥ 6 posts it sets pillar multipliers (0.75–1.35) that tilt the
mix, and the recommendations are given to the model as "what the data says". It can't raise posting frequency.

## Content safety

`validation.ts` rejects: user/sign-up counts, social proof, revenue, ratings, testimonials/anecdotes, press/awards,
partnerships/funding, fake urgency/scarcity, pricing/offers, unprovable superlatives, AI vendor names, competitors,
marketing-speak, engagement bait, politics/controversy, offensive or fear-based copy, protected characters, foreign
links, wrong UTM links, @mentions, > 2 hashtags/emoji, ALL CAPS, over-length (X weighted length: URLs 23, emoji 2).
Generated copy is also checked for wrong launch dates/weekdays and invented counts in the founder story. The prompt
only allows facts from `facts.ts`. Validation runs at generation, on approve/schedule/edit, and again right before
publishing. Repetition (`repetition.ts`) blocks the same idea (synonym-aware concept overlap, e.g. "stressful because
you need 20 tabs" ≈ "why do parents need 20 browser tabs"), a similar hook, the same opening words (last 10), the same
CTA (last 5) and the same topic (14 days).

## Tests

- Unit (`tests/unit/marketing/`, mocked AI + X + images): length, claims, voice, links, similarity, repetition,
  rotation/mix, topics, link share, UTM, slots/DST, config defaults, OAuth 1.0a (reference signature), X calls and
  error mapping, generation retries, image failure, dry-run, live publish, concurrent publish, limits, unconfirmed
  handling, scheduler idempotency, autonomous gates, learning, brief, admin actions, brand-card rendering.
- Integration (`tests/integration/marketing.test.ts`, local Supabase): persistence, constraints, the claim RPC under
  10× concurrency, limits, server-only access, private bucket, UTM attribution.
- Live (opt-in, read-only): `tests/live/x-live.test.ts`.

## Runbook

- **Stop everything now:** admin switch OFF (instant). Belt and braces: `AUTONOMOUS_PUBLISHING=false` + redeploy.
- **A post says "may have been posted":** look at the X account. Posted → paste its URL (Link). Not posted → Approve /
  Publish now and confirm "not posted".
- **Generation keeps failing validation:** the admin error lists the reasons; edit `facts.ts`/`pillars.ts`, not the
  validator, unless a rule is wrong.
- **Rotate X credentials:** regenerate in the X portal → update Vercel → redeploy → Check X connection.
