-- =============================================================================
-- BASELINE (LOCAL / CI ONLY) — reconstruction of the pre-existing schema
-- =============================================================================
-- The repository never had a single source of truth for its schema. This file
-- reconstructs it from database/database-setup-fixed.sql + venues-schema.sql +
-- trial-system-migration.sql + fix-users-table.sql + fix-google-auth-user-creation.sql
-- and from the columns the application code reads and writes.
--
-- It deliberately reproduces the *permissive* policies those files install
-- (e.g. "Allow authenticated users to do everything" on users, "Anyone can view
-- shared parties") so that the hardening migration and the RLS test-suite run
-- against a realistic starting point.
--
-- PRODUCTION: these objects already exist. Do NOT run this file there. Mark it as
-- applied instead:   supabase migration repair --status applied 20251001000000
-- and review `supabase db diff --linked` before pushing later migrations.
-- =============================================================================

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- users
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade deferrable initially deferred,
  email text unique not null,
  full_name text,
  avatar_url text,
  name text,
  display_name text,
  "displayName" text,
  email_notifications boolean default true,
  party_reminders boolean default true,
  marketing_emails boolean default false,
  current_plan text default 'FREE' check (current_plan in ('FREE','STARTER','PLUS','PRO','PROFESSIONAL')),
  trial_started_at timestamptz,
  trial_expires_at timestamptz,
  trial_plan text default 'PRO',
  is_trial_active boolean default false,
  has_used_trial boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.users enable row level security;
create policy "Users can view own profile" on public.users for select using (auth.uid() = id);
create policy "Users can update own profile" on public.users for update using (auth.uid() = id);
-- Permissive policies installed by fix-users-table.sql / fix-rls-policies route:
create policy "Allow authenticated users to do everything" on public.users
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Users can insert own profile" on public.users
  for insert with check (auth.uid() = id or auth.uid() is null);
create trigger update_users_updated_at before update on public.users
  for each row execute function public.update_updated_at_column();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name, current_plan, trial_started_at, trial_expires_at,
                            trial_plan, is_trial_active, has_used_trial)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'display_name'),
          'PRO', now(), now() + interval '24 hours', 'PRO', true, true)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- activities
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  full_description text,
  supplies_needed text[],
  setup_time integer not null default 0,
  helpers_required integer,
  step_by_step_instructions text not null default '',
  host_script text,
  age_group text[],
  venue_type text[],
  duration text not null default '',
  duration_minutes integer not null default 0,
  theme_compatibility text[],
  effort_level text not null default 'MEDIUM',
  participant_range text,
  min_participants integer,
  max_participants integer,
  category text not null default 'GAMES',
  tags text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.activities enable row level security;
create policy "Anyone can view activities" on public.activities for select using (true);

-- ---------------------------------------------------------------- parties
create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  child_name text not null,
  child_age integer not null,
  child_gender text,
  party_date date not null,
  party_time time,
  party_location text,
  zip_code text,
  guest_count integer default 0,
  budget numeric(10,2),
  theme text,
  selected_theme text,
  colors text[],
  venue_type text,
  checklist_data jsonb,
  status text default 'PLANNING' check (status in ('PLANNING','ACTIVE','COMPLETED','CANCELLED')),
  is_shared boolean default false,
  share_token text unique,
  shared_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_parties_user_id on public.parties(user_id);
create index if not exists idx_parties_party_date on public.parties(party_date);
alter table public.parties enable row level security;
create policy "Users can view own parties" on public.parties for select using (auth.uid() = user_id);
create policy "Users can create own parties" on public.parties for insert with check (auth.uid() = user_id);
create policy "Users can update own parties" on public.parties for update using (auth.uid() = user_id);
create policy "Users can delete own parties" on public.parties for delete using (auth.uid() = user_id);
create policy "Anyone can view shared parties" on public.parties for select using (is_shared = true);
create trigger update_parties_updated_at before update on public.parties
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------- guests
create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  type text default 'GUEST' check (type in ('GUEST','HELPER','HOST')),
  age integer,
  notes text,
  rsvp_status text default 'PENDING' check (rsvp_status in ('PENDING','CONFIRMED','DECLINED','MAYBE')),
  dietary_restrictions text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_guests_party_id on public.guests(party_id);
alter table public.guests enable row level security;
create policy "Users can manage guests of own parties" on public.guests for all
  using (exists (select 1 from public.parties p where p.id = guests.party_id and p.user_id = auth.uid()));
create trigger update_guests_updated_at before update on public.guests
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------- invitations (per guest)
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  token text unique not null,
  status text default 'PENDING' check (status in ('PENDING','SENT','ACCEPTED','DECLINED','MAYBE')),
  message text,
  notes text,
  sent_at timestamptz,
  opened_at timestamptz,
  responded_at timestamptz,
  email_sent boolean default false,
  email_opened boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.invitations enable row level security;
create policy "Users can view invitations for own parties" on public.invitations for select
  using (exists (select 1 from public.parties p where p.id = invitations.party_id and p.user_id = auth.uid()));
create policy "Users can create invitations for own parties" on public.invitations for insert
  with check (exists (select 1 from public.parties p where p.id = invitations.party_id and p.user_id = auth.uid()));

-- ---------------------------------------------------------------- party_activities / favorites / themes / email logs
create table if not exists public.party_activities (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  is_selected boolean default true,
  sort_order integer default 0,
  custom_notes text,
  estimated_time integer,
  people_required integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (party_id, activity_id)
);
alter table public.party_activities enable row level security;
create policy "Users can manage own party activities" on public.party_activities for all
  using (exists (select 1 from public.parties p where p.id = party_activities.party_id and p.user_id = auth.uid()));

create table if not exists public.activity_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, activity_id)
);
alter table public.activity_favorites enable row level security;
create policy "Users can manage own activity favorites" on public.activity_favorites for all using (auth.uid() = user_id);

create table if not exists public.theme_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  theme_name text not null,
  is_favorite boolean default true,
  created_at timestamptz default now(),
  unique (user_id, theme_name)
);
alter table public.theme_preferences enable row level security;
create policy "Users can manage own theme preferences" on public.theme_preferences for all using (auth.uid() = user_id);

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  party_id uuid references public.parties(id) on delete cascade,
  email_type text,
  recipient_email text,
  subject text,
  sent_at timestamptz default now(),
  status text,
  error_message text,
  created_at timestamptz default now()
);
alter table public.email_logs enable row level security;
create policy "Users can view own email logs" on public.email_logs for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------- venues (venues-schema.sql)
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  place_id text unique not null,
  name text not null,
  address text not null,
  formatted_address text,
  phone text,
  website text,
  rating numeric(2,1),
  reviews_count integer default 0,
  price_level integer,
  category text not null,
  types text[],
  business_status text,
  latitude numeric(10,8),
  longitude numeric(11,8),
  zip_code text,
  city text,
  state text,
  country text,
  description text,
  photos text[],
  opening_hours jsonb,
  accessibility_info text,
  parking_info text,
  party_packages_available boolean,
  max_capacity integer,
  age_restrictions text,
  amenities text[],
  last_validated_at timestamptz default now(),
  data_freshness_days integer default 30,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_venues_location on public.venues(latitude, longitude);
alter table public.venues enable row level security;
create policy "Venues are viewable by everyone" on public.venues for select using (true);
create policy "Venues are insertable by service role only" on public.venues for insert with check (false);

create table if not exists public.venue_searches (
  id uuid primary key default gen_random_uuid(),
  zip_code text not null,
  category text not null,
  radius_miles integer default 20,
  search_query text,
  min_rating numeric(2,1),
  total_results integer default 0,
  search_completed_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '7 days'),
  created_at timestamptz default now(),
  unique (zip_code, category, radius_miles, search_query, min_rating)
);
alter table public.venue_searches enable row level security;
create policy "Venue searches are viewable by everyone" on public.venue_searches for select using (true);
create policy "Venue searches are insertable by everyone" on public.venue_searches for insert with check (true);

create table if not exists public.venue_search_results (
  id uuid primary key default gen_random_uuid(),
  search_id uuid references public.venue_searches(id) on delete cascade,
  venue_id uuid references public.venues(id) on delete cascade,
  distance_miles numeric(5,2),
  search_rank integer,
  created_at timestamptz default now(),
  unique (search_id, venue_id)
);
alter table public.venue_search_results enable row level security;
create policy "Venue search results are viewable by everyone" on public.venue_search_results for select using (true);
create policy "Venue search results are insertable by everyone" on public.venue_search_results for insert with check (true);

create table if not exists public.party_venues (
  id uuid primary key default gen_random_uuid(),
  party_id uuid unique references public.parties(id) on delete cascade,
  venue_id uuid references public.venues(id) on delete set null,
  user_id uuid references public.users(id) on delete cascade,
  custom_name text,
  custom_address text,
  custom_notes text,
  selected_at timestamptz default now(),
  is_custom boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.party_venues enable row level security;
create policy "Users can view own party venues" on public.party_venues for select using (auth.uid() = user_id);
create policy "Users can insert own party venues" on public.party_venues for insert with check (auth.uid() = user_id);
create policy "Users can update own party venues" on public.party_venues for update using (auth.uid() = user_id);
create policy "Users can delete own party venues" on public.party_venues for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------- trial system (trial-system-migration.sql)
create or replace function public.start_24_hour_trial(user_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.users set trial_started_at = now(), trial_expires_at = now() + interval '24 hours',
    trial_plan = 'PRO', is_trial_active = true, has_used_trial = true, current_plan = 'PRO'
  where id = start_24_hour_trial.user_id;
end $$;

create or replace function public.check_and_expire_trial(user_id uuid)
returns boolean language plpgsql security definer as $$
begin
  update public.users set is_trial_active = false, current_plan = 'FREE'
  where id = check_and_expire_trial.user_id and is_trial_active and trial_expires_at < now();
  return found;
end $$;

create or replace function public.get_trial_status(user_id uuid)
returns json language plpgsql security definer as $$
declare r json;
begin
  select json_build_object('is_trial_active', is_trial_active, 'trial_expires_at', trial_expires_at,
                           'current_plan', current_plan, 'email', email)
  into r from public.users where id = get_trial_status.user_id;
  return r;
end $$;

grant execute on function public.start_24_hour_trial(uuid) to authenticated;
grant execute on function public.check_and_expire_trial(uuid) to authenticated;
grant execute on function public.get_trial_status(uuid) to authenticated;

create or replace view public.user_trial_status as
  select id, email, current_plan, is_trial_active, trial_expires_at, has_used_trial from public.users;
grant select on public.user_trial_status to authenticated;
