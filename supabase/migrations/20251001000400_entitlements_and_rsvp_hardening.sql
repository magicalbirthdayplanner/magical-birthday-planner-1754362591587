-- =============================================================================
-- Entitlement integrity + RSVP hardening. Idempotent; safe for production.
--
-- 1. Plan / trial columns are SERVER-MANAGED. Requests made with an end-user JWT
--    (role anon/authenticated) can no longer change them; the service role and
--    database owner (webhooks, migrations, admin tooling) still can.
-- 2. Legacy billing tables that may exist only in production (profiles,
--    subscriptions, invoices, user_purchases) lose client write grants.
-- 3. submit_rsvp is no longer callable from browsers (it is called by the
--    rate-limited /api/invite/[token]/rsvp route with the service role) and no
--    longer matches existing guests by name (name collision → overwrite).
-- =============================================================================

-- True when the current statement comes from an end user through PostgREST.
create or replace function public.is_end_user_request()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(
           nullif(current_setting('request.jwt.claim.role', true), ''),
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
         ) in ('anon', 'authenticated');
$$;

-- Generic guard: TG_ARGV lists the protected columns. Works whether or not every
-- column exists (compares jsonb projections), so it is safe on unknown schemas.
create or replace function public.guard_server_managed_columns()
returns trigger language plpgsql set search_path = '' as $$
declare
  col text;
  newj jsonb := to_jsonb(new);
  oldj jsonb;
begin
  if not public.is_end_user_request() then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    oldj := to_jsonb(old);
    foreach col in array tg_argv loop
      if (newj -> col) is distinct from (oldj -> col) then
        raise exception 'Column % is managed by the server', col using errcode = '42501';
      end if;
    end loop;
  end if;
  return new;
end $$;

-- users: inserts by the user themselves get server-chosen entitlement values
-- (the one-time 24h trial the product grants every new account), whatever the client sent.
create or replace function public.users_server_entitlements_on_insert()
returns trigger language plpgsql set search_path = '' as $$
declare
  now_ts timestamptz := now();
begin
  if public.is_end_user_request() then
    new.current_plan := 'PRO';
    new.trial_plan := 'PRO';
    new.trial_started_at := now_ts;
    new.trial_expires_at := now_ts + interval '24 hours';
    new.is_trial_active := true;
    new.has_used_trial := true;
  end if;
  return new;
end $$;

do $$
begin
  if to_regclass('public.users') is not null then
    execute 'drop trigger if exists users_guard_entitlements on public.users';
    execute $t$create trigger users_guard_entitlements before update on public.users
      for each row execute function public.guard_server_managed_columns(
        'current_plan', 'trial_plan', 'trial_started_at', 'trial_expires_at', 'is_trial_active', 'has_used_trial',
        'currentPlan', 'subscription_plan', 'subscription_status', 'role', 'is_admin')$t$;
    execute 'drop trigger if exists users_entitlements_on_insert on public.users';
    execute 'create trigger users_entitlements_on_insert before insert on public.users
      for each row execute function public.users_server_entitlements_on_insert()';
  end if;

  -- Production-only profiles table (written by the legacy purchase route).
  if to_regclass('public.profiles') is not null then
    execute 'drop trigger if exists profiles_guard_entitlements on public.profiles';
    execute $t$create trigger profiles_guard_entitlements before update on public.profiles
      for each row execute function public.guard_server_managed_columns(
        'subscription_plan', 'subscription_status', 'current_plan', 'plan', 'role', 'is_admin')$t$;
  end if;
end $$;

-- Billing records are written only by the server (payment webhook, service role).
do $$
declare t text;
begin
  foreach t in array array['subscriptions', 'invoices', 'user_purchases'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------- RSVP
create or replace function public.submit_rsvp(
  p_token text, p_name text, p_email text, p_status text,
  p_adults integer default 1, p_children integer default 0, p_note text default null
) returns json language plpgsql security definer set search_path = '' as $$
declare
  inv record;
  v_guest_id uuid;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_name text := trim(coalesce(p_name, ''));
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then
    raise exception 'invitation_not_found' using errcode = 'P0002';
  end if;
  if p_status not in ('CONFIRMED', 'DECLINED', 'MAYBE') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if v_email is not null and (char_length(v_email) > 200 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if coalesce(p_adults, 0) not between 0 and 20 or coalesce(p_children, 0) not between 0 and 20 then
    raise exception 'invalid_counts' using errcode = '22023';
  end if;

  select i.party_id, p.user_id into inv
    from public.party_invitations i join public.parties p on p.id = i.party_id
   where i.token = p_token and i.is_active;
  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0002';
  end if;

  if (select count(*) from public.guests g where g.party_id = inv.party_id and g.source = 'rsvp_link') >= 300 then
    raise exception 'rsvp_limit_reached' using errcode = '54000';
  end if;

  -- Only an exact email match updates an existing RSVP. Names are never used to
  -- match (anyone with the link could otherwise overwrite another family's answer).
  if v_email is not null then
    select g.id into v_guest_id from public.guests g
     where g.party_id = inv.party_id and g.source = 'rsvp_link' and lower(g.email) = v_email limit 1;
  end if;

  if v_guest_id is null then
    insert into public.guests (party_id, user_id, name, email, rsvp_status, adult_count, child_count,
                               notes, source, invite_status, responded_at)
    values (inv.party_id, inv.user_id, v_name, v_email, p_status, coalesce(p_adults, 1), coalesce(p_children, 0),
            left(p_note, 500), 'rsvp_link', 'VIEWED', now());
  else
    update public.guests
       set rsvp_status = p_status, adult_count = coalesce(p_adults, adult_count),
           child_count = coalesce(p_children, child_count),
           notes = coalesce(left(p_note, 500), notes), responded_at = now(), name = v_name
     where id = v_guest_id;
  end if;

  return json_build_object('ok', true, 'status', p_status);
end $$;

revoke all on function public.submit_rsvp(text, text, text, text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.submit_rsvp(text, text, text, text, integer, integer, text) to service_role;

-- get_invitation stays public (read-only, minimal projection) but rejects malformed tokens early.
create or replace function public.get_invitation(p_token text)
returns json language plpgsql stable security definer set search_path = '' as $$
declare r json;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then
    return null;
  end if;
  select json_build_object(
           'child_name', split_part(p.child_name, ' ', 1),
           'child_age', p.child_age,
           'party_date', p.party_date,
           'start_time', i.start_time,
           'end_time', i.end_time,
           'location_text', i.location_text,
           'headline', i.headline,
           'message', i.message,
           'host_name', i.host_name,
           'theme', p.theme,
           'design', i.design,
           'rsvp_by', i.rsvp_by)
    into r
    from public.party_invitations i
    join public.parties p on p.id = i.party_id
   where i.token = p_token and i.is_active;
  return r;
end $$;
revoke all on function public.get_invitation(text) from public;
grant execute on function public.get_invitation(text) to anon, authenticated;

-- Hosts can rotate their link; tokens must stay 48 lowercase hex chars (192 bits).
do $$ begin
  alter table public.party_invitations add constraint party_invitations_token_format check (token ~ '^[0-9a-f]{48}$');
exception when duplicate_object then null; end $$;
