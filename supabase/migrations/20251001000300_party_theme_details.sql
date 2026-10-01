-- Persist AI-generated theme details with the party (catalogue themes only need parties.theme).
alter table public.parties add column if not exists theme_details jsonb;
comment on column public.parties.theme_details is 'Details of an AI-generated theme (name, emoji, description, colors, ideas). Null for catalogue themes.';
