-- RSVP idempotency: one invitee = one guest row = one current RSVP state.
--
-- Before: an RSVP without an email always inserted a new guest (so "Change my RSVP" duplicated the family,
-- e.g. both Going and Can't go), and an email only matched earlier link RSVPs (not guests the host added).
--
-- Now, inside one transaction serialized per party (advisory lock, so concurrent submissions can't race):
--   1. the respondent key (a random per-device secret, stored SHA-256-hashed) identifies the invitee;
--   2. otherwise an exact email match against ANY guest of the party (link RSVP or host-added);
--   3. otherwise a new guest is inserted.
-- The function reports whether anything changed, so the route can skip notifications for exact repeats.
--
-- Additive and backward compatible: a new nullable column + partial unique index (no existing row is touched),
-- and p_respondent defaults to null so the currently deployed route keeps working until the app is updated.

alter table public.guests add column if not exists rsvp_respondent text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'guests_rsvp_respondent_format') then
    alter table public.guests add constraint guests_rsvp_respondent_format check (rsvp_respondent is null or rsvp_respondent ~ '^[0-9a-f]{64}$');
  end if;
end $$;
create unique index if not exists guests_party_rsvp_respondent_key
  on public.guests (party_id, rsvp_respondent) where rsvp_respondent is not null;

drop function if exists public.submit_rsvp(text, text, text, text, integer, integer, text);

create or replace function public.submit_rsvp(
  p_token text, p_name text, p_email text, p_status text,
  p_adults integer default 1, p_children integer default 0, p_note text default null,
  p_respondent text default null
) returns json language plpgsql security definer set search_path = '' as $$
declare
  inv record;
  g record;
  v_id uuid;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_name text := trim(coalesce(p_name, ''));
  v_resp text := nullif(lower(trim(coalesce(p_respondent, ''))), '');
  v_adults integer := coalesce(p_adults, 1);
  v_children integer := coalesce(p_children, 0);
  v_note text := left(nullif(trim(coalesce(p_note, '')), ''), 500);
  v_changed boolean;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then
    raise exception 'invitation_not_found' using errcode = 'P0002';
  end if;
  if p_status not in ('CONFIRMED', 'DECLINED', 'MAYBE') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if v_email is not null and (char_length(v_email) > 200 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if v_adults not between 0 and 20 or v_children not between 0 and 20 then
    raise exception 'invalid_counts' using errcode = '22023';
  end if;
  if v_resp is not null and v_resp !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_respondent' using errcode = '22023';
  end if;

  select i.party_id, p.user_id into inv
    from public.party_invitations i join public.parties p on p.id = i.party_id
   where i.token = p_token and i.is_active;
  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0002';
  end if;

  -- Serialize RSVPs per party for the rest of this transaction: lookup + insert/update can't race.
  perform pg_advisory_xact_lock(hashtextextended('submit_rsvp:' || inv.party_id::text, 0));

  -- 1. Same device/respondent → same guest.
  if v_resp is not null then
    select gg.id into v_id from public.guests gg where gg.party_id = inv.party_id and gg.rsvp_respondent = v_resp;
  end if;
  -- 2. Exact email match against any guest of this party (oldest first: the host's own entry wins).
  --    Names are never used to match (anyone with the link could otherwise overwrite another family's answer).
  if v_id is null and v_email is not null then
    select gg.id into v_id
      from public.guests gg where gg.party_id = inv.party_id and lower(gg.email) = v_email
     order by gg.created_at, gg.id limit 1;
  end if;

  if v_id is null then
    if (select count(*) from public.guests gg where gg.party_id = inv.party_id and gg.source = 'rsvp_link') >= 300 then
      raise exception 'rsvp_limit_reached' using errcode = '54000';
    end if;
    insert into public.guests (party_id, user_id, name, email, rsvp_status, adult_count, child_count,
                               notes, source, invite_status, responded_at, rsvp_respondent)
    values (inv.party_id, inv.user_id, v_name, v_email, p_status, v_adults, v_children,
            v_note, 'rsvp_link', 'VIEWED', now(), v_resp);
    return json_build_object('ok', true, 'status', p_status, 'created', true, 'changed', true);
  end if;

  select gg.rsvp_status, gg.adult_count, gg.child_count, gg.notes into g from public.guests gg where gg.id = v_id;
  v_changed := g.rsvp_status is distinct from p_status
            or g.adult_count is distinct from v_adults
            or g.child_count is distinct from v_children
            or (v_note is not null and g.notes is distinct from v_note);

  update public.guests
     set rsvp_status = p_status,
         adult_count = v_adults,
         child_count = v_children,
         notes = coalesce(v_note, notes),
         -- the host's own name for a guest they added is kept; link RSVPs keep the latest name the guest typed
         name = case when source = 'rsvp_link' then v_name else name end,
         email = coalesce(email, v_email),
         -- claim an unclaimed row for this respondent (never steal another respondent's row)
         rsvp_respondent = coalesce(rsvp_respondent, v_resp),
         invite_status = 'VIEWED',
         responded_at = case when v_changed then now() else responded_at end
   where id = v_id;

  return json_build_object('ok', true, 'status', p_status, 'created', false, 'changed', v_changed);
end $$;

revoke all on function public.submit_rsvp(text, text, text, text, integer, integer, text, text) from public, anon, authenticated;
grant execute on function public.submit_rsvp(text, text, text, text, integer, integer, text, text) to service_role;
