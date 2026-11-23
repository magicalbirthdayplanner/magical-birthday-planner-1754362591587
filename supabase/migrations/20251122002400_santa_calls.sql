-- =============================================================================
-- Magical Santa — minutes wallet, previews and sessions (docs/MAGICAL_HOLIDAYS_TECHNICAL_ARCHITECTURE.md)
--
-- Product rules (docs/MAGICAL_HOLIDAYS_PRODUCT_REQUIREMENTS.md):
--   * Parents buy TIME with Santa: $4.99 = 3 minutes; top-ups add more (same product, quantity 1–3).
--     santa_orders.seconds_granted is credited when the payment succeeds.
--   * A call may use the remaining balance (capped per call). Only CONNECTED time is charged, and a session shorter
--     than min_charge_seconds is free (failed / tiny connections never cost the parent anything).
--   * A drop costs only the seconds actually used; the parent simply calls again with what's left.
--   * Free PREVIEWS: anyone, no sign-up, preview_seconds (30 s). Capped per client (hashed IP, daily) and per day
--     globally; they share the global concurrency cap with paid calls.
--
-- Santa purchases are NOT party plans: own order ledger, so nothing in the live birthday billing changes. Shared with
-- birthday billing: the Dodo account, webhook signature verification, billing_webhook_events, billing_customers.
--
-- No transcripts, audio or video are stored. Clients READ their own rows; every write goes through the server
-- (service role). All RPCs are service-role only. Re-runnable.
-- =============================================================================

-- ---------------------------------------------------------------- settings (kill switch + caps)
create table if not exists public.santa_settings (
  id boolean primary key default true check (id),
  calls_enabled boolean not null default false,
  previews_enabled boolean not null default false,
  max_concurrent_sessions integer not null default 10 check (max_concurrent_sessions between 0 and 10000),
  daily_session_cap integer not null default 500 check (daily_session_cap between 0 and 1000000),
  max_call_seconds integer not null default 600 check (max_call_seconds between 60 and 3600),
  min_charge_seconds integer not null default 15 check (min_charge_seconds between 0 and 120),
  preview_seconds integer not null default 30 check (preview_seconds between 10 and 120),
  previews_per_client_per_day integer not null default 3 check (previews_per_client_per_day between 0 and 50),
  daily_preview_cap integer not null default 300 check (daily_preview_cap between 0 and 100000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.santa_settings (id) values (true) on conflict do nothing;
alter table public.santa_settings enable row level security;
revoke all on public.santa_settings from anon, authenticated;

-- ---------------------------------------------------------------- checkouts & orders
create table if not exists public.santa_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pack text not null check (pack ~ '^[A-Z0-9_]{2,32}$'),
  quantity integer not null default 1 check (quantity between 1 and 10),
  provider text not null default 'dodo',
  product_id text not null,
  session_id text unique,
  amount_minor integer not null check (amount_minor > 0),
  currency text not null default 'USD',
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'expired')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_santa_checkouts_user on public.santa_checkouts (user_id, created_at desc);

create table if not exists public.santa_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  checkout_id uuid references public.santa_checkouts(id) on delete set null,
  provider text not null default 'dodo',
  provider_ref text not null,
  pack text not null,
  quantity integer not null default 1 check (quantity between 1 and 10),
  product_id text,
  status text not null check (status in ('pending', 'active', 'failed', 'refunded', 'review')),
  amount_minor integer,
  currency text,
  seconds_granted integer not null check (seconds_granted between 0 and 36000),
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_ref)
);
create index if not exists idx_santa_orders_user on public.santa_orders (user_id, status, created_at);
drop trigger if exists santa_orders_updated_at on public.santa_orders;
create trigger santa_orders_updated_at before update on public.santa_orders for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- children & consent
create table if not exists public.santa_children (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 40),
  age smallint not null check (age between 2 and 12),
  -- Validated server-side against SantaChildProfileSchema (lib/santa/persona.ts); size-capped here too.
  profile jsonb not null default '{}'::jsonb check (pg_column_size(profile) < 8192),
  -- Parent approved this version of the details. Changing the profile clears it.
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_santa_children_user on public.santa_children (user_id, created_at);
drop trigger if exists santa_children_updated_at on public.santa_children;
create trigger santa_children_updated_at before update on public.santa_children for each row execute function public.set_updated_at();

create or replace function public.santa_children_reset_approval()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.first_name, new.age, new.profile) is distinct from (old.first_name, old.age, old.profile)
     and new.approved_at is not distinct from old.approved_at then
    new.approved_at := null;
  end if;
  return new;
end $$;
drop trigger if exists santa_children_reset_approval on public.santa_children;
create trigger santa_children_reset_approval before update on public.santa_children
  for each row execute function public.santa_children_reset_approval();

create table if not exists public.santa_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid references public.santa_children(id) on delete set null,
  notice_version text not null check (notice_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}\.[0-9]+$'),
  affirmations text[] not null,
  method text not null check (method in ('signed_in_parent_checkbox', 'card_purchase_with_notice')),
  accepted_at timestamptz not null default now(),
  withdrawn_at timestamptz
);
create index if not exists idx_santa_consents_user on public.santa_consents (user_id, notice_version) where withdrawn_at is null;

-- ---------------------------------------------------------------- sessions (paid calls and free previews)
create table if not exists public.santa_sessions (
  id uuid primary key default gen_random_uuid(),
  -- Usage/accounting survives child or account deletion (FKs set null); nothing personal is stored on the row.
  user_id uuid references auth.users(id) on delete set null,
  child_id uuid references public.santa_children(id) on delete set null,
  kind text not null check (kind in ('call', 'preview')),
  status text not null default 'reserved' check (status in ('reserved', 'connecting', 'active', 'ended', 'failed')),
  provider text not null,
  provider_session_id text unique,
  prompt_version text not null,
  max_seconds integer not null check (max_seconds between 10 and 3600),
  -- Previews: daily-salted hash of the client (IP) for per-client limits, and the hash of the secret the browser holds.
  client_hash text check (client_hash is null or client_hash ~ '^[0-9a-f]{64}$'),
  preview_token_hash text check (preview_token_hash is null or preview_token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  connected_at timestamptz,
  ended_at timestamptz,
  connected_seconds integer,
  charged_seconds integer not null default 0 check (charged_seconds >= 0),
  billed_seconds integer,
  provider_cost_cents numeric(10, 2),
  end_reason text check (end_reason is null or end_reason ~ '^[a-z_]{2,40}$'),
  updated_at timestamptz not null default now(),
  check (kind = 'preview' or client_hash is null),
  check (kind = 'call' or charged_seconds = 0)
);
create index if not exists idx_santa_sessions_user on public.santa_sessions (user_id, created_at desc);
create index if not exists idx_santa_sessions_open on public.santa_sessions (status, created_at) where status in ('reserved', 'connecting', 'active');
create index if not exists idx_santa_sessions_preview on public.santa_sessions (client_hash, created_at) where kind = 'preview';
drop trigger if exists santa_sessions_updated_at on public.santa_sessions;
create trigger santa_sessions_updated_at before update on public.santa_sessions for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- RLS: read own, write server-only
alter table public.santa_checkouts enable row level security;
alter table public.santa_orders enable row level security;
alter table public.santa_children enable row level security;
alter table public.santa_consents enable row level security;
alter table public.santa_sessions enable row level security;
revoke insert, update, delete on public.santa_checkouts, public.santa_orders, public.santa_children, public.santa_consents,
  public.santa_sessions from anon, authenticated;

drop policy if exists santa_checkouts_select_own on public.santa_checkouts;
create policy santa_checkouts_select_own on public.santa_checkouts for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists santa_orders_select_own on public.santa_orders;
create policy santa_orders_select_own on public.santa_orders for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists santa_children_select_own on public.santa_children;
create policy santa_children_select_own on public.santa_children for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists santa_consents_select_own on public.santa_consents;
create policy santa_consents_select_own on public.santa_consents for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists santa_sessions_select_own on public.santa_sessions;
create policy santa_sessions_select_own on public.santa_sessions for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- balance (seconds)
create or replace function public.santa_balance(p_user uuid)
returns table (seconds_granted bigint, seconds_used bigint, seconds_remaining bigint)
language sql stable security definer set search_path = '' as $$
  with g as (select coalesce(sum(o.seconds_granted), 0) as n from public.santa_orders o where o.user_id = p_user and o.status = 'active'),
       u as (select coalesce(sum(s.charged_seconds), 0) as n from public.santa_sessions s where s.user_id = p_user and s.kind = 'call')
  select g.n, u.n, greatest(0, g.n - u.n) from g, u
$$;

-- Shared admission checks (kill switch, concurrency, daily caps). Caller holds the global lock.
create or replace function public.santa_admit(p_kind text)
returns public.santa_settings
language plpgsql security definer set search_path = '' as $$
declare s public.santa_settings; n integer;
begin
  select * into s from public.santa_settings where id;
  if not coalesce(s.calls_enabled, false) then raise exception 'calls_disabled'; end if;
  if p_kind = 'preview' and not s.previews_enabled then raise exception 'previews_disabled'; end if;
  select count(*) into n from public.santa_sessions where status in ('reserved', 'connecting', 'active');
  if n >= s.max_concurrent_sessions then raise exception 'capacity'; end if;
  select count(*) into n from public.santa_sessions where created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  if n >= s.daily_session_cap then raise exception 'daily_cap'; end if;
  return s;
end $$;

-- ---------------------------------------------------------------- start a paid call (atomic)
-- Errors (message = code): calls_disabled | session_in_progress | child_not_found | consent_required | not_approved |
-- capacity | daily_cap | no_credit
create or replace function public.santa_start_session(p_user uuid, p_child uuid, p_notice_version text, p_provider text, p_prompt_version text)
returns public.santa_sessions
language plpgsql security definer set search_path = '' as $$
declare s public.santa_settings; ses public.santa_sessions; remaining bigint;
begin
  perform pg_advisory_xact_lock(hashtext('santa:user:' || p_user::text));
  perform pg_advisory_xact_lock(hashtext('santa:global'));
  s := public.santa_admit('call');
  if exists (select 1 from public.santa_sessions where user_id = p_user and status in ('reserved', 'connecting', 'active')) then
    raise exception 'session_in_progress';
  end if;
  if not exists (select 1 from public.santa_children where id = p_child and user_id = p_user) then raise exception 'child_not_found'; end if;
  if not exists (select 1 from public.santa_consents where user_id = p_user and notice_version = p_notice_version and withdrawn_at is null) then
    raise exception 'consent_required';
  end if;
  if not exists (select 1 from public.santa_children where id = p_child and approved_at is not null) then raise exception 'not_approved'; end if;
  select b.seconds_remaining into remaining from public.santa_balance(p_user) b;
  if coalesce(remaining, 0) < 20 then raise exception 'no_credit'; end if;
  insert into public.santa_sessions (user_id, child_id, kind, provider, prompt_version, max_seconds)
  values (p_user, p_child, 'call', p_provider, p_prompt_version, least(remaining, s.max_call_seconds)::integer)
  returning * into ses;
  return ses;
end $$;

-- ---------------------------------------------------------------- start a free preview (anonymous, atomic)
-- Errors: calls_disabled | previews_disabled | capacity | daily_cap | preview_limit
create or replace function public.santa_start_preview(p_client_hash text, p_token_hash text, p_provider text, p_prompt_version text)
returns public.santa_sessions
language plpgsql security definer set search_path = '' as $$
declare s public.santa_settings; ses public.santa_sessions; n integer;
  today timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
begin
  perform pg_advisory_xact_lock(hashtext('santa:client:' || p_client_hash));
  perform pg_advisory_xact_lock(hashtext('santa:global'));
  s := public.santa_admit('preview');
  select count(*) into n from public.santa_sessions where kind = 'preview' and client_hash = p_client_hash and created_at >= today and status <> 'failed';
  if n >= s.previews_per_client_per_day then raise exception 'preview_limit'; end if;
  select count(*) into n from public.santa_sessions where kind = 'preview' and created_at >= today;
  if n >= s.daily_preview_cap then raise exception 'preview_limit'; end if;
  insert into public.santa_sessions (kind, provider, prompt_version, max_seconds, client_hash, preview_token_hash)
  values ('preview', p_provider, p_prompt_version, s.preview_seconds, p_client_hash, p_token_hash)
  returning * into ses;
  return ses;
end $$;

-- ---------------------------------------------------------------- lifecycle
create or replace function public.santa_attach_session(p_session uuid, p_provider_session text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.santa_sessions set provider_session_id = p_provider_session, status = 'connecting'
   where id = p_session and status = 'reserved';
  if not found then raise exception 'session_not_reserved'; end if;
end $$;

create or replace function public.santa_mark_connected(p_session uuid, p_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.santa_sessions set status = 'active', connected_at = coalesce(connected_at, least(p_at, now()))
   where id = p_session and status in ('reserved', 'connecting', 'active');
end $$;

-- End a session (idempotent). Paid calls are charged their connected seconds (capped at max_seconds), or nothing if
-- under min_charge_seconds. A later call only fills in billed_seconds / provider cost.
create or replace function public.santa_end_session(p_session uuid, p_status text, p_ended_at timestamptz, p_reason text,
                                                    p_billed_seconds integer, p_cost_cents numeric)
returns public.santa_sessions
language plpgsql security definer set search_path = '' as $$
declare ses public.santa_sessions; min_s integer; ended timestamptz; secs integer;
begin
  if p_status not in ('ended', 'failed') then raise exception 'bad_status'; end if;
  select * into ses from public.santa_sessions where id = p_session for update;
  if not found then raise exception 'session_not_found'; end if;
  if ses.status in ('ended', 'failed') then
    update public.santa_sessions set billed_seconds = coalesce(billed_seconds, p_billed_seconds),
                                     provider_cost_cents = coalesce(provider_cost_cents, p_cost_cents)
     where id = p_session returning * into ses;
    return ses;
  end if;
  select min_charge_seconds into min_s from public.santa_settings where id;
  ended := least(coalesce(p_ended_at, now()), now());
  secs := case when ses.connected_at is null then 0
               else least(ses.max_seconds, greatest(0, floor(extract(epoch from (ended - ses.connected_at)))::integer)) end;
  update public.santa_sessions
     set status = case when ses.connected_at is null then 'failed' else p_status end,
         ended_at = ended, connected_seconds = secs, end_reason = p_reason,
         charged_seconds = case when ses.kind = 'call' and secs >= coalesce(min_s, 15) then secs else 0 end,
         billed_seconds = p_billed_seconds, provider_cost_cents = p_cost_cents
   where id = p_session returning * into ses;
  return ses;
end $$;

-- Work for the reaper (cron): sessions that never connected within 2 min or ran past their cap + 60 s grace.
create or replace function public.santa_stale_sessions()
returns setof public.santa_sessions language sql stable security definer set search_path = '' as $$
  select * from public.santa_sessions
   where (status in ('reserved', 'connecting') and created_at < now() - interval '2 minutes')
      or (status = 'active' and connected_at < now() - make_interval(secs => max_seconds + 60))
$$;

revoke all on function public.santa_balance(uuid) from public, anon, authenticated;
revoke all on function public.santa_admit(text) from public, anon, authenticated;
revoke all on function public.santa_start_session(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.santa_start_preview(text, text, text, text) from public, anon, authenticated;
revoke all on function public.santa_attach_session(uuid, text) from public, anon, authenticated;
revoke all on function public.santa_mark_connected(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.santa_end_session(uuid, text, timestamptz, text, integer, numeric) from public, anon, authenticated;
revoke all on function public.santa_stale_sessions() from public, anon, authenticated;
grant execute on function public.santa_balance(uuid) to service_role;
grant execute on function public.santa_start_session(uuid, uuid, text, text, text) to service_role;
grant execute on function public.santa_start_preview(text, text, text, text) to service_role;
grant execute on function public.santa_attach_session(uuid, text) to service_role;
grant execute on function public.santa_mark_connected(uuid, timestamptz) to service_role;
grant execute on function public.santa_end_session(uuid, text, timestamptz, text, integer, numeric) to service_role;
grant execute on function public.santa_stale_sessions() to service_role;
