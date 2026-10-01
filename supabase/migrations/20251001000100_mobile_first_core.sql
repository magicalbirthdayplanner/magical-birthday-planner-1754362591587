-- =============================================================================
-- Mobile-first core: location-aware parties, PostGIS venue store, cache-first
-- discovery, saved venues, checklist, party invitations, analytics, AI cache.
--
-- Additive and idempotent: safe to run against the existing production schema.
-- Existing tables are EVOLVED, not duplicated:
--   parties       + location / interests / radius        (venue_type reused for indoor/outdoor/mixed)
--   venues        + PostGIS location, Places (New) fields (place_id == Google place id)
--   venue_searches+ cache key / TTL / metrics              (venue_search_results reused as-is)
--   party_venues  reused for "Add to party" (the chosen venue)
--   guests        + RSVP counts / invite status / source
-- New tables only where no equivalent exists:
--   saved_venues (per-party shortlist with private notes), checklist_items,
--   party_invitations (party-level invite + public RSVP link), analytics_events, ai_cache
-- =============================================================================

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Shared trigger: keep a geography point in sync with latitude/longitude columns.
create or replace function public.sync_location_from_lat_lng()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.location := extensions.st_setsrid(
      extensions.st_makepoint(new.longitude::double precision, new.latitude::double precision), 4326
    )::extensions.geography;
  else
    new.location := null;
  end if;
  return new;
end $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ----------------------------------------------------------------------------- parties
alter table public.parties
  add column if not exists interests text[] not null default '{}',
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location extensions.geography(Point, 4326),
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists search_radius_miles integer not null default 20;

do $$ begin
  alter table public.parties add constraint parties_search_radius_range
    check (search_radius_miles between 1 and 50);
exception when duplicate_object then null; end $$;

drop trigger if exists parties_sync_location on public.parties;
create trigger parties_sync_location before insert or update of latitude, longitude on public.parties
  for each row execute function public.sync_location_from_lat_lng();
create index if not exists idx_parties_location on public.parties using gist (location);
create index if not exists idx_parties_user_date on public.parties (user_id, party_date);

comment on column public.parties.venue_type is 'Setting preference: indoor | outdoor | mixed (either). Legacy values preserved.';
comment on column public.parties.theme is 'Theme id from data/themes-data.ts, or "ai:<slug>" for AI themes.';

-- ----------------------------------------------------------------------------- guests
alter table public.guests
  add column if not exists adult_count integer not null default 1,
  add column if not exists child_count integer not null default 0,
  add column if not exists invite_status text not null default 'NOT_SENT',
  add column if not exists invited_at timestamptz,
  add column if not exists responded_at timestamptz,
  add column if not exists source text not null default 'host';

do $$ begin
  alter table public.guests add constraint guests_invite_status_check
    check (invite_status in ('NOT_SENT', 'SENT', 'VIEWED'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.guests add constraint guests_source_check check (source in ('host', 'rsvp_link'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.guests add constraint guests_counts_check
    check (adult_count between 0 and 20 and child_count between 0 and 20);
exception when duplicate_object then null; end $$;

-- Two incompatible guest "type" constraints exist in the repo (GUEST/HELPER/HOST vs
-- ADULT/CHILD/FAMILY/COUPLE). Accept the union so both the legacy planner and the
-- mobile app can write.
alter table public.guests drop constraint if exists guests_type_check;
alter table public.guests add constraint guests_type_check
  check (type is null or type in ('GUEST', 'HELPER', 'HOST', 'ADULT', 'CHILD', 'FAMILY', 'COUPLE'));

-- ----------------------------------------------------------------------------- venues
alter table public.venues
  add column if not exists location extensions.geography(Point, 4326),
  add column if not exists short_address text,
  add column if not exists primary_type text,
  add column if not exists primary_type_label text,
  add column if not exists categories text[] not null default '{}',
  add column if not exists tags text[] not null default '{}',
  add column if not exists google_maps_url text,
  add column if not exists photo_refs jsonb not null default '[]'::jsonb,
  add column if not exists good_for_children boolean,
  add column if not exists good_for_groups boolean,
  add column if not exists editorial_summary text,
  add column if not exists source text not null default 'google_places',
  add column if not exists last_synced_at timestamptz,
  add column if not exists details_synced_at timestamptz;

alter table public.venues alter column address drop not null;
alter table public.venues alter column category set default 'general';
alter table public.venues alter column category drop not null;

comment on column public.venues.place_id is 'Google Places place id (Places API New `id`). Stable; may be stored indefinitely.';
comment on column public.venues.photo_refs is 'Places photo resource names + author attributions. Never contains API keys.';
comment on column public.venues.photos is 'LEGACY: photo references from the old Nearby Search integration.';

drop trigger if exists venues_sync_location on public.venues;
create trigger venues_sync_location before insert or update of latitude, longitude on public.venues
  for each row execute function public.sync_location_from_lat_lng();
create index if not exists idx_venues_geo on public.venues using gist (location);
create index if not exists idx_venues_categories on public.venues using gin (categories);
create index if not exists idx_venues_last_synced on public.venues (last_synced_at);

-- Backfill geography for rows written by the legacy integration.
update public.venues set latitude = latitude where location is null and latitude is not null;

-- Spatial lookup used as graceful degradation when Google is unavailable.
create or replace function public.venues_near(
  p_lat double precision, p_lng double precision, p_radius_m integer, p_limit integer default 60
) returns table (venue_id uuid, distance_m double precision)
language sql stable security invoker set search_path = '' as $$
  select v.id, extensions.st_distance(
           v.location,
           extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography)
  from public.venues v
  where v.location is not null
    and coalesce(v.is_active, true)
    and extensions.st_dwithin(
          v.location,
          extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
          least(greatest(p_radius_m, 100), 80467))
  order by 2
  limit least(greatest(p_limit, 1), 200);
$$;
grant execute on function public.venues_near(double precision, double precision, integer, integer) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------- discovery cache
alter table public.venue_searches
  add column if not exists cache_key text,
  add column if not exists query_id text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location extensions.geography(Point, 4326),
  add column if not exists radius_meters integer,
  add column if not exists status text not null default 'ok',
  add column if not exists api_latency_ms integer,
  add column if not exists fetched_at timestamptz;
alter table public.venue_searches alter column category set default 'discovery';
alter table public.venue_searches alter column zip_code drop not null;

create unique index if not exists venue_searches_cache_key_uidx on public.venue_searches (cache_key);
drop trigger if exists venue_searches_sync_location on public.venue_searches;
create trigger venue_searches_sync_location before insert or update of latitude, longitude on public.venue_searches
  for each row execute function public.sync_location_from_lat_lng();
create index if not exists idx_venue_searches_expires on public.venue_searches (expires_at);

-- ----------------------------------------------------------------------------- saved venues
create table if not exists public.saved_venues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  party_id uuid not null references public.parties(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  place_id text not null,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (party_id, venue_id)
);
create index if not exists idx_saved_venues_user on public.saved_venues (user_id);
drop trigger if exists saved_venues_updated_at on public.saved_venues;
create trigger saved_venues_updated_at before update on public.saved_venues
  for each row execute function public.set_updated_at();
alter table public.saved_venues enable row level security;

-- ----------------------------------------------------------------------------- checklist
create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_key text not null,
  title text not null check (char_length(title) between 1 and 200),
  detail text,
  category text not null default 'general',
  due_date date,
  completed_at timestamptz,
  sort_order integer not null default 0,
  is_custom boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (party_id, task_key)
);
create index if not exists idx_checklist_party on public.checklist_items (party_id, due_date);
drop trigger if exists checklist_items_updated_at on public.checklist_items;
create trigger checklist_items_updated_at before update on public.checklist_items
  for each row execute function public.set_updated_at();
alter table public.checklist_items enable row level security;

-- ----------------------------------------------------------------------------- party invitations
create table if not exists public.party_invitations (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null unique references public.parties(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  headline text check (headline is null or char_length(headline) <= 120),
  message text check (message is null or char_length(message) <= 1000),
  host_name text check (host_name is null or char_length(host_name) <= 80),
  location_text text check (location_text is null or char_length(location_text) <= 200),
  start_time time,
  end_time time,
  rsvp_by date,
  design text not null default 'classic',
  is_active boolean not null default true,
  share_count integer not null default 0,
  last_shared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists party_invitations_updated_at on public.party_invitations;
create trigger party_invitations_updated_at before update on public.party_invitations
  for each row execute function public.set_updated_at();
alter table public.party_invitations enable row level security;

-- Public, token-scoped read: returns only what an invitee needs to see.
create or replace function public.get_invitation(p_token text)
returns json language plpgsql stable security definer set search_path = '' as $$
declare r json;
begin
  if p_token is null or char_length(p_token) < 32 then
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

-- Public, token-scoped RSVP. Creates or updates a guest on the host's list.
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

  select i.party_id, p.user_id, p.party_date into inv
    from public.party_invitations i join public.parties p on p.id = i.party_id
   where i.token = p_token and i.is_active;
  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0002';
  end if;

  if (select count(*) from public.guests g where g.party_id = inv.party_id and g.source = 'rsvp_link') >= 300 then
    raise exception 'rsvp_limit_reached' using errcode = '54000';
  end if;

  if v_email is not null then
    select g.id into v_guest_id from public.guests g
     where g.party_id = inv.party_id and lower(g.email) = v_email limit 1;
  end if;
  if v_guest_id is null then
    select g.id into v_guest_id from public.guests g
     where g.party_id = inv.party_id and lower(g.name) = lower(v_name) limit 1;
  end if;

  if v_guest_id is null then
    insert into public.guests (party_id, user_id, name, email, rsvp_status, adult_count, child_count,
                               notes, source, invite_status, responded_at)
    values (inv.party_id, inv.user_id, v_name, v_email, p_status, coalesce(p_adults, 1), coalesce(p_children, 0),
            left(p_note, 500), 'rsvp_link', 'VIEWED', now())
    returning id into v_guest_id;
  else
    update public.guests
       set rsvp_status = p_status, adult_count = coalesce(p_adults, adult_count),
           child_count = coalesce(p_children, child_count),
           notes = coalesce(left(p_note, 500), notes), responded_at = now(),
           email = coalesce(email, v_email)
     where id = v_guest_id;
  end if;

  return json_build_object('ok', true, 'status', p_status);
end $$;

revoke all on function public.get_invitation(text) from public;
revoke all on function public.submit_rsvp(text, text, text, text, integer, integer, text) from public;
grant execute on function public.get_invitation(text) to anon, authenticated;
grant execute on function public.submit_rsvp(text, text, text, text, integer, integer, text) to anon, authenticated;

-- ----------------------------------------------------------------------------- analytics
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  event text not null check (char_length(event) <= 64),
  user_id uuid,
  anonymous_id text,
  session_id text,
  party_id uuid,
  properties jsonb not null default '{}'::jsonb,
  source text not null default 'client' check (source in ('client', 'server')),
  path text,
  created_at timestamptz not null default now()
);
create index if not exists idx_analytics_event_time on public.analytics_events (event, created_at desc);
create index if not exists idx_analytics_user_time on public.analytics_events (user_id, created_at desc);
alter table public.analytics_events enable row level security;
-- No policies: written by the server with the service role only.

-- ----------------------------------------------------------------------------- AI cache
create table if not exists public.ai_cache (
  cache_key text primary key,
  kind text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.ai_cache enable row level security;
-- No policies: server-only.

-- ----------------------------------------------------------------------------- retention
-- Google Places content should not be kept longer than needed. Run daily
-- (pg_cron or a scheduled job): select public.purge_stale_places_content(30);
create or replace function public.purge_stale_places_content(p_max_age_days integer default 30)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.venue_searches where expires_at < now() - interval '1 day';
  delete from public.venues v
   where coalesce(v.last_synced_at, v.updated_at) < now() - make_interval(days => p_max_age_days)
     and not exists (select 1 from public.saved_venues s where s.venue_id = v.id)
     and not exists (select 1 from public.party_venues pv where pv.venue_id = v.id);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purge_stale_places_content(integer) from public, anon, authenticated;
