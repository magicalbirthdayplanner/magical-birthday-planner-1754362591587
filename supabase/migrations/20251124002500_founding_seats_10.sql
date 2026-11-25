-- =============================================================================
-- Founding families: 10 seats instead of 25 (owner ruling 2026-11-24).
-- Seats 1..3 were already taken; they are kept. Seats are only handed out from 1..founding_seats_total(), so no new
-- seat beyond 10 is ever granted. The 1..25 CHECK on founding_members.seat is left as it is (10 fits inside it).
-- Additive and re-runnable.
-- =============================================================================
create or replace function public.founding_seats_total()
returns integer language sql immutable set search_path = '' as $$ select 10 $$;
