-- Per-platform pause switch for the marketing engine (X, Instagram, Facebook). Additive, re-runnable, server-only.
alter table public.marketing_settings add column if not exists paused_platforms text[] not null default '{}';
