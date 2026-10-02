# Supabase security audit

Source: local Supabase with all migrations applied (`supabase db reset`), inspected via
`pg_class`, `pg_policies`, grants and function privileges; behaviour verified by
`tests/integration/{rls,security}.test.ts`. Production could not be inspected
(see `PRODUCTION_SCHEMA_DIFF.md`).

Helper: `owns_party(party_id)` = `exists(parties where id = party_id and user_id = auth.uid())`
(SECURITY DEFINER, STABLE, `search_path=''`).

## Tables used by the mobile-first app

| Table | RLS | SELECT | INSERT | UPDATE | DELETE | Ownership rule | Leakage risk |
|---|---|---|---|---|---|---|---|
| `parties` | ✅ | own | own (`user_id = auth.uid()`) | own (USING + CHECK, cannot reassign) | own | `user_id` | None found. Public sharing removed |
| `users` (profiles) | ✅ | own row | own row (server-chosen entitlements) | own row; **plan/trial columns server-only** (trigger) | none | `id` | Previously all users readable — fixed |
| `guests` | ✅ | `owns_party` | `owns_party` + `user_id = auth.uid()` | same (cannot move to another party) | `owns_party` | party owner | Guest emails visible only to host |
| `saved_venues` (incl. **private notes**) | ✅ | `owns_party` | `owns_party` + `user_id` | same | `owns_party` | party owner | None |
| `party_venues` (chosen venue) | ✅ | `owns_party` | `owns_party` + `user_id` | same | `owns_party` | party owner | — |
| `party_invitations` (party invite + token) | ✅ | `owns_party` | `owns_party` + `user_id` | same; token must match `^[0-9a-f]{48}$` | `owns_party` | party owner | Public view only via `get_invitation(token)` projection |
| `invitations` (legacy per-guest) | ✅ | `owns_party` | `owns_party` + `user_id` | same | `owns_party` | party owner | Legacy RSVP route non-functional under RLS |
| `checklist_items` | ✅ | `owns_party` | `owns_party` + `user_id` | same | `owns_party` | party owner | — |
| `party_activities` | ✅ | `owns_party` | `owns_party` + `user_id` | same | `owns_party` | party owner | — |
| `theme_preferences` (themes) | ✅ | own | own | own | own | `user_id` | — |
| `activity_favorites` | ✅ | own | own | own | own | `user_id` | — |
| `venues` (public catalogue) | ✅ | everyone | — (service role) | — | — | n/a | Public business data only |
| `venue_searches`, `venue_search_results` (cache) | ✅ | — | — | — | — | server only | Previously anyone could insert (poisoning) — fixed |
| `analytics_events`, `ai_cache` | ✅ | — | — | — | — | server only | — |
| `activities` (catalogue) | ✅ | everyone | — | — | — | n/a | — |
| `email_logs` | ✅ | own | — | — | — | `user_id` | unused |

## Tables named in the brief that do not exist in the repo schema

| Table | Status | Action |
|---|---|---|
| `profiles` | Referenced by legacy purchase code only; may exist in production | 0400 adds plan-column guard + revokes client writes **if present**; verify in prod |
| `subscriptions`, `invoices`, `user_purchases` | Written by legacy billing; not in migrations | 0400 revokes client writes if present; define in a migration with owner-SELECT RLS when billing is built |
| `vendors` | No such table — vendors are `venues` rows with vendor categories | n/a |
| “themes” | Catalogue is static code (`data/themes-data.ts`); choices stored on `parties.theme(_details)`; favourites in `theme_preferences` | covered above |
| “checklists” | `checklist_items` | covered above |

## Functions callable by clients

| Function | Who | Notes |
|---|---|---|
| `get_invitation(token)` | anon, authenticated | SECURITY DEFINER; malformed token ⇒ null; returns first name, age, date/time, location text, message, theme, design, RSVP-by — no ids, ZIP, budget, guest data |
| `submit_rsvp(...)` | **service role only** | called by `/api/invite/[token]/rsvp` after validation + rate limiting |
| `venues_near(...)` | anon, authenticated | SECURITY INVOKER over public `venues`; radius and limit clamped |
| `owns_party(uuid)` | authenticated (and anon via Supabase defaults) | returns ownership of the caller only |
| trial functions, `purge_stale_places_content`, `exec_sql`/`exec` (if present in prod) | none | revoked |

## Other observations

* `anon`/`authenticated` hold Supabase’s default table grants; RLS is the protection. Defence in
  depth (optional): revoke `TRUNCATE`, `REFERENCES`, `TRIGGER` from `anon, authenticated` on public
  tables (PostgREST cannot issue them, so this is hygiene only).
* `users` has no DELETE policy (accounts are deleted via Auth, cascading).
* Triggers on `users`: `users_guard_entitlements`, `users_entitlements_on_insert`,
  `update_users_updated_at`; `on_auth_user_created` on `auth.users` grants the trial at sign-up.
* RLS tests (A vs B): read, update, delete and insert-as-other for parties, guests, saved venues,
  private notes and invitations; cross-party inserts; moving rows to another owner; shared-party
  enumeration; cache/catalogue writes; trial RPCs; entitlement columns; RSVP isolation.
