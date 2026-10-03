-- =============================================================================
-- Party Experience layer (Activities, timeline, host content, food). Additive and idempotent.
--
-- * party_ai_activities becomes THE canonical activity table (AI-created and parent-created). New columns describe
--   the activity, its status ('idea' = saved, 'planned' = in the party plan) and provenance (origin ai/user,
--   user_edited, approved_at, the guest count / theme it was made for). Long text sections live in `details`.
-- * checklist_items / party_shopping_items / party_budget_lines get a nullable source_activity_id, so prep tasks,
--   supplies and cost estimates trace back to their activity without duplicates.
-- * party_timeline_items: the single party-day timeline (ordered; activity rows take their duration from the
--   activity, so editing an activity's duration moves the schedule).
-- * party_host_content: saved speeches / announcements / thank-you messages.
-- * party_food_items: the party menu with quantities.
-- * remove_party_activity(): removes an activity and what only it needed, atomically, under the caller's RLS.
-- RLS everywhere via owns_party(); nothing here touches billing, auth or entitlements.
-- =============================================================================

-- New AI features (still behind AI_ENABLED_FEATURES).
alter table public.ai_generations drop constraint if exists ai_generations_feature_check;
alter table public.ai_generations add constraint ai_generations_feature_check check (feature in (
  'party_planner','theme_ideas','checklist','budget_optimizer','activities','food','invitation','timeline','shopping_list','discover_explain',
  'activity_studio','host_content','party_experience'));

-- ---------------------------------------------------------------- activities
alter table public.party_ai_activities
  add column if not exists category text not null default 'game',
  add column if not exists age_min integer,
  add column if not exists age_max integer,
  add column if not exists setting text not null default 'either',
  add column if not exists difficulty text not null default 'easy',
  add column if not exists cleanup_level text not null default 'low',
  add column if not exists status text not null default 'planned',
  add column if not exists origin text not null default 'ai',
  add column if not exists user_edited boolean not null default false,
  add column if not exists approved_at timestamptz,
  add column if not exists designed_for_guests integer,
  add column if not exists designed_for_theme text,
  add column if not exists sort_order integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'party_ai_activities_experience_check') then
    alter table public.party_ai_activities add constraint party_ai_activities_experience_check check (
      category in ('game','craft','treasure_hunt','active','calm','performance','food','other')
      and setting in ('indoor','outdoor','either')
      and difficulty in ('easy','medium','hard')
      and cleanup_level in ('none','low','medium','high')
      and status in ('idea','planned')
      and origin in ('ai','user')
      and (age_min is null or age_min between 0 and 18)
      and (age_max is null or age_max between 0 and 18)
      and (designed_for_guests is null or designed_for_guests between 0 and 500)
      and char_length(coalesce(designed_for_theme, '')) <= 80);
  end if;
end $$;
-- Existing rows keep their data untouched (no backfill): status defaults to 'planned' (they were added to the plan by
-- the parent); approved_at stays null for them, which the app treats the same as approved.
create index if not exists party_ai_activities_party_idx on public.party_ai_activities (party_id, status, sort_order);

-- ---------------------------------------------------------------- links back to an activity
alter table public.checklist_items add column if not exists source_activity_id uuid references public.party_ai_activities(id) on delete set null;
alter table public.party_shopping_items add column if not exists source_activity_id uuid references public.party_ai_activities(id) on delete set null;
alter table public.party_budget_lines add column if not exists source_activity_id uuid references public.party_ai_activities(id) on delete set null;
create index if not exists checklist_items_activity_idx on public.checklist_items (source_activity_id) where source_activity_id is not null;
create index if not exists party_shopping_items_activity_idx on public.party_shopping_items (source_activity_id) where source_activity_id is not null;
create index if not exists party_budget_lines_activity_idx on public.party_budget_lines (source_activity_id) where source_activity_id is not null;

-- ---------------------------------------------------------------- timeline (single source of truth)
create table if not exists public.party_timeline_items (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'other' check (kind in ('arrival','welcome','activity','food','cake','gifts','closing','other')),
  label text not null check (char_length(label) between 1 and 120),
  -- null for activity rows = use the activity's own duration
  duration_min integer check (duration_min between 0 and 600),
  sort_order integer not null default 0,
  activity_id uuid references public.party_ai_activities(id) on delete cascade,
  origin text not null default 'user' check (origin in ('ai','user')),
  source_generation_id uuid references public.ai_generations(id) on delete set null,
  source_item_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists party_timeline_items_activity_once on public.party_timeline_items (party_id, activity_id) where activity_id is not null;
create index if not exists party_timeline_items_party_idx on public.party_timeline_items (party_id, sort_order);

-- ---------------------------------------------------------------- host content
create table if not exists public.party_host_content (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('welcome','activity_intro','cake','closing','thank_you_all','thank_you_guest','reminder')),
  title text check (char_length(title) <= 120),
  body text not null check (char_length(body) between 1 and 4000),
  activity_id uuid references public.party_ai_activities(id) on delete set null,
  guest_id uuid references public.guests(id) on delete cascade,
  origin text not null default 'ai' check (origin in ('ai','user')),
  user_edited boolean not null default false,
  source_generation_id uuid references public.ai_generations(id) on delete set null,
  source_item_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists party_host_content_party_idx on public.party_host_content (party_id, kind, created_at);

-- ---------------------------------------------------------------- food (menu)
create table if not exists public.party_food_items (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category text not null default 'other' check (category in ('main','snack','dessert','cake','drink','other')),
  quantity numeric(10,2) check (quantity >= 0 and quantity <= 10000),
  unit text check (char_length(unit) <= 30),
  estimated_cost numeric(10,2) check (estimated_cost >= 0 and estimated_cost <= 100000),
  dietary_tags text[] not null default '{}',
  notes text check (char_length(notes) <= 300),
  designed_for_guests integer check (designed_for_guests between 0 and 500),
  origin text not null default 'ai' check (origin in ('ai','user')),
  user_edited boolean not null default false,
  source_generation_id uuid references public.ai_generations(id) on delete set null,
  source_item_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists party_food_items_dedupe on public.party_food_items (party_id, lower(name));

do $$
declare t text;
begin
  foreach t in array array['party_timeline_items', 'party_host_content', 'party_food_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.owns_party(party_id))', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.owns_party(party_id) and user_id = (select auth.uid()))', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.owns_party(party_id)) with check (public.owns_party(party_id) and user_id = (select auth.uid()))', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.owns_party(party_id))', t || '_delete_own', t);
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- A timeline/host row may only point at an activity / guest of the same party.
create or replace function public.party_experience_same_party()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.activity_id is not null and not exists (select 1 from public.party_ai_activities a where a.id = new.activity_id and a.party_id = new.party_id) then
    raise exception 'activity belongs to another party' using errcode = '23503';
  end if;
  if tg_table_name = 'party_host_content' then
    -- (separate IF: plpgsql may evaluate both sides of AND, and timeline rows have no guest_id)
    if new.guest_id is not null and not exists (select 1 from public.guests g where g.id = new.guest_id and g.party_id = new.party_id) then
      raise exception 'guest belongs to another party' using errcode = '23503';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists party_timeline_items_same_party on public.party_timeline_items;
create trigger party_timeline_items_same_party before insert or update on public.party_timeline_items for each row execute function public.party_experience_same_party();
drop trigger if exists party_host_content_same_party on public.party_host_content;
create trigger party_host_content_same_party before insert or update on public.party_host_content for each row execute function public.party_experience_same_party();

-- Same rule for the new source_activity_id links.
create or replace function public.source_activity_same_party()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.source_activity_id is not null and not exists (select 1 from public.party_ai_activities a where a.id = new.source_activity_id and a.party_id = new.party_id) then
    raise exception 'activity belongs to another party' using errcode = '23503';
  end if;
  return new;
end $$;
drop trigger if exists checklist_items_source_activity on public.checklist_items;
create trigger checklist_items_source_activity before insert or update of source_activity_id on public.checklist_items for each row execute function public.source_activity_same_party();
drop trigger if exists party_shopping_items_source_activity on public.party_shopping_items;
create trigger party_shopping_items_source_activity before insert or update of source_activity_id on public.party_shopping_items for each row execute function public.source_activity_same_party();
drop trigger if exists party_budget_lines_source_activity on public.party_budget_lines;
create trigger party_budget_lines_source_activity before insert or update of source_activity_id on public.party_budget_lines for each row execute function public.source_activity_same_party();

-- Remove an activity plus what only it needed: unfinished prep tasks and planned cost lines with no actual spend.
-- Supplies stay on the shopping list (they may be bought); timeline rows go with the activity (FK cascade).
-- SECURITY INVOKER: every statement runs under the caller's RLS.
create or replace function public.remove_party_activity(p_activity uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_party uuid; n_tasks int; n_budget int;
begin
  select party_id into v_party from public.party_ai_activities where id = p_activity;
  if v_party is null then raise exception 'activity not found' using errcode = 'P0002'; end if;
  delete from public.checklist_items where source_activity_id = p_activity and completed_at is null;
  get diagnostics n_tasks = row_count;
  delete from public.party_budget_lines where source_activity_id = p_activity and actual_amount is null;
  get diagnostics n_budget = row_count;
  delete from public.party_ai_activities where id = p_activity;
  return jsonb_build_object('tasks_removed', n_tasks, 'budget_lines_removed', n_budget);
end $$;
revoke all on function public.remove_party_activity(uuid) from public, anon;
grant execute on function public.remove_party_activity(uuid) to authenticated;
