# Release guide

How to take the mobile-first app to production on Vercel. Status and evidence:
[`LAUNCH_READINESS_REPORT.md`](./LAUNCH_READINESS_REPORT.md). Per-service setup:
[`INTEGRATIONS.md`](./INTEGRATIONS.md).

## 1. Environment variables (Vercel → Settings → Environment Variables)

Use [`.env.example`](../.env.example) as the definitive list. It's grouped PUBLIC vs SERVER, and every
entry is read by the code.

* **Browser (`NEXT_PUBLIC_`):**
  * `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  * `NEXT_PUBLIC_BASE_URL` (the production origin)
  * `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: a separate key, Maps JavaScript API only, HTTP-referrer restricted
  * `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`
* **Server only:**
  * `SUPABASE_SERVICE_ROLE_KEY`
  * `GOOGLE_PLACES_API_KEY`
  * `RESEND_API_KEY`, `EMAIL_FROM`: an address on a domain verified in Resend
  * `DODO_PAYMENTS_*`, `DODO_PRODUCT_*`
  * optional `AZURE_OPENAI_*`
* **Live charging** requires `DODO_PAYMENTS_ENVIRONMENT=live_mode` **and**
  `DODO_LIVE_PAYMENTS_ENABLED=true`. Keep it off until it's explicitly approved.
* **Scope test-mode values to Preview.** Never reuse Preview credentials in Production.

## 2. Supabase

* **Schema:** apply `supabase/migrations/` with `supabase link --project-ref <ref> && supabase db push`.
  Every migration is additive and idempotent. Regenerate types if needed: `npm run db:types`.
* **Auth → URL Configuration:**
  * Site URL = the production origin.
  * Redirect URLs: `https://<origin>/auth/callback**` and `https://<origin>/reset-password`.
* **Auth → SMTP:** use a custom sender on your verified domain (for example Resend SMTP). The
  built-in mailer is for testing only.
* **Daily retention job** (pg_cron or a protected cron route): `select public.purge_stale_places_content(30);`

## 3. Google Cloud

* Enable **Places API (New)** and **Maps JavaScript API**. **Geocoding API** is optional; it's only
  used for ZIPs missing from the offline dataset.
* Restrict the server key to Places API (New) (plus Geocoding if enabled).
* Restrict the browser key to Maps JavaScript API and your HTTP referrers. Create a Map ID.
* Set per-API daily quotas and a billing budget alert. These are the fleet-wide hard caps
  (`GOOGLE_PLACES_COST_CONTROL.md`).

## 4. Domain

* **Canonical origin:** `https://magicalbirthdayplanner.app` (`lib/site-url.ts`, `PRODUCTION_ORIGIN`;
  `NEXT_PUBLIC_BASE_URL` overrides it).
* **Redirects:** `www` and the `*.vercel.app` production alias 308-redirect to it, configured in
  Vercel → Domains.
* **DNS:** in Cloudflare, DNS-only (see `INTEGRATIONS.md`).

## 5. Ship

1. **CI green.** `.github/workflows/ci.yml` runs lint, typecheck, unit tests, build, the secret scan,
   local-Supabase integration tests and Playwright E2E.
2. **Deploy.**
3. **Smoke test on production:**
   * sign up → confirmation email → wizard with your ZIP;
   * results with photos on a real Google map;
   * open a venue → save → add to party;
   * add a guest → email invitation → RSVP from another phone;
   * confirmation and host emails arrive;
   * checklist;
   * sign out / sign in.
4. **Monitor:**
   * Sentry issues, alerts and uptime (`docs/OBSERVABILITY.md`);
   * Google quota usage;
   * Resend bounces;
   * Supabase auth logs.

## 6. Device QA (manual)

| Device | Must pass |
|---|---|
| iPhone (Safari) at 375 / 393 / 430 | wizard keyboard (no zoom, sticky Continue), date picker, safe areas, bottom-sheet drag, map pan/pinch, share sheet, Add to Home Screen, standalone launch |
| Android (Chrome) at 393 / 412 | the same, plus the install prompt from **More** and back button closing sheets |

## 7. Rollback

* **Migrations before app.** Apply a new migration (`supabase db push --db-url <session pooler URL>`, after a
  `--dry-run`), verify it, then fast-forward `master`. Each migration header states its compatibility.
* **App:** promote the previous Vercel deployment — **check compatibility first**: after `20251004001200` the
  previous app cannot reserve AI usage (AI would fail), so fix forward instead of rolling back past it.
* **Database:** migrations only add columns, tables, functions and indexes, or replace policies with
  stricter ones. There are no destructive steps to undo.
