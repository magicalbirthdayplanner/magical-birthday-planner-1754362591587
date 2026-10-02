# Production schema diff

## Status: production schema NOT verified

* Production database read access was **not available** to this audit: a read-only, schema-only
  introspection was refused by the session’s safety policy, and no other credentials were used.
* The configured project host (`NEXT_PUBLIC_SUPABASE_URL` in the untracked `.env`) **resolves in
  DNS today**; an earlier build in this session reported `ENOTFOUND` for the same host. Resolution
  alone does not prove the project is active (paused projects keep DNS). No request was sent to it.
* Nothing was applied to production.

**Owner action:** open the Supabase dashboard for that project and confirm it is active (not paused
or deleted) and is the project you intend to launch on.

## Expected differences (repo-derived)

Production is believed to match the repo’s historic SQL files (`database/*.sql`) plus changes made
at runtime by the now-blocked “fix” routes. Against that, applying migrations 0100–0400 adds:

| Kind | Objects |
|---|---|
| Extensions | `postgis` (schema `extensions`); `pgcrypto` (likely present) |
| Tables | `saved_venues`, `checklist_items`, `party_invitations`, `analytics_events`, `ai_cache` |
| Columns — `parties` | `interests`, `latitude`, `longitude`, `location`, `city`, `state`, `search_radius_miles`, `theme_details` (+ check `parties_search_radius_range`) |
| Columns — `guests` | `adult_count`, `child_count`, `invite_status`, `invited_at`, `responded_at`, `source` (+ checks); `guests_type_check` replaced by a superset |
| Columns — `venues` | `location`, `short_address`, `primary_type`, `primary_type_label`, `categories`, `tags`, `google_maps_url`, `photo_refs`, `good_for_children`, `good_for_groups`, `editorial_summary`, `source`, `last_synced_at`, `details_synced_at`; `address`/`category` become nullable |
| Columns — `venue_searches` | `cache_key` (unique), `query_id`, `latitude`, `longitude`, `location`, `radius_meters`, `status`, `api_latency_ms`, `fetched_at` |
| Indexes | GIST on `parties.location`, `venues.location`; GIN `venues.categories`; `venue_searches(cache_key)` unique, `(expires_at)`; `parties(user_id, party_date)`; `saved_venues(user_id)`; `checklist_items(party_id, due_date)`; analytics indexes |
| Functions | `sync_location_from_lat_lng`, `set_updated_at`, `venues_near`, `get_invitation`, `submit_rsvp`, `purge_stale_places_content`, `owns_party`, `is_end_user_request`, `guard_server_managed_columns`, `users_server_entitlements_on_insert` |
| Triggers | location sync on parties/venues/venue_searches; `updated_at` on new tables; `users_guard_entitlements`, `users_entitlements_on_insert`; `profiles_guard_entitlements` if `profiles` exists |
| RLS / policies | **All** existing policies on `users`, `parties`, `guests`, `invitations`, `party_activities`, `party_venues`, `activity_favorites`, `theme_preferences`, `venues`, `venue_searches`, `venue_search_results` are dropped and replaced with the set in `SUPABASE_SECURITY_AUDIT.md` |
| Grants | revoke execute on trial RPCs, `exec_sql`/`exec`/`sql` (if present); revoke `user_trial_status` view; revoke client writes on `subscriptions`/`invoices`/`user_purchases` (if present); `submit_rsvp` service-role only |

Unknowns to check in the real diff: whether `profiles`, `subscriptions`, `invoices`,
`user_purchases`, an `exec_sql` function, or extra columns (e.g. `"currentPlan"`, `"displayName"`)
exist; whether `parties.party_date` is `date`; whether `guests.type` uses the old or new check;
whether `handle_new_user` / `on_auth_user_created` exist.

## How to produce the real diff (owner, read-only first)

```bash
supabase link --project-ref <ref>
supabase db dump --linked --schema public -f prod_schema_before.sql      # read-only
supabase db dump --linked --role-only -f prod_roles.sql
supabase migration repair --status applied 20251001000000                # baseline = already there
supabase db diff --linked --schema public > prod_vs_repo.diff            # review
supabase db push --dry-run                                               # lists 0100..0400
```

Fill in the table below from `prod_vs_repo.diff` and attach it to the release ticket.

| Category | Missing in production | Notes |
|---|---|---|
| Tables | _to fill_ | |
| Columns | _to fill_ | |
| Indexes | _to fill_ | |
| RLS differences | _to fill_ | |
| Policies | _to fill_ | |
| Functions | _to fill_ | |
| Extensions | _to fill_ | |

Do not apply migrations until the diff has been reviewed (see `RELEASE.md`).
