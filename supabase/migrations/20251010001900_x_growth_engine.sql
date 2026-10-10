-- =============================================================================
-- X growth engine (on top of 20251010001800_founder_marketing). Additive, re-runnable, server-only.
--
-- * marketing_posts gets formats (text/image/carousel/poll/video/thread), the weekly-plan slot it fills, its media,
--   poll options, thread parts, the business score and the estimated X cost.
-- * marketing_media   — the reusable media library (branded templates, curated campaign images/carousels/videos),
--                       with a privacy review status, usage counters and a performance score.
-- * marketing_plans   — one weekly content plan (56 slots by default) per platform.
-- * marketing_usage   — every billable call (X API, AI, image, video) with its estimated cost: the monthly budget
--                       ledger. Nothing is ever charged without a row here.
-- * storage bucket marketing-media (private; images and short MP4 videos for the library).
-- =============================================================================

alter table public.marketing_posts add column if not exists format text not null default 'text';
alter table public.marketing_posts drop constraint if exists marketing_posts_format_check;
alter table public.marketing_posts add constraint marketing_posts_format_check check (format in ('text', 'image', 'carousel', 'poll', 'video', 'thread'));
alter table public.marketing_posts add column if not exists slot_role text;
alter table public.marketing_posts add column if not exists category text;
alter table public.marketing_posts add column if not exists plan_id uuid;
alter table public.marketing_posts add column if not exists slot_index integer;
alter table public.marketing_posts add column if not exists media_ids uuid[] not null default '{}';
alter table public.marketing_posts add column if not exists poll jsonb;
alter table public.marketing_posts add column if not exists thread_parts jsonb;
alter table public.marketing_posts add column if not exists external_thread_ids text[] not null default '{}';
alter table public.marketing_posts add column if not exists business_score numeric(12, 4);
alter table public.marketing_posts add column if not exists est_cost_usd numeric(10, 5);
alter table public.marketing_posts add column if not exists source text not null default 'ai';
alter table public.marketing_posts drop constraint if exists marketing_posts_source_check;
alter table public.marketing_posts add constraint marketing_posts_source_check check (source in ('ai', 'library', 'imported', 'manual'));
create index if not exists marketing_posts_plan_idx on public.marketing_posts (plan_id, slot_index);

create table if not exists public.marketing_plans (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'x',
  week_start date not null,
  status text not null default 'planned' check (status in ('planned', 'generating', 'ready', 'cancelled')),
  slots jsonb not null,
  notes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, week_start)
);
drop trigger if exists marketing_plans_updated_at on public.marketing_plans;
create trigger marketing_plans_updated_at before update on public.marketing_plans for each row execute function public.set_updated_at();
alter table public.marketing_posts drop constraint if exists marketing_posts_plan_fk;
alter table public.marketing_posts add constraint marketing_posts_plan_fk foreign key (plan_id) references public.marketing_plans(id) on delete set null;

create table if not exists public.marketing_media (
  id uuid primary key default gen_random_uuid(),
  library_key text unique,
  kind text not null check (kind in ('image', 'video')),
  source text not null check (source in ('template', 'library', 'ai')),
  set_key text,
  position integer not null default 1,
  template_key text,
  title text not null,
  description text,
  category text,
  tags text[] not null default '{}',
  storage_path text,
  mime_type text,
  bytes integer,
  width integer,
  height integer,
  duration_s numeric(8, 2),
  alt_text text,
  caption_suffix text,
  privacy_status text not null default 'pending' check (privacy_status in ('pending', 'approved', 'rejected')),
  privacy_notes text,
  used_count integer not null default 0,
  last_used_at timestamptz,
  performance_score numeric(12, 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_media_set_idx on public.marketing_media (set_key, position);
create index if not exists marketing_media_kind_idx on public.marketing_media (kind, privacy_status, last_used_at);
drop trigger if exists marketing_media_updated_at on public.marketing_media;
create trigger marketing_media_updated_at before update on public.marketing_media for each row execute function public.set_updated_at();

create table if not exists public.marketing_usage (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  month text not null,
  provider text not null check (provider in ('x', 'ai', 'image', 'video')),
  operation text not null,
  units integer not null default 1,
  cost_usd numeric(10, 5) not null default 0,
  ok boolean not null default true,
  post_id uuid references public.marketing_posts(id) on delete set null,
  detail jsonb not null default '{}'::jsonb
);
create index if not exists marketing_usage_month_idx on public.marketing_usage (month, provider);

alter table public.marketing_plans enable row level security;
alter table public.marketing_media enable row level security;
alter table public.marketing_usage enable row level security;
-- Intentionally no policies: server only.
revoke all on public.marketing_plans, public.marketing_media, public.marketing_usage from anon, authenticated;

-- Atomic usage counter bump for library media.
create or replace function public.marketing_media_used(p_ids uuid[])
returns void language sql security definer set search_path = '' as $$
  update public.marketing_media set used_count = used_count + 1, last_used_at = now() where id = any(p_ids)
$$;
revoke all on function public.marketing_media_used(uuid[]) from public, anon, authenticated;
grant execute on function public.marketing_media_used(uuid[]) to service_role;

-- Library media: images and short videos (private; the server streams them to X).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketing-media', 'marketing-media', false, 52428800, array['image/png', 'image/jpeg', 'image/webp', 'video/mp4'])
on conflict (id) do nothing;
