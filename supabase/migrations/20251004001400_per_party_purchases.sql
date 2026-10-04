-- =============================================================================
-- Per-party plans: a paid plan is bought for ONE party (Starter $4.99 / Plus $9.99 / Pro $14.99 per party).
--
-- * billing_checkouts / billing_purchases get the party the purchase is for, and a scope:
--     scope = 'party'   → unlocks the plan for that party only (all new purchases)
--     scope = 'account' → legacy purchases made before this migration (unlocks every party, as sold then)
--   A party purchase whose party is deleted keeps its row (accounting) but unlocks nothing (party_id → null).
-- * users.current_plan (recompute_entitlement) now reflects only ACCOUNT-level entitlements: admin override →
--   legacy account purchase → sign-up trial → FREE. Party purchases are resolved per party:
--   public.party_plan(p_party) (server) and public.has_paid_access(p_party) (RLS for guests/invitations).
-- * Unchanged: admin overrides and the 24 h trial are account-wide; only the service role writes billing data.
-- Additive; re-runnable; no existing row changes meaning (every existing purchase is scope 'account').
-- =============================================================================

alter table public.billing_checkouts add column if not exists party_id uuid references public.parties(id) on delete set null;

alter table public.billing_purchases add column if not exists party_id uuid references public.parties(id) on delete set null;
alter table public.billing_purchases add column if not exists scope text not null default 'account';
do $$ begin
  alter table public.billing_purchases add constraint billing_purchases_scope_check check (scope in ('account', 'party'));
exception when duplicate_object then null; end $$;
-- The server writes scope explicitly for every new purchase. The 'account' default only covers a webhook handled by
-- the previous app version during the deploy window (the buyer then gets the old, more generous behaviour).
create index if not exists idx_billing_purchases_party on public.billing_purchases (party_id, status) where party_id is not null;

-- Account-level entitlement: override → legacy (account-scope) purchase → trial → FREE.
create or replace function public.recompute_entitlement(p_user uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  paid text;
  override_plan text;
  next_plan text;
  u record;
begin
  select po.plan into override_plan
    from public.plan_overrides po
   where po.user_id = p_user
     and (po.expires_at is null or po.expires_at > now());

  select bp.plan into paid
    from public.billing_purchases bp
   where bp.user_id = p_user
     and bp.scope = 'account'
     and bp.status = 'active'
     and (bp.current_period_end is null or bp.current_period_end > now())
   order by case bp.plan when 'PRO' then 3 when 'PLUS' then 2 when 'STARTER' then 1 else 0 end desc
   limit 1;

  select is_trial_active, trial_expires_at, trial_plan into u from public.users where id = p_user;
  if override_plan is not null then
    next_plan := override_plan;
  elsif paid is not null then
    next_plan := paid;
  elsif coalesce(u.is_trial_active, false) and u.trial_expires_at > now() then
    next_plan := coalesce(u.trial_plan, 'PRO');
  else
    next_plan := 'FREE';
  end if;

  update public.users
     set current_plan = next_plan,
         is_trial_active = case when coalesce(is_trial_active, false) and trial_expires_at <= now() then false else is_trial_active end
   where id = p_user;
  return next_plan;
end $$;
revoke all on function public.recompute_entitlement(uuid) from public, anon, authenticated;
grant execute on function public.recompute_entitlement(uuid) to service_role;

-- The best plan PURCHASED for one party (null when none). Server only (service role).
create or replace function public.party_plan(p_party uuid)
returns text language sql stable security definer set search_path = '' as $$
  select bp.plan
    from public.billing_purchases bp
    join public.parties p on p.id = bp.party_id and p.user_id = bp.user_id
   where bp.party_id = p_party
     and bp.scope = 'party'
     and bp.status = 'active'
     and (bp.current_period_end is null or bp.current_period_end > now())
   order by case bp.plan when 'PRO' then 3 when 'PLUS' then 2 when 'STARTER' then 1 else 0 end desc
   limit 1
$$;
revoke all on function public.party_plan(uuid) from public, anon, authenticated;
grant execute on function public.party_plan(uuid) to service_role;

-- Account-level paid access (no party): override, legacy account purchase or trial. Kept for callers without a
-- party; it no longer counts party purchases (those unlock only their own party).
create or replace function public.has_paid_access()
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); ov text;
begin
  if uid is null then return false; end if;
  if exists (select 1 from public.user_roles r where r.user_id = uid and r.role = 'super_admin') then return true; end if;
  select po.plan into ov from public.plan_overrides po where po.user_id = uid and (po.expires_at is null or po.expires_at > now());
  if ov is not null then return ov <> 'FREE'; end if;
  if exists (select 1 from public.billing_purchases bp where bp.user_id = uid and bp.scope = 'account' and bp.status = 'active'
               and (bp.current_period_end is null or bp.current_period_end > now())) then return true; end if;
  return exists (select 1 from public.users u where u.id = uid and coalesce(u.is_trial_active, false) and u.trial_expires_at > now());
end $$;
revoke all on function public.has_paid_access() from public, anon;
grant execute on function public.has_paid_access() to authenticated, service_role;

-- Paid access for ONE party of the caller: account-level access, or an active purchase for this party
-- (an admin override of FREE still wins, as everywhere else).
create or replace function public.has_paid_access(p_party uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); ov text;
begin
  if uid is null or p_party is null then return false; end if;
  if exists (select 1 from public.user_roles r where r.user_id = uid and r.role = 'super_admin') then return true; end if;
  select po.plan into ov from public.plan_overrides po where po.user_id = uid and (po.expires_at is null or po.expires_at > now());
  if ov is not null then return ov <> 'FREE'; end if;
  if exists (select 1 from public.billing_purchases bp
               join public.parties p on p.id = bp.party_id and p.user_id = uid
              where bp.user_id = uid and bp.party_id = p_party and bp.scope = 'party' and bp.status = 'active'
                and (bp.current_period_end is null or bp.current_period_end > now())) then return true; end if;
  if exists (select 1 from public.billing_purchases bp where bp.user_id = uid and bp.scope = 'account' and bp.status = 'active'
               and (bp.current_period_end is null or bp.current_period_end > now())) then return true; end if;
  return exists (select 1 from public.users u where u.id = uid and coalesce(u.is_trial_active, false) and u.trial_expires_at > now());
end $$;
revoke all on function public.has_paid_access(uuid) from public, anon;
grant execute on function public.has_paid_access(uuid) to authenticated, service_role;

-- Guests and invitations: writes need paid access FOR THAT PARTY.
drop policy if exists guests_insert_own on public.guests;
create policy guests_insert_own on public.guests for insert to authenticated
  with check (public.owns_party(party_id) and user_id = (select auth.uid()) and public.has_paid_access(party_id));
drop policy if exists guests_update_own on public.guests;
create policy guests_update_own on public.guests for update to authenticated
  using (public.owns_party(party_id))
  with check (public.owns_party(party_id) and user_id = (select auth.uid()) and public.has_paid_access(party_id));

drop policy if exists party_invitations_insert_own on public.party_invitations;
create policy party_invitations_insert_own on public.party_invitations for insert to authenticated
  with check (public.owns_party(party_id) and user_id = (select auth.uid()) and public.has_paid_access(party_id));
drop policy if exists party_invitations_update_own on public.party_invitations;
create policy party_invitations_update_own on public.party_invitations for update to authenticated
  using (public.owns_party(party_id))
  with check (public.owns_party(party_id) and user_id = (select auth.uid()) and public.has_paid_access(party_id));
