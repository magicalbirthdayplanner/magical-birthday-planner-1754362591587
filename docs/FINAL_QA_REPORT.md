# Final QA report — Mobile-first Magical Birthday Planner

_Branch `mobile-first` · 2026-10-01 · base `a73a9e2`_

## Summary

The existing Next.js app was evolved — not rebuilt — into a mobile-first web app/PWA. A parent can
now, from a phone: create an account → answer nine one-tap questions → **immediately** see ranked
local party places (“We found 21 party options near you.”) → browse list or map, filter, open, save,
compare and choose a venue → pick a theme → add guests → follow a countdown checklist → share an
invitation whose RSVPs land on the guest list → close the browser and continue later. Every step
persists in Supabase under owner-only RLS.

Verification: **117 unit + 48 integration (RLS/API) + 15 Playwright E2E tests, all passing**, plus
lint (0 errors), typecheck, production build and a client-bundle secret scan.

## Features implemented (spec phase → status)

| Phase | Delivered |
|---|---|
| 0 Audit | `MOBILE_FIRST_AUDIT.md`; critical security findings acted on immediately |
| 1 Shell | `(app)` shell: sticky header, 5-tab bottom nav, safe areas, scoped design system; `(flow)` full-screen group; legacy pages untouched in `(site)` |
| 2 Wizard | `/start` — 9 single-question screens, live ZIP validation, draft persistence, inline sign-up/Google, then straight to discovery |
| 3 ZIP → discovery | offline ZIP dataset (41,488 ZIPs) + Google fallback; coordinates stored on the party; automatic search |
| 4 Venue list | search, chips, filters sheet, infinite scroll, skeletons, aha banner, honest cards |
| 5 Map | Google Maps + MarkerClusterer (with browser key) / schematic clustered map (fallback); draggable non-modal sheet; persisted list/map toggle |
| 6 Venue detail | photos w/ attribution, rating, distance, price, hours, phone, website, directions, share, why-recommended, save, add to party |
| 7 Save/shortlist | Supabase-persisted saves, private notes, compare (2–4), share, add to party |
| 8 Dashboard | Home (“what next?”, countdown, % complete, next action) and Plan (milestones, details, edit) |
| 9 Themes | catalogue recommendations for the child, popular, browse/search, custom, optional AI (auth, rate limit, validation, 30-day cache) |
| 10 Guests | add/edit/delete, RSVP + invite status, search, filters, headcounts |
| 11 Checklist | generated from date/guests/venue/theme/setting; Today/This week/Later/Completed; overdue; custom tasks; auto-completion of milestones |
| 12 Invitations | 3 designs, preview, Web Share/SMS/email/copy, token-scoped public RSVP page, add-to-calendar |
| 13 PWA | manifest, icons, SW (offline shell, no API caching), offline page/banner, install prompt |
| 14 Analytics | typed catalogue (all 17 spec events + extras), batched client tracker, server ingestion, discovery metrics |
| 15 Security | see below |
| 16 Performance | see below |
| 17 E2E | Playwright suite at 375/390/393/430 |
| 18 Hardening | error boundaries, 404, security headers, CI workflow, release runbook |

## Architecture

```
app/(site)/*        legacy marketing + desktop planner (unchanged URLs)
app/(app)/*         mobile shell screens          components/{home,plan,discover,guests,invite,more}
app/(flow)/*        wizard, auth, venue, public invite, offline
app/api/discovery/* zip · search · places/[id] · photo        app/api/themes/ai · app/api/analytics
lib/discovery       taxonomy · query plan · ranking · service · stores · filters      (UI-free)
lib/google          Places (New) + Geocoding clients                                  (server-only)
lib/geo             ZIP dataset lookup · distance · projection/clustering
lib/planning        wizard · checklist · progress · themes · AI theme parsing         (pure)
lib/data            browser data layer on Supabase (RLS) + SWR hooks
lib/server          auth (bearer → user-scoped client) · service-role client · rate limit · http
supabase/migrations baseline (local) + core + RLS hardening + theme details
```

Native-ready: domain logic is UI-free; a future React Native/Swift client can reuse the same
API routes and the same Supabase tables/RLS/RPCs.

## Google Places implementation

Places API (New) Text Search with a minimal field mask, Place Details only when a venue is opened,
photos via a key-less server redirect, Geocoding only as a ZIP fallback. Context-aware query
planning (≤ 8 queries), dedupe by place id, stale-if-error, PostGIS fallback, typed errors mapped to
friendly copy. Details: `GOOGLE_PLACES.md`, `LOCAL_DISCOVERY.md`.

## Supabase implementation

Real migrations replace ad-hoc SQL and `exec_sql` routes. PostGIS geography + GIST on parties,
venues and the search cache; existing tables evolved (parties, venues, venue_searches, guests,
party_venues) and new ones only where nothing existed (saved_venues, checklist_items,
party_invitations, analytics_events, ai_cache). Token-scoped public RPCs for invitations.
Details: `SUPABASE_SCHEMA.md`.

## Caching

| Layer | What | TTL |
|---|---|---|
| Supabase `venue_searches` | Text Search results per (query, ~1 km cell, radius) — shared across parents | 24 h (config) |
| Supabase `venues.details_synced_at` | Place Details | 7 days (config) |
| Photo proxy | googleusercontent URI in memory + `Cache-Control: public, max-age=21600` | 6 h |
| `ai_cache` | AI theme ideas by (age, interests, setting, guest band) | 30 days |
| SWR (browser) | discovery results, party data across tabs | session; discovery deduped 10 min |
| Service worker | static assets, app-shell HTML | versioned |

Measured locally: a repeat discovery for the same location makes **0** Google calls (8/8 cache hits).

## Security

All critical findings from the audit are either fixed in code or require owner action:
fixed — debug/account-takeover routes blocked, users/parties/child-table RLS hardened, shared-party
enumeration removed, party-venue IDOR closed, Google key removed from source and browsers,
food-vendor fabrications removed, open redirect closed, trial-escalation RPCs revoked, cache
poisoning closed, security headers, secret scan. **Owner action** — rotate all leaked secrets,
deploy, apply migrations. **Open** — billing/entitlement integrity. Full table: `SECURITY.md`.

## RLS

32 automated RLS assertions (`tests/integration/rls.test.ts`): User A ↔ User B ↔ anonymous across
parties, guests, saved venues, private notes, checklist, per-guest invitations, party invitations,
users; cross-party inserts rejected; shared parties not enumerable; catalogue/cache not writable;
public invitation exposes only first name/age/date/time/location text; RSVPs land only on the
owner’s list.

## Performance

| Route | First-load JS |
|---|---|
| `/home` | 174 kB |
| `/start` (wizard) | 176 kB |
| `/discover` | 208 kB (map code lazy-loaded) |
| `/venue/[id]` | 182 kB |
| `/plan` | 205 kB |
| `/plan/theme` | 218 kB (catalogue lazy, 15 kB gz) |
| `/invite/[token]` (public) | 162 kB |
| legacy `/party-plan` (for comparison) | 398 kB |

Also: shared 87.6 kB; lazy map/theme catalogue; 12-card pages with infinite scroll; lazy images
with explicit aspect ratios; debounced search; server cache + SWR dedupe; no request loops
(verified by network logging). Remaining weight is mostly supabase-js + React.

## E2E results

```
✓ [iphone-390] required-flow — parent plans a party end-to-end on a phone        (≈15 s)
✓ [iphone-390] error-states ×10 — auth redirect, wrong password, invalid ZIP, Google quota + retry, stored-venue fallback,
                 empty radius, empty saved/guests, offline banner, unknown invite, debug routes 404
✓ [viewports] 375 · 390 · 393 · 430 — 10 screens + map: no overflow, ≥44 px nav targets, markers
15 passed (1.4 m)
```

Bugs found by the suites and fixed: build failure without `RESEND_API_KEY`; duplicate places
breaking cache writes; checklist missing milestones completed before it existed; ~1.8k px page width
on phones; wrong “Loves art” theme badges; accent-mangling slugs; duplicate links per card.

## Known issues

* **Production schema unverified** — read access to the production DB was not available; the
  baseline is reconstructed from repo SQL + code. Run the diff in `RELEASE.md §3` before pushing.
* The configured production Supabase host returned `ENOTFOUND` during local builds — the project
  may be paused/deleted; confirm before release.
* Google Maps JS map is untested here (no browser key) — E2E runs the schematic fallback.
* No real-device or WebKit runs (Chromium mobile emulation only).
* Party-size filter can only exclude places Google marks “not good for groups”; capacity is rarely
  published.
* Rate limiting is per serverless instance.
* Legacy pages remain desktop-first and partly broken (legacy RSVP/share/favorites/emails;
  `/party-plan` paywall); the mobile app does not depend on them.
* Email-confirmation sign-ups land on the legacy `/auth/callback` flow; the wizard draft survives,
  but the parent must reopen `/start`.
* `ideavo.min.js` third-party script still loads on every page (kept per repo instruction).

## Production blockers

1. Rotate every leaked secret (Supabase service role/JWT, DB password, Google, Azure, Resend, Apify).
2. Deploy this branch (or at minimum the middleware) — account takeover is live on old code.
3. Diff and apply migrations 0100/0200/0300 to production.
4. Configure `GOOGLE_PLACES_API_KEY` (server) and `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (browser,
   referrer-restricted); add the Supabase redirect allow-list entry.
5. Fix billing/entitlements (`SECURITY.md §4`) before charging anyone.
6. Legal review of Places caching TTLs and attribution.
7. Real-device QA (`RELEASE.md §6`).

## Next recommendations

1. Payments: Dodo webhook → verified, service-role plan updates; remove client-side plan writes.
2. Delete the 37 blocked debug routes and ~10k lines of dead components; drop unused heavy deps
   (`n8n`, `apify-client`).
3. Migrate legacy RSVP/share to the new invitation model; retire `/create-party` in favour of `/start`.
4. Redis/Upstash rate limiting and a per-user daily cap on cold Google searches.
5. Add WebKit to the Playwright matrix and a Lighthouse CI budget (PWA, LCP, CLS).
6. Analytics dashboard (Supabase SQL or a PostHog sink via `addAnalyticsSink`).
7. Venue enrichment: let parents record quoted prices/capacity on saved venues (owner data, not
   fabricated), then feed it back into ranking.
8. Push reminders (Web Push) for checklist due dates once the PWA install base grows.

## Update — 2026-10-02 (integrations pass)

* Deleted 60 obsolete debug/fix/insecure route files and debug pages.
* Dodo billing implemented (checkout, verified webhook, idempotency, entitlement) — `BILLING_SECURITY.md`.
* Resend workflows: invitation, RSVP confirmation, host notification (escaped, idempotent, logged).
* Forgot/reset password via Supabase Auth.
* **Bug fixed:** Next.js 14’s fetch data cache was caching Supabase responses inside route
  handlers (stale plan/party data; shared stale service-role reads). All Supabase clients now use
  `cache: 'no-store'` and every route sets `fetchCache = 'force-no-store'`.
* Tests: 156 unit, 112 integration, 21 E2E — all passing. Real-service status: `INTEGRATIONS.md`.
