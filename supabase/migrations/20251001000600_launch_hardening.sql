-- Launch hardening (additive, non-destructive; safe to re-run).
--
-- 1. Indexes for the DB-backed daily email caps (invitations per host, RSVP emails
--    per party), which count email_logs rows over a rolling 24 h window.
-- 2. Defence in depth for legacy objects from the baseline schema:
--    * SECURITY DEFINER functions get a fixed search_path (they are not executable
--      by anon/authenticated today; this removes search_path hijacking if grants change).
--    * user_trial_status view runs with the caller's privileges, so RLS on users applies
--      if anyone ever grants SELECT on it (no grants exist today).

create index if not exists email_logs_user_type_created_idx on public.email_logs (user_id, email_type, created_at desc);
create index if not exists email_logs_party_type_created_idx on public.email_logs (party_id, email_type, created_at desc);

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prosecdef
      and p.proname in ('check_and_expire_trial', 'get_trial_status', 'start_24_hour_trial')
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.sig);
  end loop;
end $$;

do $$
begin
  if exists (select 1 from pg_class where relname = 'user_trial_status' and relnamespace = 'public'::regnamespace and relkind = 'v') then
    execute 'alter view public.user_trial_status set (security_invoker = true)';
  end if;
end $$;
