# Security release audit — `mobile-first`

_2026-10-01 · local branch only — nothing pushed, deployed, rotated, or changed in production._

Companion documents: [`BILLING_SECURITY.md`](./BILLING_SECURITY.md) ·
[`SUPABASE_SECURITY_AUDIT.md`](./SUPABASE_SECURITY_AUDIT.md) ·
[`PRODUCTION_SCHEMA_DIFF.md`](./PRODUCTION_SCHEMA_DIFF.md) ·
[`GOOGLE_PLACES_COST_CONTROL.md`](./GOOGLE_PLACES_COST_CONTROL.md) · [`RELEASE.md`](./RELEASE.md)

## 1. Method

* Full-repository search for: bypass, debug, fix, admin, impersonate, oauth, session, service_role,
  `SUPABASE_SERVICE_ROLE`, `DATABASE_URL`, password, Google/OpenAI/Azure/Resend/Apify/Stripe/
  RevenueCat keys, subscription, plan, premium, billing, `exec_sql`, `dangerouslySetInnerHTML`,
  `eval`, hard-coded emails, error/stack echoing in responses.
* Every route handler under `app/api` reviewed for: caller authentication, trust in client-supplied
  ids, service-role use, paid upstream calls, writes to entitlement data, error leakage.
* Every blob in git history scanned with `scripts/scan-git-history-secrets.mjs` (prints type,
  fingerprint, files and commit range — never values).
* Local Supabase (same migrations as production will get) inspected for RLS, policies, grants,
  function privileges and triggers; behaviour verified by automated tests.
* `npm audit`; client bundles scanned for server secret values (`npm run check:secrets`).

## 2. Findings

Severity: **C** critical · **H** high · **M** medium · **L** low.

| # | Finding | Sev | Location | Current status | Required action |
|---|---|---|---|---|---|
| 1 | Live credentials committed; repository is public | C | `.env`, `.env.local`, `.env.backup`, `app/.env`, `vercel-env-template.txt`, `VERCEL_DEPLOYMENT_GUIDE.md`, `.mcprc`, `scripts/fix-supabase-auth.js`, chat logs, 11 `.ideavo/**` files — commits `8ebcda8`…`e9650a0` (§3) | Removed from the working tree (all files incl. `.ideavo/**`); `.env*` untracked & ignored | **Rotate every credential in §3. Decide on history rewrite (§4).** |
| 2 | “Service role key” values are **Supabase personal access tokens** (`sbp_…`) — Management-API access to the whole Supabase account | C | as #1 | Removed from tree | **Revoke** in Supabase → Account → Access Tokens; issue a real service-role key for the app |
| 3 | `POST /api/bypass-oauth-session` signs in as any email (account takeover) | C | `app/api/bypass-oauth-session/route.ts` | Returns 404 via middleware; cannot be re-enabled in production | Ship the middleware (already on branch). **Delete the file** (§6 — deletion was blocked in this session) |
| 4 | 37 debug / fix / test routes: DDL via `exec_sql`, RLS rewrites, auth-config changes, magic-link generation, user listings, env dumps, real email sends | C | `app/api/{fix-*,debug*,oauth-*,force-*,test-*,db-*,…}` (list in `lib/security/blocked-routes.ts`) | All 404 in every environment unless `ENABLE_DEBUG_ROUTES=true` **and** not production (unit-tested, E2E-tested) | Delete the files (§6) |
| 5 | Users could set their own `current_plan` / trial columns (RLS allowed own-row update; `PATCH /api/user/subscription` accepted any plan; `/checkout-success?plan=PRO` + `/api/user/purchase` granted plans from URL params; `localStorage` flags unlocked plans) | C | `users` table, `app/api/user/{subscription,purchase,trial}`, `contexts/SubscriptionContext.tsx`, `app/(site)/checkout-success` | **Fixed**: DB trigger rejects end-user changes to plan/trial columns (42501); self-inserted rows get server values; PATCH → 403; purchase → 410; trial start/expiry via service role with eligibility check; client reads plan only from server; checkout page never grants | Implement verified webhook → plan update (see `BILLING_SECURITY.md`) before charging |
| 6 | `users` RLS “everything for any authenticated user” (repo SQL + fix routes) | C | `database/fix-users-table.sql`, fix routes | Replaced by own-row policies (migration 0200), tested | Apply 0200 to production after the diff in `PRODUCTION_SCHEMA_DIFF.md` |
| 7 | Payment webhook: non-constant-time signature compare; writes with anon key; never updates entitlements | H | `lib/dodo-payments.ts`, `app/api/webhooks/dodo` | Compare is now `timingSafeEqual`; billing tables lose client write grants (0400) | Finish webhook (signature + replay window + service-role writes + plan update) |
| 8 | `subscriptions/create`, `subscriptions/cancel` trust client `userId` (no auth) | H | `app/api/subscriptions/*` | 404 (middleware) | Delete (§6) |
| 9 | Unauthenticated paid API calls (Azure OpenAI, Google) | H | `budget-allocation`, `activity-expansion`, `venues`, `venues-local`, `theme-recommendations`, `food-vendors` | First four 404; legacy AI + food routes IP rate-limited; new routes authenticated + budgeted | Delete dead routes (§6); put legacy AI behind auth when the legacy planner is retired |
| 10 | `party-venue` IDOR (service role + client ids) | H | `app/api/party-venue` | Fixed (token, RLS, catalogue insert-only), tested | — |
| 11 | Shared parties enumerable by anyone (`is_shared = true` policy) | H | `parties` RLS | Policy dropped; public data only via token RPC | — |
| 12 | RSVP: direct anon RPC (no rate limit) and name-based matching let anyone with the link overwrite another family’s answer | H | `submit_rsvp` | Callable only by the service role via rate-limited `POST /api/invite/[token]/rsvp`; matches by email within link RSVPs only; never touches host-created guests; tokens validated `^[0-9a-f]{48}$`; hosts can rotate links | — |
| 13 | Google key hard-coded and returned to browsers in photo URLs | H | `lib/google-places*.ts`, `/api/venues`, `/api/food-vendors` | Removed; photo proxy; bundle scan | Rotate key (§3) |
| 14 | Google cost abuse: arbitrary radius ⇒ new cache keys; details for any place id; no hourly ceiling; malformed responses unclassified | H | discovery routes | Radius snapped to {5,10,20,30,50}; details only for surfaced places; per-user + per-instance hourly budget; malformed → handled error | Also set quotas in Google Cloud (see cost doc) |
| 15 | Legacy routes echo DB errors, `debug` blocks, stack traces | M | `parties`, `user-parties`, `party/*`, `venues-search`, … | All kept legacy routes use `safeJson()` (strips internals; 5xx generic); unused leaky ones 404 | Delete unused routes (§6) |
| 16 | Legacy `PUT /api/guests` passed client object straight to `.update()` | M | `app/api/guests/route.ts` | Field whitelist + type checks | — |
| 17 | Open redirects (`next`, `return_url`) | M | `auth/callback`, `/login`, `/checkout-success` | Single `safeNext()` (same-origin path only), unit-tested | — |
| 18 | Trial RPCs `SECURITY DEFINER` with arbitrary user id; `user_trial_status` view bypasses RLS | M | trial SQL | Execute/select revoked | — |
| 19 | Dependencies: 28 critical / 58 high | M | `package.json` | Removed unused `n8n`, `apify-client`, `@cwahlers/react-confetti-canvas`; `next` 14.2.35; `jspdf` 4.2.1; `@playwright/test` 1.55.1; non-breaking `audit fix` ⇒ **1 critical / 4 high** remain (§5) | Plan Next 15/16 upgrade |
| 20 | Hard-coded “superadmin” email checks in client code (UI-only plan preview) | L | `account/page.tsx`, `Dashboard.tsx` | Cannot change server plan (PATCH refused); `superadmin_plan` key cleared | Replace with server-side admin role; remove personal email from public code |
| 21 | Third-party `ideavo.min.js` loaded on every page; framing allowed | L | `app/layout.tsx`, `next.config.js` | Kept per repo instruction | Remove or pin with SRI before launch; add `frame-ancestors` |
| 22 | Local maintenance scripts that rewrite auth/RLS with service role / `exec_sql` | L | `database/*.js`, `scripts/apply-google-auth-fix.js`, `scripts/fix-supabase-auth.js` | Not deployed (not routes); secrets removed | Move to a private ops repo or delete |
| 23 | In-memory rate limits / Google budget are per serverless instance | M | `lib/server/rate-limit.ts`, `lib/server/google-budget.ts` | Documented, not solved | Add Upstash/Redis or Vercel WAF rate limiting + Google Cloud quotas |
| 24 | Supabase session in `localStorage` (supabase-js default) — readable by any XSS | L | `lib/supabase-client.ts` | No `dangerouslySetInnerHTML` with user data; React escaping; no `eval` | Add a strict CSP once the third-party script is removed |

Not found: RevenueCat, Stripe secret keys, OpenAI (non-Azure) keys, `eval`, SQL built from user input
in app code (all DB access is PostgREST/RPC with parameters).

## 3. Secrets requiring rotation (values never printed)

From `node scripts/scan-git-history-secrets.mjs` — 30 distinct secret values across 580 commits.
“At last commit” = still present in commit `aaa9c71`; all are removed in the release-gate commit.

| Secret type | Distinct values | Files (history) | Commit range | At last commit |
|---|---|---|---|---|
| Supabase **personal access token** (`sbp_`, mislabelled service role) | 2 | `.env`, `app/.env`, `.mcprc`, `VERCEL_DEPLOYMENT_GUIDE.md`, `vercel-env-template.txt`, `scripts/fix-supabase-auth.js`, 1 `.ideavo` file | `e6bff8b` (2025-08-21) → `e9650a0` | yes |
| Supabase service-role JWT | 1 | `.env`, 2 `.ideavo` files | `173093d` (2025-08-25) → `de23291` (2025-09-29) | yes |
| Supabase JWT (unknown/garbled role) | 1 | `.env` | `abc8149` → `d7e828e` (2025-08) | no |
| Postgres URL with password | 18 | `.env`, `.env.backup`, `app/.env`, `VERCEL_DEPLOYMENT_GUIDE.md`, `vercel-env-template.txt`, 4 `.ideavo` files | `8ebcda8` (2025-07-31) → `e9650a0` | yes |
| Google API key | 1 | `.env`, `.env.local`, `lib/google-places.ts`, `lib/google-places-photos.ts`, 8 `.ideavo` files | `7d275ab` (2025-09-06) → `e9650a0` | yes |
| Azure OpenAI API key | 2 | `.env`, `.env.backup`, 2 `.ideavo` files | `e72551f` (2025-08-01) → `e9650a0` | yes |
| Resend API key | 3 | `.env`, `.env.backup`, `GUEST-FUNCTIONALITY-STATUS.md`, `chat-log.md`, `docs/chat-log.md`, 2 `.ideavo` files | `53bf9f2` (2025-08-08) → `e9650a0` | yes |
| Apify API token | 1 | `.env`, `.env.backup`, `.env.local`, `chat-log.md`, `docs/chat-log.md`, `vercel-env-template.txt` | `24cc9c4` (2025-08-19) → `e9650a0` | no |
| Dodo Payments key | 1 | `.env`, `.env.backup` | `311a9fc` → `9bc86ca` (2025-08) | no |

**Rotate all of them**, including values that look old: every one is publicly readable in history.
The 18 database URLs correspond to repeated password changes — rotate the current DB password and
treat every listed one as compromised. Also review Supabase auth logs, Google Cloud billing, Azure
usage and Resend sending logs for misuse since 2025-07-31.

> Session note: during the scan one Apify token value appeared in a local tool error message (a
> crashed `git grep` echoed its argv). The scanner was fixed to keep values out of argv and errors.
> The value is already public in git history and is on the rotation list above.

## 4. Git history remediation plan (not executed — requires explicit approval)

1. **Rotate first** (§3). Rewriting history does not un-leak anything: forks, clones, GitHub caches,
   and search indexes may already hold the secrets. Rotation is the actual fix.
2. **Is a rewrite required?** Recommended (hygiene; stops trivial discovery), not sufficient.
3. **Objects**: all commits `8ebcda8`…`e9650a0` on `main` touching the files in §3; plus the 1,743
   tracked `.ideavo/**` builder session files (11 contain secrets).
4. **Method** — `git filter-repo` on a fresh mirror:
   ```bash
   git clone --mirror https://github.com/magicalbirthdayplanner/magical-birthday-planner-1754362591587 mbp-mirror.git
   cd mbp-mirror.git
   # a) drop files that should never have been committed
   git filter-repo --invert-paths --path .env --path .env.local --path .env.backup --path app/.env \
     --path .mcprc --path vercel-env-template.txt --path-glob '.ideavo/*'
   # b) redact remaining in-file occurrences (replacements.txt: one `regex:<pattern>==>REDACTED` per line,
   #    built from the scanner patterns — keep this file out of the repo)
   git filter-repo --replace-text ../replacements.txt
   ```
5. **Verify**: run `node scripts/scan-git-history-secrets.mjs` inside the rewritten mirror ⇒ 0
   findings (anon/demo keys excluded); `git log --all -- .env` empty; spot-check with gitleaks or
   trufflehog (`trufflehog git file://$PWD --only-verified`).
6. **Publish** (owner action, coordinated): temporarily make the repo private, force-push all refs
   (`git push --force --mirror`), ask GitHub Support to purge cached views/PR refs, then re-open.
7. **Collaborators**: stop work, push nothing from old clones; after the rewrite **re-clone**. Local
   branches (e.g. `mobile-first`) are rebased with `git rebase --onto <new-main> <old-main> mobile-first`
   or recreated by cherry-picking. Ideavo integrations must be re-linked to the rewritten repo.

## 5. Dependency audit

| Package | Severity | Status |
|---|---|---|
| `next` 14.2.35 | critical (Image-optimizer DoS — **not applicable**, `images.unoptimized: true`); high RSC DoS advisories | Latest 14.x applied. Remaining fixes require Next 15/16 (major, App Router changes). **Plan the upgrade**; mitigate with Vercel WAF/rate limiting meanwhile |
| `postcss` (bundled by Next) | high (XSS in CSS stringify, sourceMappingURL read) | Build-time only, no attacker-controlled CSS. Fixed with Next upgrade |
| `eslint-config-next`, `@next/eslint-plugin-next`, `glob` | high | Dev-only lint tooling (glob CLI not used). Fixed with Next 15/16 upgrade |
| 3 moderate | — | transitive, non-runtime |

Before: 188 (28 critical, 58 high). After: **8 (1 critical, 4 high, 3 moderate)**. Supabase packages
(`@supabase/supabase-js` 2.x, `@supabase/ssr`) have no advisories.

## 6. Routes still to delete (deletion was blocked in this session)

File deletion was refused by the session’s safety policy, so these files remain but return **404**
in every environment (and cannot be enabled in production). Delete them with:

```bash
cd app/api && git rm -r apply-auth-fix auth-status auto-fix-oauth automated-supabase-fix bypass-oauth-session \
  check-redirect check-supabase-config database-diagnosis db-ping db-structure db-test debug debug-auth \
  diagnose-user env-test fix-database-admin fix-google-auth fix-google-profile fix-profile-permissions \
  fix-rls-policies fix-schema-mismatch fix-site-url-config force-session-fix force-welcome manual-user-test \
  oauth-advanced-debug oauth-callback-workaround oauth-fix oauth-redirect-diagnosis session-debug \
  setup-profiles-table simple-oauth-fix supabase-fix test-activities test-auth-complete test-resend test-welcome \
  venues venues-local subscriptions activity-expansion budget-allocation n8n emails party/create party/get \
  party/update party/guests party-data custom-themes theme-favorites birthday-activities host-mode-expand
cd ../.. && git rm -r "app/(site)/env-check" "app/(site)/test-oauth"
npm run check   # nothing in the live UI calls these
```

Per-route classification (A delete · B admin-only · C test-only · D safe replacement):

| Route(s) | Class | Reason |
|---|---|---|
| `bypass-oauth-session`, `oauth-callback-workaround`, `force-session-fix`, `fix-google-profile` | **A** | Mint sessions / magic links for arbitrary users |
| `fix-rls-policies`, `fix-database-admin`, `automated-supabase-fix`, `fix-schema-mismatch`, `fix-profile-permissions`, `fix-google-auth`, `setup-profiles-table`, `apply-auth-fix`, `fix-site-url-config` | **A** | Modify production DB, RLS or auth configuration — use migrations / dashboard |
| `diagnose-user`, `debug-auth`, `database-diagnosis`, `db-structure`, `env-test`, `auth-status`, `session-debug`, `check-supabase-config`, `check-redirect`, `oauth-advanced-debug`, `oauth-fix`, `oauth-redirect-diagnosis`, `supabase-fix`, `db-ping`, `db-test`, `debug` | **A** | Information disclosure; `/api/health` remains for monitoring |
| `auto-fix-oauth`, `simple-oauth-fix`, `manual-user-test`, `force-welcome`, `test-*` | **A** (C if wanted) | Test helpers; recreate inside `tests/` if ever needed |
| `subscriptions/*` | **A** → D | Replace with verified checkout session + webhook (`BILLING_SECURITY.md`) |
| `venues`, `venues-local` | **A** → D | Replaced by `/api/discovery/*` |
| `budget-allocation`, `activity-expansion` | **A** | Dead UI, unauthenticated AI |
| `emails/*`, `n8n/*`, `party/{create,get,update,guests}`, `party-data`, `custom-themes`, `theme-favorites`, `birthday-activities`, `host-mode-expand` | **A** | No live caller; leak errors or broken |
| `/env-check`, `/test-oauth` pages | **A** | Config disclosure |

No route is kept as admin-only (B): the app has no server-side admin role yet; build one before
adding any admin endpoint.

## 7. Endpoint inventory after the gate

| Endpoint | Auth | Rate limit | Validation | Notes |
|---|---|---|---|---|
| `POST /api/discovery/search` | bearer (RLS) | 20/min/user; refresh 5/h; Google budget 60 calls/h/user | zod; radius snapped; ≤10 known categories | |
| `GET /api/discovery/places/:id` | bearer | 60/min/user + budget | id regex; must be a surfaced place | |
| `GET /api/discovery/photo` | public | 240/min/IP; 600 uncached/h/IP | photo-name regex; surfaced places only | key never sent |
| `GET /api/discovery/zip` | public | 30/min/IP; geocode fallback budgeted + negative cache | ZIP format | offline dataset first |
| `POST /api/themes/ai` | bearer | 6/h/user; 30-day cache | zod | optional |
| `POST /api/invite/:token/rsvp` | token | 6/10 min/IP/token; 30/h/IP | token regex; zod | service-role RPC |
| `rpc get_invitation` | public (anon) | Supabase platform limits | token regex in SQL | minimal projection |
| `POST /api/analytics` | optional | 60/min/IP | event allowlist; PII keys stripped | |
| `/api/party-venue` | bearer (RLS) | — | uuid/place-id regex | |
| legacy `/api/{parties,guests,user-parties,user/*}` | bearer/cookie (RLS) | — | whitelisted fields | `safeJson` |
| legacy `/api/theme-recommendations`, `/api/food-vendors` | public | 10/h/IP, 10/min/IP | — | paid upstream; retire with legacy planner |
| Supabase Auth (sign-up / sign-in / reset) | — | Supabase Auth rate limits (configure in dashboard) | — | not proxied by the app |
| `/api/webhooks/dodo` | HMAC signature | — | — | incomplete billing |

## 8. Verification (executed on this branch)

| Gate | Result |
|---|---|
| Lint | 0 errors |
| Typecheck | pass |
| Unit (Vitest) | 144 passed |
| Integration (local Supabase: RLS, security, discovery API, hardened routes) | 85 passed |
| E2E (Playwright, mobile) | 19 passed (required flow; 10 error states; 4 viewport sweeps; 4 full mobile regressions incl. logout/login) |
| Production build (Next 14.2.35) | pass, 0 browser source maps |
| Client-bundle secret scan | clean (6 server secret values checked) |
| Working-tree secret scan | clean (only Supabase local demo keys in `.env.e2e` and test helpers) |
