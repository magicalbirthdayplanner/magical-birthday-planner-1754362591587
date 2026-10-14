-- =============================================================================
-- Free launch campaign (owner ruling 2026-10-14): EVERY plan free for EVERYONE (US + India) until the end of
-- Friday 13 November 2026 (America/New_York) — 30 days after the Oct 13 launch. No card, no sign-up step.
--
-- * promo_campaigns — one row per campaign window (plan + starts_at/ends_at). Server-only table (no client policies).
-- * active_campaign() — the running campaign, if any (public: it is shown on the site). Ends by itself at ends_at.
-- * has_paid_access() / has_paid_access(party) — a running campaign counts as paid access (RLS for guests and
--   invitations), right after admin overrides (an admin override of FREE still wins, as before).
-- * The app reads the same function (lib/billing/server.ts getUserPlan → source 'campaign', plan PRO), so AI tiers,
--   per-party AI allowances (Pro: 50) and the global AI breaker apply exactly as for a Pro purchase.
-- * Nothing is written per user: when the window closes every party falls back to its own purchase / Free, with its
--   data intact. Purchases made before or during the campaign are untouched; checkout answers "already owned" for a
--   party while the campaign covers it.
--
-- End early:   update public.promo_campaigns set ends_at = now() where id = 'launch-free-30';
-- Extend:      update public.promo_campaigns set ends_at = '<timestamp>', ends_on = '<date>' where id = 'launch-free-30';
-- Additive and re-runnable; the access functions keep their signatures.
-- =============================================================================

create table if not exists public.promo_campaigns (
  id text primary key,
  plan text not null check (plan in ('STARTER', 'PLUS', 'PRO')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- the last day shown to people ("free until 13 November"); ends_at is the exact instant
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table public.promo_campaigns enable row level security;
revoke all on public.promo_campaigns from anon, authenticated;

insert into public.promo_campaigns (id, plan, starts_at, ends_at, ends_on)
values ('launch-free-30', 'PRO', '2026-10-13 04:00:00+00', '2026-11-14 05:00:00+00', '2026-11-13')
on conflict (id) do nothing;

-- The campaign running now (at most one row: the most generous plan, then the latest end).
create or replace function public.active_campaign()
returns table (id text, plan text, ends_at timestamptz, ends_on date)
language sql stable security definer set search_path = '' as $$
  select c.id, c.plan, c.ends_at, c.ends_on
    from public.promo_campaigns c
   where now() >= c.starts_at and now() < c.ends_at
   order by case c.plan when 'PRO' then 3 when 'PLUS' then 2 else 1 end desc, c.ends_at desc
   limit 1
$$;
revoke all on function public.active_campaign() from public;
grant execute on function public.active_campaign() to anon, authenticated, service_role;

-- Account-level paid access: as 20251004001400, plus a running campaign (after overrides).
create or replace function public.has_paid_access()
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); ov text;
begin
  if uid is null then return false; end if;
  if exists (select 1 from public.user_roles r where r.user_id = uid and r.role = 'super_admin') then return true; end if;
  select po.plan into ov from public.plan_overrides po where po.user_id = uid and (po.expires_at is null or po.expires_at > now());
  if ov is not null then return ov <> 'FREE'; end if;
  if exists (select 1 from public.active_campaign()) then return true; end if;
  if exists (select 1 from public.billing_purchases bp where bp.user_id = uid and bp.scope = 'account' and bp.status = 'active'
               and (bp.current_period_end is null or bp.current_period_end > now())) then return true; end if;
  return exists (select 1 from public.users u where u.id = uid and coalesce(u.is_trial_active, false) and u.trial_expires_at > now());
end $$;
revoke all on function public.has_paid_access() from public, anon;
grant execute on function public.has_paid_access() to authenticated, service_role;

-- Paid access for ONE party of the caller: as 20251004001400, plus a running campaign (after overrides). The
-- caller must still own the party for any write (owns_party in every policy).
create or replace function public.has_paid_access(p_party uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); ov text;
begin
  if uid is null or p_party is null then return false; end if;
  if exists (select 1 from public.user_roles r where r.user_id = uid and r.role = 'super_admin') then return true; end if;
  select po.plan into ov from public.plan_overrides po where po.user_id = uid and (po.expires_at is null or po.expires_at > now());
  if ov is not null then return ov <> 'FREE'; end if;
  if exists (select 1 from public.active_campaign()) then return true; end if;
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
