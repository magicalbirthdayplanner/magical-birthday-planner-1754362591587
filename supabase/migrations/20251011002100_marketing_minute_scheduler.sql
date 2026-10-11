-- Minute-precise scheduler for the marketing engine (Vercel Hobby crons only fire somewhere within the hour).
-- pg_cron runs public.marketing_tick() every 5 minutes; it calls the protected publish endpoint with pg_net.
-- The endpoint URL and CRON_SECRET live in Supabase Vault (names marketing_cron_url / marketing_cron_secret) —
-- never in this file. Without both secrets (e.g. local stacks) the tick does nothing. Idempotent.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function public.marketing_tick(p_task text default 'publish')
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  if p_task not in ('publish', 'prepare', 'plan') then return null; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'marketing_cron_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'marketing_cron_secret';
  if v_url is null or v_secret is null then return null; end if;
  return net.http_get(
    url := v_url || '?task=' || p_task || '&source=pg_cron',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 60000
  );
end $$;
revoke all on function public.marketing_tick(text) from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'marketing-publish';
  perform cron.schedule('marketing-publish', '*/5 * * * *', 'select public.marketing_tick(''publish'')');
end $$;
