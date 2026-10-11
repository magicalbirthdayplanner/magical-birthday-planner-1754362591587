# Marketing console (X · Instagram · Facebook)

One place to run the content engine: `/admin/marketing` (Super Admin). It replaces the earlier X-only screens and the
local Facebook Page tool (`tools/facebook-content-manager`, systemd timer) — everything runs on the server (Vercel crons
+ Supabase), so nothing depends on a computer being on.

## Tabs

- **General** — AUTONOMOUS PUBLISHING switch, live/dry-run state, per-platform cards (credentials, active/paused,
  cadence, queued/drafts, days written ahead, **Check connection**, **Pause/Resume publishing**), run daily prepare /
  publish what's due, X + AI budget, what the data says, daily brief, activity log.
- **X / Instagram / Facebook** — status + **Check connection** + pause + **Import existing posts**; the X tab also shows
  the X budget. **Content engine — next 30 days**: every day laid out slot by slot (time, role, format, status) with the
  written post (text, images/video, poll options, thread). Per post: **Approve**, **Publish now**, **Regenerate**,
  **Edit**, **Cancel**, **Delete**. Per day: **Write this day**, **Approve all drafts**. **Write all unwritten days**
  fills the 30-day bank (one AI call per platform-day, with progress and Stop). Last 14 days with metrics; 30-day
  performance.

## Publishing rules

- `AUTONOMOUS_PUBLISHING` (env) is the scheduler's kill switch.
- Admin switch ON → the engine publishes its own written posts at their times (no approval needed).
- Admin switch OFF → only posts you **approved** (or scheduled) go out, at their time; the rest wait as drafts.
- **Publish now** always works for a valid post (still honours `MARKETING_DRY_RUN`).
- A paused platform publishes nothing (writing continues so you can review).

## Cadence (defaults)

| Platform | Posts/day | Times (America/New_York) | Notes |
|---|---|---|---|
| X | 4 | 09:00 · 12:30 · 17:00 · 20:00 | $0.015/post, $0.20/link post — budget-gated |
| Instagram | 2 | 12:30 · 20:00 | every post has media; no links/polls/threads |
| Facebook | 2 | 09:00 · 17:00 | links free (UTM `utm_source=facebook`); polls posted as questions |

**Publishing clock.** Vercel Hobby crons fire anywhere within their hour, so they can't hit a 09:00 slot. Supabase
pg_cron runs `public.marketing_tick('publish')` every 5 minutes (migration `20251011002100`), which calls
`/api/cron/marketing?task=publish&source=pg_cron` via pg_net. The URL and Bearer secret live in Supabase Vault
(`marketing_cron_url`, `marketing_cron_secret` = `CRON_SECRET`); without them the tick does nothing. A post goes out at
most `MARKETING_PUBLISH_EARLY_MINUTES` (5) before its slot and within ~5 minutes after it. The Vercel publish crons stay
as a backup. Check ticks: `select status_code, left(content, 200) from net._http_response order by created desc limit 5`.

The daily prepare keeps the bank topped up toward `MARKETING_BANK_DAYS`
(30): today and tomorrow first, then the earliest unwritten day, round-robin across platforms.

## Facebook setup

`FB_PAGE_ID` (1387953677730770) and `FB_PAGE_ACCESS_TOKEN` — a Page token derived from the owner's long-lived user
token (`GET /me/accounts`), which does not expire unless the password/permissions change. Permissions used:
`pages_manage_posts`, `pages_read_engagement`, `read_insights`.
