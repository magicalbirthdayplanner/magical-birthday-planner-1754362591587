# Security

Current security model of the mobile-first app. Evidence and test results:
[`LAUNCH_READINESS_REPORT.md`](./LAUNCH_READINESS_REPORT.md). Billing details:
[`BILLING_SECURITY.md`](./BILLING_SECURITY.md). Earlier dated audits are in [`archive/`](./archive/).

## Rules (enforced by code and tests)

* **Data access.** The browser only has the Supabase **anon** key and the user's JWT. All user data goes
  through RLS: `lib/db/browser.ts` in the browser, and `getAuthedRequest()` on the server, which queries
  *as the user*. RLS policies are owner-scoped (`supabase/migrations/…0200_rls_hardening.sql`).
* **Service role.** `lib/server/supabase-admin.ts` (`server-only`) is used only for:
  * shared, non-user data: the venue catalogue/cache, analytics ingestion, AI cache;
  * the token-checked RSVP RPC;
  * billing (webhook, entitlement recompute, lapsed-trial expiry).
* **Entitlements are server-only.** A trigger blocks clients from changing plan or trial columns.
  `current_plan` changes only via the verified Dodo webhook or `recompute_entitlement()` (service role
  only). The browser never grants a plan: no URL parameter, localStorage or client API can do it.
* **Secrets** live only in modules importing `server-only`. `npm run check:secrets` fails if any
  server secret value appears in `.next/static`. `npm run scan:history` reports secret patterns in
  Git history without printing values.
* **Public, unauthenticated surface** (all rate-limited):
  * token-scoped invitation RPCs (`get_invitation`, plus `submit_rsvp` via `/api/invite/[token]/rsvp`);
  * ZIP lookup;
  * photos of places discovery already surfaced;
  * analytics ingestion;
  * health;
  * the signed Dodo webhook.
* **Route inventory.** `tests/unit/route-inventory.test.ts` pins the exact list of routes and rejects
  debug/fix/test/bypass-style routes, so tooling routes can't ship unnoticed.
* **Errors** are returned as `{ error: { code, message } }` with user-safe text: no stack traces,
  provider bodies or internal ids (`lib/server/http.ts`, `lib/server/safe-json.ts`).
* **Logging.** Structured JSON metrics (`lib/analytics/server.ts`). Never log tokens, auth codes, URLs
  with tokens, emails or request bodies.
* **Headers** (`next.config.js`):
  * `X-Frame-Options: DENY` and `frame-ancestors 'none'` (no framing);
  * `object-src 'none'` and `base-uri 'self'`;
  * `nosniff`, `Referrer-Policy`, `Permissions-Policy`;
  * HSTS (from Vercel);
  * API responses `no-store`.
* **Email abuse caps** come from `email_logs`, so they hold across instances: invitations per host
  per day, and RSVP emails per party per day.
* **Shared devices.** Sign-out always clears local app data (with a local sign-out fallback when
  offline). A different user signing in on the same device never sees the previous user's draft.

## AI usage (migrations `…0800`, `…0900`, `…1200`)

* AI routes authenticate, validate a strict body (16 KB cap), check party ownership with the user's RLS session,
  check the feature flag and plan, then **reserve usage on the server** (`ai_reserve`, service role only, with the
  authenticated user id). The database re-checks ownership and enforces the global daily breaker atomically.
* `ai_finalize` and `ai_global_count_today` are service-role only. Users can read their own `ai_generations` rows
  but cannot insert, update or delete them.
* Usage survives deletion: `ai_generations.party_id` / `user_id` are `ON DELETE SET NULL`; a trigger strips results
  and summaries from detached rows. Deleting a party or account never gives limits back.
* Prompts never include emails, phone numbers, ZIP or guest names (Party Host may use first names for speeches);
  parent notes are wrapped as data; outputs are schema-validated and scrubbed (no URLs/HTML).
* Tests: `tests/integration/ai-security.test.ts`, `ai-usage.test.ts`, `ai-usage-security.test.ts` (reproduces
  direct-RPC, global-exhaustion, deletion-reset, party-hopping and account-cycling attacks).

## RSVP (migrations `…0400`, `…1100`)

* `submit_rsvp` is service-role only, reached through the rate-limited route; the 192-bit invitation token is the
  only credential. One invitee = one guest: matched by a hashed per-device key, then exact email within the party;
  never by name. RSVPs for a party are serialized, so concurrent submissions can't duplicate.
* **Accepted trade-off:** anyone with a valid invitation link and the exact email of a guest can update that guest's
  RSVP status (not the host's name for the guest).

## Billing and admin

* Checkout accepts only a plan name; product, price and customer are server-side; the hosted checkout host is
  validated. Plans change only through Standard-Webhooks-verified Dodo events (timing-safe HMAC, 5-minute tolerance,
  idempotent per webhook id, out-of-order protection, price integrity check). See `BILLING_SECURITY.md`.
* Super Admin is a server-verified `user_roles` row; admin APIs return 404 to everyone else; there is no endpoint
  that grants roles; every override is written to `admin_audit_log`.

## Open items

| Item | Notes |
|---|---|
| Rotate historical credentials | 30 secret values exist in Git history from the original repository (old Supabase project, Postgres URLs, Google, Azure OpenAI, Resend, Apify, Dodo). None is used by the current app; all must be rotated or revoked at their providers. History is not rewritten. |
| PostCSS advisories (build-time) | Upgraded to Next 15.5.27 + React 19.3.0: the 23 Next.js 14 advisories are fixed. `npm audit` still flags PostCSS source-map file-read issues in Next's bundled `postcss@8.4.31` (no Next 15 fix) and the direct `postcss@8.4.47` (fixed in 8.5.28; separate bump). Both only process the app's own CSS at build time. |
| Distributed rate limiting | In-memory limits are per serverless instance. Google Cloud quotas are the fleet-wide hard cap. |
| Script CSP | Framing, plugin and `<base>` restrictions are shipped; a nonce-based `script-src` is P2. |
| Error monitoring | Sentry (see `OBSERVABILITY.md`). |
| `users.email` | Writable by its owner (profile row); admin tooling should read email from `auth.users`. |
| Email abuse caps | Per host and per party today; add global / per-account caps across parties. |
