-- =============================================================================
-- AI planning assistant. Additive and idempotent. Apply to production only per docs/ai/LAUNCH_CHECKLIST.md.
--
-- * ai_generations   — one row per AI request (usage, limits, the validated suggestion to apply later).
--                      Owners can READ their rows. They cannot insert/update/delete directly: reserve,
--                      finalize and mark-applied go through security-definer RPCs scoped to auth.uid() and
--                      the caller's own party, so used generations can never be "un-counted".
-- * party_ai_activities, party_shopping_items, party_budget_lines — apply targets with no existing table
--                      (party_activities requires a catalogue activity_id). Same RLS as checklist_items.
-- No prompts, free text, keys or auth data are stored; input_summary holds structured fields only.
-- =============================================================================

create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  party_id uuid not null references public.parties(id) on delete cascade,
  feature text not null check (feature in ('party_planner','theme_ideas','checklist','budget_optimizer','activities','food','invitation','timeline','shopping_list','discover_explain')),
  status text not null default 'pending' check (status in ('pending','success','failed','rejected')),
  provider text,
  model text,
  input_tokens integer,
  output_tokens integer,
  duration_ms integer,
  error_code text,
  result jsonb,
  input_summary jsonb not null default '{}'::jsonb,
  applied jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_generations_party_idx on public.ai_generations (party_id, created_at, id);
create index if not exists ai_generations_user_idx on public.ai_generations (user_id, created_at, id);
create index if not exists ai_generations_day_idx on public.ai_generations (created_at);

alter table public.ai_generations enable row level security;
drop policy if exists ai_generations_select_own on public.ai_generations;
create policy ai_generations_select_own on public.ai_generations for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete, truncate on public.ai_generations from anon, authenticated;

-- Reserve a generation (counts toward limits immediately, closing the double-click race).
create or replace function public.ai_reserve(p_party uuid, p_feature text, p_input_summary jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); new_id uuid;
begin
  if uid is null then raise exception 'unauthenticated' using errcode = '42501'; end if;
  if not exists (select 1 from public.parties p where p.id = p_party and p.user_id = uid) then
    raise exception 'party not found' using errcode = 'P0002';
  end if;
  -- Requests that never finished (crash, killed instance) stop counting after 10 minutes.
  update public.ai_generations set status = 'failed', error_code = 'stale', updated_at = now()
   where user_id = uid and status = 'pending' and created_at < now() - interval '10 minutes';
  insert into public.ai_generations (user_id, party_id, feature, input_summary)
  values (uid, p_party, p_feature, coalesce(p_input_summary, '{}'::jsonb)) returning id into new_id;
  return new_id;
end $$;

-- Finalize one of the caller's own pending rows. Success rows are immutable afterwards.
create or replace function public.ai_finalize(p_id uuid, p_status text, p_provider text, p_model text, p_input_tokens integer,
  p_output_tokens integer, p_duration_ms integer, p_error_code text, p_result jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('success','failed','rejected') then raise exception 'bad status' using errcode = '22023'; end if;
  update public.ai_generations
     set status = p_status, provider = p_provider, model = p_model, input_tokens = p_input_tokens, output_tokens = p_output_tokens,
         duration_ms = p_duration_ms, error_code = p_error_code, result = case when p_status = 'success' then p_result else null end,
         updated_at = now()
   where id = p_id and user_id = auth.uid() and status = 'pending';
end $$;

-- Record that an item was applied (dedupe log). Own successful rows only.
create or replace function public.ai_mark_applied(p_id uuid, p_entry jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.ai_generations set applied = applied || jsonb_build_array(p_entry), updated_at = now()
   where id = p_id and user_id = auth.uid() and status = 'success';
end $$;

-- Circuit breaker: today's (UTC) counted generations across ALL users. Returns a number only.
create or replace function public.ai_global_count_today()
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.ai_generations
   where status in ('pending','success') and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
$$;

revoke all on function public.ai_reserve(uuid, text, jsonb) from public, anon;
revoke all on function public.ai_finalize(uuid, text, text, text, integer, integer, integer, text, jsonb) from public, anon;
revoke all on function public.ai_mark_applied(uuid, jsonb) from public, anon;
revoke all on function public.ai_global_count_today() from public, anon;
grant execute on function public.ai_reserve(uuid, text, jsonb) to authenticated;
grant execute on function public.ai_finalize(uuid, text, text, text, integer, integer, integer, text, jsonb) to authenticated;
grant execute on function public.ai_mark_applied(uuid, jsonb) to authenticated;
grant execute on function public.ai_global_count_today() to authenticated;

-- ---------------------------------------------------------------- apply targets
create table if not exists public.party_ai_activities (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 1000),
  duration_min integer check (duration_min between 0 and 600),
  estimated_cost numeric(10,2) check (estimated_cost >= 0),
  materials text[] not null default '{}',
  details jsonb not null default '{}'::jsonb,
  source_generation_id uuid references public.ai_generations(id) on delete set null,
  source_item_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists party_ai_activities_dedupe on public.party_ai_activities (party_id, lower(name));

create table if not exists public.party_shopping_items (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item text not null check (char_length(item) between 1 and 120),
  qty text check (char_length(qty) <= 40),
  category text not null default 'other' check (category in ('food','decorations','activities','favors','other')),
  estimated_cost numeric(10,2) check (estimated_cost >= 0),
  done boolean not null default false,
  source_generation_id uuid references public.ai_generations(id) on delete set null,
  source_item_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists party_shopping_items_dedupe on public.party_shopping_items (party_id, lower(item));

create table if not exists public.party_budget_lines (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null check (char_length(category) between 1 and 60),
  label text check (char_length(label) <= 120),
  amount numeric(10,2) not null check (amount >= 0 and amount <= 100000),
  source_generation_id uuid references public.ai_generations(id) on delete set null,
  source_item_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists party_budget_lines_dedupe on public.party_budget_lines (party_id, lower(category), lower(coalesce(label, '')));

do $$
declare t text;
begin
  foreach t in array array['party_ai_activities', 'party_shopping_items', 'party_budget_lines'] loop
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

drop trigger if exists ai_generations_updated_at on public.ai_generations;
create trigger ai_generations_updated_at before update on public.ai_generations for each row execute function public.set_updated_at();
