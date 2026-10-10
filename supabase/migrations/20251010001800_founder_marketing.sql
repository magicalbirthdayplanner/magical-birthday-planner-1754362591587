-- =============================================================================
-- Founder Marketing Agent (X first; other channels later). Additive, re-runnable, server-only.
--
-- * marketing_posts         — every draft/scheduled/published post, its image, validation, metrics and attribution.
-- * marketing_post_metrics  — metric snapshots over time (platform metrics + MBP-side attribution).
-- * marketing_settings      — one row: the runtime AUTONOMOUS PUBLISHING switch (default OFF). The environment must
--                             also allow it (AUTONOMOUS_PUBLISHING=true) and MARKETING_DRY_RUN=false before anything
--                             reaches a real account.
-- * marketing_insights      — learning-loop results (computed from stored metrics only).
-- * marketing_briefs        — one daily founder brief per local date.
-- * marketing_audit_log     — every admin/agent action on a post.
-- * storage bucket marketing-images (private; the admin UI uses short-lived signed URLs).
--
-- No table has a policy and all access is revoked from anon/authenticated: only the server (service role, after
-- requireSuperAdmin or the CRON_SECRET check) reads or writes them. Credentials are never stored here.
-- Publishing is claimed through marketing_claim_post(): a transaction advisory lock per platform + a conditional status
-- change, so a scheduler that runs twice can never publish the same post twice or exceed the daily limit.
-- =============================================================================

create table if not exists public.marketing_posts (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'x' check (platform in ('x', 'instagram', 'facebook', 'reddit', 'linkedin')),
  content_type text not null default 'text' check (content_type in ('text', 'text_image')),
  content_pillar text not null check (content_pillar in ('founder_journey', 'parent_pain', 'useful_tips', 'product_education', 'ai_thinking', 'community_question', 'launch_invitation')),
  topic_key text,
  topic text not null,
  hook text,
  cta text,
  text text not null check (char_length(text) between 1 and 4000),
  link_url text,
  image_path text,
  image_prompt text,
  image_alt text,
  image_provider text,
  image_status text not null default 'none' check (image_status in ('none', 'generated', 'failed', 'skipped', 'upload_failed')),
  status text not null default 'draft' check (status in ('draft', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'cancelled', 'dry_run')),
  origin text not null default 'agent' check (origin in ('agent', 'manual')),
  autonomous boolean not null default false,
  scheduled_at timestamptz,
  published_at timestamptz,
  external_post_id text,
  external_post_url text,
  external_media_id text,
  -- Platform metrics: NULL = not available (API access), never a guessed 0.
  impressions integer,
  likes integer,
  reposts integer,
  replies integer,
  quotes integer,
  bookmarks integer,
  profile_visits integer,
  link_clicks integer,
  metrics_updated_at timestamptz,
  -- MBP-side attribution (analytics_events with utm_content = this post's id).
  landing_visits_attributed integer not null default 0,
  signups_attributed integer not null default 0,
  parties_created_attributed integer not null default 0,
  checkouts_attributed integer not null default 0,
  purchases_attributed integer not null default 0,
  revenue_attributed_minor integer not null default 0,
  revenue_currency text,
  attribution_updated_at timestamptz,
  similarity_score numeric(5, 4),
  similar_post_id uuid references public.marketing_posts(id) on delete set null,
  validation jsonb not null default '{}'::jsonb,
  generation jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  publish_attempt_id uuid,
  publishing_started_at timestamptz,
  publish_attempts integer not null default 0,
  publish_error_code text,
  publish_error text,
  dry_run_at timestamptz,
  dry_run_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists marketing_posts_external_uidx on public.marketing_posts (platform, external_post_id) where external_post_id is not null;
create index if not exists marketing_posts_status_sched_idx on public.marketing_posts (status, scheduled_at);
create index if not exists marketing_posts_platform_pub_idx on public.marketing_posts (platform, published_at desc);
create index if not exists marketing_posts_created_idx on public.marketing_posts (created_at desc);

drop trigger if exists marketing_posts_updated_at on public.marketing_posts;
create trigger marketing_posts_updated_at before update on public.marketing_posts
  for each row execute function public.set_updated_at();

create table if not exists public.marketing_post_metrics (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.marketing_posts(id) on delete cascade,
  source text not null check (source in ('platform', 'mbp')),
  metrics jsonb not null,
  collected_at timestamptz not null default now()
);
create index if not exists marketing_post_metrics_post_idx on public.marketing_post_metrics (post_id, collected_at desc);

create table if not exists public.marketing_settings (
  id text primary key default 'default' check (id = 'default'),
  autonomous_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.marketing_settings (id) values ('default') on conflict (id) do nothing;

create table if not exists public.marketing_insights (
  id bigint generated always as identity primary key,
  computed_at timestamptz not null default now(),
  window_days integer not null,
  sample_size integer not null,
  data jsonb not null,
  recommendations jsonb not null default '[]'::jsonb,
  pillar_multipliers jsonb not null default '{}'::jsonb
);
create index if not exists marketing_insights_computed_idx on public.marketing_insights (computed_at desc);

create table if not exists public.marketing_briefs (
  brief_date date primary key,
  timezone text not null,
  data jsonb not null,
  text text not null,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_audit_log (
  id bigint generated always as identity primary key,
  post_id uuid references public.marketing_posts(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists marketing_audit_log_created_idx on public.marketing_audit_log (created_at desc);
create index if not exists marketing_audit_log_post_idx on public.marketing_audit_log (post_id, created_at desc);

alter table public.marketing_posts enable row level security;
alter table public.marketing_post_metrics enable row level security;
alter table public.marketing_settings enable row level security;
alter table public.marketing_insights enable row level security;
alter table public.marketing_briefs enable row level security;
alter table public.marketing_audit_log enable row level security;
-- Intentionally no policies: server only.
revoke all on public.marketing_posts, public.marketing_post_metrics, public.marketing_settings, public.marketing_insights,
  public.marketing_briefs, public.marketing_audit_log from anon, authenticated;

-- Claim one post for publishing. One claimer per platform at a time (advisory lock, released at commit).
-- Refuses when the post is not approved/scheduled, when the platform already has p_max_per_day posts since
-- p_window_start (published, simulated in dry-run, in flight, or unconfirmed), or when the last one was under
-- p_min_gap_minutes ago.
create or replace function public.marketing_claim_post(
  p_post uuid, p_attempt uuid, p_max_per_day integer, p_min_gap_minutes integer, p_window_start timestamptz
)
returns table (claimed boolean, reason text)
language plpgsql security definer set search_path = '' as $$
declare
  v_platform text;
  v_status text;
  v_count integer;
  v_last timestamptz;
begin
  select mp.platform into v_platform from public.marketing_posts mp where mp.id = p_post;
  if v_platform is null then return query select false, 'not_found'; return; end if;
  perform pg_advisory_xact_lock(hashtext('marketing_publish:' || v_platform));

  select mp.status into v_status from public.marketing_posts mp where mp.id = p_post for update;
  if v_status not in ('approved', 'scheduled') then return query select false, 'not_publishable:' || v_status; return; end if;

  select count(*)::integer into v_count
    from public.marketing_posts mp
   where mp.platform = v_platform
     and (mp.status = 'publishing'
          or (mp.status = 'published' and mp.published_at >= p_window_start)
          or (mp.status = 'dry_run' and mp.dry_run_at >= p_window_start)
          -- an unconfirmed attempt may be live: it counts until the founder resolves it
          or (mp.status = 'failed' and mp.publish_error_code = 'publish_unconfirmed' and mp.publishing_started_at >= p_window_start));
  if v_count >= greatest(p_max_per_day, 0) then return query select false, 'daily_limit'; return; end if;

  select max(greatest(coalesce(mp.published_at, '-infinity'), coalesce(mp.dry_run_at, '-infinity'), coalesce(mp.publishing_started_at, '-infinity')))
    into v_last
    from public.marketing_posts mp
   where mp.platform = v_platform
     and (mp.status in ('publishing', 'published', 'dry_run') or (mp.status = 'failed' and mp.publish_error_code = 'publish_unconfirmed'));
  if v_last is not null and v_last > now() - make_interval(mins => greatest(p_min_gap_minutes, 0)) then
    return query select false, 'min_gap'; return;
  end if;

  update public.marketing_posts
     set status = 'publishing', publish_attempt_id = p_attempt, publishing_started_at = now(),
         publish_attempts = publish_attempts + 1, publish_error_code = null, publish_error = null
   where id = p_post;
  return query select true, 'claimed';
end $$;
revoke all on function public.marketing_claim_post(uuid, uuid, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.marketing_claim_post(uuid, uuid, integer, integer, timestamptz) to service_role;

-- Generated images: private bucket, PNG/JPEG/WebP only, 8 MB cap.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketing-images', 'marketing-images', false, 8388608, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
