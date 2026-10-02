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

## Open items

| Item | Notes |
|---|---|
| Rotate historical credentials | 30 secret values exist in Git history from the original repository (old Supabase project, Postgres URLs, Google, Azure OpenAI, Resend, Apify, Dodo). None is used by the current app; all must be rotated or revoked at their providers. History is not rewritten. |
| Next.js 14 advisories | Fixed only in Next 15.5.x. Upgrade planned (P1). |
| Distributed rate limiting | In-memory limits are per serverless instance. Google Cloud quotas are the fleet-wide hard cap. |
| Script CSP | Framing, plugin and `<base>` restrictions are shipped; a nonce-based `script-src` is P2. |
| Error monitoring | Not configured (vendor/cost decision). |
