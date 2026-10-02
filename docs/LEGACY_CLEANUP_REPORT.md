# Legacy cleanup report

_Repository consolidation, 2026-10-02, branch `mobile-first`._ The repository now contains only the
mobile-first Magical Birthday Planner: Next.js on Vercel, Supabase, Google Places/Maps, Resend, Dodo
Payments, and optional Azure OpenAI for AI theme ideas.

Labels: **REMOVED** (deleted and verified), **KEPT** (still required, with the reason),
**REVIEW REQUIRED** (needs an owner decision or action).

Overall: 2,082 files changed, 92,827 lines deleted. 2,032 files deleted, 8 added, 35 modified,
7 moved.

## 1. Legacy functionality removed

| Item | Status | Notes |
|---|---|---|
| Desktop planner: `/party-plan` (tabs, timeline, activities, host mode, food/cake vendors, PDF export) | REMOVED | Linked from More and Plan as "Full planner (desktop tools)"; links removed too |
| Desktop dashboard `/dashboard`, party builder `/create-party`, activity catalogue `/activities` | REMOVED | |
| Desktop account page `/account` | REMOVED | Its working features moved into **More → Account**: display name and the "Email me when guests RSVP" preference, which the server honours (`hostContact`). Its "Delete Account" button was never wired up. |
| Legacy auth pages `/signin`, `/signup`, `/signup-success`, auth modal, `SessionSync`, cookie-session (`@supabase/ssr`) helpers | REMOVED | The app uses `/login`, `/join`, `/reset-password` and the browser Supabase client |
| Legacy sharing/RSVP `/share/[token]`, `/rsvp/[token]` | REMOVED | Replaced by `/invite/[token]`. Both had been non-functional under RLS. |
| Fake "early access" form on the landing page | REMOVED | It collected emails, claimed "Join 10,000+ parents" and stored nothing |
| Site header with legacy nav (Dashboard, Account, plan dropdown, dark-mode switch) | REMOVED | Replaced by `components/site/SiteHeader.tsx` (Sign in / Get started / Open app) |
| `SubscriptionContext`, `ThemeContext`, `SubscriptionGate`, trial banner, localStorage plan logic | REMOVED | `/pricing` and `/checkout-success` now read the server-derived `/api/billing/status` (`usePlanStatus`) |
| `/checkout-success` URL-derived plan display and **old static Dodo payment-link product ids** | REMOVED | Rewritten around `CheckoutStatus` (polls the server; URL params grant nothing) |
| Builder (Ideavo) runtime: CDN script, iframe-navigation script, webpack tagger, framing exception, `DomainRedirect` with the builder host | REMOVED | Framing is now denied everywhere |
| Middleware deny-list for long-deleted debug routes (`lib/security/blocked-routes.ts`, `middleware.ts`) | REMOVED | Replaced by `tests/unit/route-inventory.test.ts`: the exact allowed routes, plus a ban on debug/fix/test/bypass-style routes |
| 97 unreachable source files: 26 legacy root components, 37 unused shadcn UI files, `lib/google-places*.ts` (legacy Places API), `lib/n8n.ts`, `lib/env-config.ts`, `lib/dodo-payments.ts`, `lib/db-utils.ts`, `lib/pdf-generator.ts`, `lib/party-actions.ts`, `lib/auth-fetch.ts`, legacy-route guard, 3 unused email templates, `hooks/*`, `utils/geocode.js` | REMOVED | Found by an import-graph walk from the kept entry points. No test, script or config referenced them. |

## 2. Legacy routes removed

10 pages and 21 API route files. All return **404** on a production build (37 URLs checked):

* **Pages:** `/dashboard`, `/party-plan`, `/create-party`, `/account`, `/activities`, `/signin`,
  `/signup`, `/signup-success`, `/rsvp/[token]`, `/share/[token]`.
* **APIs:**
  * `/api/parties`, `/api/guests`, `/api/party-venue`, `/api/party-activities`, `/api/party/share`
  * `/api/user/{subscription,purchase,trial,profile,theme,parties}`, `/api/user-parties`
  * `/api/venues-search`, `/api/food-vendors`, `/api/theme-recommendations`
  * `/api/activities` (+ `/personalize`), `/api/activity-full-expand`, `/api/favorites`, `/api/selected-activities`
  * `/api/early-access`, `/api/check-new-user`, `/api/rsvp/[token]`
* **Already deleted earlier, re-verified 404:** `/env-check`, `/test-oauth`, `/api/bypass-oauth-session`,
  `/api/debug`, `/api/fix-rls-policies`, `/api/map/tiles/*`.

**Lapsed-trial expiry** was handled only by the removed `/api/user/trial`. It now runs server-side in
`/api/billing/status` via `recompute_entitlement`. New integration tests cover both an expired trial
and an active one.

### Final route inventory (pinned by `tests/unit/route-inventory.test.ts`)

| Route | Class | Reason |
|---|---|---|
| `/`, `/pricing`, `/privacy`, `/terms` | PUBLIC | Landing, plans (Dodo checkout), legal |
| `/checkout-success` | PUBLIC (reads status only when signed in) | Return from Dodo hosted checkout |
| `/login`, `/join`, `/reset-password`, `/offline` | PUBLIC | Auth and offline fallback |
| `/invite/[token]` | PUBLIC (token-scoped) | Guest invitation and RSVP |
| `/start` | AUTHENTICATED (draft can begin signed out) | Party wizard |
| `/home`, `/plan`, `/plan/theme`, `/plan/checklist`, `/plan/invite`, `/discover`, `/discover/saved`, `/guests`, `/more`, `/venue/[placeId]` | AUTHENTICATED | The app |
| `/auth/callback` | API (redirect) | Email confirmation / OAuth return. Same-origin `next` only. |
| `/api/discovery/{search,places/[placeId]}`, `/api/themes/ai`, `/api/invitations/send`, `/api/billing/{checkout,status}` | API, AUTHENTICATED | |
| `/api/discovery/{zip,photo}`, `/api/invite/[token]/rsvp`, `/api/analytics`, `/api/health` | API, PUBLIC (rate-limited / token-scoped) | |
| `/api/webhooks/dodo` | API, signature-verified | Dodo events |
| `robots.txt`, `sitemap.xml`, `manifest.webmanifest` | PUBLIC | SEO / PWA |
| Admin | none | No admin routes exist |

## 3. Legacy providers removed

| Provider | Status | Notes |
|---|---|---|
| Geoapify (client, tile proxy, categories, env var, tests) | REMOVED | Removed in `2fa4058`. Its env var is gone from config and scanners. |
| Geoapify compatibility helper `lib/discovery/legacy.ts` (`geo_` ids: no Google directions id, OSM attribution) | **KEPT** → REVIEW REQUIRED | Production's venue cache still holds 59 `geo_` rows from UAT testing; deleting them was not permitted in this session (§10). Delete the helper and its uses after those rows are removed. |
| Legacy Google Places API (`maps/api/place`, key in URL) | REMOVED | `lib/google-places*.ts`. Places API (New) remains. |
| n8n, Stripe, PositionStack, Apify, Nominatim | REMOVED | Code, env vars and the secret-scanner list. The history scanner keeps their *patterns* to detect historical leaks. |
| Legacy Azure OpenAI route (`/api/theme-recommendations`) | REMOVED | |
| Azure OpenAI for `/api/themes/ai` | KEPT | Used by the current Theme screen ("AI ideas"). Optional; hides when unset. |
| Ideavo builder (scripts, tagger, 1,811 `.ideavo*` session files, `ideavo-server.info`, package name `ideavo-nextjs`) | REMOVED | `.gitignore` keeps them from returning |

## 4. Legacy domains removed

| Item | Status |
|---|---|
| Old domain in code, config, Vercel JSON, emails, metadata, tests | REMOVED. A search of tracked files finds it only in `docs/archive/` (dated history) and the dated launch report. |
| `vercel.production.json`, `vercel.staging.json` (old aliases/config) | REMOVED |
| Client-side canonical-host redirect | REMOVED. Use Vercel → Domains redirects (documented in `RELEASE.md`). |
| Hard-coded production domain | None. Origin comes from `NEXT_PUBLIC_BASE_URL` or the Vercel deployment URL. |

## 5. Legacy environment variables removed

* **Removed from `.env.example`, `.env.e2e` and code:**
  * `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `N8N_WEBHOOK_URL`, `POSITIONSTACK_API_KEY`, `GEOAPIFY_API_KEY`, `APIFY_API_TOKEN`
  * `NEXT_PUBLIC_CANONICAL_HOST`, `NEXT_PUBLIC_DISABLE_DOMAIN_REDIRECT`, `NEXT_PUBLIC_SITE_URL`
  * `DATABASE_URL`, `DIRECT_URL`
  * `DODO_API_KEY`, `DODO_WEBHOOK_SECRET`, `DODO_PAYMENTS_WEBHOOK_KEY` (undocumented alias in the webhook)
  * `ENABLE_DEBUG_ROUTES`
* **`.env.example` now holds exactly the variables the code reads,** grouped PUBLIC / SERVER:
  Supabase, Google, Resend, Dodo, Azure OpenAI (optional), app URL, cost/abuse guards, and the
  test-only endpoint overrides. It has no values.
* **REVIEW REQUIRED (Vercel, not in Git):** the old shared Preview/Development entries with old
  credentials (`INTEGRATIONS.md` → Vercel). Removing them automatically was not permitted.

## 6. Legacy dependencies removed

**46 packages removed** (44 runtime + 2 dev; 169 including transitive dependencies), plus 5 npm scripts that ran deleted tools (`db:setup`, `db:verify`, `push`, `push:msg`, `deploy`):

* **Runtime:**
  * `@babel/runtime`, `@hookform/resolvers`
  * 25 `@radix-ui/*` packages (unused shadcn primitives)
  * `@supabase/ssr`, `cmdk`, `date-fns`, `dotenv`, `embla-carousel-react`, `input-otp`
  * `jspdf`, `jspdf-autotable`, `next-themes`, `pg`, `react-canvas-confetti`, `react-day-picker`
  * `react-hook-form`, `react-resizable-panels`, `recharts`, `uuid`, `@ideavo/webpack-tagger`
* **Dev:** `@types/jspdf`, `@types/uuid`.
* **Kept:** `autoprefixer` and `postcss` (PostCSS config), `react-dom` and `typescript` (Next.js),
  `openai` (Azure AI themes), `vaul` (bottom sheets), `@googlemaps/markerclusterer` and
  `@vis.gl/react-google-maps` (map).
* **`npm audit` after cleanup:** 1 critical, 4 high, 3 moderate. These are the same Next.js 14 and
  dev-tool advisories documented in the launch report; all need major upgrades.

## 7. Legacy tests removed / changed

| Test | Status |
|---|---|
| `tests/integration/legacy-routes.test.ts` (party-venue legacy route) | REMOVED |
| `tests/unit/blocked-routes.test.ts` | REMOVED; replaced by `tests/unit/route-inventory.test.ts` |
| Legacy paid-route cases in the launch hardening suite | REMOVED. The email-cap cases kept as `tests/integration/email-caps.test.ts`. |
| `security.test.ts` legacy self-upgrade endpoint case | Rewritten: asserts those endpoints no longer exist |
| Builder-script gate test | Rewritten: framing is denied unconditionally |
| **Added** | `tests/e2e/account.spec.ts` (More → Account persists), trial-expiry cases in `billing.test.ts`, route inventory |
| Kept: `tests/e2e/error-states.spec.ts` asserts retired debug URLs return 404 | KEPT (guards against reintroduction) |

## 8. Legacy documentation cleaned

* **Rewritten to describe only the current app:**
  * `README.md` (previously described the original desktop app)
  * `docs/SECURITY.md`, `docs/RELEASE.md`, `docs/INTEGRATIONS.md`, `docs/BILLING_SECURITY.md`, `docs/README.md`, `scripts/README.md`
* **Edited:** `docs/MOBILE_UX.md`, `docs/SUPABASE_SCHEMA.md`, `docs/TESTING.md`.
* **REMOVED** (described deleted code or abandoned approaches):
  * root `CHANGELOG.md`, `LESSONS_LEARNED.md`, `PROJECT_STRUCTURE.md`, `rules.md`
  * `GOOGLE_AUTH_FIX_SUMMARY.md`, `GUEST-*`, `TRIAL_*`, `INSTANT_TRIAL_FIX.sql`
  * `VERCEL_DEPLOYMENT_GUIDE.md`, `vercel-env-template.txt`
  * `chat-log.md` (root and `docs/`)
  * `docs/ACTIVITIES_TAB_README.md`, `docs/FRESH_SETUP_README.md`, `docs/PLAN_BASED_ACCESS_CONTROL.md`,
    `docs/SUPABASE_SETUP_GUIDE.md`, `docs/SUPABASE_ENV_TEMPLATE.txt`
* **Archived** to `docs/archive/` with a "historical, not current instructions" note:
  * `FINAL_QA_REPORT.md`, `MOBILE_FIRST_AUDIT.md`, `PRODUCTION_SCHEMA_DIFF.md`,
    `SECURITY_RELEASE_AUDIT.md`, `SUPABASE_SECURITY_AUDIT.md`
* **Also REMOVED:**
  * `database/` (33 legacy setup/"fix"/seed scripts and SQL; the schema lives in `supabase/migrations`)
  * `scripts/apply-google-auth-fix.js`, `scripts/fix-supabase-auth.js`
  * auto-commit-and-push scripts (`push`, `p`, `quick-push.sh`, `scripts/auto-push.sh`, `deploy-trial-fix.sh`)
  * `test-guest-*.sh`, tracked `logs/*.log`, `.mcprc`
* **Untracked:** the local tool settings file `.claude/settings.local.json` (now git-ignored).

## 9. Database items reviewed

Production schema is unchanged by this cleanup.

| Object | Classification | Notes |
|---|---|---|
| `parties`, `guests`, `saved_venues`, `party_venues`, `party_invitations`, `checklist_items`, `venues`, `venue_searches`, `venue_search_results`, `users`, `billing_*`, `email_logs`, `analytics_events`, `ai_cache` | ACTIVE | |
| `get_invitation`, `submit_rsvp`, `venues_near`, `recompute_entitlement`, `owns_party`, trigger functions | ACTIVE | |
| `activities`, `activity_favorites`, `party_activities`, `theme_preferences`, `invitations` (per-guest) | LEGACY BUT SAFE → REQUIRES MIGRATION | No code reads them. RLS on. |
| View `user_trial_status`; functions `start_24_hour_trial`, `get_trial_status`, `check_and_expire_trial` | LEGACY BUT SAFE → REQUIRES MIGRATION | Not executable/selectable by clients (`42501`, verified) |
| `parties.checklist_data`, `is_shared`, `shared_at`, `share_token`, `selected_theme`, `party_location`, `child_gender` | LEGACY BUT SAFE → REQUIRES MIGRATION | Unused columns |
| Migration `20251001000600_launch_hardening.sql` (indexes, `search_path`, `security_invoker`) | REVIEW REQUIRED | Applied locally; production awaits approval |

The drop is prepared as **`supabase/proposed/drop_legacy_planner_objects.sql`**. It is DESTRUCTIVE,
NOT APPLIED, and outside `supabase/migrations`, so no tooling applies it. It was validated by applying
it to the local database (no dependent objects), which was then rebuilt from the real migrations.
Apply only after a backup and your approval.

Correction to the launch report: its "`recompute_entitlement` not executable" result had used a
wrong parameter name. Re-tested with the correct one: `authenticated` and `anon` both get `42501`;
service role only.

## 10. Test data cleaned

| Where | Status |
|---|---|
| Production test users and user data created during verification (temporary users for RLS, plan, trial, view, UAT checks) | REMOVED by each script, then re-verified by count: **0** users, parties, guests, invitations, RSVP guests, saved venues, party venues, billing purchases/checkouts and email logs |
| Local development database (22 test users, 20 parties from test runs) | REMOVED (`supabase db reset`; 0 users / 0 parties / 0 guests). The local demo account is gone too; reseed if needed. |
| Production **test-generated cache and analytics**: 59 `geo_` venues, 8 cached searches (78 result links), 100 analytics events, all created 2026-10-02 13:06–14:58 UTC by our Preview UAT runs (no customers exist; Preview is behind Vercel login) | **REVIEW REQUIRED**: deletion was not permitted in this session. SQL to run in the Supabase SQL editor is below. |

```sql
-- Run only while production has no real users (check first: select count(*) from auth.users;)
begin;
delete from venue_search_results where venue_id in (select id from venues where place_id like 'geo\_%');
delete from venue_searches where created_at between '2026-10-02 13:00+00' and '2026-10-02 15:00+00';
delete from venues where place_id like 'geo\_%';
delete from analytics_events where created_at between '2026-10-02 13:00+00' and '2026-10-02 15:00+00';
commit;
```

## 11. Security scan result

| Check | Result |
|---|---|
| Client bundle secret scan (`npm run check:secrets`, all current server secrets loaded) | clean: 73 client files, 7 server secret values |
| Current credentials in staged changes or tracked files | none |
| Git history scan | **0 secrets at HEAD**. 30 historical values from the original repository remain in history (not rewritten, per instruction). Rotation required (`SECURITY.md`). |
| Debug / bypass / env-check / fix routes | none exist (route inventory test); all retired URLs return 404 |
| Auth bypasses | none. The auth callback only validates a same-origin `next` and redirects. |
| Builder / third-party scripts | none loaded |

## 12. Build result

`next build`: **PASS**. 37 routes, first-load JS 87.5 kB shared (landing 159 kB, largest app page
`/plan/theme` 213 kB). The bundle secret scan is clean.

## 13. Test result

| Suite | Result |
|---|---|
| ESLint | 0 errors, **0 warnings** (was 19; all in deleted legacy files) |
| TypeScript | PASS |
| Unit | **162 / 162** (16 files) |
| Integration (local Supabase) | **112 / 112** (6 files) |
| Browser E2E (Playwright, phone viewports) | **23 / 23** |
| Removed-route check on a production build | 37 / 37 retired URLs → 404; all kept routes respond |

## 14. Git status

* **Branch:** `mobile-first`.
* **Commit:** a single cleanup commit after all tests passed, pushed normally. No reset, rebase,
  force-push or history rewrite. See the commit right after `5574d52`.

## 15. Remaining items requiring manual review

1. **Production test cache and analytics rows.** Run the SQL in §10. Then delete
   `lib/discovery/legacy.ts` and its four uses (`ranking.ts`, `venue-row.ts`, `VenueDetailScreen.tsx`,
   `google-migration.test.ts`).
2. **Legacy database objects.** Approve (or not) `supabase/proposed/drop_legacy_planner_objects.sql`
   after a backup.
3. **Migration `0600`.** Approve applying it to production.
4. **Vercel.**
   * Untick Preview/Development on the 6 old shared variables.
   * Remove the previous domain's team-level record.
5. **Google sign-in button.** The login screen shows "Continue with Google", but Google is not
   enabled as a Supabase Auth provider. Enable it, or hide the button (product decision).
6. **Credential rotation.** Historical values and those pasted in chat (`SECURITY.md`).
7. **Next.js 15 upgrade.** Security advisories (launch report, P1).
