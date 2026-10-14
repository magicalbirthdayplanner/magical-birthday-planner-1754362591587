# Billing security

Two providers, chosen **on the server from the party's stored event country** (`lib/billing/providers.ts`), never
from anything the browser sends, with no fallback between them:

* **US parties → Dodo Payments** (everything below). **Live charging is impossible** unless
  `DODO_PAYMENTS_ENVIRONMENT=live_mode` **and** `DODO_LIVE_PAYMENTS_ENABLED=true`.
* **India parties → Razorpay**, only when `RAZORPAY_ENABLED=true`, keys are set and all three INR prices
  (`RAZORPAY_PRICE_<PLAN>_PAISE`) are configured; a `rzp_live_` key also needs `RAZORPAY_LIVE_PAYMENTS_ENABLED=true`.
  Otherwise checkout answers 503 "not available yet" — an India party is never sent to a USD checkout. See
  "Razorpay (India)" at the end and [RAZORPAY_SETUP.txt](RAZORPAY_SETUP.txt).

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
   * **Every purchase is party-scoped.** The party comes only from a verified association: the checkout id our
     server put in the metadata must be a checkout of the same user, for the same plan, whose party (and any
     party id in the metadata) matches and still belongs to the user. Nothing is inferred from the user or their
     latest/active/only party. Otherwise the purchase is recorded with no party and `unresolved_reason`
     (`no_checkout` | `checkout_mismatch` | `party_unavailable`): it unlocks **nothing**, the webhook outcome is
     `unmatched`, Sentry gets a `PAYMENT_UNRESOLVED` warning issue, and Super Admin stats show the count.
     Reconcile with `select public.reconcile_purchase('<purchase id>', '<party id>')` (service role; the party
     must belong to the payer; only once).
   * A database trigger rejects new `scope = 'account'` rows and any change of scope or move to another party.
     Deleting the party ends its plan. Party plans are resolved by `party_plan(party)` / `getPartyPlan` and
     `has_paid_access(party)` (RLS); `users.current_plan` covers account-level entitlements only — the
     intentionally account-wide admin override and 24 h trial, plus legacy pre-2026-10-04 purchases (none in
     production).
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

## Razorpay (India)

1. `POST /api/billing/checkout` for an India party: server price (paise) → `billing_checkouts` row
   (`provider='razorpay'`, `amount_minor`, `currency='INR'`) → Razorpay order (`POST /v1/orders`, key secret) →
   order id stored as `session_id`. Only the key id goes to the browser. An open order for the same party/plan/price
   (< 30 min) is reused (double taps).
2. `POST /api/billing/razorpay/verify` (signed in): the checkout must be the caller's own (RLS); the signature is
   checked against **our** order id (`HMAC_SHA256(order_id|payment_id, key_secret)`, constant time); then the payment
   is fetched server-side (`GET /v1/payments/:id`) and must belong to that order.
3. `POST /api/webhooks/razorpay`: `X-Razorpay-Signature` = HMAC-SHA256 of the **raw** body with the webhook secret;
   idempotent on `x-razorpay-event-id` (`billing_webhook_events`, `razorpay:` prefix); 401 bad signature, 503 no
   secret, 500 transient (Razorpay retries).
4. One recorder for both (`lib/billing/razorpay-server.ts`): the party comes **only** from our checkout row (party
   must still belong to the payer, else `party_unavailable` → unlocks nothing); captured payments whose amount or
   currency differ from the order → `review`; unique `(provider, provider_ref)` makes verify/webhook races and
   replays a single purchase; older events never overwrite newer ones; a settled payment is never downgraded by a
   late `authorized`/`failed` view. Full refund (`refund.processed`) → `refunded` (plan ends); partial refund → kept.
5. Same per-party invariants as Dodo: `scope='party'`, scope guard trigger, `party_plan()` / `has_paid_access(party)`,
   `reconcile_purchase()` for unmatched payments.

Tested in `tests/unit/razorpay.test.ts`, `tests/integration/india.test.ts` (checkout, verify, webhook, tampering,
duplicates, races, refunds, deleted party) and `tests/e2e/india.spec.ts` (mobile Checkout against a mock).
**Not yet run against Razorpay itself** (no credentials).

## Not yet done

* **Real Dodo sandbox run.** Needs test-mode credentials (`INTEGRATIONS.md`).
* **Product decision on paid features.** Features are not plan-gated server-side today, so every
  signed-in user can use the full app.
