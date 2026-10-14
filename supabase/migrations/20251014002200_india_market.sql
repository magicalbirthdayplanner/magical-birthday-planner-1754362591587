-- =============================================================================
-- India market expansion: country-aware parties, profile country, Razorpay-ready billing rows, invitation
-- projection with the event's country/timezone, and a US-vs-India market report for Super Admin.
--
-- * parties.country_code — the EVENT country ('US' | 'IN'). Every existing party is a US party (default 'US').
--   zip_code is reused as the postal code of that country (US ZIP or Indian 6-digit PIN).
-- * parties.timezone — IANA zone of the event (India parties: Asia/Kolkata). NULL = floating local time, which is
--   exactly how every existing party behaves today.
-- * parties.address_line1/address_line2/locality/district — optional event address details (all nullable).
-- * users.country_code — the account's preferred country (default for new parties only; never overrides a party).
-- * billing_checkouts.provider/amount_minor/currency — which provider the checkout was created with and, for
--   Razorpay, the authoritative order amount. Existing rows are Dodo checkouts (default 'dodo').
-- * billing_purchases.provider_order_ref — the provider's order id (Razorpay order_…) for reconciliation.
-- * get_invitation(token) — same signature; adds country_code + timezone to the public projection (no PII).
-- * admin_market_report(days) — aggregate counts per market for the Super Admin dashboard (service role only).
--
-- Additive and re-runnable. Nothing is dropped, renamed or made mandatory for existing rows; RLS is unchanged (the
-- parties/users policies are row-level and cover the new columns). Old application code ignores the new columns,
-- so this migration is safe to apply BEFORE the code that uses it (required order: migration, then deploy).
--
-- Manual reversal (only with approval, and only if no India data must be kept):
--   drop function if exists public.admin_market_report(integer);
--   alter table public.parties drop column if exists country_code, drop column if exists timezone,
--     drop column if exists address_line1, drop column if exists address_line2, drop column if exists locality,
--     drop column if exists district;
--   alter table public.users drop column if exists country_code;
--   alter table public.billing_checkouts drop column if exists provider, drop column if exists amount_minor,
--     drop column if exists currency;
--   alter table public.billing_purchases drop column if exists provider_order_ref;
--   (then re-create get_invitation from 20251001000400.)
-- =============================================================================

-- ---------------------------------------------------------------- parties: event country + address
alter table public.parties add column if not exists country_code text not null default 'US';
do $$ begin
  alter table public.parties add constraint parties_country_code_check check (country_code in ('US', 'IN'));
exception when duplicate_object then null; end $$;
alter table public.parties add column if not exists timezone text;
alter table public.parties add column if not exists address_line1 text;
alter table public.parties add column if not exists address_line2 text;
alter table public.parties add column if not exists locality text;
alter table public.parties add column if not exists district text;
do $$ begin
  alter table public.parties add constraint parties_address_lengths_check check (
    coalesce(length(timezone), 0) <= 64 and coalesce(length(address_line1), 0) <= 200 and coalesce(length(address_line2), 0) <= 200
    and coalesce(length(locality), 0) <= 120 and coalesce(length(district), 0) <= 120);
exception when duplicate_object then null; end $$;
create index if not exists idx_parties_country_created on public.parties (country_code, created_at desc);

-- ---------------------------------------------------------------- users: preferred country
alter table public.users add column if not exists country_code text;
do $$ begin
  alter table public.users add constraint users_country_code_check check (country_code is null or country_code in ('US', 'IN'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- billing: provider-aware checkouts
alter table public.billing_checkouts add column if not exists provider text not null default 'dodo';
do $$ begin
  alter table public.billing_checkouts add constraint billing_checkouts_provider_check check (provider in ('dodo', 'razorpay'));
exception when duplicate_object then null; end $$;
alter table public.billing_checkouts add column if not exists amount_minor integer;
alter table public.billing_checkouts add column if not exists currency text;
do $$ begin
  alter table public.billing_checkouts add constraint billing_checkouts_amount_check check (
    (amount_minor is null and currency is null) or (amount_minor > 0 and currency ~ '^[A-Z]{3}$'));
exception when duplicate_object then null; end $$;
create index if not exists idx_billing_checkouts_party_pending on public.billing_checkouts (party_id, plan, provider, created_at desc) where status = 'pending';

alter table public.billing_purchases add column if not exists provider_order_ref text;
create index if not exists idx_billing_purchases_order on public.billing_purchases (provider, provider_order_ref) where provider_order_ref is not null;

-- ---------------------------------------------------------------- public invitation projection
-- Same rules as 20251001000400 (48-hex token, active only, first name only); adds the event's country + timezone so
-- the public page shows dates/times the way the host's country writes them and calendar files keep the right time.
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
           'rsvp_by', i.rsvp_by,
           'country_code', p.country_code,
           'timezone', p.timezone)
    into r
    from public.party_invitations i
    join public.parties p on p.id = i.party_id
   where i.token = p_token and i.is_active;
  return r;
end $$;
revoke all on function public.get_invitation(text) from public;
grant execute on function public.get_invitation(text) to anon, authenticated;

-- ---------------------------------------------------------------- market report (Super Admin)
-- Counts only, from data we already hold: parties.country_code for party-scoped activity, the analytics "market"
-- property (the visitor's chosen country — never derived from IP) for pre-party funnel steps. No personal data.
create or replace function public.admin_market_report(p_days integer default 30)
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
  result json;
begin
  with markets(m) as (values ('US'), ('IN')),
  ev as (
    select e.event, e.anonymous_id, e.user_id, e.properties,
           coalesce(p.country_code, upper(e.properties->>'market')) as market
      from public.analytics_events e
      left join public.parties p on p.id = e.party_id
     where e.created_at >= since
  )
  select json_build_object(
    'since', since,
    'days', greatest(1, least(coalesce(p_days, 30), 365)),
    'markets', (select json_agg(json_build_object(
      'market', mk.m,
      'visitors', (select count(distinct coalesce(anonymous_id, user_id::text)) from ev where market = mk.m and event in ('landing_page_view', 'app_open')),
      'signupsStarted', (select count(*) from ev where market = mk.m and event = 'signup_started'),
      'signups', (select count(*) from ev where market = mk.m and event = 'signup_completed'),
      'profiles', (select count(*) from public.users u where u.country_code = mk.m),
      'partiesCreated', (select count(*) from public.parties p where p.country_code = mk.m and p.created_at >= since),
      'partiesTotal', (select count(*) from public.parties p where p.country_code = mk.m),
      'venueSearches', (select count(*) from ev where market = mk.m and event = 'venue_search_completed'),
      'venuesSaved', (select count(*) from ev where market = mk.m and event = 'venue_saved'),
      'invitationsShared', (select count(*) from ev where market = mk.m and event = 'invitation_shared'),
      'whatsappShares', (select count(*) from ev where market = mk.m and event = 'whatsapp_share_initiated'),
      'rsvps', (select count(*) from ev where market = mk.m and event = 'rsvp_completed'),
      'checkoutsStarted', (select count(*) from public.billing_checkouts c join public.parties p on p.id = c.party_id where p.country_code = mk.m and c.created_at >= since),
      'purchases', (select count(*) from public.billing_purchases b join public.parties p on p.id = b.party_id where p.country_code = mk.m and b.status = 'active' and b.created_at >= since),
      'paymentsFailed', (select count(*) from public.billing_purchases b join public.parties p on p.id = b.party_id where p.country_code = mk.m and b.status = 'failed' and b.created_at >= since),
      'revenue', (select coalesce(json_object_agg(cur, total), '{}'::json) from (
          select b.currency as cur, sum(b.amount_minor) as total from public.billing_purchases b join public.parties p on p.id = b.party_id
           where p.country_code = mk.m and b.status = 'active' and b.created_at >= since and b.currency is not null group by b.currency) r),
      'sources', (select coalesce(json_agg(json_build_object('source', src, 'signups', n) order by n desc), '[]'::json) from (
          select coalesce(properties->>'utm_source', 'direct') as src, count(*) as n from ev
           where market = mk.m and event = 'signup_completed' group by 1 order by 2 desc limit 8) s)
    ) order by mk.m desc) from markets mk)
  ) into result;
  return result;
end $$;
revoke all on function public.admin_market_report(integer) from public, anon, authenticated;
grant execute on function public.admin_market_report(integer) to service_role;
