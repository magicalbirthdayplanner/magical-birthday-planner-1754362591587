# Release guide — mobile-first

## 0. Before anything: security

Do the items in `SECURITY.md §1` first (rotate leaked secrets; ship the debug-route block).

## 1. Decisions needed from the product owner

| Decision | Default in this branch | Why it matters |
|---|---|---|
| Paywall | Mobile core flow (discovery, save, theme, guests, checklist, invitation) is available to **every signed-in user**. The legacy `/party-plan` keeps its plan gating. | The legacy gate blocked FREE users from their own party after a 24 h trial, contradicting the Definition of Done. Re-introduce limits deliberately (e.g. cap saved venues or parties) once payments are trustworthy (`SECURITY.md §4`). |
| AI themes | Optional, behind auth + rate limit, cached 30 days | Needs Azure OpenAI env vars; hides gracefully when absent |
| Places caching TTLs | 24 h search / 7 days details | Confirm with counsel against Google Maps Platform terms (`GOOGLE_PLACES.md`) |

## 2. Environment variables (Vercel → Settings → Environment Variables)

Server only: `SUPABASE_SERVICE_ROLE_KEY` (new, rotated), `GOOGLE_PLACES_API_KEY` (new; Places API
New + Geocoding only), `AZURE_OPENAI_*` (optional), `RESEND_API_KEY` (optional), `DATABASE_URL`
(scripts only). Browser: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (**separate key**, Maps JavaScript API, referrer-restricted to your
domains — required in production for the map), `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` (recommended),
`NEXT_PUBLIC_BASE_URL`. Never set `ENABLE_DEBUG_ROUTES` in production (it is ignored there anyway).
Optional tuning: `DISCOVERY_*` (see `GOOGLE_PLACES.md`).

## 3. Database (production)

The production schema could not be inspected from the build environment, so:

```bash
supabase link --project-ref <ref>
# 1. Snapshot first
supabase db dump --linked -f backup_before_mobile_first.sql
supabase db dump --linked --schema public -f schema_before.sql
# 2. The baseline file reconstructs what already exists — mark it applied, do not run it
supabase migration repair --status applied 20251001000000
# 3. Review what will change
supabase db diff --linked          # compare with schema_before.sql; check parties/guests/venues columns
supabase db push --dry-run
# 4. Apply 0100 (core), 0200 (RLS hardening), 0300 (theme details)
supabase db push
# 5. Regenerate types if the live schema differed
supabase gen types typescript --linked > lib/db/database.types.ts
```

All three migrations are additive/idempotent and were re-run twice locally without error. Points to
eyeball in the diff: the `guests_type_check` constraint is replaced by a superset; every policy on
`users`, `parties` and party-owned tables is replaced with owner-scoped ones (anything that relied
on “authenticated can do everything” will now get empty results — the legacy debug routes did).

Schedule retention (daily): `select public.purge_stale_places_content(30);` (pg_cron or a Vercel
cron calling a protected route).

## 4. Supabase Auth settings

* Redirect URLs allow-list: add `https://www.magicalbirthdayplanner.com/auth/callback**` (the mobile
  flows append `?next=/home` / `?next=/start?resume=1`) and preview domains if used.
* Email confirmation: if enabled, the wizard shows “Check your inbox”; consider magic-link or OTP
  for a smoother phone flow.

## 5. Ship

1. Merge `mobile-first` → `main` after CI is green (`.github/workflows/ci.yml` runs lint, typecheck,
   unit, build, secret scan, local-Supabase integration and Playwright E2E).
2. Deploy. Smoke test on production:
   `/home` → *Plan a party* → wizard with your ZIP → results appear with real photos and a real
   Google map → open venue → save → theme → guest → invite link opens on another phone → RSVP shows up.
3. Check `analytics_events` for `venue_search_completed` (cache hits, latency, errors).

## 6. Device QA checklist (manual — not automatable here)

| Device | Must pass |
|---|---|
| iPhone (Safari, iOS 17+) — 375 & 393/430 | wizard keyboard behaviour (no zoom, sticky Continue above keyboard), date picker, safe areas, bottom sheet drag, map pan/pinch, share sheet, Add to Home Screen, standalone launch |
| Android (Chrome) — 393/412 | same + install prompt from **More**, back button closes sheets |
| Desktop Chrome/Safari | centred column usable with mouse/keyboard; legacy `/party-plan` unaffected |

## 7. Rollback

* App: redeploy the previous build — new routes are additive; legacy URLs unchanged.
* DB: migrations only add columns/tables/functions and replace policies. To restore the old
  policies, re-create them from `schema_before.sql` (not recommended — they were insecure).

## 8. Next steps (recommended)

See `FINAL_QA_REPORT.md → Next recommendations`.
