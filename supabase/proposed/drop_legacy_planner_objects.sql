-- PROPOSED — REQUIRES APPROVAL. DESTRUCTIVE. Not applied anywhere.
--
-- Drops database objects that only the retired desktop planner used. The mobile-first app
-- does not read or write any of them (verified by code search when the repository was
-- consolidated; see docs/LEGACY_CLEANUP_REPORT.md §9).
--
-- Before applying in production:
--   1. Take a backup (Supabase → Database → Backups, or pg_dump of these objects).
--   2. Confirm they hold no data you want to keep:
--        select count(*) from activities; select count(*) from activity_favorites;
--        select count(*) from party_activities; select count(*) from theme_preferences;
--        select count(*) from invitations;
--        select count(*) from parties where checklist_data is not null or share_token is not null
--          or selected_theme is not null or party_location is not null or child_gender is not null;
--   3. Move this file into supabase/migrations/ with a new timestamp and run `supabase db push`.

begin;

drop view if exists public.user_trial_status;

drop function if exists public.start_24_hour_trial(uuid);
drop function if exists public.get_trial_status(uuid);
drop function if exists public.check_and_expire_trial(uuid);

drop table if exists public.activity_favorites;
drop table if exists public.party_activities;
drop table if exists public.activities;
drop table if exists public.theme_preferences;
drop table if exists public.invitations;   -- old per-guest invitations (replaced by party_invitations)

alter table public.parties
  drop column if exists checklist_data,   -- replaced by checklist_items
  drop column if exists is_shared,        -- old public share links (policy already removed)
  drop column if exists shared_at,
  drop column if exists share_token,
  drop column if exists selected_theme,   -- replaced by theme / theme_details
  drop column if exists party_location,   -- replaced by party_invitations.location_text
  drop column if exists child_gender;

commit;
