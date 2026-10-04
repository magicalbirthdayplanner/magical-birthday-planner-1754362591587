-- =============================================================================
-- Per-party plans: a paid plan is bought for ONE party (Starter $4.99 / Plus $9.99 / Pro $14.99 per party).
--
-- Invariant: every normal paid entitlement belongs to exactly one party.
-- * billing_checkouts / billing_purchases get the party the purchase is for, and a scope:
--     scope = 'party'   → unlocks the plan for that party only. EVERY new purchase.
--     scope = 'account' → only purchases that existed before this migration (legacy; production has none).
--   New rows can never be 'account', and a row can never change scope or move to another party (trigger below).
-- * A party purchase that could not be matched to a party (party_id null + unresolved_reason) unlocks NOTHING and
--   is listed for admin reconciliation. A party deleted after purchase also ends that plan (party_id → null).
-- * users.current_plan (recompute_entitlement) reflects only ACCOUNT-level entitlements: admin override → legacy
--   account purchase → sign-up trial → FREE. Party purchases are resolved per party: public.party_plan(p_party)
--   (server) and public.has_paid_access(p_party) (RLS for guests/invitations).
-- * Intentionally account-wide (unchanged): admin overrides and the 24 h sign-up trial.
-- Re-runnable; existing rows keep their meaning (every pre-existing purchase is scope 'account').
-- =============================================================================

alter table public.billing_checkouts add column if not exists party_id uuid references public.parties(id) on delete set null;

alter table public.billing_purchases add column if not exists party_id uuid references public.parties(id) on delete set null;
-- Adding the column with default 'account' marks only rows that already exist as legacy; then new rows default to 'party'.
alter table public.billing_purchases add column if not exists scope text not null default 'account';
alter table public.billing_purchases alter column scope set default 'party';
do $$ begin
  alter table public.billing_purchases add constraint billing_purchases_scope_check check (scope in ('account', 'party'));
exception when duplicate_object then null; end $$;
-- Why a party purchase has no party at creation (null = matched normally). Such rows need admin reconciliation.
alter table public.billing_purchases add column if not exists unresolved_reason text;
do $$ begin
  alter table public.billing_purchases add constraint billing_purchases_unresolved_check
    check (unresolved_reason is null or (scope = 'party' and unresolved_reason in ('no_checkout', 'checkout_mismatch', 'party_unavailable')));
exception when duplicate_object then null; end $$;
create index if not exists idx_billing_purchases_party on public.billing_purchases (party_id, status) where party_id is not null;
create index if not exists idx_billing_purchases_unresolved on public.billing_purchases (created_at desc) where unresolved_reason is not null;

-- Guard: no path can create an account-wide purchase or turn a party purchase into one / move it to another party.
-- (The parties FK's ON DELETE SET NULL is allowed: deleting a party ends its plan.)
create or replace function public.billing_purchases_scope_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.scope <> 'party' then raise exception 'new purchases must be party-scoped' using errcode = 'check_violation'; end if;
  else
    if new.scope is distinct from old.scope then raise exception 'purchase scope cannot change' using errcode = 'check_violation'; end if;
    -- The only allowed party change besides FK set-null: reconciling an unresolved purchase (null → its party).
    if new.party_id is not null and new.party_id is distinct from old.party_id
       and not (old.party_id is null and old.unresolved_reason is not null and new.unresolved_reason is null) then
      raise exception 'a purchase cannot move to another party' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists billing_purchases_scope_guard on public.billing_purchases;
create trigger billing_purchases_scope_guard before insert or update on public.billing_purchases
  for each row execute function public.billing_purchases_scope_guard();

-- Admin reconciliation of an unresolved payment: attach it to ONE party of the same user (service role only).
create or replace function public.reconcile_purchase(p_purchase uuid, p_party uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare bp record;
begin
  select * into bp from public.billing_purchases where id = p_purchase for update;
  if bp.id is null then raise exception 'purchase not found'; end if;
  if bp.scope <> 'party' or bp.party_id is not null or bp.unresolved_reason is null then raise exception 'purchase is not awaiting reconciliation'; end if;
  if not exists (select 1 from public.parties p where p.id = p_party and p.user_id = bp.user_id) then raise exception 'party does not belong to the purchaser'; end if;
  update public.billing_purchases set party_id = p_party, unresolved_reason = null where id = p_purchase;
end $$;
revoke all on function public.reconcile_purchase(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reconcile_purchase(uuid, uuid) to service_role;

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
