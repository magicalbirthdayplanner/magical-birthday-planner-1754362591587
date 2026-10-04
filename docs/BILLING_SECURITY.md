# Billing security

Dodo Payments is the only payment provider. **Live charging is impossible** unless
`DODO_PAYMENTS_ENVIRONMENT=live_mode` **and** `DODO_LIVE_PAYMENTS_ENABLED=true`.

## Flow

1. **`POST /api/billing/checkout {plan, partyId}`** (signed-in only, rate limited). Plans are bought **per party**.
   * The server picks the Dodo product and price from config (`lib/billing/plans.ts`) and identifies
     the user from the session. Clients cannot choose product, price or user. The party must be the
     caller's own (RLS) and must not already have this plan or a higher one (409 `already_owned`).
   * The checkout is recorded in `billing_checkouts` with its `party_id`.
   * The user goes to Dodo's hosted checkout and returns to `/checkout-success?ref=…`.
2. **`POST /api/webhooks/dodo`** (Standard Webhooks).
   * HMAC-SHA256 over `id.timestamp.body`, constant-time compare, ±5 min window, 512 KB cap.
   * Idempotent on `webhook-id` (`billing_webhook_events`).
   * User mapping: known customer → metadata user → recent pending checkout email. Conflicts are rejected.
   * `billing_purchases` is upserted by provider reference. Older events never overwrite newer ones.
   * Party: from our own checkout record (only the paying user's party), else `scope = 'account'` for a
     payment with no checkout at all (legacy/external). A purchase never moves to another party; deleting the
     party ends its plan. Party plans are resolved by `party_plan(party)` / `getPartyPlan` and
     `has_paid_access(party)` (RLS); `users.current_plan` covers account-level entitlements only
     (admin override → legacy account purchase → trial → FREE).
3. **`recompute_entitlement(user)`** (service role only) sets `users.current_plan`.
   * The plan comes from the **product id**, never from metadata.
   * USD payments below the plan price are held as `review`.
   * Refunds and subscription cancel/expire/on-hold revoke the plan.
4. **`GET /api/billing/status`** returns the server-derived plan and purchases. It also expires a lapsed
   24 h trial server-side, via `recompute_entitlement`.
   * `/checkout-success`, `/pricing` and More (`components/billing/usePlanStatus.ts`,
     `CheckoutStatus`) only read this. URL parameters are never proof of payment.

## What a client cannot do (tested)

| Attempt | Result |
|---|---|
| Update own `current_plan`, `is_trial_active`, `trial_expires_at`, `has_used_trial` | `42501`. The `users_guard_entitlements` trigger blocks clients from writing plan/trial columns. |
| Insert own `users` row with a plan | Server values forced by the insert trigger |
| Insert/update `billing_purchases`, `billing_checkouts`, `billing_customers`, `billing_webhook_events` | Denied (no client write policies). Owners can only read their own rows. |
| Execute `recompute_entitlement` | `42501`. Service role only. |
| `/checkout-success?plan=PRO&status=succeeded`, localStorage flags | Nothing granted. The page only polls `/api/billing/status`. |
| Forged, tampered, stale or replayed webhook | Rejected, nothing changed |
| Tampered metadata plan or price | Plan from product. Low price held for review. |

## Tests

* `tests/unit/billing.test.ts`: signatures, plan mapping, live switch, event decisions.
* `tests/integration/billing.test.ts`: checkout, webhook → entitlement, duplicates, out-of-order,
  refunds, subscriptions, hijack attempts, client write denial, server-side trial expiry.
* `tests/e2e/integrations-journey.spec.ts`: checkout → signed webhook → plan active; a declined
  card and URL tampering grant nothing.

## Not yet done

* **Real Dodo sandbox run.** Needs test-mode credentials (`INTEGRATIONS.md`).
* **Product decision on paid features.** Features are not plan-gated server-side today, so every
  signed-in user can use the full app.
