-- =============================================================================
-- Founding families: the first 25 accounts get Pro free (owner ruling 2026-10-09, replaces the pre-launch waitlist).
--
-- * founding_members — one row per seat (1..25). A seat is taken when an account's email is CONFIRMED (Google sign-in
--   is confirmed at once; email sign-up when the link is clicked), so unconfirmed/bot sign-ups never use a seat.
-- * Taking a seat writes a plan_overrides row (PRO, no expiry): the existing, already-enforced account-wide path
--   (recompute_entitlement, has_paid_access, getUserPlan → AI, guests/RSVP RLS) — nothing new to enforce.
--   A Super Admin can still change or remove that override; the seat stays taken.
-- * Never a seat: Super Admins and reserved test addresses (*.test, *.invalid, @resend.dev smoke-test inboxes).
-- * Deleting an account frees its seat (ON DELETE CASCADE) and its override.
-- * Seats are handed out under a transaction advisory lock: concurrent confirmations can never exceed 25.
-- Additive and re-runnable. No backfill: seats go to accounts confirmed from now on.
-- =============================================================================

create table if not exists public.founding_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  seat smallint not null unique check (seat between 1 and 25),
  granted_at timestamptz not null default now()
);
alter table public.founding_members enable row level security;
drop policy if exists founding_members_select_own on public.founding_members;
create policy founding_members_select_own on public.founding_members for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete, truncate on public.founding_members from anon, authenticated;

create or replace function public.founding_seats_total()
returns integer language sql immutable set search_path = '' as $$ select 25 $$;

-- Public: how many seats are left (a count only — no one's identity). Used by the landing and pricing pages.
create or replace function public.founding_seats_left()
returns integer language sql stable security definer set search_path = '' as $$
  select greatest(0, public.founding_seats_total() - (select count(*)::integer from public.founding_members))
$$;
revoke all on function public.founding_seats_left() from public;
grant execute on function public.founding_seats_left() to anon, authenticated, service_role;

-- Give p_user the lowest free seat, if one is left and the account qualifies. Returns the seat, or null.
create or replace function public.claim_founding_seat(p_user uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_seat integer;
begin
  -- One claimer at a time (key = hashtext('founding_members')); released at commit.
  perform pg_advisory_xact_lock(hashtext('founding_members'));
  select seat into v_seat from public.founding_members where user_id = p_user;
  if v_seat is not null then return v_seat; end if;

  select lower(u.email) into v_email from auth.users u where u.id = p_user and u.email_confirmed_at is not null;
  if v_email is null
     or v_email ~ '\.(test|invalid)$'
     or v_email like '%@resend.dev'
     or exists (select 1 from public.user_roles r where r.user_id = p_user and r.role = 'super_admin') then
    return null;
  end if;

  select s into v_seat from generate_series(1, public.founding_seats_total()) s
   where not exists (select 1 from public.founding_members m where m.seat = s)
   order by s limit 1;
  if v_seat is null then return null; end if;

  insert into public.founding_members (user_id, seat) values (p_user, v_seat);
  -- Never replaces an override an admin already set.
  insert into public.plan_overrides (user_id, plan, expires_at, set_by) values (p_user, 'PRO', null, null)
  on conflict (user_id) do nothing;
  if exists (select 1 from public.users where id = p_user) then perform public.recompute_entitlement(p_user); end if;
  return v_seat;
end $$;
revoke all on function public.claim_founding_seat(uuid) from public, anon, authenticated;
grant execute on function public.claim_founding_seat(uuid) to service_role;

-- Claim when the email becomes confirmed (or is confirmed at creation: Google, admin-created users).
-- Never blocks sign-up: any failure here is swallowed.
create or replace function public.on_auth_user_confirmed_founding()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null and (tg_op = 'INSERT' or old.email_confirmed_at is null) then
    begin
      perform public.claim_founding_seat(new.id);
    exception when others then
      raise warning 'claim_founding_seat failed for %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end $$;
revoke all on function public.on_auth_user_confirmed_founding() from public, anon, authenticated;

-- Named to sort after on_auth_user_created (creates public.users) so the profile exists when the plan is recomputed.
drop trigger if exists on_auth_user_founding_seat on auth.users;
create trigger on_auth_user_founding_seat after insert or update of email_confirmed_at on auth.users
  for each row execute function public.on_auth_user_confirmed_founding();
