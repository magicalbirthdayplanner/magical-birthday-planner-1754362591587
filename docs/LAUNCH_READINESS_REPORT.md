# Launch readiness report: Magical Birthday Planner

_Overnight validation, 2026-10-03 (UTC). Production: `https://magicalbirthdayplanner.app`.
The previous review (2026-10-02, commit `bb098cb`) is in Git history._

## Launch status

**READY WITH USER ACTIONS**

Production works end to end in Dodo **test mode**, and every automated and production check
below passed. One security action should come first: production still runs **Next.js 14.2.35**.
The Next.js 15 upgrade is built and fully tested, but it couldn't be promoted overnight (see
"Remaining user actions" §1). Live payments stay off until you explicitly decide to enable them.

## Production (as of this report)

| Item | State |
|---|---|
| Production commit | `b261014` (`master`), deployment `dpl_dGVdw4pBmBH3cxyUoHifW5DNgF2y`, READY |
| Next.js in production | **14.2.35** (Next.js 15.5.27 + React 19.3.0 is ready on `mobile-first` `0495bcc`) |
| `mobile-first` | `d0dfd86` = Next 15 upgrade + PostCSS patch (not deployed); `master` can fast-forward to it |
| Domain | `magicalbirthdayplanner.app`, HTTPS; `http://`, `www.` and `magical-birthday-planner.vercel.app` 308 → apex |
| Supabase | project `fnrgybrhmjtokmotqotk`; migrations `0000`–`0700` applied; RLS on all 25 public tables |
| Google Places (New) | live: ZIP 48084 → 112/112 real Google venues, no fallback |
| Google Maps JS | live: real map with Map ID, markers, sheet, details, pan, zoom |
| Resend | domain verified; all mail from `noreply@magicalbirthdayplanner.app`; delivered |
| Dodo | **LIVE** since 2026-10-03: `DODO_PAYMENTS_ENVIRONMENT=live_mode`, `DODO_LIVE_PAYMENTS_ENABLED=true`, live products 4.99 / 9.99 / 14.99 USD |
| Vercel | production branch `master`; Vercel Authentication on previews unchanged; no bypass secrets |
| Monitoring | Sentry (errors, tracing, logs, metrics, AI, uptime, alerts) — see docs/OBSERVABILITY.md |

## Completed overnight

| # | Task | Result |
|---|---|---|
| 1 | Next.js 15 promotion | **STOPPED (not promoted).** See §1 of "Remaining user actions". Production unchanged. |
| 2 | PostCSS security patch | `postcss` 8.4.47 → 8.5.28, commit `d0dfd86` on `mobile-first`. Compiled CSS byte-identical; full suite green. Not deployed, because it sits on top of Next 15. |
| 3 | Dependency audit | Done (see Security). Nothing else patchable without a major upgrade. |
| 4 | Production security audit | PASS: client bundle, API, webhook and billing checks (details below). |
| 5 | Super-admin validation | PASS, 40/40 checks on production. |
| 6 | Dodo test-mode validation | PASS: products, prices, purchases, decline, cancel, processing, refund, duplicate/replay/invalid signature. |
| 7 | Google validation | PASS: Places and Maps on production; server key never in the browser. |
| 8 | Auth + Resend validation | PASS, 14/14: sign-up/confirm, reset (old password rejected), sender and URL checks. |
| 9 | Production DB safety | PASS (read-only); tonight's temporary data removed; production matches the pre-test baseline (see Known limitations for one anonymous analytics row). |
| 10 | Real-device readiness | Browser coverage at 375/390/393/430 done; physical devices **pending you**. |
| 11 | PWA / mobile audit | PASS: manifest, icons (incl. maskable), service worker, offline page, viewport. No fixes needed. |
| 12 | SEO / public site | PASS with polish items (below). |
| 13 | Error / observability | Friendly errors covered by tests; monitoring not configured. |
| 14 | Fresh-user production journey | PASS (single temporary account), plus a one-account Free→Starter→Plus→Pro→refund→Free ladder. |
| 15 | Final secret scan | PASS: no secrets in the tree, tonight's commits, client or server bundles. |
| 16 | Git hygiene | Clean tree; no force pushes; `master` ⊂ `mobile-first`. |
| 17 | Final production smoke | Covered by the runs above, all against the current production deployment (nothing was deployed overnight). |

### Test evidence (production unless stated)

* **Local gate on `mobile-first` (Next 15 + PostCSS):** lint ✔, typecheck ✔, unit 168/168, integration 128/128,
  Playwright E2E 25/25 (production build; includes 375/390/393/430 viewports), build ✔, client-secret check ✔.
* **Next 15 extra checks (local production build):** 19 screens × 4 widths with no console errors, hydration
  errors, overflow or failed requests; all 44 routes keep their static/dynamic mode; real Google Places,
  Resend and Dodo test checkout work.
* **Fresh-user journey (`b261014`):** landing → sign-up (confirmation required) → sign-in → wizard (ZIP 48084)
  → 112 Google venues → real map → marker → sheet → venue → save → add to party → guest → invitation email →
  RSVP → confirmation + host emails delivered → checklist → budget ($650) → sign out → sign in → all data
  persists. 36 page×width combinations, no horizontal scroll.
* **Auth:** confirmation and reset emails delivered from `noreply@magicalbirthdayplanner.app`; links go to
  `https://magicalbirthdayplanner.app/auth/callback` and `/reset-password`; no localhost, old-domain or
  vercel.app URLs. Google sign-in reaches Google's account screen with the correct Supabase callback.
* **Dodo sandbox (real test checkouts, test card):** Starter $4.99, Plus $9.99, Pro $14.99 → webhook → plan
  active, persists after re-login. Declined card → `failed`, stays Free. Signed `payment.processing` →
  pending, no access. Dodo test refund → `refund.succeeded` → access revoked. One account Starter → Plus →
  Pro, then refunds step it Pro → Plus → Starter → Free.

## Security

### Vulnerabilities fixed (on `mobile-first`; reaches production when Next 15 is promoted)
* **Next.js 14 → 15.5.27:** 23 advisories (2 critical, 8 high), including RSC/App Router DoS, cache
  poisoning, SSRF and Server Action issues.
* **postcss 8.4.47 → 8.5.28:** GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849.

### Production exposure until Next 15 is promoted
Next.js 14.2.35 advisories. The two criticals don't apply here: the image optimizer isn't served
(`/_next/image` → 404 on production) and Windows hosting isn't used. **The App Router DoS /
cache-poisoning advisories do apply.** Promoting Next 15 removes them.

### Remaining after the overnight changes (`npm audit` on `mobile-first`)
| Category | Finding | Notes |
|---|---|---|
| A. Must fix before soft launch | Next 14 in production | Promote `mobile-first` (user action §1). |
| C. Build-time only | `postcss@8.4.31` bundled inside Next 15 (high) | Processes only the app's own CSS; fixed only in Next 16. |
| C. Build-time only | `braces` ≤3.0.3 (high, GHSA-vfj7-8cjw-p6xm), via micromatch / fast-glob / chokidar / tailwindcss / eslint-config-next | New advisory; **no patched release exists**. Used only for build/lint globbing of repo paths. |
| B. Development-only | `vitest` / `@vitest/mocker` / `@vitest/coverage-v8` (moderate) | Test runner only. |
| D. Requires a major upgrade | Next 16 (bundled postcss), Vitest 5 | Not done overnight by design. |

### Secret scan
Clean across the working tree, tonight's commits, local client and server bundles, and the
**production** client bundle (28 assets including lazy chunks). Only the public, referrer-restricted
Maps browser key is in the client; no source maps are served. The Git **history** of the original
repository still contains 30 old secret values (none at HEAD); rotation is your action.

### Auth / billing / admin validation (production)
* Webhooks: forged, missing, wrong-key, stale (replayed, 1 h old), tampered and malformed signatures are
  rejected and change nothing. Duplicate delivery ×3 → processed once; the same payment under a new
  webhook id doesn't create a second purchase.
* Checkout: unauthenticated → 401; client-supplied plan, product ID, price or user ID → 400.
* Clients can't update their plan or trial (`42501`), insert purchases or webhook events, call
  `recompute_entitlement`, or read others' purchases. A forged success URL plus localStorage flags grants
  nothing.
* Super admin (only `arunpx2015@email.iimcal.ac.in` holds the role): a temporary admin switched
  Free/Starter/Plus/Pro with persistence across refresh and re-login. Normal users, anonymous users and
  garbage tokens get 404 from all admin APIs and `/admin`; direct DB writes to roles, overrides and the
  audit log are rejected; the admin list is unreadable. A signed-out admin session can't call admin APIs.

## Remaining user actions

1. **Promote Next.js 15 (highest priority).** The Preview couldn't validate the real Google map:
   * the Preview environment has **no** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` / Map ID (production only), so it
     always shows the simplified map, and the browser key's referrer list doesn't include localhost;
   * the Preview is Vercel-auth protected; creating a temporary bypass secret was declined by the
     session's permission policy, so it wasn't attempted another way.

   Everything else in Next 15 passed. Choose one:
   * **(a)** fast-forward `master` to `mobile-first` (`git merge --ff-only`), let Vercel deploy, and verify
     the map on production. Rollback = promote deployment `dpl_dGVdw4pBmBH3cxyUoHifW5DNgF2y`.
   * **(b)** add the Maps key and Map ID to the `mobile-first` Preview environment (and the preview domain
     to the key's referrers), then check the Preview signed in to Vercel.
2. **Real iPhone Safari test: PENDING USER.**
3. **Real Android Chrome test: PENDING USER.**
4. **Google sign-in round trip:** sign in once with a real Google account (the start of the flow is verified).
5. **Credential rotation:** rotate or revoke the 30 historical values in Git history (the old Supabase
   project, Google, Azure OpenAI, Resend, Apify, Dodo). Nothing was rotated overnight.
6. **Live Dodo:** a separate, explicit decision. Nothing live was configured or used.
7. **Google Cloud:** confirm in the console that the browser key's referrers are exactly the production
   domains you want (observed: production works, localhost is rejected). Set quotas and a budget alert.
8. **Monitoring:** production monitoring is **NOT CONFIGURED**. Recommended next action: Vercel
   Observability/log drains or a free-tier error tracker (e.g. Sentry) for client and server errors.

## Known limitations

* Production still runs Next 14 (see above). The Next 15 + PostCSS commits are not live.
* No plan-gated features exist yet. Plans change billing state and display only (product decision).
* SEO polish: no `<link rel="canonical">` or `og:image`; `/pricing`, `/privacy` and `/terms` reuse the
  homepage title.
* Rate limits are in-memory per serverless instance; Google quotas are the fleet-wide cap.
* Two leftover records not created by the overnight run were left in place: one unmatched sandbox
  `payment.succeeded` webhook record (2026-10-02 sandbox validation) and one anonymous `app_open` analytics
  event (2026-10-03 02:07 UTC) that couldn't be attributed to a tracked test browser.
* Self-hosted only: with `next start`, the auth callback builds redirects from the server's bind host
  (`localhost`). Next 14 behaves identically; Vercel isn't affected.
