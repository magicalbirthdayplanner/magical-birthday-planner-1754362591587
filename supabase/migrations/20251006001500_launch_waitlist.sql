-- =============================================================================
-- Launch waitlist (temporary pre-launch mode, Oct 6–12 2026; see lib/launch.ts).
-- Additive and idempotent. Touches no existing table, policy or function.
--
-- * public.launch_waitlist: one row per normalized email (lower-cased, trimmed). Optional first name and
--   first-touch campaign attribution (source + utm_*). Repeat sign-ups bump signup_count; they never add rows
--   and never overwrite the original attribution.
-- * No client access at all: RLS on, no policies, and table privileges revoked from anon/authenticated.
--   Writes go through join_launch_waitlist() and reads through launch_waitlist_stats(), both service-role only
--   (called by /api/waitlist and /api/admin/waitlist on the server).
-- * The data outlives the pre-launch mode: it is kept for launch communication.
-- =============================================================================

create table if not exists public.launch_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 3 and 254 and email = lower(btrim(email)) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  first_name text check (first_name is null or char_length(first_name) between 1 and 60),
  source text check (source is null or char_length(source) <= 80),
  utm_source text check (utm_source is null or char_length(utm_source) <= 80),
  utm_medium text check (utm_medium is null or char_length(utm_medium) <= 80),
  utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 80),
  utm_content text check (utm_content is null or char_length(utm_content) <= 120),
  status text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed')),
  signup_count integer not null default 1 check (signup_count >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists launch_waitlist_email_key on public.launch_waitlist (email);
create index if not exists launch_waitlist_created_idx on public.launch_waitlist (created_at desc);

alter table public.launch_waitlist enable row level security;
-- No policies: nobody but the service role can read or write a row.
revoke all on table public.launch_waitlist from public, anon, authenticated;
grant select, insert, update, delete on table public.launch_waitlist to service_role;

-- Join (or re-join) the waitlist. Returns 'joined' for a new email, 'duplicate' when it was already on the list.
create or replace function public.join_launch_waitlist(p_email text, p_first_name text default null, p_source text default null,
  p_utm_source text default null, p_utm_medium text default null, p_utm_campaign text default null, p_utm_content text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_inserted boolean;
begin
  insert into public.launch_waitlist as w (email, first_name, source, utm_source, utm_medium, utm_campaign, utm_content)
  values (lower(btrim(p_email)), nullif(btrim(p_first_name), ''), nullif(btrim(p_source), ''), nullif(btrim(p_utm_source), ''),
          nullif(btrim(p_utm_medium), ''), nullif(btrim(p_utm_campaign), ''), nullif(btrim(p_utm_content), ''))
  on conflict (email) do update
     set signup_count = w.signup_count + 1,
         first_name = coalesce(w.first_name, excluded.first_name),
         status = 'subscribed',
         updated_at = now()
  returning (xmax = 0) into v_inserted;
  return case when v_inserted then 'joined' else 'duplicate' end;
end $$;
revoke all on function public.join_launch_waitlist(text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.join_launch_waitlist(text, text, text, text, text, text, text) to service_role;

-- Aggregate counts for the Super Admin dashboard. "Today" is the America/New_York calendar day.
create or replace function public.launch_waitlist_stats()
returns jsonb language sql stable security definer set search_path = '' as $$
  with w as (
    select coalesce(utm_source, source, 'direct') as src, coalesce(utm_campaign, '(none)') as campaign, created_at
      from public.launch_waitlist where status = 'subscribed'
  )
  select jsonb_build_object(
    'total', (select count(*) from w),
    'today', (select count(*) from w where (created_at at time zone 'America/New_York')::date = (now() at time zone 'America/New_York')::date),
    'bySource', coalesce((select jsonb_object_agg(src, n) from (select src, count(*) as n from w group by src order by n desc limit 20) s), '{}'::jsonb),
    'byCampaign', coalesce((select jsonb_object_agg(campaign, n) from (select campaign, count(*) as n from w group by campaign order by n desc limit 20) c), '{}'::jsonb)
  );
$$;
revoke all on function public.launch_waitlist_stats() from public, anon, authenticated;
grant execute on function public.launch_waitlist_stats() to service_role;
