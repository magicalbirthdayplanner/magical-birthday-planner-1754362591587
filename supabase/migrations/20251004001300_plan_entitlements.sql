-- =============================================================================
-- Product model enforcement for non-AI paid features (lib/entitlements.ts: guests & RSVP are Starter+).
--
-- Guests and invitations are written straight from the browser through RLS, so hiding the screens is not enough:
-- the database itself refuses guest / invitation writes for accounts without paid access. Paid access =
-- an active admin override (other than FREE), an active purchase, or the 24 h sign-up trial (which unlocks
-- Starter's non-AI features; AI stays paid — enforced in lib/ai/handler.ts). Same precedence as
-- recompute_entitlement(): override → purchase → trial.
--
-- Not affected: reading and deleting your own guests/invitation (nothing is lost on downgrade), and the public RSVP
-- route (submit_rsvp, service role) — guests can still answer an invitation that was already sent.
-- Additive; re-runnable; no data is changed.
-- =============================================================================

create or replace function public.has_paid_access()
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); ov text;
begin
  if uid is null then return false; end if;
  if exists (select 1 from public.user_roles r where r.user_id = uid and r.role = 'super_admin') then return true; end if;
  select po.plan into ov from public.plan_overrides po where po.user_id = uid and (po.expires_at is null or po.expires_at > now());
  if ov is not null then return ov <> 'FREE'; end if;
  if exists (select 1 from public.billing_purchases bp where bp.user_id = uid and bp.status = 'active'
               and (bp.current_period_end is null or bp.current_period_end > now())) then return true; end if;
  return exists (select 1 from public.users u where u.id = uid and coalesce(u.is_trial_active, false) and u.trial_expires_at > now());
end $$;
revoke all on function public.has_paid_access() from public, anon;
grant execute on function public.has_paid_access() to authenticated, service_role;

-- guests: create / change require paid access; read and delete stay owner-only as before.
drop policy if exists guests_insert_own on public.guests;
create policy guests_insert_own on public.guests for insert to authenticated
  with check (public.owns_party(party_id) and user_id = (select auth.uid()) and (select public.has_paid_access()));
drop policy if exists guests_update_own on public.guests;
create policy guests_update_own on public.guests for update to authenticated
  using (public.owns_party(party_id))
  with check (public.owns_party(party_id) and user_id = (select auth.uid()) and (select public.has_paid_access()));

-- invitations (link + emailed invitations): same rule.
drop policy if exists party_invitations_insert_own on public.party_invitations;
create policy party_invitations_insert_own on public.party_invitations for insert to authenticated
  with check (public.owns_party(party_id) and user_id = (select auth.uid()) and (select public.has_paid_access()));
drop policy if exists party_invitations_update_own on public.party_invitations;
create policy party_invitations_update_own on public.party_invitations for update to authenticated
  using (public.owns_party(party_id))
  with check (public.owns_party(party_id) and user_id = (select auth.uid()) and (select public.has_paid_access()));
