-- =============================================================================
-- AI usage-accounting hardening (follows 0800 ai_assistant and 0900 ai_hardening).
--
-- Vulnerabilities closed:
--  1. ai_reserve was executable by `authenticated`: any signed-in user could call POST /rest/v1/rpc/ai_reserve
--     directly and add "pending" rows, which count toward the global daily breaker — ~50 free calls switched AI
--     off for everyone. Now: server-only (service_role), the server names the user it already authenticated,
--     ownership is re-checked here, and the global breaker is enforced atomically inside the reservation.
--  2. ai_generations rows were ON DELETE CASCADE from parties and auth.users, and every limit is counted from
--     those rows: deleting a party (or the account) erased usage. Now both FKs are ON DELETE SET NULL, so the
--     usage ledger survives; a BEFORE UPDATE trigger strips the content (result, input summary, applied log) the
--     moment a row is detached from its party or user, keeping only what accounting needs
--     (feature, status, provider/model, token counts, duration, error code, timestamps).
--  3. ai_global_count_today is no longer callable by end users (it leaked platform-wide usage).
--
-- Additive / non-destructive: no row is deleted or rewritten. Re-runnable.
-- Deployment note: the app version that calls the new ai_reserve(p_user, …) must be deployed right after this.
-- =============================================================================

-- ---------------------------------------------------------------- 2. usage survives party / account deletion
alter table public.ai_generations alter column party_id drop not null;
alter table public.ai_generations alter column user_id drop not null;

alter table public.ai_generations drop constraint if exists ai_generations_party_id_fkey;
alter table public.ai_generations add constraint ai_generations_party_id_fkey
  foreign key (party_id) references public.parties(id) on delete set null;
alter table public.ai_generations drop constraint if exists ai_generations_user_id_fkey;
alter table public.ai_generations add constraint ai_generations_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

-- When a row loses its party or its user (FK SET NULL runs as an UPDATE, so row triggers fire), drop everything
-- that isn't needed to count usage. The AI result can mention the child's first name, guests or the venue.
create or replace function public.ai_generations_scrub_detached()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (old.party_id is not null and new.party_id is null) or (old.user_id is not null and new.user_id is null) then
    new.result := null;
    new.input_summary := '{}'::jsonb;
    new.applied := '[]'::jsonb;
  end if;
  return new;
end $$;
drop trigger if exists ai_generations_scrub_detached on public.ai_generations;
create trigger ai_generations_scrub_detached before update of party_id, user_id on public.ai_generations
  for each row execute function public.ai_generations_scrub_detached();

-- ---------------------------------------------------------------- 1. server-only reservation
drop function if exists public.ai_reserve(uuid, text, jsonb);

create or replace function public.ai_reserve(p_user uuid, p_party uuid, p_feature text, p_input_summary jsonb default '{}'::jsonb,
  p_global_limit integer default 0)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if p_user is null then raise exception 'unauthenticated' using errcode = '42501'; end if;
  -- Defence in depth: the server already checked ownership with the user's own RLS session.
  if not exists (select 1 from public.parties p where p.id = p_party and p.user_id = p_user) then
    raise exception 'party not found' using errcode = 'P0002';
  end if;
  if pg_column_size(coalesce(p_input_summary, '{}'::jsonb)) > 4096 then
    raise exception 'input summary too large' using errcode = '22023';
  end if;
  -- Requests that never finished (crash, killed instance) stop counting after 10 minutes.
  update public.ai_generations set status = 'failed', error_code = 'stale', updated_at = now()
   where user_id = p_user and status = 'pending' and created_at < now() - interval '10 minutes';
  -- Global daily breaker, enforced atomically: reservations are serialized for the check + insert, so concurrent
  -- requests can't overshoot. Counts what reached (or may reach) the provider today (UTC), from every user —
  -- including rows whose user or party has since been deleted.
  if coalesce(p_global_limit, 0) > 0 then
    perform pg_advisory_xact_lock(hashtextextended('ai_reserve:global', 0));
    if (select count(*) from public.ai_generations
         where status in ('pending','success','failed')
           and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc') >= p_global_limit then
      raise exception 'global_limit' using errcode = '54000';
    end if;
  end if;
  insert into public.ai_generations (user_id, party_id, feature, input_summary)
  values (p_user, p_party, p_feature, coalesce(p_input_summary, '{}'::jsonb)) returning id into new_id;
  return new_id;
end $$;

revoke all on function public.ai_reserve(uuid, uuid, text, jsonb, integer) from public, anon, authenticated;
grant execute on function public.ai_reserve(uuid, uuid, text, jsonb, integer) to service_role;

-- ---------------------------------------------------------------- 3. breaker count: server only
revoke all on function public.ai_global_count_today() from public, anon, authenticated;
grant execute on function public.ai_global_count_today() to service_role;
