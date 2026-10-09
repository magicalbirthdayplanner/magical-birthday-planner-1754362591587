# Founding families — first 25 accounts get Pro free

Owner ruling 2026-10-09 (replaces the pre-launch waitlist, see [PRELAUNCH.md](PRELAUNCH.md)): to drive adoption the
first 25 accounts get **Pro, free, on every party, with no time limit**. AI fair-use limits still apply
(`AI_USER_DAILY_LIMIT`, `AI_GLOBAL_DAILY_LIMIT`, per-party caps).

| Piece | Where |
| --- | --- |
| Seats, claim function, trigger | `supabase/migrations/20251009001700_founding_families.sql` |
| Plan source `founding` | `lib/billing/server.ts` (`getUserPlan`, `getPartyPlan`) |
| Public count `GET /api/founding` → `{ seats, left }` | `app/api/founding/route.ts` (CDN-cached 30 s) |
| Offer banner (landing + pricing), founding note | `components/billing/FoundingOffer.tsx` |
| Admin | `/admin` → System → "Founding families: N of 25"; users list shows source "Founding family (free Pro)" |
| Tests | `tests/integration/founding.test.ts` |

## How a seat is given

- When an account's email becomes **confirmed** (`auth.users.email_confirmed_at`): Google sign-in at once, email
  sign-up when the confirmation link is clicked. Unconfirmed sign-ups never use a seat.
- Lowest free seat 1..25, under a transaction advisory lock — concurrent confirmations never exceed 25.
- The seat writes `plan_overrides` (PRO, no expiry). Everything already enforced for overrides applies: RLS
  (`has_paid_access`), AI tiers, pricing CTAs. An override an admin set earlier is never replaced.
- Never a seat: Super Admins, `*.test`, `*.invalid`, `@resend.dev` (prod smoke-test inboxes).
- Deleting an account frees its seat (cascade).

## Operating it

- Seats left: `curl https://magicalbirthdayplanner.app/api/founding`.
- Revoke one gift: `/admin` → remove the user's override (the seat stays used). Remove the seat too:
  `delete from public.founding_members where user_id = '…';`
- Change the number of seats: new migration redefining `public.founding_seats_total()` and the
  `founding_members.seat` check constraint.
- End the offer early: new migration making `founding_seats_total()` return the current member count.
