-- =============================================================================
-- Billing (Dodo Payments). Additive and idempotent.
--
-- Entitlement is derived ONLY from verified webhook events written by the server
-- (service role). Users can read their own checkouts/purchases; nobody but the
-- server can write any billing table or users.current_plan (see 0400 guard).
-- =============================================================================

create table if not exists public.billing_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('STARTER', 'PLUS', 'PRO')),
  product_id text not null,
  session_id text unique,
  customer_email text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'expired')),
  payment_ref text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_billing_checkouts_user on public.billing_checkouts (user_id, created_at desc);
create index if not exists idx_billing_checkouts_email on public.billing_checkouts (lower(customer_email), created_at desc);

-- One row per provider payment (one-time plans) or subscription. Upserted by
-- provider_ref, so webhook retries / repeated events never create duplicates.
create table if not exists public.billing_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'dodo',
  provider_ref text not null,
  kind text not null check (kind in ('payment', 'subscription')),
  plan text not null check (plan in ('STARTER', 'PLUS', 'PRO')),
  product_id text,
  status text not null check (status in ('pending', 'active', 'failed', 'cancelled', 'refunded', 'on_hold', 'expired', 'review')),
  amount_minor integer,
  currency text,
  customer_ref text,
  current_period_end timestamptz,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_ref)
);
create index if not exists idx_billing_purchases_user on public.billing_purchases (user_id, status);
drop trigger if exists billing_purchases_updated_at on public.billing_purchases;
create trigger billing_purchases_updated_at before update on public.billing_purchases
  for each row execute function public.set_updated_at();

create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'dodo',
  provider_customer_id text not null,
  email text,
  created_at timestamptz not null default now(),
  unique (provider, provider_customer_id)
);

-- Webhook idempotency + audit trail (keyed by the webhook-id header).
create table if not exists public.billing_webhook_events (
  event_id text primary key,
  event_type text not null,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'unmatched', 'rejected', 'error')),
  user_id uuid,
  detail text,
  attempts integer not null default 1,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.billing_checkouts enable row level security;
alter table public.billing_purchases enable row level security;
alter table public.billing_customers enable row level security;
alter table public.billing_webhook_events enable row level security;

do $$ begin
  create policy billing_checkouts_select_own on public.billing_checkouts for select to authenticated using (user_id = (select auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy billing_purchases_select_own on public.billing_purchases for select to authenticated using (user_id = (select auth.uid()));
exception when duplicate_object then null; end $$;
-- No insert/update/delete policies anywhere: only the service role writes billing data.
revoke insert, update, delete on public.billing_checkouts, public.billing_purchases, public.billing_customers, public.billing_webhook_events from anon, authenticated;

-- Recompute users.current_plan from active purchases (then trial, then FREE).
-- Runs as owner; callable only by the service role.
create or replace function public.recompute_entitlement(p_user uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  paid text;
  next_plan text;
  u record;
begin
  select bp.plan into paid
    from public.billing_purchases bp
   where bp.user_id = p_user
     and bp.status = 'active'
     and (bp.current_period_end is null or bp.current_period_end > now())
   order by case bp.plan when 'PRO' then 3 when 'PLUS' then 2 when 'STARTER' then 1 else 0 end desc
   limit 1;

  select is_trial_active, trial_expires_at, trial_plan into u from public.users where id = p_user;
  if paid is not null then
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
