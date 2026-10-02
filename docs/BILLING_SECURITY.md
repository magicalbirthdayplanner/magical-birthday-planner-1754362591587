# Billing security

**Status: users can no longer grant themselves a plan. Billing itself is not implemented end-to-end
— no real payment currently activates a plan.** Do not charge customers until §4 is done.

## 1. Where entitlement state lives

| Data | Location | Meaning |
|---|---|---|
| `users.current_plan` | Supabase | `FREE · STARTER · PLUS · PRO · PROFESSIONAL` — read by `GET /api/user/subscription` |
| `users.trial_*`, `is_trial_active`, `has_used_trial` | Supabase | 24 h PRO trial granted once per account |
| `profiles.subscription_*`, `user_purchases`, `subscriptions`, `invoices` | Production only (not in any migration) | Written by legacy routes / webhook; **not read** by entitlement checks |
| Plan gating | Client only (`contexts/SubscriptionContext.tsx`) | Hides legacy planner tabs. No paid feature is enforced server-side today |

The mobile-first app (discovery, saves, themes, guests, checklist, invitations) is available to every
signed-in user and does not read plan state.

## 2. Every place plan state could be written — before → after

| Path | Before | After (this branch) |
|---|---|---|
| Direct Supabase update from the browser (`users` own-row RLS) | Any user could set `current_plan='PRO'` or extend a trial | `users_guard_entitlements` trigger rejects changes to `current_plan`, `trial_*`, `is_trial_active`, `has_used_trial` (+ `subscription_*`, `role`, `is_admin` if present) by `anon`/`authenticated` with **42501** |
| Direct insert of one’s own `users` row | Client chose plan and trial expiry | `users_entitlements_on_insert` overwrites with the standard one-time 24 h trial; client values ignored |
| `PATCH /api/user/subscription` | Set any plan, no payment check | **403** always |
| `POST /api/user/purchase` (from `/checkout-success`) | Wrote purchase + `profiles.subscription_plan` from browser-supplied plan | **410**, writes nothing |
| `/checkout-success?plan=PRO` | `localStorage` flags + purchase call ⇒ PRO | Shows “confirming your payment”; re-reads server state only |
| `localStorage` (`hasPurchasedPlan`, `userSubscriptionPlan`, …, `superadmin_plan`) | Trusted by `hasActiveSubscription()` | Ignored and deleted on load; plan comes only from `/api/user/subscription` + `/api/user/trial` |
| `POST /api/user/trial` `start_trial` | User-role update (raced, restartable via direct update) | Service role, only when `has_used_trial` is false/null (conditional update ⇒ no double start) |
| `GET /api/user/trial` expiry downgrade | User-role update | Service role |
| `GET /api/user/subscription` on DB error | Returned **STARTER** | Returns **FREE** (fail closed) |
| `/api/subscriptions/create`, `/cancel` | No auth, trusted body `userId` | 404 (delete pending) |
| Production `profiles`, `subscriptions`, `invoices`, `user_purchases` | Unknown client grants | Migration 0400 revokes INSERT/UPDATE/DELETE from `anon`/`authenticated` and enables RLS if the tables exist; `profiles` gets the same column guard |
| `POST /api/webhooks/dodo` | `===` signature compare; anon-key writes; never updates plan | `timingSafeEqual`; still incomplete (see §4) |
| `/account` superadmin plan switcher (hard-coded email) | UI-only preview + PATCH | PATCH refused; UI preview only affects that browser |

Service role (server) and the database owner can still change plans — that is the intended path.

## 3. Tests

`tests/integration/security.test.ts → "entitlements cannot be self-granted"`:

* user cannot set `current_plan` (PRO, PROFESSIONAL), `is_trial_active`, `trial_expires_at`,
  `has_used_trial` — each returns 42501 and the stored row is unchanged;
* user cannot change another user’s plan;
* ordinary profile edits still work;
* a self-inserted profile row receives server-chosen values (PRO trial ≤ 24 h) regardless of input;
* the service role can still update plans;
* `PATCH /api/user/subscription` → 403, `POST /api/user/purchase` → 410.

## 4. Remaining work before taking payments (not invented here)

1. **Checkout**: create the Dodo checkout session server-side for the signed-in user (user id in
   checkout metadata; never trust a client `userId`).
2. **Webhook**: verify signature (`timingSafeEqual`, done) **and** timestamp/replay window; make it
   idempotent on event id; write `subscriptions`/`invoices` with the **service role**; on
   `subscription.active/renewed/cancelled` update `users.current_plan` (service role). Add those
   tables to a migration with RLS: owner `SELECT` only.
3. **Server-side enforcement**: any feature that costs money or is sold must check the plan on the
   server (route handler or RLS), not only in `SubscriptionContext`.
4. **Admin**: replace the hard-coded email with a server-managed role (`app_metadata.role`, set only
   by the service role) if an admin plan switcher is still wanted.
5. Decide the product question in `RELEASE.md §1` (which mobile features, if any, become paid).
