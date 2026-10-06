# Temporary pre-launch (waitlist) mode — Oct 6–12, 2026

From **Oct 6, 2026 12:00:00 AM** to **Oct 12, 2026 11:59:59 PM America/New_York** the public site is a single
waitlist page. At **Oct 13, 2026 12:00:00 AM ET** it switches off by itself and the normal site returns. Nothing is
deployed, migrated or switched by hand at launch; the waitlist data stays.

## How it works

| Piece | Where |
|---|---|
| Launch state (single source of truth): window as Eastern wall-clock times → instants via the IANA tz database; `PRELAUNCH_MODE` override | `lib/launch.ts` |
| Routing layer (Node middleware, runs per request): `/`, `/privacy` → pre-launch shell; product pages and `/terms` (it lists prices) → `307` to `/` (query kept, `no-store`); `POST /api/billing/checkout` → `403`; when LIVE, `/prelaunch*` → public path | `middleware.ts` |
| Pre-launch page + shell (header without sign-in/pricing, footer, sticky mobile CTA) | `app/(prelaunch)/`, `components/prelaunch/` |
| Waitlist API (anonymous, validated, rate-limited, honeypot) | `app/api/waitlist/route.ts`, `lib/waitlist.ts` |
| Storage | `supabase/migrations/20251006001500_launch_waitlist.sql` |
| Observability | `lib/observability/waitlist.ts` |
| Emails: confirmation after sign-up, Oct 12 launch reminder, unsubscribe | `lib/server/waitlist-email.ts`, `app/api/cron/launch-reminder`, `app/api/waitlist/unsubscribe`, migration `20251006001600_launch_waitlist_emails.sql` |
| Admin counts (Super Admin) | `GET /api/admin/waitlist`, "Launch waitlist" card in `/admin` (incl. confirmation / reminder / unsubscribe counts) |
| Screens shown | `public/prelaunch/*.webp` — real v1.0 screens with real AI output (child names blurred), from the film workspace's `screens-30` capture |

Still reachable during pre-launch: guests' RSVP links (`/invite/*`) for parties that already exist, `/auth/callback`,
`/reset-password`, `/offline`, all APIs except checkout (webhooks, RSVP, health, waitlist, cron).

## Waitlist data

`public.launch_waitlist` — one row per normalized email (lower-cased, trimmed; unique index), optional `first_name`,
first-touch attribution `source` (`?source=`/`?ref=` or the referrer host) and `utm_source/medium/campaign/content`,
`status` (`subscribed`/`unsubscribed`), `signup_count`, timestamps. Repeat sign-ups bump `signup_count` and never
overwrite attribution. RLS on with no policies, table privileges revoked from `anon`/`authenticated`; writes only via
`join_launch_waitlist()` and counts via `launch_waitlist_stats()`, both executable by `service_role` only. New and
already-listed emails get the same API answer.

Export for launch email (service role / SQL editor):
`select email, first_name from public.launch_waitlist where status = 'subscribed' order by created_at;`

## Emails (Resend — existing `RESEND_API_KEY` / `EMAIL_FROM`)

- **Confirmation** — sent after the response (`after()`), at most once per row: Resend idempotency key
  `waitlist-confirm:<row id>`, `confirmation_sent_at` recorded on success. A repeat sign-up only sends if no
  confirmation was delivered yet (self-healing after a Resend outage). Failures never fail the sign-up.
- **Launch reminder** — Vercel Cron `0 4 12 10 *` (Oct 12 04:00 UTC = 00:00 EDT; Hobby cron fires within that hour)
  → `GET /api/cron/launch-reminder` with `Authorization: Bearer $CRON_SECRET`. Only between Oct 12 00:00 ET and
  launch; subscribed rows with `launch_reminder_sent_at is null`; Resend batches of 100, each with an idempotency key
  from its row ids; rows marked after Resend accepts. Re-running is safe: `POST {"all":true}` (same window).
- **Test path** — `POST /api/cron/launch-reminder {"testEmail":"…"}` (same secret) runs the exact reminder code for that
  one existing waitlist row, at any time.
- **Unsubscribe** — every email has a link `/api/waitlist/unsubscribe?t=<random token>` (GET asks, POST unsubscribes)
  and RFC 8058 one-click `List-Unsubscribe` headers.

## Observability

Outcomes `waitlist_signup_success` · `_duplicate` · `_validation_error` (reason: invalid_email, invalid_request,
honeypot, rate_limited) · `_server_error` are Sentry metrics + logs and rows in `analytics_events` (dimensions: form,
source, campaign — never the email or name). Unexpected failures are Sentry issues tagged `area=db op=waitlist_signup`
with only the Postgres/PostgREST error code. Page views: `landing_page_view` with `variant=prelaunch`. Emails:
`waitlist_confirmation_sent` / `_failed`, `launch_reminder_sent` / `_failed` / `_run` (counts and error codes only).

## Operating it

- Force on/off: `PRELAUNCH_MODE=on|off` (Vercel env, redeploy). Default `auto`.
- Owner preview of the real product during pre-launch: set `PRELAUNCH_PREVIEW_TOKEN`, open `/?preview=<token>`.
- Local review: `PRELAUNCH_MODE=on` with the local stack (see the review server in the PR notes).
- Production needs migrations `20251006001500` and `20251006001600` applied **before** this code is deployed, and
  `CRON_SECRET` set in Vercel Production.
- After launch the code is dormant; remove `app/(prelaunch)`, `components/prelaunch`, `middleware.ts` routing and
  `/api/waitlist` in a later cleanup (keep the table).
