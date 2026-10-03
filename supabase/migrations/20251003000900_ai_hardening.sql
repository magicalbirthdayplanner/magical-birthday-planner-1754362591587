-- =============================================================================
-- AI planning assistant — production-readiness hardening (follows 20251003000800_ai_assistant.sql).
-- Additive and idempotent. Apply to production only per docs/ai/LAUNCH_CHECKLIST.md, after 0800.
--
-- 1. ai_finalize becomes service-role only. Before: a signed-in user could call it on their own *pending* row
--    (while the provider call was in flight) and mark it failed/rejected — the generation stopped counting toward
--    their limits but the server still returned the result. Now only the server (service role) can finalize,
--    and it must name the row's owner.
-- 2. The global daily breaker also counts failed generations (failed calls still cost provider tokens).
-- 3. party_budget_lines.actual_amount: what the parent actually spent. AI never writes it; `amount` stays the
--    planned/estimated figure, so estimates and real costs are always distinguishable.
-- No existing billing/auth/entitlement object is touched.
-- =============================================================================

drop function if exists public.ai_finalize(uuid, text, text, text, integer, integer, integer, text, jsonb);

create or replace function public.ai_finalize(p_id uuid, p_user uuid, p_status text, p_provider text, p_model text,
  p_input_tokens integer, p_output_tokens integer, p_duration_ms integer, p_error_code text, p_result jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('success','failed','rejected') then raise exception 'bad status' using errcode = '22023'; end if;
  update public.ai_generations
     set status = p_status, provider = p_provider, model = p_model, input_tokens = p_input_tokens, output_tokens = p_output_tokens,
         duration_ms = p_duration_ms, error_code = p_error_code, result = case when p_status = 'success' then p_result else null end,
         updated_at = now()
   where id = p_id and user_id = p_user and status = 'pending';
end $$;

revoke all on function public.ai_finalize(uuid, uuid, text, text, text, integer, integer, integer, text, jsonb) from public, anon, authenticated;
grant execute on function public.ai_finalize(uuid, uuid, text, text, text, integer, integer, integer, text, jsonb) to service_role;

-- Circuit breaker: today's (UTC) generations across ALL users that reached (or may reach) the provider.
create or replace function public.ai_global_count_today()
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.ai_generations
   where status in ('pending','success','failed') and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
$$;
revoke all on function public.ai_global_count_today() from public, anon;
grant execute on function public.ai_global_count_today() to authenticated;

alter table public.party_budget_lines add column if not exists actual_amount numeric(10,2);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'party_budget_lines_actual_amount_check') then
    alter table public.party_budget_lines add constraint party_budget_lines_actual_amount_check check (actual_amount is null or (actual_amount >= 0 and actual_amount <= 100000));
  end if;
end $$;
