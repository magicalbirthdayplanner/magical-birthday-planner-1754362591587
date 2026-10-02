# Supabase schema

Source of truth: `supabase/migrations/`. Local stack: `npm run db:start && npm run db:reset`.
Generated types: `lib/db/database.types.ts` (`npm run db:types`).

| Migration | Purpose | Run in production? |
|---|---|---|
| `20251001000000_baseline_existing_schema.sql` | Reconstruction of the pre-existing schema (from the repo’s SQL files + code), **including the permissive policies believed to be live** so tests prove the hardening | **No** — mark applied: `supabase migration repair --status applied 20251001000000` |
| `20251001000100_mobile_first_core.sql` | PostGIS, party location, venue store, cache, saved venues, checklist, invitations, analytics, AI cache, RPCs | Yes (additive, idempotent) |
| `20251001000200_rls_hardening.sql` | Replaces every policy on user tables with owner-scoped ones; revokes dangerous functions | Yes (idempotent) |
| `20251001000300_party_theme_details.sql` | `parties.theme_details` for AI/custom themes | Yes |

Production’s exact schema could not be inspected from this environment. Before pushing, run
`supabase db diff --linked` (or `pg_dump --schema-only`) and review — see `RELEASE.md`.

## Tables used by the mobile app

### `parties` (existing, extended)
Existing columns kept. Added: `interests text[]`, `latitude`, `longitude`,
`location geography(Point,4326)` (trigger-maintained, GIST index), `city`, `state`,
`search_radius_miles int (1–50, default 20)`, `theme_details jsonb`.
Reused: `venue_type` = `indoor | outdoor | mixed` (mixed = either), `theme` = catalogue id,
`ai-…` or `custom-…`.

### `venues` (existing, evolved — shared catalogue)
`place_id` **is** the Google place id (unique). Added: `location geography` (GIST), `short_address`,
`primary_type(_label)`, `categories text[]` (GIN), `tags`, `google_maps_url`, `photo_refs jsonb`
(photo resource names + author attributions, never keys), `good_for_children`, `good_for_groups`,
`editorial_summary`, `source`, `last_synced_at`, `details_synced_at`.
Maps to the suggested spec fields: `google_place_id → place_id`, `postal_code → zip_code`,
`review_count → reviews_count`, `photos → photo_refs` (legacy `photos` kept).
RLS: public read; writes only via the service role (server).

### `venue_searches` / `venue_search_results` (existing, evolved — search cache)
Added `cache_key` (unique), `query_id`, `latitude/longitude/location`, `radius_meters`, `status`,
`api_latency_ms`, `fetched_at`; `expires_at` drives the TTL. Results keep `search_rank`.
RLS enabled with **no** client policies (previously anyone could insert ⇒ cache poisoning).

### `saved_venues` (new) — the per-party shortlist
`user_id (default auth.uid())`, `party_id`, `venue_id`, `place_id`, `notes ≤ 2000` (private),
unique `(party_id, venue_id)`.

### `party_venues` (existing) — the chosen venue (“Add to party”)
Shared with the legacy planner. Policies now also check party ownership.

### `guests` (existing, extended)
Added `adult_count`, `child_count`, `invite_status (NOT_SENT|SENT|VIEWED)`, `invited_at`,
`responded_at`, `source (host|rsvp_link)`. The `type` check accepts both historic value sets.

### `checklist_items` (new)
`task_key` unique per party (generated tasks are idempotent), `title`, `detail`, `category`,
`due_date`, `completed_at`, `sort_order`, `is_custom`. The legacy planner’s
`parties.checklist_data` is untouched.

### `party_invitations` (new)
One per party: `token` (24 random bytes, hex), `headline`, `message`, `host_name`, `location_text`,
`start_time`, `end_time`, `rsvp_by`, `design`, `is_active`, `share_count`, `last_shared_at`.
The legacy per-guest `invitations` table is unchanged.

### `analytics_events`, `ai_cache` (new)
Server-written only (RLS on, no policies).

## Functions

| Function | Security | Purpose |
|---|---|---|
| `owns_party(uuid)` | definer, stable | ownership check used by policies (avoids recursive RLS) |
| `venues_near(lat, lng, radius_m, limit)` | invoker | PostGIS `ST_DWithin` lookup — fallback when Google is down |
| `get_invitation(token)` | definer, granted to `anon` | minimal invitation projection (first name, age, date/time, location text, message) — no ZIP, budget, ids |
| `submit_rsvp(token, name, email, status, adults, children, note)` | definer, granted to `anon` | validates input, upserts a guest on the host’s list (300 RSVP cap per party) |
| `purge_stale_places_content(days)` | definer, no client grants | retention job for Places content |
| `sync_location_from_lat_lng()`, `set_updated_at()` | triggers | geography + timestamps |

## RLS model

* `users`: own row only (select/insert/update).
* `parties`: `user_id = auth.uid()` for every command; no public read.
* Party-owned tables (`guests`, `invitations`, `party_activities`, `saved_venues`,
  `checklist_items`, `party_invitations`, `party_venues`): read/delete if `owns_party(party_id)`;
  insert/update additionally require `user_id = auth.uid()`.
* `activity_favorites`, `theme_preferences`: own rows.
* Public catalogues: `venues`, `activities` readable by all.
* Server-only: `venue_searches`, `venue_search_results`, `analytics_events`, `ai_cache`.

Verified by `tests/integration/rls.test.ts` (User A / User B / anonymous across parties, guests,
saved venues + private notes, checklist, invitations, party invitations, users, shared-party
enumeration, cache writes, trial RPCs, public RSVP).
