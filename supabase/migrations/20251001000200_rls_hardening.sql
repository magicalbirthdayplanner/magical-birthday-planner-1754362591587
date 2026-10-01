-- =============================================================================
-- RLS hardening. Idempotent; safe to run on production.
--
-- Production policy names are not fully known (several were created ad hoc by
-- "fix" API routes), so for user-owned tables every existing policy is dropped
-- and replaced by a small, explicit, owner-scoped set.
-- =============================================================================

create or replace function pg_temp.drop_all_policies(p_table text) returns void language plpgsql as $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = p_table loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, p_table);
  end loop;
end $$;

-- Ownership helper. SECURITY DEFINER so policies on child tables don't depend on
-- the caller's access to parties (avoids recursive RLS evaluation), and STABLE
-- so it is evaluated once per statement.
create or replace function public.owns_party(p_party_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.parties p where p.id = p_party_id and p.user_id = (select auth.uid()));
$$;
revoke all on function public.owns_party(uuid) from public;
grant execute on function public.owns_party(uuid) to authenticated;

-- ----------------------------------------------------------------------------- users
-- Removes "Allow authenticated users to do everything" (any user could read and
-- modify every user row) and "insert when auth.uid() is null" (anonymous inserts).
select pg_temp.drop_all_policies('users');
alter table public.users enable row level security;
create policy users_select_own on public.users for select to authenticated using ((select auth.uid()) = id);
create policy users_insert_own on public.users for insert to authenticated with check ((select auth.uid()) = id);
create policy users_update_own on public.users for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- ----------------------------------------------------------------------------- parties
-- Removes "Anyone can view shared parties" (is_shared = true exposed child name,
-- age, date, ZIP and budget of every shared party to anonymous callers).
select pg_temp.drop_all_policies('parties');
alter table public.parties enable row level security;
create policy parties_select_own on public.parties for select to authenticated using ((select auth.uid()) = user_id);
create policy parties_insert_own on public.parties for insert to authenticated with check ((select auth.uid()) = user_id);
create policy parties_update_own on public.parties for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy parties_delete_own on public.parties for delete to authenticated using ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------------------- party-owned tables
do $$
declare t text;
begin
  foreach t in array array['guests', 'invitations', 'party_activities', 'saved_venues',
                           'checklist_items', 'party_invitations', 'party_venues'] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    perform pg_temp.drop_all_policies(t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.owns_party(party_id))',
                   t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.owns_party(party_id) and user_id = (select auth.uid()))',
                   t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.owns_party(party_id)) with check (public.owns_party(party_id) and user_id = (select auth.uid()))',
                   t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.owns_party(party_id))',
                   t || '_delete_own', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------- per-user tables
do $$
declare t text;
begin
  foreach t in array array['activity_favorites', 'theme_preferences'] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    perform pg_temp.drop_all_policies(t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
                   t || '_own', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------- public catalogues & caches
-- venues: public business data, readable by all, written only by the server (service role).
select pg_temp.drop_all_policies('venues');
create policy venues_public_read on public.venues for select to anon, authenticated using (true);

-- venue_searches / venue_search_results: previously "insertable by everyone"
-- (cache poisoning). Server-only now.
select pg_temp.drop_all_policies('venue_searches');
select pg_temp.drop_all_policies('venue_search_results');
alter table public.venue_searches enable row level security;
alter table public.venue_search_results enable row level security;

-- ----------------------------------------------------------------------------- dangerous functions
-- Trial functions were SECURITY DEFINER, accepted any user_id and were executable by
-- every authenticated user (grant yourself PRO, read anyone's trial/email).
-- They are not called by the application.
do $$
declare f text;
begin
  foreach f in array array['public.start_24_hour_trial(uuid)', 'public.check_and_expire_trial(uuid)',
                           'public.get_trial_status(uuid)', 'public.exec_sql(text)', 'public.exec(text)',
                           'public.sql(text)'] loop
    begin
      execute format('revoke execute on function %s from public, anon, authenticated', f);
    exception when undefined_function then null;
    end;
  end loop;
end $$;

-- user_trial_status was a plain view (owner rights, bypasses RLS) listing every user's email/plan.
do $$ begin
  if to_regclass('public.user_trial_status') is not null then
    revoke all on public.user_trial_status from anon, authenticated;
  end if;
end $$;
