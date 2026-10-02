# Launch readiness report: Magical Birthday Planner

_Review date: 2026-10-02 · branch `mobile-first` · reviewed commit `bb098cb` (plus this report) ·
Preview: `https://magical-birthday-planner-17-git-ef697a-magical-birthday-planner.vercel.app`
(Vercel Authentication protected)._

Status labels used: **PASS**, **FAIL**, **BLOCKED**, **MANUAL TEST REQUIRED**, **DEFERRED**.

---

## 1. Executive summary

**Verdict: not ready for real customers yet.** The blockers are external configuration (email domain,
Google billing, Supabase Auth email) and credential hygiene, not the core product.

- **The core product works end-to-end, including on the real deployed Preview.** A parent can:
  - sign up and build a party (child, date, ZIP 48084, guests, budget, vibe, interests, theme);
  - get context-ranked venues, list and map them, open details, save, and add one to the party;
  - manage guests and send an invitation;
  - receive the guest's RSVP from another phone (RSVP confirmation and host notification delivered
    through real Resend);
  - tick the checklist, sign out, sign back in, and find everything intact.
- **Security checks passed:**
  - Production RLS: 81 cross-user checks with 0 leaks.
  - Plan self-grant: every attempt denied.
  - Shipped JavaScript contains no secrets.
- **What blocks a real launch (P0, §18):**
  - **Email to real people doesn't work yet.** There is no owned domain, so Resend's shared sender only
    delivers to the account owner. Supabase's built-in auth mailer is for testing only, and its Site
    URL still points to `localhost`, so sign-up confirmation and password-reset emails would not
    reach real parents correctly.
  - **Google returns 403** for the supplied key (billing or Places API (New) not enabled). New areas
    can't be searched, so discovery only works from venues already stored. There is also no browser
    Maps key, so the map is the simplified one.
  - **Production environment not prepared:**
    - no owned production domain;
    - the production Vercel environment still holds old, leaked values;
    - credentials leaked in git history (30 distinct values) still need rotating.
  - **Payments:** if you charge at launch, Dodo needs a real sandbox run first. Live charging is
    disabled.
- **Review findings:** 30 issues found, 26 fixed and re-tested in this review (§13–14), including:
  - access tokens logged on every party creation;
  - an unpinned third-party script on every page;
  - unauthenticated routes that spend money (Google, Azure OpenAI);
  - shared-catalogue poisoning;
  - an outage state that told existing users "No party yet".

## 2. Product flow validation

**How it was tested:** Playwright, driving a phone browser (390×844 iPhone profile; a Pixel 7 profile
for the guest).
- **Local runs:** a local production build with mock Google/Resend/Dodo, using the realistic data you
  asked for (Ava, 7, ZIP 48084, 15 guests, $500, indoor, art).
- **Real Preview run (`/tmp/mbp/uat.mjs`):** the same journey on the real Preview, against production
  Supabase and real Resend.

| Step | Local (realistic data) | Real Preview | Evidence |
|---|---|---|---|
| Landing | PASS | PASS | HTTP 200; screenshot `01-landing` |
| Sign up (UI) | PASS | PASS¹ | lands on `/home` |
| Email confirmation | PASS² | **BLOCKED** | see §4 |
| Wizard: child, age, date, ZIP 48084 → Troy, MI, 15 guests, $500, indoor, art, theme | PASS | PASS | |
| Venue discovery | PASS: 20 results, art places first ("Clay Cafe Paint-Your-Own", "Little Picasso Art Studio"…) | PASS³: 59 venues | |
| Venue details ("Why we recommend it") | PASS | PASS | |
| Save venue | PASS | PASS | |
| Add venue to party | PASS | n/t | |
| Browser back | PASS | n/t | |
| Map: markers, cluster, selection sheet | PASS | PASS (schematic) | |
| Guest list (empty-state button and header button) | PASS | PASS | |
| Invitation email | PASS (mock) | PASS (real, delivered) | |
| Guest RSVP (Android profile) | PASS | PASS | |
| RSVP confirmation | PASS | PASS (delivered) | |
| Host notification | PASS | PASS (delivered) | |
| Checklist | PASS | PASS | |
| Logout (no private localStorage left) | PASS | PASS | |
| Login, then data persists (party, saved venue, guests) | PASS | PASS | |
| Wrong password: "That email and password don’t match. Try again?" | PASS | n/t | |
| Signed-out deep link to `/guests`: `/login`, no data shown | PASS | n/t | |

Footnotes:
1. The Preview UAT creates a confirmed user server-side, because UI sign-up there needs the confirmation
   email (§4).
2. Verified end-to-end on local Supabase by following a generated confirmation link: the user lands
   signed in on `/home`. This needed the sign-up redirect fix (§14).
3. On the Preview, Google returns 403, so these are stored venues served by the designed fallback.
   "Art Studios" appears twice: it's two OpenStreetMap features stored while Geoapify was the
   provider (P2).

## 3. Security assessment

| Area | What / how | Result | Evidence | Remaining risk |
|---|---|---|---|---|
| **API routes (36)** | Read-only audit of every handler (auth, authorization, validation, rate limit, errors, SSRF, IDOR, paid calls), plus live unauthorized calls | PASS after fixes | Table in this review's API audit; Preview: legacy paid routes **401**, blocked routes **404**, bad photo request **400** | Rate limits are per serverless instance (in-memory). Google Cloud quotas are the fleet-wide hard cap (external). |
| **Error leakage** | Bad ZIPs, malformed bodies, provider failures, Supabase outage, expired session | PASS | No stack traces, provider bodies, keys or internal codes on screen or in JSON (`technical-leak=false` in all cases) | — |
| **XSS / input** | HTML/JS payloads, SQL-like strings, 5,000-char strings, emoji/RTL in child name, ZIP, guest names, saved-venue notes, RSVP name/note, wrong JSON types | PASS | 0 script executions, 0 dialogs, 0 injected elements; values stored verbatim and truncated (child name 40, guest name 80); `parties` table intact; wrong types → 400 | — |
| **CSRF** | APIs use bearer tokens (no ambient cookie auth on the mobile routes) | PASS | `getAuthedRequest` | Legacy cookie routes only read/write the caller's own RLS-scoped data |
| **Clickjacking** | Headers on the Preview | PASS (fixed) | `X-Frame-Options: DENY`, `frame-ancestors 'none'` | — |
| **Third-party script** | Root layout | PASS (fixed) | Ideavo builder scripts are no longer served on Vercel (0 in the Preview HTML) | — |
| **Security headers** | Preview response headers | PASS | HSTS preload, `nosniff`, Referrer-Policy, Permissions-Policy | No full script CSP yet (P2) |
| **Secrets in shipped JS** | `check-client-secrets` on the build, plus a scan of the deployed Preview (10 pages, 43 assets; plus 30 scripts during UAT) | PASS | "clean"; 0 hits; no public source maps | — |
| **Server Actions** | `"use server"` modules | PASS (fixed) | `lib/party-actions.ts` is now plain server code | — |
| **Framework** | `npm audit` | **FAIL / DEFERRED** | Next 14.2.35: about 23 advisories, fixed only in 15.5.x (§11) | DoS / cache-poisoning class issues |

## 4. Authentication assessment

| Test | Result | Evidence |
|---|---|---|
| Sign up (production Supabase) | PASS | `signUp` returns a user with no session (confirmation required). Only the email provider is enabled. |
| Email confirmation | Flow PASS locally; **BLOCKED** on Preview/production | Supabase Site URL is still `http://localhost:3000` and the Preview isn't on the allow-list: confirmation and reset links are rewritten to localhost (checked with `generateLink`). Confirmation emails go through Supabase's built-in, test-only mailer. |
| Sign-up redirect | PASS (fixed) | Previously ended on `/signin` without a session; now `/auth/callback?next=/home` lands signed in |
| Login | PASS | |
| Logout | PASS | |
| Wrong password | PASS | Friendly message |
| Password reset | PASS locally | Real link → `/reset-password` → new password works |
| Password reset on production | **BLOCKED** | Same Site URL / SMTP issue |
| Expired / corrupted session | PASS | Redirects to `/login`; nothing leaked |
| Offline sign-out | PASS (fixed) | Local sign-out fallback; local data always cleared |
| Shared device (A's session expires, B signs in) | PASS (fixed) | B never sees A's wizard draft (child name / ZIP) |
| Multiple tabs | MANUAL TEST REQUIRED | Supabase session sync across tabs is library behaviour; not automated here |
| Unauthorized API calls | PASS | No token → 401; forged JWT → 401; another user's `partyId` → 404 |
| Auth bypass via IDs | PASS | §5 matrix |

## 5. Supabase / RLS assessment

- **Schema:** production fingerprint is identical to the tested migrations: **521/521 items, 0 diff**.
  It covers tables, columns, RLS flags, policies, function grants/definer flags, triggers, indexes,
  extensions, `anon`/`authenticated` table grants, and definer `search_path`.
- **Cross-user matrix on production:** USER A, USER B and anonymous, 81 checks, **0 leaks**.
  - Read, update, delete and insert are denied for B and anonymous callers on:
    `parties`, `guests`, `saved_venues` (incl. notes), `party_invitations`, `checklist_items`,
    `party_venues`, `theme_preferences`.
  - Inserting into A's party is denied, including with B's own user id.
  - `billing_*`, `email_logs`, `analytics_events` and `users` are unreadable and unwritable cross-user;
    billing inserts are denied.
  - `recompute_entitlement` is not executable by clients.
  - The public invitation projection exposes only display fields. A guessed token returns `null`.
  - **Entitlements:** a user can't set `current_plan`, `is_trial_active` or `trial_expires_at` on
    themselves (`42501`). Anonymous updates change nothing; ordinary profile edits still work.
- **Findings:**
  - `anon`/`authenticated` hold Supabase's default full table grants. Safe only because RLS is enabled
    on every table; verified above.
  - `user_trial_status` is a view over every user, with no RLS. It is not exposed: no grants, `42501`
    from the API.
  - Three legacy SECURITY DEFINER functions have no pinned `search_path` (not executable by clients;
    `42501`).
  - `email_logs` had no index for the new daily caps.
- **Migration `20251001000600_launch_hardening.sql`** (additive, idempotent): indexes, pinned
  `search_path`, `security_invoker` view. **Applied locally and tested; NOT applied to production.**
  Awaiting your approval, per your instruction.

## 6. Google Places / Maps assessment

| Check | Result | Evidence |
|---|---|---|
| Server key never reaches the client | PASS | Not in any client file, HTML or deployed asset; `server-only` imports; unit test enforces it |
| Browser Maps key referrer-restricted | **BLOCKED** | No browser key supplied |
| Real Google discovery | **BLOCKED** | Supplied key returns `403 PERMISSION_DENIED` on Places (New); Geocoding reports billing not enabled |
| Radius normalised | PASS | 5/10/20/30 mi: every result within the radius. 13 → snapped to 10; 99 → 400. Text Search uses a hard `locationRestriction` box. |
| Duplicates | PASS | 0 duplicates per radius; same-response duplicates removed |
| Caching | PASS | 24 h search cache (Supabase), 7 d details cache, 6 h photo-URI cache plus CDN |
| Duplicate-request suppression | PASS | Identical in-flight searches share one call (unit test: 3 concurrent → 4 calls, not 12) |
| Details only when opened | PASS | Only for places discovery surfaced. Catalogue poisoning closed (§14). |
| Rate limits / budgets | PASS | 20 searches/min and 5 refreshes/h per user; 60 Google calls/h per user and 2,000/h per instance; photos charged to the budget |
| Provider failures | PASS | Quota → 503 "very busy"; error → 503; timeout → 504 (now about 8 s instead of 16 s); empty → 0 results; malformed or missing key → typed errors |

**Worst-case Google calls** (cold cache, no sharing). Per user per party:
- 8 Text Search for initial discovery;
- 1 Place Details for each venue opened (assume 5);
- 1 Place Photo for each photo first seen (assume 25);
- 0 for map pan/zoom;
- 0 for reload within 24 h.

That is about 38 calls per party.

| Active parents (one party each) | Worst case | Hard ceiling enforced by the app |
|---|---|---|
| 1 | ~38 | 60 calls/h/user (plus 60 photo calls/h/IP) |
| 10 | ~380 | same per user; 2,000/h per server instance |
| 100 | ~3,800 | same |
| 1,000 | ~38,000 | same; instance caps don't add up to a fleet-wide cap |
| 10,000 | ~380,000 | **Set Google Cloud per-API daily quotas and a billing budget/alert. This is the only fleet-wide hard cap.** |

Real numbers will be lower: parents in the same area share cached searches (keyed by category,
~1 km location and radius), and photos are cached by the CDN. Text Search falls in the Enterprise
SKU because rating and price fields are requested; they're shown on every card. See
`GOOGLE_PLACES_COST_CONTROL.md` for the per-action breakdown.

## 7. Email assessment

| Check | Result | Evidence |
|---|---|---|
| Invitation | PASS | Delivered on the real Preview: correct recipient, the party's link, subject "You’re invited to Ava’s birthday party!" |
| RSVP confirmation | PASS | Delivered |
| Host notification | PASS | Delivered |
| Password reset / sign-up confirmation | **BLOCKED** | Sent by Supabase Auth's mailer (not Resend); Site URL is localhost |
| HTML injection | PASS | All user text escaped (9 integration tests); XSS run (§3) |
| No duplicates | PASS | Resend idempotency keys; already-invited guests skipped |
| Failure doesn't break RSVP | PASS | Integration test; RSVP recorded with `emailed:false` |
| Spam relay | PASS (fixed) | Daily caps from `email_logs`, holding across all instances: 300 invitations per host, 200 RSVP emails per party (integration tested) |
| Content | PASS | No secrets, stack traces, old domain or dev URLs. Links use the deployment URL. |
| Deliverability to real recipients | **BLOCKED** | Shared `onboarding@resend.dev` only delivers to the account owner |

## 8. Dodo billing assessment

- **Code review:** PASS.
  - The client cannot choose the plan's product, price or user. The server creates the checkout.
  - Webhooks use Standard Webhooks HMAC, a ±5-minute window, constant-time comparison and a 512 KB cap.
  - Events are idempotent on `webhook-id`; stale or out-of-order events are ignored.
  - The plan is derived from the product id only; underpaid amounts are held for review.
  - Refunds and cancellations revoke; customer hijacking is rejected.
  - Live charging needs both `live_mode` and `DODO_LIVE_PAYMENTS_ENABLED=true`.
- **Tests:** 12 unit, 18 integration and 2 E2E tests cover:
  - success, failure, duplicate and out-of-order events;
  - refunds and subscription cancellation;
  - invalid and missing signatures;
  - URL and localStorage tampering, and a direct API self-grant (403/410).
- **Preview without credentials:** checkout is refused with 503 and never reaches Dodo.
- **Real sandbox run: BLOCKED.**
  - No test-mode API key, webhook secret or product ids have been supplied.
  - A **live-mode** key was supplied. It is stored only in the secure file and is not configured anywhere.
  - Note: Vercel deployment protection will block Dodo's webhook calls to a protected Preview. Use a
    protection-bypass secret in the webhook URL for sandbox testing (documented in INTEGRATIONS.md).

## 9. Performance assessment

Measured on a local production build with a throttled mid-range phone profile (about 1.6 Mbps,
150 ms RTT, 4× CPU slowdown):

| Page | DOMContentLoaded | LCP | Data requests |
|---|---|---|---|
| `/` | 247 ms | 188 ms | 5 |
| `/login` | 240 ms | 308 ms | 1 |
| `/home` | 250 ms | 1,096 ms | 12 |
| `/discover` | 241 ms | 1,008 ms | 11 (incl. lazy photos) |
| venue | 250 ms | 736 ms | 6 |
| `/plan` | 243 ms | 596 ms | 6 |
| `/guests` | 236 ms | 740 ms | 2 |

- **Totals:** the 9-step wizard plus party creation takes 3.6 s; results appear 2.3 s later.
  First-load JS is 87.8 kB shared and 161–219 kB per route. No duplicate requests, and no 5xx
  responses during the journeys.
- **Top 5 improvements:**
  1. Home calls the full discovery API on every visit for three recommendations. It's served from
     cache (no Google calls), but could reuse the SWR result.
  2. Card photos could use the 320 px bucket instead of 640.
  3. The legacy landing page is a large client component. Making it a server component would help
     first paint and SEO.
  4. A Google Maps browser key plus a Map ID would replace the schematic map; consider lazy-loading
     the map only on the map tab (already a dynamic import).
  5. Upgrading Next/React (§11) brings framework performance fixes.
- **Implemented:** the discovery deadline (worst-case wait 16 s → about 8 s).

## 10. PWA / mobile assessment

- **Manifest:** name, standalone display, `start_url /home?source=pwa`, icons 192/512 plus maskable.
  All served correctly. PASS.
- **Service worker:** activated. It caches only static assets and the app-shell HTML, never API or
  Supabase data. Shell HTML contains no user data. Sign-out deletes the page cache. PASS.
- **Shared-device privacy:** PASS (fixed).
  - Sign-out clears every `mbp.*` key, the page cache and the in-memory SWR data.
  - A different user signing in clears the previous user's local data.
- **Responsive layout:** 16 screens × 375/390/393/430 px (64 combinations): **0 horizontal overflow**.
  The flagged "clipping" is inside intentional horizontal carousels.
- **Touch targets:** checklist toggles, "Reset link", "Forgot password?", section links, the radius
  control and "Open in Google Maps" now have 44 px hit areas (fixed). Remaining sub-40 px targets are
  on the legacy desktop pages (P2).
- **Offline:** cached screens show "You’re offline". Unvisited pages while offline: **MANUAL DEVICE
  TEST REQUIRED** (automation's offline mode bypasses the service worker inconsistently).
- **Needs a real device** (MANUAL DEVICE TEST REQUIRED): iPhone Safari and Android Chrome keyboard
  behaviour, the native date picker, safe areas, the bottom-sheet drag, PWA install/update.

## 11. Dependency / security assessment

`npm audit`: **1 critical, 4 high, 3 moderate**. Every fix is a major version upgrade.

| Package | Severity | Exploitable here? | Decision |
|---|---|---|---|
| `next@14.2.35` (last 14.x) | critical; ~23 advisories, fixed ≥15.5.24 | Partly. Not applicable: the image optimizer (disabled with `unoptimized`), Windows RCE, Pages-Router i18n, WebSocket and custom-server SSRF. **Applicable class:** App Router / RSC DoS and cache-poisoning advisories. The public Server Actions surface was removed in this review. | **DEFERRED, P1:** upgrade to Next 15.5.x + React 19 in a dedicated branch with the full suite |
| `postcss` (via next) | high | No. Build-time processing of our own CSS. | Resolved by the Next upgrade |
| `eslint-config-next`, `glob` | high | No. Dev-only CLI. | With the Next upgrade |
| `vitest`, `@vitest/*` | moderate | No. Dev-only. | DEFERRED, P2 |

There are 25 packages a major version behind. None was upgraded blindly.

## 12. Environment / deployment assessment

| Environment | State | Result |
|---|---|---|
| **Preview, `mobile-first`** | Branch-scoped variables: new Supabase, Resend, Google server key, Dodo test mode, Preview URL. Geoapify variables removed. | PASS |
| Preview, shared entries | Old Supabase/anon/service-role keys, old Resend, old Google, `DATABASE_URL` still target **Preview + Development**. Overridden for `mobile-first`, except `DATABASE_URL` (unused by the app). | **FAIL**: automatic cleanup was blocked by the permission system; manual step |
| **Production (`master`)** | Old application; old (leaked) values; not touched by this review | **BLOCKED**: needs migration before launch |
| Domains | `magicalbirthdayplanner.com` and `www.` removed from the project | PASS. The team-level record remains (manual). |
| `.env.example` | Matches what the code reads; no secret values. Added `EMAIL_DAILY_*`, `DISCOVERY_DEADLINE_MS`, Dodo price/base vars; removed unused entries. | PASS |
| Git / secrets | 0 secrets at HEAD (history scan); current credentials appear in no commit | PASS |
| Secret history | **30 historical secret values** (original repo `.env` files): Supabase (old project), Postgres URLs, Google, Azure OpenAI, Resend, Apify, Dodo. Not rewritten, per instruction. | **Rotation required**, see §17 |

## 13. Issues found

| # | Issue | Severity | Status |
|---|---|---|---|
| 1 | `app/api/parties` logged all request headers (bearer token, session cookies) | Critical | Fixed |
| 2 | Unpinned third-party builder script on every page, including signed-in ones; plus a 404 script | High | Fixed (not loaded on Vercel) |
| 3 | `/api/venues-search`: unauthenticated, unlimited legacy Google calls and service-role writes | High | Fixed |
| 4 | `/api/food-vendors`: unauthenticated, 6 uncached Google calls per request | High | Fixed |
| 5 | `/api/theme-recommendations`: unauthenticated Azure OpenAI with unbounded prompts | High | Fixed |
| 6 | `/api/party-venue` let users write the shared venue catalogue (and unlock paid detail calls) | Medium | Fixed |
| 7 | `/api/activities`: PostgREST filter injection, unbounded page size, unneeded service role | Medium | Fixed |
| 8 | Photo proxy: arbitrary widths caused paid cache misses; not budgeted | Medium | Fixed |
| 9 | `lib/party-actions.ts` exposed 9 mutators as public Server Actions | Medium | Fixed |
| 10 | Legacy `/api/rsvp/[token]` and `/api/party/share`: IDOR-prone if RLS loosened | Medium | Fixed (blocked) |
| 11 | No cross-instance email caps (spam relay via invitations or RSVP confirmations) | Medium | Fixed |
| 12 | OAuth code, full URLs, emails, request bodies and guest data in server logs | Medium | Fixed |
| 13 | Raw access token written to an unused cookie in the auth callback | Medium | Fixed |
| 14 | No clickjacking protection | Medium | Fixed (on Vercel) |
| 15 | No robots/noindex: private and token pages indexable; previews indexable | Medium | Fixed |
| 16 | Sign-out skipped cleanup on network error | Medium | Fixed |
| 17 | Next user on the same device could see the previous user's wizard draft | Medium | Fixed |
| 18 | DB outage showed "No party yet" to existing users (duplicate-party risk) | Medium | Fixed |
| 19 | Provider timeout made users wait ~16 s | Low | Fixed |
| 20 | Sign-up confirmation landed on `/signin` without a session | Medium | Fixed |
| 21 | No global error page | Low | Fixed |
| 22 | Structured log props could overwrite level/type/name; no timestamp | Low | Fixed |
| 23 | Touch targets of 16–32 px on key mobile controls | Low | Fixed |
| 24 | Debug log shipped the old Supabase project ref | Low | Fixed |
| 25 | `email_logs` lacked indexes; definer functions without `search_path`; security-definer view | Low | Fixed in migration (prod pending approval) |
| 26 | History scanner flagged the fake e2e Dodo key | Info | Fixed (allow-listed) |
| 27 | Next.js 14 unpatched advisories | High | Deferred, P1 |
| 28 | Rate limits are per instance (in-memory) | Medium | Deferred, P1 (Google quotas external) |
| 29 | No error monitoring / alerting | Medium | Business decision (cost) |
| 30 | Legacy desktop planner (`/party-plan`, `/dashboard`, …) still linked from More; several of its features are broken (always-401 routes) | Medium | Business decision |

## 14. Issues fixed

Items 1–26 above, in commits `40820a9`, `2fa4058`, `a568299` and `bb098cb`. Each fix has a test:
- `tests/integration/launch-hardening.test.ts` (7)
- `tests/unit/launch-config.test.ts` (6)
- `tests/unit/google-migration.test.ts` (7)
- `tests/e2e/resilience.spec.ts` (1)
- updated `blocked-routes`, `legacy-routes`, `google-cost-control` and `places-client` tests

## 15. Issues intentionally deferred

| Item | Why deferred |
|---|---|
| Next.js 15 / React 19 upgrade | Major upgrade (P1); needs its own branch |
| Script CSP | Needs a nonce strategy; frame/object/base protections were shipped |
| Fleet-wide rate limiting (Redis / Vercel KV) | New infrastructure; Google quotas are the hard cap meanwhile |
| Retiring the legacy desktop planner and dead code | Product decision (list in the dead-code audit) |
| Production migration `0600` | Needs your approval |
| RSVP "update by email" | Someone knowing a guest's email can change that RSVP (by design today); product decision |
| `favicon.ico` format, OG image, landing as server component, 19 lint warnings | P2 |

## 16. Manual tests remaining

- iPhone Safari and Android Chrome (MANUAL DEVICE TEST REQUIRED): keyboard over inputs, date picker,
  safe areas / notch, bottom-sheet drag, back gesture, PWA install, update and offline.
- Real email clients (Gmail app, iOS Mail): rendering of the invitation and the RSVP emails.
- Google map with a real browser key: markers, clustering, pan and zoom on a phone.
- Dodo sandbox: checkout, success, failure, refund, cancellation with real test cards.
- Real sign-up confirmation and password-reset emails once SMTP and Site URL are configured.
- Multiple tabs / long-lived sessions.

## 17. External configuration remaining

1. **Domain:** buy or choose one. Verify it in **Resend** and set `EMAIL_FROM`. Configure
   **Supabase Auth → SMTP** (e.g. Resend SMTP) and set Site URL and redirect URLs (Preview URL now,
   production domain later).
2. **Google Cloud:**
   - Enable billing and **Places API (New)** (+ Maps JavaScript API).
   - Restrict the server key to Places API (New).
   - Create a **browser key** (Maps JavaScript only, HTTP referrers) and a **Map ID**.
   - Set **per-API daily quotas and a billing budget alert**.
3. **Dodo:** test-mode API key, webhook secret and 3 product ids. Configure the webhook with a Vercel
   protection-bypass URL for the Preview.
4. **Vercel:**
   - Untick Preview and Development on the 6 old shared variables.
   - Remove the team-level `magicalbirthdayplanner.com` domain record.
   - Prepare the Production environment with new values before any production deploy.
5. **Rotate** all historical leaked credentials and those pasted in chat: GitHub, Vercel, Resend,
   Supabase secret key and DB password, Google, Geoapify, and the Dodo live key.
6. **Approve** applying migration `0600` to production.
7. Confirm you still own the contact address `magicalbirthdayplanner@gmail.com` (privacy/terms pages).

## 18. Final launch checklist

**P0 — must fix before launch**
- [ ] Owned domain, verified in Resend, `EMAIL_FROM` set. Invitations must reach real guests.
- [ ] Supabase Auth: custom SMTP plus Site URL and redirect URLs. Sign-up confirmation and reset must
  work for real parents.
- [ ] Google: billing and Places API (New) enabled; browser key and Map ID; quotas and budget alert.
- [ ] Production Vercel environment rebuilt with new credentials; production deploy of this branch;
  production domain on HTTPS.
- [ ] Rotate every leaked or pasted credential (§17.5).
- [ ] If charging at launch: Dodo sandbox end-to-end test passed, then live keys with explicit approval.

**P1 — should fix before launch**
- [ ] Next.js 15.5.x / React 19 upgrade (security advisories).
- [ ] Apply migration `0600` to production.
- [ ] Error monitoring and alerting (log drain or Sentry; choose for cost).
- [ ] Decide the legacy desktop planner's fate. Retire it, or fix its broken (always-401) features.
- [ ] Remove the old shared Preview/Development variables.
- [ ] Legal review of privacy policy and terms for data about children (provided by parents) and email
  consent.

**P2 — can fix after launch**
- [ ] Script CSP with nonces; fleet-wide rate limiting.
- [ ] Dead-code and dependency cleanup (audit list).
- [ ] OG image, square favicon, landing page as server component.
- [ ] Remaining small targets on legacy pages; lint warnings.
- [ ] De-duplicate legacy OSM venues in the stored-venue fallback.

**MANUAL TEST REQUIRED:** §16. **BUSINESS DECISION REQUIRED:** legacy planner, paid-feature gating
(features currently aren't plan-gated server-side), monitoring vendor, RSVP-edit policy, whether to
charge at launch. **EXTERNAL CONFIGURATION REQUIRED:** §17.

## 19. Exact test results (final run, commit `bb098cb`)

| Suite | Result |
|---|---|
| ESLint | 0 errors, 19 warnings (legacy files) |
| TypeScript | PASS |
| Unit (Vitest) | **169 / 169** passed (16 files) |
| Integration (Vitest + local Supabase) | **119 / 119** passed (7 files) |
| Browser (Playwright, iPhone 390 + 4 viewports) | **22 / 22** passed |
| Production build | PASS (first-load JS 87.8 kB shared) |
| Client bundle secret scan | clean (118 files, 10 server secrets) |
| Deployed Preview bundle scan | 0 secrets; 0 old Supabase refs; 0 public source maps |
| Git history scan | 0 secrets at HEAD; 30 historical (rotation) |
| `npm audit` | 1 critical, 4 high, 3 moderate (all need major upgrades; §11) |
| Production schema fingerprint | 521/521 identical |
| Production RLS matrix | 81 checks, 0 leaks; entitlement self-grant 4/4 denied |
| Local journey (realistic data) | 17 steps PASS (2 test-script selector issues fixed and re-run PASS) |
| Real Preview UAT | 16 steps PASS; 3 real emails delivered |
| Mobile QA | 64 page×width combos, 0 horizontal overflow |
| Input security | 0 script executions / dialogs / injected elements |
| Discovery | 4 radii within radius, 0 duplicates; 8 bad-ZIP cases friendly; 4 provider-failure modes friendly |
| Outage / expired session / shared device | PASS (after fixes) |

## 20. Recommended launch sequence

1. Approve and apply migration `0600` to production. Upgrade Next.js on a branch (P1).
2. Domain → Resend verification → `EMAIL_FROM` → Supabase SMTP plus URL settings.
3. Google Cloud: billing, APIs, keys, Map ID, quotas, budget alert. Re-run the Preview UAT with real
   Google.
4. Dodo sandbox credentials → sandbox UAT. Live mode only after explicit approval.
5. Rotate every credential. Clean the old Vercel shared and production variables.
6. Real-device QA on iPhone and Android (§16).
7. Configure the Vercel Production environment and domain. Deploy `mobile-first` to production, with
   live charging off. Smoke-test.
8. Soft launch to a small group. Watch logs, Google spend and email bounces. Then enable payments.
