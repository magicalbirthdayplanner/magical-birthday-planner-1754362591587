-- =============================================================================
-- Launch waitlist emails (follows 20251006001500_launch_waitlist.sql). Additive and idempotent.
--
-- * confirmation_sent_at     — set once the "you're on the list" email was accepted by Resend.
-- * launch_reminder_sent_at  — set once the Oct 12 launch reminder was accepted by Resend; the reminder job only
--                              sends to subscribed rows where this is null, so re-runs never send twice.
-- * unsubscribe_token        — random per row; the email's unsubscribe link carries it (never the email address).
-- * unsubscribe_launch_waitlist(token) and the extended launch_waitlist_stats() are service-role only, like the
--   rest of the waitlist. Client roles still have no access to the table.
-- =============================================================================

alter table public.launch_waitlist add column if not exists confirmation_sent_at timestamptz;
alter table public.launch_waitlist add column if not exists launch_reminder_sent_at timestamptz;
alter table public.launch_waitlist add column if not exists unsubscribe_token uuid not null default gen_random_uuid();
create unique index if not exists launch_waitlist_unsubscribe_token_key on public.launch_waitlist (unsubscribe_token);
create index if not exists launch_waitlist_reminder_due_idx on public.launch_waitlist (created_at, id)
  where status = 'subscribed' and launch_reminder_sent_at is null;

-- One-click unsubscribe from a waitlist email. Returns false for an unknown token.
create or replace function public.unsubscribe_launch_waitlist(p_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_found boolean;
begin
  update public.launch_waitlist set status = 'unsubscribed', updated_at = now() where unsubscribe_token = p_token
  returning true into v_found;
  return coalesce(v_found, false);
end $$;
revoke all on function public.unsubscribe_launch_waitlist(uuid) from public, anon, authenticated;
grant execute on function public.unsubscribe_launch_waitlist(uuid) to service_role;

-- Same counts as before, plus email status. "Today" is the America/New_York calendar day.
create or replace function public.launch_waitlist_stats()
returns jsonb language sql stable security definer set search_path = '' as $$
  with w as (
    select coalesce(utm_source, source, 'direct') as src, coalesce(utm_campaign, '(none)') as campaign, created_at,
           confirmation_sent_at, launch_reminder_sent_at
      from public.launch_waitlist where status = 'subscribed'
  )
  select jsonb_build_object(
    'total', (select count(*) from w),
    'today', (select count(*) from w where (created_at at time zone 'America/New_York')::date = (now() at time zone 'America/New_York')::date),
    'bySource', coalesce((select jsonb_object_agg(src, n) from (select src, count(*) as n from w group by src order by n desc limit 20) s), '{}'::jsonb),
    'byCampaign', coalesce((select jsonb_object_agg(campaign, n) from (select campaign, count(*) as n from w group by campaign order by n desc limit 20) c), '{}'::jsonb),
    'confirmationsSent', (select count(*) from w where confirmation_sent_at is not null),
    'confirmationsPending', (select count(*) from w where confirmation_sent_at is null),
    'remindersSent', (select count(*) from w where launch_reminder_sent_at is not null),
    'unsubscribed', (select count(*) from public.launch_waitlist where status = 'unsubscribed')
  );
$$;
revoke all on function public.launch_waitlist_stats() from public, anon, authenticated;
grant execute on function public.launch_waitlist_stats() to service_role;
