# Security

> Release-gate status and the authoritative findings table: [`SECURITY_RELEASE_AUDIT.md`](./SECURITY_RELEASE_AUDIT.md).
> Since that audit: billing self-upgrade is **fixed** (`BILLING_SECURITY.md`), RSVP moved behind a rate-limited route,
> insecure legacy routes are blocked, dependencies patched, and secrets removed from all tracked files incl. `.ideavo/**`.

## 1. Immediate actions for the owner (not doable from code)

1. **Rotate every secret that was committed.** `.env`, `.env.local`, `vercel-env-template.txt`,
   `.mcprc`, `VERCEL_DEPLOYMENT_GUIDE.md`, `scripts/fix-supabase-auth.js`, `chat-log.md` and ~1,700
   `.ideavo/**` files contained live values. The repository is **public**. Rotate:
   Supabase service-role key + JWT secret, database password (`DATABASE_URL`), Resend, Azure OpenAI,
   Google API key(s), Apify. Removing them from HEAD (done) does not remove them from git history;
   rotation is the fix. Optionally purge history afterwards (`git filter-repo`) and force-push.
2. **Deploy the middleware block** (or delete the routes) ASAP: `POST /api/bypass-oauth-session`
   lets anyone obtain a session for any email address on the currently deployed code.
3. Apply `supabase/migrations/20251001000200_rls_hardening.sql` to production (see `RELEASE.md`).
4. Review Supabase auth logs for use of the debug routes and for unexpected `users` changes.

## 2. Findings and status

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | Critical | Live secrets committed; repo public | Removed from HEAD, `.env*` untracked, `.env.example` added. **Rotate.** |
| 2 | Critical | `/api/bypass-oauth-session` mints sessions for any email | 404 via middleware (`lib/security/blocked-routes.ts`) |
| 3 | Critical | 37 debug/fix routes (DDL via `exec_sql`, RLS rewrites, env dumps, user listings) without auth | 404 via middleware; cannot be enabled when `NODE_ENV=production` |
| 4 | Critical | `users` policy “Allow authenticated users to do everything” | Replaced by own-row policies (migration 0200), tested |
| 5 | High | `/api/party-venue`: service role + client-supplied `userId`/`partyId` (IDOR) | Requires token, RLS-scoped, catalogue insert-only, tested |
| 6 | High | “Anyone can view shared parties” — child name/age/date/ZIP/budget enumerable | Policy dropped; public data only via token-scoped `get_invitation` |
| 7 | High | Google key hard-coded & sent to browsers in photo URLs | Removed; server-side photo proxy; bundle secret scan in `npm run check` |
| 8 | High | Unauthenticated paid API calls (Places, Azure OpenAI) | New routes authenticated + rate-limited; legacy AI & food routes IP rate-limited; legacy `/api/venues*` blocked |
| 9 | High | Self-service plan upgrades (`PATCH /api/user/subscription`, `/checkout-success?plan=`, localStorage flags); webhook writes with anon key | **Open — production blocker** (see §4) |
| 10 | Medium | `SECURITY DEFINER` trial RPCs accept any user id; `user_trial_status` view bypasses RLS | Execute/select revoked from `anon`/`authenticated` |
| 11 | Medium | Open cache tables (`venue_searches` insertable by anyone) | Server-only |
| 12 | Medium | Predictable per-guest RSVP tokens; RSVP GET returns `parties(*)`, `guests(*)` | New flow uses 24-byte random tokens + minimal projection. Legacy `/rsvp/[token]` unchanged (it is already non-functional under RLS) |
| 13 | Medium | Open redirect in `auth/callback` (`next=//evil`) | `next` must be a same-origin relative path |
| 14 | Medium | No security headers | `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `poweredByHeader:false`; API `no-store` |
| 15 | Medium | Fabricated data presented as real (random distances, fake fallback restaurants) | Food vendors: real distances, unknowns left empty, no invented fallback. Remaining legacy items listed in `FINAL_QA_REPORT.md` |
| 16 | Low | Third-party `ideavo.min.js` (jsDelivr, mutable tag) loaded on every page; `iframe-navigation.js` 404 | Left in place per the repository’s “never remove” note. Recommend removing in production or pinning with SRI |
| 17 | Low | Framing allowed (no `frame-ancestors`) — needed by the Ideavo builder preview | Add `frame-ancestors 'self'` once the builder is no longer used |
| 18 | Low | `/api/emails/password-reset` enumerates accounts | Unused by UI; recommend deleting |

## 3. Architecture rules (enforced in code review and tests)

* The browser only ever has the **anon** key and the user’s JWT. All user data access goes through
  RLS (`lib/db/browser.ts`, or `getAuthedRequest()` on the server, which queries *as the user*).
* The **service role** (`lib/server/supabase-admin.ts`, `server-only`) is used only for shared,
  non-user data: venue catalogue, discovery cache, analytics ingestion, AI cache.
* Server secrets live only in modules importing `server-only`; `npm run check:secrets` scans
  `.next/static` for every server secret value after each build.
* Public, unauthenticated access is limited to token-scoped RPCs (`get_invitation`,
  `submit_rsvp`), ZIP lookup, and photos of already-surfaced places — all rate-limited.
* API errors are `{ error: { code, message } }` with user-safe copy; no stack traces or upstream
  messages (`lib/server/http.ts`).
* Rate limits are in-memory per instance — a guard, not a quota. For scale, back
  `lib/server/rate-limit.ts` with Redis/Upstash.

## 4. Open items (production blockers)

* **Entitlements / payments**: plans can be granted client-side and the purchase/webhook paths
  write to tables not in any migration (`profiles`, `subscriptions`, `invoices`) using the anon
  key. Fix: Dodo webhook → verify signature (timing-safe compare) → update `users.current_plan`
  with the service role; remove the client PATCH and `localStorage` checks; add a trigger that
  blocks `authenticated` from changing plan/trial columns.
* **Delete** the blocked debug routes and dead code once nothing external calls them
  (list in `lib/security/blocked-routes.ts` and `MOBILE_FIRST_AUDIT.md §9`).
* **Distributed rate limiting** for paid APIs (see above).
* `/rsvp/[token]`, `/share/[token]`, `/api/emails/*`, `/api/favorites`, `/api/selected-activities`
  remain broken (pre-existing). Either migrate them to the new invitation/RPC model or remove them.
