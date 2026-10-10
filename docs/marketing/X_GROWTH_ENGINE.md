# X Growth Engine (8 posts/day inside a $5/month X budget)

Builds on the founder marketing agent ([FOUNDER_MARKETING_AGENT.md](FOUNDER_MARKETING_AGENT.md)): same validation,
repetition check, claim-protected publishing, dry-run and autonomous switches. This layer adds cost control, a
weekly content bank, reusable media, new formats, owned-read metrics, business scoring and a decision engine.

```
WEEKLY  plan 56 slots (no AI, no X calls) ── roles · formats · topics · media (reuse > template > none) · links (budget)
DAILY   one AI call writes the day (≤ 1 repair call) → validate → repetition → free branded cards → store (bank)
        fallback: evergreen library (zero AI cost)
8×/DAY  publish the due post: product-name fix → re-validate → media privacy → budget → claim → X (ledger)
DAILY   metrics (owned reads, 2 windows) → UTM attribution → business score → decisions → next plan
```

## The cost model (X pay-per-use, Oct 2026)

| Call | Price | How the engine uses it |
|---|---|---|
| Post create | $0.015 | 8/day ≈ $3.70/month — the core spend |
| Post with a URL (incl. a bare domain) | **$0.20** | only when the month's projection can absorb the premium (≈ 1–3/week); otherwise the link is dropped at publish time |
| Owned read (own posts) | $0.001/post | metrics: once a day for posts 1–2 days old and 7–8 days old (≈ $0.50/month); history import once |
| Post read / user read | $0.005 / $0.01 | avoided (connection check only) |
| Media metadata (alt text) | $0.005 | `MARKETING_X_ALT_TEXT=auto`: only while the budget is GREEN |
| Media upload | not on the rate card | metered at $0 (override if X starts charging) |

Free levers instead of paid links: the brand cards carry the product name and `magicalbirthdayplanner.app` as plain
text in the image; **add the website (with UTM `utm_content=bio`) to the X profile** — the bio is currently empty
and a profile link costs nothing per post.

**Budget guard** (`lib/marketing/budget.ts`, ledger `marketing_usage`): projected spend = spent + queued posts +
remaining slots + metrics reads. GREEN ≤ 80 %, YELLOW ≤ 100 %, RED above (or the hard cap = budget − reserve is
reached). Core posts publish while they fit the hard cap and 1.5× today's fair share; links, metrics reads, alt text
and checks need the projection to stay inside the budget. Nothing is called without a ledger row.

Fallback levels when money runs short: (1) already-written bank posts; (2) text-only; (3) free branded templates;
(4) library media with a new caption; (5) AI generation pauses (`MONTHLY_AI_BUDGET_USD`) — the library keeps posting.

## Weekly plan (`lib/marketing/planner.ts`)

Daily structure (in posting order): founder story 08:00 · parent tip 10:30 · conversation 12:30 · visual 14:30 ·
educational/carousel 16:30 · product 18:00 · poll 19:30 · soft conversion 21:00 (America/New_York). Formats by role and
weekday, giving roughly 35–40 % text, ~20 % branded images, ~12 % carousels, ~12 % polls, ~5–10 % video, ≤ 1 thread a
week (GREEN only). Learning weights can swap weak roles for strong ones on alternate days and cut weak formats.
Library media is never planned twice within 14 days; rejected/pending media is never planned.

## Media library

`data/marketing/media-library.json` (44 entries) — owner-approved 30-day campaign finals, reviewed 2026-10-10 with frame
contact sheets: 7 videos (4:5, 19–36 s, Mixkit music — no attribution), 10 carousels (2–4 slides), 4 single images.
**Rejected:** day 04 "RSVP group chat" (fictional children's first names in the chat). Upload with
`node scripts/marketing-seed-media.mjs` (service role; idempotent; `--dry` lists). Branded cards (10 templates:
tip, founder quote, pain point, checklist, this-or-that, venue comparison, AI tip, product feature, inspiration, poll
companion) are rendered free with `next/og` from each post's validated text.

## Formats on X

Text · image (≤ 4) · carousel (2–4 images) · poll (2–4 options ≤ 25 chars, 24 h) · video (chunked v2 upload:
initialize → 4 MB appends → finalize → status) · thread (root + 2–4 self-replies; a failed reply never un-publishes the
root). Every call is metered.

## Safety additions

Product name auto-fix ("Magical Birthday Plannner" → "Magical Birthday Planner") before publishing, and a validation
error in drafts. Child privacy: child names ("my daughter Maya"), schools, street addresses, phone numbers and emails
are rejected; media must be `privacy_status = approved`. A bare web address counts as a (paid) link.

Phase-2 audit (2026-10-10): no "Plannner" in the repository, the film workspace, the X profile name/bio, or the 49 posts
already on @MagicalBPlanner.

## Scoring and decisions

Business score (`MARKETING_SCORE_WEIGHTS`, JSON): defaults impressions 0.001 · engagements 0.02 · profile visits 0.2 ·
link clicks 0.5 · website visits 0.5 · sign-ups 10 · parties 20 · purchases 50. The brief's example weights
(impressions × 0.10 … sign-ups × 0.25) applied to raw counts would rank a 20,000-impression poll with no sign-ups above a
4,000-impression founder story with 6 sign-ups — the opposite of the stated principle — so the defaults are funnel
values; the literal weights can still be configured (tested).

Daily decisions (≥ 6 scored posts, ≥ 3 per group): role/format/category/hook groups scoring ≥ 1.3× average → increase
(multiplier ≤ 1.5); ≤ 0.7× → decrease (≥ 0.5); engagement ≥ 1.3× average with zero clicks/sign-ups → "keep for reach,
don't expect conversions"; formats with < 0.5× the average score per dollar → reduce. Shown in `/admin/marketing/x`
and fed to the next weekly plan and the batch prompt.

## Scheduling (Vercel Hobby: each cron once a day, fires within the hour)

| Cron (UTC) | Task |
|---|---|
| `0 10 * * 0` | `plan` — next week's 56 slots + its first day |
| `0 11 * * *` | `prepare` — metrics, attribution, scores, learning, write today/tomorrow, brief |
| `0 12`, `30 14`, `30 16`, `30 18`, `30 20`, `0 22`, `30 23`, `0 1` | `publish` — one post each (slots 08:00–21:00 EDT) |

After DST ends (Nov 1) the UTC crons run an hour earlier in local time; the 90-minute early window keeps every slot
covered (posts may go out up to an hour early in winter).

## Dashboard

`/admin/marketing/x` (Super Admin): status, **X budget dashboard** (budget, X/AI/image/video spend, remaining,
projected, GREEN/YELLOW/RED, ledger by operation), actions (plan week, write today/tomorrow, import X history, run
prepare/publish), today, upcoming, content bank (week grid + library stats), performance (funnel, top formats/roles/
hooks/CTAs/content by business score), decisions.

## New environment variables

`MONTHLY_X_BUDGET_USD` (5) · `MONTHLY_AI_BUDGET_USD` (2) · `MARKETING_X_RESERVE_USD` (0.25) ·
`MARKETING_AI_USD_PER_1M_TOKENS` (2) · `MARKETING_X_ALT_TEXT` (auto) · `MARKETING_METRICS_WINDOWS` (`24-48,168-192`) ·
`MARKETING_SCORE_WEIGHTS` (JSON) · `MARKETING_UTM_CAMPAIGN` (mbp_x_growth) · `MARKETING_X_PRICE_<OP>` (rate-card
overrides) · `MARKETING_MEDIA_SOURCE_DIR` (seed script only). Changed defaults: `MARKETING_POSTS_PER_DAY` 8 (cap 8),
`MARKETING_POST_TIMES` 8 slots, `MARKETING_MIN_GAP_MINUTES` 60, `MARKETING_URL_SHARE` 0.1, learning every day.

## Migration

`20251010001900_x_growth_engine.sql` (after `…1800`): post formats/slots/media/poll/thread/score/cost columns,
`marketing_media`, `marketing_plans`, `marketing_usage`, RPC `marketing_media_used`, private bucket `marketing-media`
(images + MP4, 50 MB). Additive; server-only.
