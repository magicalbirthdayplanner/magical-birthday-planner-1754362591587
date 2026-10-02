-- =============================================================================
-- Super Admin: roles, admin plan overrides, audit log. Additive and idempotent.
--
-- * user_roles       — server-managed roles. Users can read only their own row.
-- * plan_overrides   — an administrator's plan override for a user (FREE..PRO),
--                      optionally expiring. Users can read only their own row.
-- * admin_audit_log  — every administrative action. No client access at all.
--
-- No table here has an INSERT/UPDATE/DELETE policy and writes are revoked from
-- anon/authenticated: only the server (service role), after verifying the caller
-- holds `super_admin`, can change them. An override is NOT a purchase: it never
-- touches billing_* tables; recompute_entitlement simply gives it precedence.
-- =============================================================================

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin')),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null
);

create table if not exists public.plan_overrides (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null check (plan in ('FREE', 'STARTER', 'PLUS', 'PRO')),
  expires_at timestamptz,
  set_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text,
  action text not null check (action in ('override_set', 'override_changed', 'override_removed', 'override_expired', 'role_granted', 'role_revoked')),
  old_plan text,
  new_plan text,
  override_expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_target_idx on public.admin_audit_log (target_user_id, created_at desc);

alter table public.user_roles enable row level security;
alter table public.plan_overrides enable row level security;
alter table public.admin_audit_log enable row level security;

drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own on public.user_roles for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists plan_overrides_select_own on public.plan_overrides;
create policy plan_overrides_select_own on public.plan_overrides for select to authenticated using ((select auth.uid()) = user_id);
-- admin_audit_log: intentionally no policies (server only).

revoke insert, update, delete, truncate on public.user_roles, public.plan_overrides from anon, authenticated;
revoke all on public.admin_audit_log from anon, authenticated;

-- Entitlement: an unexpired admin override wins; then paid purchases; then the trial.
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

-- One-time seed of the initial Super Admin (the only place the email appears).
do $$
declare admin_id uuid;
begin
  select id into admin_id from auth.users where lower(email) = 'arunpx2015@email.iimcal.ac.in';
  if admin_id is not null and not exists (select 1 from public.user_roles where user_id = admin_id) then
    insert into public.user_roles (user_id, role) values (admin_id, 'super_admin');
    insert into public.admin_audit_log (admin_user_id, target_user_id, target_email, action, new_plan)
      values (null, admin_id, 'arunpx2015@email.iimcal.ac.in', 'role_granted', 'super_admin');
  end if;
end $$;
