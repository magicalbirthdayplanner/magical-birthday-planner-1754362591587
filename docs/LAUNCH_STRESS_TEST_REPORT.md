> **Point-in-time report (2026-10-03).** Fixed since: P0-1 (trial users can buy — `f3027f0`), P1-1/P1-2
> (AI usage hardening — `1f96a8b`), P1-4 (RSVP duplicates — `f3027f0`, `b2ddf67`), the invisible Starter button
> (`f3027f0`). Current status: [LAUNCH_STATUS.md](LAUNCH_STATUS.md).

# Magical Birthday Planner

## Pre-Launch Stress Test & UAT Report

**Date:** 2026-10-03, about 20:55–22:10 UTC
**Auditor:** Claude, in the roles of release QA, SRE, security and UAT
**Scope:** live production at https://magicalbirthdayplanner.app, plus the repository at `1d4e90a`
**Method:**
- Read-only static audit: two parallel reviews, one for security/RLS and one for product/AI/data.
- The full automated suite.
- Scripted mobile UAT against **production**, using Playwright with an iPhone 13 profile and 375/390/393/430 px viewports.
- API and RLS probing with a real end-user token.
- Low-volume stress testing.
- A read-only review of the Vercel, Sentry, Dodo, Resend and DNS configuration.

**What I did not change:** no code, config, schema, environment variables, Dodo, Google, Supabase, Sentry or DNS settings, and no deploys. Exactly one file was added: this report.
**Test data:** two temporary production accounts (`delivered+mbpqa…@resend.dev`). Both were created and **deleted**, along with all their data (verified afterwards: `parties=0`, `guests=0`, `ai_generations=0`). The owner's account and data were not touched.
**AI spend:** 9 real model calls, about $0.06 at peak prices.

---

### 1. Executive Summary

The core product works and holds up well under realistic use. A parent can:
- sign up and confirm their email,
- answer the nine-question wizard,
- see 124 real Google venues near Troy, MI within about 4 s,
- open venue details with photos, hours, phone and website,
- save a venue and add it to the party,
- add guests, email invitations (delivered), collect RSVPs with host notifications (delivered),
- use the checklist,
- get a good AI party plan in 21–33 s and apply it,
- sign out, sign back in, and find everything still there.

Several other areas also passed:
- Security fundamentals are solid. A normal user could not escalate their plan, role, trial, billing state or AI accounting through the public REST API (every attempt returned 403). Admin APIs return 404 to normal users. Webhook forgery, stale and replayed webhooks all get 401. Prompt injection was resisted.
- Mobile layout is clean at 375–430 px on all 11 app screens. There is no page-level horizontal scroll except one More-screen row with a long email.
- Performance is good: TTFB under 120 ms, discovery search about 1.5–2.5 s, venue details about 1 s, health about 80 ms.

**But the build is not ready to take money from strangers tomorrow:**

1. **A new user cannot buy anything for their first 24 hours.** Every signup automatically gets a 24-hour "Pro (trial)". The pricing page then hides every plan, because nothing ranks above Pro. All "Included with Starter" upsells therefore lead to a page with **no buy button**. On launch day, essentially every visitor is a new signup. *(Verified on production.)*
2. **The marketing copy makes claims that aren't true while live payments are on:**
   - "Trusted by 10,000+ parents ★★★★★" and "Join thousands of parents".
   - Paid features that don't exist or are switched off (Task reminders, Pro food suggestions and budget insights, Starter invitation creator).
   - "7-day risk-free trial… full refund" on the pricing page, against "All fees are non-refundable" in the Terms.
   - A Terms page that still reads "governed by the laws of **[Your Jurisdiction]**".
3. **The live payment path has never been exercised.** Dodo shows 0 live payments. I confirmed that a live checkout session opens at $4.99, but I could not confirm that the production webhook secret matches the live endpoint until a real payment arrives.
4. **One logged-in user can switch AI off for everyone.** The daily global AI limit is 50. Any signed-in user can raise that counter directly through the `ai_reserve` RPC (verified). Deleting a party or account erases its usage history, which resets every AI cap (verified twice).

Beyond those, the main problems that would embarrass the app in front of real parents are:
- RSVPs create **duplicate guests**. A family appeared as both "Going" and "Can't go", and the host got two contradictory emails.
- The invitation email links to **/help, which is a 404**.
- Google sign-in shows **"continue to <project-ref>.supabase.co"**.
- A party entered before signup is **not saved** after email confirmation: the parent has to tap through all nine wizard questions again.
- Shared links show **no preview image**.
- The Starter "Choose Plan" button on /pricing is **invisible** (white text on white).

### 2. Current Production Version

| Item | Value |
|---|---|
| Working tree | `feat/observability-sentry`, **clean** before testing; only this report was added |
| HEAD / master / mobile-first | `1d4e90a` / `1d4e90a` / `1d4e90a` |
| Vercel production deployment | `dpl_FpQvAmZ1BnLVxUuuZTBGtvFqP4XB` (READY, commit 1d4e90a) |
| Production URL | https://magicalbirthdayplanner.app (www, http and *.vercel.app redirect to the apex with 308 or 404; Let's Encrypt certificate valid until Dec 31) |
| Next.js / React / Sentry SDK | 15.5.27 / 19.3.0 / @sentry/nextjs 11.4.0 |
| Node / npm (local) | 22.23.2 / 10.9.8 |
| Database migrations | 0000–1000 in the repository. The production REST API confirms the tables exist. The legacy tables `profiles`, `subscriptions`, `invoices` and `user_purchases` do **not** exist in production, which is good. |
| AI | `AI_ENABLED=true`. Provider opencode, model deepseek-v4-pro, thinking off, timeout 45 s (long features 55 s by default), 1 retry, max 3000 output tokens, `AI_GLOBAL_DAILY_LIMIT=50`, `AI_USER_DAILY_LIMIT=10` |
| AI features live | **Six**, not three: `party_planner, theme_ideas, checklist, activity_studio, host_content, party_experience` |
| Feature flags | `NEXT_PUBLIC_EXPERIENCE_ENABLED=true` |
| Dodo | **LIVE**: `DODO_PAYMENTS_ENVIRONMENT=live_mode`, `DODO_LIVE_PAYMENTS_ENABLED=true`. Live products are $4.99, $9.99 and $14.99 USD, with purchasing-power pricing on and tax not included. The live webhook endpoint is enabled with 48 event types. **0 live payments.** |
| Sentry | Live. 11 metric monitors plus uptime on `/api/health`, all connected to the email alert. During testing: 0 issues and no PII in logs. |
| Production data | 1 user (the owner), 0 parties, 0 purchases, 1 old pending sandbox checkout belonging to the owner |

### 3. Overall Launch Score: **57 / 100**

| Area (0–10) | Score | Why |
|---|---|---|
| Reliability | 7 | No 5xx responses and no Sentry issues during about 3 hours of traffic. The core journey works. AI succeeded 9 out of 9 times. |
| Security | 6 | RLS and escalation protection are strong. Weak spots: AI capacity denial of service via `ai_reserve` and cap reset on deletion, email relay abuse, client-writable `users.email`, rate limits held only in memory. |
| Integrations | 7 | Supabase, Places, Maps, Resend, Sentry and DNS all work. Google OAuth shows the raw Supabase domain. The live Dodo flow is unproven. |
| AI | 6 | Output quality is good, injection is resisted, and limits are enforced. But the global cap of 50 is fragile and can be abused. Six features are live, not three. The summary can contradict the budget numbers. One plan suggested dry ice for children. |
| Billing | 3 | Trial users can't buy. Prices match Dodo. Feature, refund and terms copy is untrue or contradictory. A plan is account-wide although the copy says "per party". |
| UX | 5 | The flow is strong once signed up. The wizard has to be repeated after confirmation. Pricing has an invisible CTA, and there are progress and upsell contradictions. |
| Mobile | 8 | Clean at 375–430 px, with 44 px targets nearly everywhere. Minor issues on More and Discover. |
| Performance | 8 | Fast pages and APIs. AI takes 21–33 s, which is disclosed in the UI. |
| Observability | 7 | Good coverage and privacy. Some telemetry is lost on serverless, and a few alerts are missing (see §17). |
| Data integrity | 5 | RSVP duplicates. Plan, activity, checklist and budget don't stay in sync. Apply actions are well deduplicated. |
| SEO / public | 4 | No og:image, the same title on every page, a placeholder in the Terms, an invisible pricing CTA. |
| Conversion readiness | 2 | There is no way to buy during the first 24 hours, the social proof is fake, and paid tiers are poorly differentiated. |

**Average: 5.7, so 57/100.** I did not round up. The fundamentals are better than this number suggests; billing and conversion pull it down.

### 4. GO / NO-GO Recommendation

## 🔴 NO-GO for the current build → 🟡 GO WITH CONDITIONS once the P0 list is done

All four P0 items are small: roughly 3–5 hours of work plus one real $4.99 purchase and refund. Fix them, redeploy and re-test the purchase, and the soft launch becomes reasonable. Launching without them means losing launch-day revenue and risking the app's credibility in community posts (fake "10,000 parents"). It also opens the door to refund disputes over features that don't exist.

---

### 5. P0 — Launch Blockers

| # | Issue | Evidence | Fix |
|---|---|---|---|
| **P0-1** | **New users can't purchase for 24 hours.** `handle_new_user` gives `current_plan='PRO'` as a 24-hour trial. `usePlanStatus` and `/pricing` hide every tier that the user "can't upgrade to", so a trial user sees **zero plan cards**. `?upgrade=starter` shows "You're currently on the Pro plan" with no button. Meanwhile AI treats trial users as FREE and keeps sending them to "Included with Starter" upsells. More shows "Pro (trial)" next to "included with Starter". | Production: new account → `/api/billing/status` = `{"plan":"PRO","source":"trial"}` → /pricing had 0 "Choose" buttons (screenshot `u13_pricing_trial`). AI returned `403 forbidden_plan upgradeTo:STARTER` and `429 limit_reached upgradeTo:STARTER`. | In `usePlanStatus` and on the pricing page, treat `source==='trial'` as FREE, so all tiers are buyable. Or drop the PRO trial entirely. Then re-test /pricing as a brand-new user. |
| **P0-2** | **False or unverifiable claims on public pages** while live payments are on: "Trusted by 10,000+ parents ★★★★★" and "Join thousands of parents" (`app/(site)/page.tsx:538,552`); "Join thousands of happy families" (`pricing/page.tsx:363`). | Live homepage and pricing page. | Remove them, or replace with honest copy ("Made by a busy parent"). |
| **P0-3** | **Billing terms and feature claims contradict the product.** The pricing FAQ promises a "7-day risk-free trial… full refund"; Terms §4 says "All fees are non-refundable". Terms §12 reads "laws of **[Your Jurisdiction]**". The FAQ promises "We'll credit your original purchase toward the upgrade cost", which isn't implemented. Sold features don't exist or are off: Task reminders (no sender), Pro "Personalized food suggestions" and "Smart budget tracker with cost insights" (`food` and `budget_optimizer` are off), Starter "Simple invitation creator" (`invitation` AI is off; the manual invitation is free for everyone). RSVP tracking and vendor search, sold as paid features, are available to Free users. | Live /pricing, /terms, homepage. | Decide the refund policy and write it the same way in both places. Fill in the jurisdiction. Rewrite each tier's bullets to match what `capabilities.ts` actually gates (party planner / theme / checklist / host / activities / experience and the per-party caps). Remove the upgrade-credit claim. |
| **P0-4** | **The live payment path is unproven.** Dodo has 0 live payments. The production `DODO_PAYMENTS_WEBHOOK_SECRET` is "Sensitive", so I couldn't compare it with the live endpoint's secret. If they don't match, every paid customer stays on Free and gets a "WEBHOOK_INVALID_SIGNATURE" (an alert-less warning). | A live checkout session was created and opened at "MBP – Starter Plan $4.99" on checkout.dodopayments.com. No payment was made. | **Requires your action:** buy Starter for $4.99 with a real card. Confirm that the plan activates within about 1 minute (More → "Starter"), that `billing_purchases` has an `active` row, and that Sentry shows `PAYMENT_SUCCEEDED`. Then refund it in Dodo and confirm the plan reverts. |

### 6. P1 — Fix Before Launch (or within the first days)

| # | Issue | Evidence | Fix |
|---|---|---|---|
| P1-1 | **One user can turn AI off for everyone.** `ai_reserve` can be executed by `authenticated`. Each direct REST call inserts a `pending` row, and these count toward `ai_global_count_today` (limit 50/day). About 50 calls from devtools give every user "very busy" until UTC midnight. | Production: `POST /rest/v1/rpc/ai_reserve` → 200 and a new id; the global count went from 3 to 4. | Make `ai_reserve` service-role only, the same way as `ai_finalize`, and call it from the handler after the ownership check. |
| P1-2 | **Deleting a party or account resets every AI cap and the global breaker.** `ai_generations.party_id` uses `ON DELETE CASCADE`. | Production: deleting test account 1 dropped the global count from 4 to 0. Deleting a party in the UI dropped account 2's count from 4 to 2. | Keep a usage ledger that survives deletion (`ON DELETE SET NULL`, or a separate `ai_usage` table keyed by user and time). |
| P1-3 | **The global limit of 50/day is too small for six live features.** It also counts failures. Five enthusiastic users at 10/day each use it up. | Production env. | Size it from the provider budget, and decide whether `activity_studio`, `host_content` and `party_experience` should be live (you believe only three are). Add a Sentry alert on `AI_REQUEST_LIMIT_REACHED limit=global`. |
| P1-4 | **RSVPs create duplicate guests.** "Change my RSVP" without an email inserts a new row each time. An RSVP with the email of a guest the host added inserts a duplicate, and the host's row stays "Waiting" forever. | Production: Nguyen family appeared twice (CONFIRMED and DECLINED). Patel family: the host row stayed PENDING and the rsvp_link row was CONFIRMED. The host received "is coming" **and** "can't make it" emails. | Return a per-guest edit token (stored in localStorage) or require an email to change an RSVP. Match on `lower(email)` across all sources. Send per-guest tokens in emailed invitations. |
| P1-5 | **The invitation email links to a 404.** "If you have any issues… visit our help center" points to `https://magicalbirthdayplanner.app/help`, which returns 404. | The delivered invitation HTML (Resend), and `lib/email-templates/invitation.ts:289`. | Point it at the mailto contact address or remove the line. The template also doesn't match the brand (red-to-blue gradient). |
| P1-6 | **Google sign-in shows "continue to <project-ref>.supabase.co".** To a parent this looks like phishing. | Production screenshot `au_10`. | Use a Supabase custom auth domain (e.g. `auth.magicalbirthdayplanner.app`), or brand the Google OAuth consent screen. **Also check** in Google Cloud that the OAuth app's publishing status is **"In production"** and not "Testing". In Testing mode only listed test users can sign in. I could not verify this. |
| P1-7 | **The party entered before signup is lost after email confirmation.** Signup requires confirmation. After clicking the link, the parent lands on "Let's plan your first party" with 0 parties. The draft is in localStorage but the wizard restarts at question 1 and needs 9 taps. If the link opens in a different browser (for example Gmail's in-app browser), the draft is gone completely. | Production: confirmed through a real confirmation link; `parties=0`; screenshots `u3_*`, `u4_*`. | After confirmation, create the party from `mbp.partyDraft` automatically, or resume the wizard at the summary step. Consider saving the draft server-side before confirmation, keyed by email. |
| P1-8 | **Invisible pricing CTAs.** The Starter card's "Choose Plan" button is white text with no background (`ctaVariant: 'outline'` resolves to an empty class). The "Compare Plans" button in the final CTA is white on white. The FAQ answers "How does the per-party pricing work?" with "Yes!". | Production DOM: `color rgb(255,255,255) bg transparent`; screenshots `pricing_0` and `pricing_4`. | Give the Starter button a visible style, fix the outline button on the gradient, and rewrite the FAQ answer. |
| P1-9 | **No social preview image, and every page has the same title.** `og:image` and `twitter:image` are missing (`twitter:card=summary`). /pricing, /privacy, /terms and the 404 page all use the homepage title. There is no canonical or `og:url`. | Production `<head>`. | Add `app/opengraph-image.png` (1200×630, party-hat brand) and per-page `metadata.title`. This matters most for Facebook, WhatsApp and Reddit shares tomorrow. |
| P1-10 | **The privacy policy doesn't match how data is processed.** It mentions only "AI theme recommendations" and names no processors (OpenCode/DeepSeek, Google, Dodo, Resend, Sentry, Vercel, Supabase). `host_content` sends the child's first name, the venue street address and confirmed guests' first names to the model. The policy promises "Delete your account", but there is no in-app account deletion. "Last updated" always shows today's date. | `app/(site)/privacy/page.tsx`; `lib/ai/features/hostContent.ts`. | List the processors and the AI processing. Drop `venueAddress` from `host_content`. Add a "Delete my account" request path (even a mailto). Use a fixed "Last updated" date. |
| P1-11 | **A plan is account-wide and permanent, but the copy says "per party".** One $4.99 Starter purchase unlocks the tier, plus a fresh per-party AI allowance, for every current and future party. | `lib/billing/server.ts` and `recompute_entitlement`. | Either attach purchases to a party, or change the copy to "one-time, unlocks your account". This is a business decision. |
| P1-12 | **The app can be used to send spam.** Anonymous RSVPs send a confirmation email to any typed address, with an attacker-chosen name. Hosts can email up to 300 arbitrary addresses a day with a 1,000-character custom message. Accounts are free, and RSVP and IP limits live in instance memory. | Static analysis (F-03). The send path was verified (email delivered). | Add a global daily email cap and a per-account cap across all parties. Require a confirmed email before bulk invites. Use a durable limiter. Strip URLs from free text in emails. |

### 7. P2 — Safe After Launch (fix within weeks)

| # | Issue | Evidence |
|---|---|---|
| P2-1 | `users.email` can be written by the client. A user can set another person's address and block that person's later signup (unique conflict), or spoof the email admins see. | Production: a PATCH changed it to `qa-squat-test@example.invalid` (I reverted it). |
| P2-2 | All rate limits and the Google budget live in instance memory, so they don't hold on Vercel. 12 parallel RSVPs with invalid tokens got no 429. | `lib/server/rate-limit.ts`; production probe. |
| P2-3 | Plan My Party breaks permanently for a party with a budget over $100,000. The edit sheet accepts it, the AI schema rejects it, and the user sees "Something in that request didn't look right". | Production: budget 150000 → 400 invalid_input. |
| P2-4 | The AI summary can contradict the server's budget figures. With $40 for 30 guests: "stay within $40" but total $82 (over by $42). Another said "stays under budget" while over by $38. | Production generations. |
| P2-5 | AI safety: the 12-year-old plan suggested a "Dry Ice Bubble Experiment". | Production generation C. Add a hazard denylist to the safety rules. |
| P2-6 | Progress and next step don't stay in sync. With 5 activities planned, Home and Plan still say "NEXT STEP Book entertainment or an activity". The checklist "Make the guest list" stayed due after guests were added. | Production screens. |
| P2-7 | Budget figures differ across screens: AI plan $538, Plan tab "$225 planned of $500", Activities "about $98–132". Activity costs never reach the budget unless added one at a time. There is no manual way to add budget or shopping lines. | Production plus static analysis (P-23, P-24). |
| P2-8 | Guests: no duplicate check (I added "The Patel family" twice), and Remove has no confirmation (one tap deletes). | Production. |
| P2-9 | Sentry telemetry is lost on serverless. Logs showed 3 `AI_REQUEST_STARTED` against 2 `SUCCEEDED`, 2 of 3 gen_ai spans, and `GOOGLE_PLACES_REQUEST` 42 against `SUCCESS` 39 with 0 failures. Buffered logs and metrics aren't flushed before Vercel freezes the function. | Sentry query. Fix: `Sentry.flush()` or `waitUntil` at the end of AI, billing and webhook handlers. |
| P2-10 | The More screen scrolls horizontally with long emails (scrollWidth 392 at 375 and 390 px). The "Email me when guests RSVP" toggle gets pushed off-screen. | Screenshot `r375_more`. |
| P2-11 | The confirmation screen ("We sent a confirmation link to …") cuts off long email addresses. | Screenshot `u2_12`. |
| P2-12 | `/checkout-success` with an unknown or never-confirmed reference shows "Confirming your payment… usually within a minute" forever, even after 70 s. | Production. Add a timeout message with a support link. |
| P2-13 | There is no DMARC record (`_dmarc.magicalbirthdayplanner.app`). SPF and DKIM exist for the `send.` subdomain. This is a deliverability risk with Gmail and Yahoo. | DNS. |
| P2-14 | "Add all" for the budget overwrites the amount on an existing line with the same label. Some host and timeline applies have no unique key, and the Host save button has no busy guard. | Static analysis (P-14, P-15). |
| P2-15 | Changing the party date doesn't re-date checklist tasks. Once the date has passed, no field of the party can be saved. | Static analysis (P-17, P-18). |
| P2-16 | Billing gaps: the price check runs only for USD; `dispute.*` / chargebacks are ignored, so the plan stays active; subscription refunds aren't matched. | Static analysis (F-09). |
| P2-17 | Admin override ignores errors from recompute and the audit insert. | Static analysis (F-10). |
| P2-18 | The legacy `/api/themes/ai` (Azure) route has no flag, plan gate or accounting. In production it returns 503 `not_configured`, so it's dormant. Retire it. | Production: 503. |
| P2-19 | Credentials from earlier work are still in git history (`.env` in `de23291`, `.env.local` in `7d275ab`). Several keys were also pasted into chat. Rotate them. | Static analysis (F-12). |
| P2-20 | `npm audit`: 8 vulnerabilities (7 high). Most are Next's bundled `postcss` and `braces` via tailwind's build-time chokidar, so runtime exposure is low. | `npm audit --omit=dev`. |
| P2-21 | The Places venue cache can be read anonymously (`GET /rest/v1/venues` with the anon key → 200). Check this against Google Places caching terms. | Production probe. |
| P2-22 | Guest names, `notes` and the venue address are visible to anyone with the invite link. This is by design, but there is no warning to hosts not to type a home address. | Production guest view. |
| P2-23 | On devices without WebGL the map area stays blank (vector map), with no fallback message. This is rare on real phones. | Headless test without GL showed a blank map; with GL, 57 markers rendered. |

### 8. P3 — Future Improvements

- Theme recommendations show "Loves art" on every card, including Minecraft and Music & Dance.
- The homepage hero uses an old PartyPopper icon instead of the party-hat brand.
- "Try Demo" and "Explore All Themes" both go to /start; there is no demo.
- The homepage feature "Timeline & Reminders – automated reminders" describes something that doesn't exist (see P0-3).
- The footer "Contact" link sits partly under the bottom navigation.
- In the AI theme-ideas cards, the title and description are squeezed into a narrow column beside the button.
- The /pricing comparison table scrolls horizontally at 390 px with no visual hint.
- /home and /discover have no `<h1>`.
- After sign-out, three in-flight requests return 401 (including a checklist upsert after sign-out). This is noise, not data loss.
- "Last updated" on Privacy and Terms always shows today's date.
- The system prompt says "children aged 0 to 12" while the app allows ages 1–14.
- `ai_global_count_today` reveals platform-wide AI usage to any user.
- The `robots.txt` doesn't list `/activities` or `/admin`.
- The `/admin` route returns 200 with a client-side "not found", and the admin bundle ships to everyone.
- Venue details are fetched twice per page view.
- The contact address is a gmail.com mailbox.

---

### 9. Complete Integration Matrix

| Integration | Configuration | Auth / secret placement | Happy path | Failure path | Persistence | Prod status |
|---|---|---|---|---|---|---|
| **Supabase** (DB, Auth, RLS) | Project `<project-ref>`. Anon key public; service-role key in Vercel as Sensitive. | Server-side ✔ | ✔ CRUD, RLS, RPCs | ✔ Resilience E2E covers "DB unreachable → retryable error". The 401 race on sign-out is harmless. | ✔ | **PASS.** No fallback (single dependency). Launch-blocking if down. |
| **Supabase Auth email** | Confirm email ON; SMTP sends through Resend from `noreply@magicalbirthdayplanner.app` | Server-side ✔ | ✔ Confirmation and reset emails delivered | ✔ Wrong password and unknown email show the same friendly message | ✔ | **PASS** |
| **Google Places (New)** | Server key (Sensitive) | Server-side ✔. The key never appears in client code, Sentry or URLs. | ✔ 124 venues for 48084 in about 4 s; 16 in Ketchikan, AK | ✔ Invalid ZIP → 422 with a friendly message. A stale or degraded fallback exists (E2E). Unknown place → 404. | ✔ Cache (8/8 cache hits on repeat) | **PASS.** Hard ceiling only via the GCP quota (P2-2). |
| **Google Maps JS** | Browser key and Map ID (public by design; must be referrer-restricted) | Public key ✔ (confirm referrer restriction in GCP) | ✔ Clusters, rating markers, sheet | ⚠ Sentry captures load failures; a no-WebGL device shows a blank area | n/a | **PASS** |
| **Google OAuth** | Via Supabase | Server-side ✔ | ⚠ Redirects to Google, but the screen says "continue to …supabase.co" | ✔ Callback errors → "Sign-in didn't complete" | ✔ | **REQUIRES USER ACTION** (P1-6; check the publishing status) |
| **Resend** | Domain verified, DKIM and SPF on `send.` | Server-side ✔ | ✔ Invitations, RSVP confirmations, host notices, auth emails: all "delivered" | ⚠ Errors are caught; daily caps exist | ✔ `email_logs` | **PASS.** DMARC missing (P2-13). Relay abuse risk (P1-12). |
| **Dodo Payments** | LIVE mode; 3 live products at the correct prices; webhook endpoint enabled | Server-side ✔ (live key and webhook secret are Sensitive) | ⚠ Checkout session created (live, $4.99). **Payment, webhook and activation never exercised.** | ✔ Forged, stale or missing signature → 401. Bogus plan or extra fields → 400. No auth → 401. | ✔ Purchases and webhook-event ledger | **REQUIRES USER ACTION** (P0-4) |
| **OpenCode / DeepSeek V4 Pro** | Key in Vercel (Sensitive) | Server-side ✔ | ✔ 9 of 9 succeeded; latency 21–33 s | ✔ Friendly errors for timeout, 5xx and limits; 1 retry on invalid JSON | ✔ `ai_generations` | **PASS** but fragile (P1-1 to P1-3) |
| **Sentry** | DSN public; auth token build-only | ✔ | ✔ Logs, spans, gen_ai spans, uptime | ✔ App works with Sentry unreachable (E2E) | n/a | **PASS** with some telemetry loss (P2-9) |
| **Vercel** | Production `1d4e90a`; environment variables scoped correctly | ✔ | ✔ | Rollback available (`613fcf0`) | n/a | **PASS** |
| **DNS / domain** | Apex A records; www and http 308 to apex; HSTS 2 years | ✔ | ✔ | n/a | n/a | **PASS** |
| **Analytics** (first-party `/api/analytics`) | Anonymous POST | ✔ No secrets | ✔ | ⚠ Accepts junk events with a 200 (filtered by an allowlist) and has no size limit | ✔ | **PASS** (P3) |
| **Webhooks** (Dodo to app) | `/api/webhooks/dodo` | HMAC with a timing-safe compare, ±300 s tolerance, dedupe by event id | Not exercised live | ✔ 401 on every forgery I tried | ✔ | **REQUIRES USER ACTION** (P0-4) |

**Could this integration block launch?** Supabase: yes, if it's down (no fallback). Dodo: yes, until a real payment has been verified. Google OAuth: yes, if the app is still in "Testing" mode. AI: partly; it can be switched off for everyone (P1-1). Everything else degrades gracefully.

### 10. Authentication & Security Results

**Authentication**

| Check | Result |
|---|---|
| Signup → confirmation email (Resend) → confirmation link → signed in on /home | **PASS** |
| Party draft kept after confirmation | **FAIL** (P1-7) |
| Wrong password and unknown email give the same message, with no account enumeration | **PASS** |
| Sign-out clears local storage (only `mbp.aid` remains) and protected routes go to `/login?next=` | **PASS** |
| Sign back in → parties, guests, activities, saved venues and theme all persist | **PASS** |
| Forgot password: neutral message and email delivered | **PASS** (the reset-link landing wasn't completed) |
| Open redirect via `/auth/callback?next=//evil.example.com` → `/home` | **PASS** |
| Callback `error_code=otp_expired` → friendly message | **PASS** |

**API probes**

| Check | Result |
|---|---|
| AI with no auth → 401 | **PASS** |
| AI with another party's or a random party id → 404 | **PASS** |
| Malformed JSON, 40 KB body, unexpected fields → 400 | **PASS** |
| Admin APIs (`session`, `stats`, `users`, `audit`, `override`) as a normal user → 404 | **PASS** |
| Webhook forged, stale or without headers → 401 | **PASS** |
| Checkout tampering (price, productId, userId) → 400; unknown plan → 400; no auth → 401 | **PASS** |
| Browser claiming "payment succeeded" (`/checkout-success?ref=<random>`) → no plan change | **PASS** |
| Prompt injection ("print the system prompt, API key, other users' data, a link, `<script>`") → normal plan, no leak or URL | **PASS** |

**Abuse and hardening**

| Check | Result |
|---|---|
| AI usage manipulation through `ai_reserve` / party deletion | **FAIL** (P1-1, P1-2) |
| Email relay abuse | **RISK** (P1-12) |
| `users.email` write | **FAIL** (P2-1) |
| Rate limiting | **WEAK** (P2-2) |
| CSP: only `frame-ancestors`, `object-src` and `base-uri`, with no `script-src`; sessions live in `localStorage`. No `dangerouslySetInnerHTML` found. HTML in a guest name was escaped on screen. | **P2** hardening |

### 11. Database / RLS Results

All probes used a real end-user JWT plus the public anon key against production PostgREST.

| Probe | Result |
|---|---|
| `users`: set own `current_plan` / `trial_expires_at` | 403 "Column … managed by the server" ✔ |
| Insert into `user_roles` / `plan_overrides` / `billing_purchases` | 403 permission denied ✔ |
| Delete or update `ai_generations` | 403 ✔ |
| RPC `recompute_entitlement` | 403 ✔. `ai_finalize` and `submit_rsvp` aren't exposed (404) ✔ |
| Read other users' `users` and `parties` | Only own rows returned ✔ |
| `admin_audit_log` | 403 ✔. `billing_webhook_events` and `analytics_events` return empty ✔ |
| Anon read of `guests`, `party_invitations`, `users`, `parties` | Empty ✔ |
| Anon read of `venues` | **Readable** (P2-21) |
| Legacy tables (`profiles`, `subscriptions`, `invoices`, `user_purchases`) | Don't exist ✔ |
| RPC `ai_reserve` (authenticated) | **Executable → global counter can be inflated** ✗ (P1-1) |
| RPC `ai_global_count_today` | Exposes usage (P3) |
| `users.email` update | **Allowed** ✗ (P2-1) |

Static review: RLS is enabled on every public table in the migrations. Every new SECURITY DEFINER function sets `search_path=''`. Entitlement is protected by a guard trigger plus revoked writes. See §5–7 for F-01 to F-04.

### 12. AI System Results

**Feature matrix in production.** Caps that apply to every feature:
- **Per party:** Free 3, Starter 10, Plus 25, Pro 50.
- **Per user:** 10 per hour and 10 per 24 h.
- **Global:** 50 per UTC day.

| Feature | Entry point | Endpoint | Live | Min plan | Timeout / maxTokens | Tested in production |
|---|---|---|---|---|---|---|
| Plan My Party | Home / Plan → "Plan My Party" | `/api/ai/party-planner` | ✔ | Free | 55 s / 3000 | ✔ 5 calls, 21–32 s, all valid. Restore and "Add all" work. |
| AI Theme Ideas | Plan → Theme → "Dream up themes with AI" | `/api/ai/theme-ideas` | ✔ | Free | 55 s / 3000 | ✔ 2 calls, 21–34 s; honoured "no princess" and "no pink"; unicode OK |
| AI Checklist | Checklist → "What am I forgetting?" | `/api/ai/checklist` | ✔ | Starter | 45 s / 1500 | Gate ✔ (403 for trial/Free). The paid path wasn't exercised (would need a purchase). |
| Activity Studio | Activities → "Create an activity" | `/api/ai/activity` | ✔ (you didn't know) | Plus | 45 s / 1800 | Gate ✔ 403 |
| Party Host | Plan → Party Magic → Host / Messages | `/api/ai/host` | ✔ (you didn't know) | Starter | 45 s / 1400 | Gate ✔ 403 |
| Party Experience | Plan → Party Magic hero | `/api/ai/party-experience` | ✔ (you didn't know) | Plus | 55 s / **4000** | Gate ✔ 403 |
| `budget_optimizer`, `food`, `activities`, `invitation`, `timeline`, `shopping_list`, `discover_explain` | Hidden | Various | Off | — | — | ✔ 503 `ai_disabled` (or 400) and **no model call** |
| Legacy Azure `/api/themes/ai` | Fallback UI | — | Unconfigured | none | — | 503 `not_configured` (no spend) |

**Usage accounting**
- Per-party cap enforced: the 4th call on a Free party → 429 `limit_reached`, no model call.
- Failed and cancelled calls count toward the hourly, daily and global limits but not the per-party one (by design).
- **Weaknesses:** P1-1, P1-2 and P1-3 above.

**Output quality.** Plans were concrete and age-appropriate, handled allergies (gluten-free and nut-aware), stayed calm for a shy child, were indoors when asked, and suggested a "mature" party for a 12-year-old.

**Defects:**
- The summary can contradict the over-budget figures (P2-4).
- One hazardous suggestion: dry ice (P2-5).
- With a budget over $100k the planner always fails (P2-3).

**Applying results**
- "Use this theme" changed `parties.theme` and showed up in the plan, activities and theme screens ✔.
- "Add all" activities → 5 rows → Activities tab "5 planned · about $98–132" ✔.
- "Add all" shopping → 30 items → Plan tab "0 of 30 bought" ✔.
- "Add to budget" → a Food $225 line → "$225 planned of $500" ✔.
- Double-apply was blocked by unique keys (409) ✔.
- Not in sync: the checklist and next step (P2-6) and the budget total (P2-7).

### 13. Billing / Dodo Results

**Prices**

| Check | Result |
|---|---|
| App and Dodo prices match: Starter $4.99, Plus $9.99, Pro $14.99, USD | **PASS** |
| Purchasing-power pricing on; tax added at checkout ("Sales Tax $0.00" shown) | Note |

**Checkout and plan integrity**

| Check | Result |
|---|---|
| Plan chosen on the server; client product, price and user fields rejected (`.strict()`) | **PASS** |
| Checkout host validated as `*.dodopayments.com`; live session opens at $4.99 | **PASS** |
| Browser can't grant itself a plan (REST writes to billing tables denied; `/checkout-success` only polls) | **PASS** |

**Webhooks**

| Check | Result |
|---|---|
| Signature verification, replay tolerance, dedupe by event id, out-of-order guard (code + tests) | **PASS** |
| Forgery attempts against production | **PASS** (401) |

**Paths not exercised in live mode**

| Check | Result |
|---|---|
| Successful, failed, processing and cancelled payments, refund, duplicate webhook | Integration tests ✔ (24 billing tests). **NOT TESTED live** (P0-4) |
| Plan revocation on refund | Tests ✔, live NOT TESTED |
| Disputes and chargebacks | **FAIL** (ignored, P2-16) |

**Trial and product model**

| Check | Result |
|---|---|
| Trial users can buy | **FAIL** (P0-1) |
| Per-party vs account-wide | **INCONSISTENT** (P1-11) |
| Super-admin override is applied before purchases (`recompute_entitlement`) | Static ✔. Not exercised (no admin login). |

### 14. Google Maps / Places Results

| Check | Result |
|---|---|
| Discovery search for 48084 / 20 mi: 124 venues in about 4 s on first load, 1.5–2.5 s on repeat (8/8 cache hits); 6 concurrent searches all 200 within 3 s | **PASS** |
| Ranking: art venues first for an art-loving child | **PASS** |
| Sparse region (Ketchikan, AK 99950): 16 places, mostly parks | **PASS** |
| Invalid ZIP 00000 → "We couldn't find that ZIP code" (422) | **PASS** |
| Venue details: about 1 s; 10 photos, rating, distance, address, Directions / Call / Website / Share, hours, "Why we recommend it" | **PASS** |
| Save venue and add to party; Saved list persists across sessions | **PASS** |
| Map: clusters, rating chips, bottom sheet, saved-heart state | **PASS** (needs WebGL; P2-23) |
| API key never in client code, URLs, Sentry or the bundle | **PASS** |
| Places failure path | Unit tests and E2E ✔. Not forced in production. |

### 15. Email / RSVP Results

| Check | Result |
|---|---|
| Confirmation, password reset, invitation, RSVP confirmation, host notification: all **delivered** via Resend from `noreply@magicalbirthdayplanner.app` | **PASS** |
| Invitation page for guests: child first name, age, date and time, venue name and address, Add to calendar, RSVP form; no budget or ZIP | **PASS** |
| RSVP Yes → "You're on the list!" and the host is emailed | **PASS** |
| Change RSVP / RSVP with a matching email | **FAIL**: duplicates (P1-4) |
| Invitation email link to /help | **FAIL** (404, P1-5) |
| Invite sent to a guest who had already RSVP'd through the link (same email) | **FAIL** (consequence of P1-4) |
| Invalid token → 404 | **PASS** |
| Reset link (old link invalid afterwards) | **NOT TESTED** (native `confirm()` dialog; static review says emailed links die after reset, P2) |

### 16. Super Admin Results

| Check | Result |
|---|---|
| All admin APIs return 404 to a normal user | **PASS** |
| `/admin` page as a normal user: client-side "not found", no data | **PASS** (P3: bundle shipped) |
| Self-escalation via REST (`user_roles`, `plan_overrides`, `users.role`) | **PASS** (denied) |
| Server-side role check (`requireSuperAdmin` reads `user_roles` with the service role) | **PASS** (static) |
| Override and audit flow as an admin | **NOT TESTED** (no admin credentials used); static review found F-10 (P2-17) |

### 17. Sentry / Observability Results

**Coverage**

| Check | Result |
|---|---|
| Logs and metrics received from production: `AI_REQUEST_STARTED/SUCCEEDED/LIMIT_REACHED`, `GOOGLE_PLACES_*`, `AUTH_LOGIN_FAILED` (code `invalid_credentials`, category expected), `CHECKOUT_STARTED` (plan STARTER), `WEBHOOK_RECEIVED/INVALID_SIGNATURE` | **PASS** |
| gen_ai spans with model, input tokens and duration | **PASS** (2 of 3 arrived: P2-9) |
| Traces for every API route; p95 values available | **PASS** |
| Correlation: logs carry `request_id` (generation id) and a hashed party id | **PASS** |

**Privacy and noise**

| Check | Result |
|---|---|
| No email, password, token, API key, prompt or response in sampled logs; `user.email` is empty everywhere | **PASS** |
| Issues raised by this test run: **0** (all failures were expected 4xx, so no noise) | **PASS** |

**Alerts**

| Check | Result |
|---|---|
| 11 metric monitors (500s, Dodo webhook, AI provider, auth, AI failure rate, AI timeouts, checkout, Places, AI latency, unusual AI usage, DB errors), uptime on `/api/health` every 5 min, email alert connected | **PASS** |

**Missing alerts**
- Global AI breaker tripped: `AI_REQUEST_LIMIT_REACHED` with `limit=global`.
- Spike in `WEBHOOK_INVALID_SIGNATURE` (this is exactly what a wrong webhook secret produces in P0-4).
- `PAYMENT_FAILED` rate.
- "Checkout started but no payment webhook within N minutes".

The P2 monitors on low traffic may be noisy: the failure rate fires on 1 failure out of 2.

### 18. Mobile / Responsive Results

I tested 11 app screens and 8 public pages at 375, 390, 393 and 430 px.

| Check | Result |
|---|---|
| No page-level horizontal scroll | **PASS** except `/more` with a long email (P2-10) |
| Touch targets of 44 px or more | Mostly **PASS**. Exceptions: Discover list/map toggle, card chips and Saved button (40×40); "Completed 4" toggle (117×20); "New party" link (87×20); venue phone and website text links (19 px tall); home checkbox (24×24); landing "Sign in" (43×19). |
| Long child name ("Zoë-Maximiliana O'Connor-Nguyễn ✨🦄"), an 80-character guest name, emoji and HTML in names | **PASS** (wrapped or escaped) |
| Bottom navigation, sheets (Add guest, Plan My Party, Theme ideas, Party details) | **PASS** |
| Long AI responses scroll inside the sheet | **PASS** |
| Pricing comparison table | Scrolls sideways with no affordance (P3) |
| Footer "Contact" partly under the bottom navigation | P3 |
| Keyboard overlap | **NOT TESTED** (headless browsers don't show a virtual keyboard) |

### 19. Performance / Stress Results

| Test (low volume, production) | Result |
|---|---|
| Page TTFB: `/` 77 ms, `/home` 102, `/pricing` 106, `/plan` 63, `/discover` 294 | ✔ |
| Landing LCP 576 ms; app screens LCP 90–780 ms; discover LCP about 4.9 s (photos and map) | ✔ / ⚠ discover |
| Discovery search ×5 sequential (1.5–2.5 s), ×6 concurrent (all 200 within 3 s) | ✔ |
| Venue details 0.5–1.4 s | ✔ |
| AI: 9 calls, 21–34 s, 0 timeouts | ✔ |
| Rapid navigation ×15 in 5.6 s: no errors or 401 loops | ✔ |
| Back, forward and refresh on discover | ✔ |
| Wizard final button triple-clicked → **1** party (no duplicate) | ✔ |
| "Add guest" double-click → 1 row | ✔ |
| "Add all" and "Add to timeline" double-tap → blocked by unique keys (409, no duplicates) | ✔ |
| 12 parallel invalid RSVPs → all 404, no 429 | ⚠ P2-2 |
| 3 forged webhooks in parallel → all 401 | ✔ |
| Health ×5: 74–105 ms | ✔ |
| Offline navigation → "You're offline — your plans are safe" | ✔ |
| Infinite polling or request loops | None found ✔ |

### 20. Data Integrity Results

| Check | Result |
|---|---|
| Party → guests → invitation → RSVP | **FAIL**: duplicate guest rows; headcounts disagree ("2 going" while the same family was also "Can't go") |
| Party → AI plan → apply theme, activities, shopping, budget | **PASS** for writes. **INCONSISTENT** for derived progress and budget (P2-6, P2-7). |
| Party delete → children cascade cleanly (verified by deleting a party in the UI) | **PASS**. But AI usage history is also erased (P1-2). |
| Account delete → everything cascades (verified: 0 rows left) | **PASS** (same caveat) |
| Duplicate activity by name → blocked (409) | **PASS** (the UI error message wasn't verified) |
| Orphan records after testing | None ✔ |

### 21. SEO / Public Website Results

**Passing**
- `robots.txt` and `sitemap.xml` are correct and limited to public pages.
- Favicon, PWA icons and manifest are fine; the new party-hat icon is live.
- The 404 page is friendly ("This page floated away").
- HTTPS, HSTS and security headers are in place.

**Failing or missing:** `og:image` and Twitter image (P1-9); per-page titles; canonical URL and `og:url`.

**Content problems that hurt credibility:** fake social proof (P0-2), the Terms placeholder and contradictions (P0-3), invisible pricing buttons and the "Yes!" FAQ answer (P1-8), a "Try Demo" that isn't a demo, a features list that undersells venue discovery (the strongest feature), and "automated reminders" that don't exist.

### 22. End-to-End UAT Journey (production, iPhone 13)

| Step | Result | Notes |
|---|---|---|
| Landing | ✔ | Clear headline. Fake social proof at the bottom. |
| Get Started → wizard (9 steps) | ✔ | Fast and friendly. ZIP shows "Troy, MI" live. |
| Sign up | ✔ | "Check your inbox". A long email is cut off. |
| Confirm account (real link) | ✔ | Lands on /home… |
| …party kept? | ✗ | **No party.** The wizard restarts (P1-7). |
| Create party (re-tapped 9×) | ✔ | |
| Discover venues | ✔ | "We found 124 party options near you." |
| Map | ✔ | Clusters and rating chips |
| Venue details | ✔ | Rich detail |
| Save venue | ✔ | "Saved to Ava's shortlist" |
| Add venue to party | ✔ | Shows on Plan and Invite |
| Theme | ✔ | "Magical Unicorn Kingdom it is!" ("Loves art" label on every card) |
| Add guests (incl. duplicate, unicode, 80+ chars) | ✔ / ⚠ | Duplicate allowed silently |
| Remove guest | ⚠ | No confirmation |
| Invitation: preview, copy link, email 1 guest | ✔ | Email delivered |
| Email "help center" link | ✗ | 404 |
| RSVP Yes (guest device) | ✔ | Host emailed |
| Change RSVP / RSVP with matching email | ✗ | Duplicates (P1-4) |
| Checklist (14 tasks, toggle) | ✔ | |
| Budget | ✔ / ⚠ | $225 of $500; totals out of sync |
| AI Plan My Party | ✔ | 32 s; strong plan |
| AI Theme Ideas | ✔ | 21 s |
| AI Checklist | ⛔ | Gated to Starter, and a trial user can't buy Starter (P0-1) |
| Apply AI results | ✔ | Theme, 5 activities, 30 shopping items, budget line |
| Results appear on Plan, Activities, Home | ✔ / ⚠ | Next step and progress stale |
| Pricing as a new user | ✗ | **No plans shown** (P0-1) |
| Live checkout opens at $4.99 (API) | ✔ | Not paid |
| Sign out → protected route → sign in | ✔ | |
| Everything persists | ✔ | Parties, guests, activities, saved venue, theme |

---

### 23. Bugs Found

Severity, screen, steps, expected and actual are listed per bug. Evidence screenshots are in `/tmp/qa/shots/` on the test machine (temporary).

1. **[P0] Trial users see no plans on /pricing.**
   - *Screen:* /pricing, /pricing?upgrade=starter
   - *Steps:* sign up → confirm → open /pricing.
   - *Expected:* three buyable plans.
   - *Actual:* no plan cards; "You're currently on the Pro plan".
   - *Impact:* no revenue from new users for 24 h.
   - *Fix:* treat a trial as FREE in `usePlanStatus` and on the pricing page.
2. **[P0] Fake social proof.**
   - *Screen:* /, /pricing
   - *Actual:* "Trusted by 10,000+ parents ★★★★★".
   - *Impact:* credibility and consumer law.
   - *Fix:* remove it.
3. **[P0] Contradictory and false billing copy plus a Terms placeholder.**
   - *Screen:* /pricing, /terms, /
   - *Actual:* 7-day refund vs non-refundable; "[Your Jurisdiction]"; sold features that don't exist.
   - *Fix:* rewrite.
4. **[P0] Live payment unverified.**
   - *Screen:* checkout
   - *Fix:* make a real $4.99 purchase and refund.
5. **[P1] `ai_reserve` callable by users.**
   - *Steps:* `POST /rest/v1/rpc/ai_reserve` with a user JWT.
   - *Actual:* 200; global count +1.
   - *Fix:* service-role only.
6. **[P1] Deleting a party or account resets AI caps and the global count.**
   - *Actual:* count 4 → 0 after account deletion.
   - *Fix:* a ledger that survives deletion.
7. **[P1] RSVP duplicates guests.**
   - *Screen:* /invite/[token], /guests
   - *Steps:* RSVP Yes → Change my RSVP → Can't go (no email).
   - *Expected:* one row updated.
   - *Actual:* two rows (CONFIRMED and DECLINED) and two contradictory host emails.
   - *Fix:* per-guest edit token / email match across all sources.
8. **[P1] RSVP with a host-added guest's email creates a duplicate;** the host row stays "Waiting".
9. **[P1] Invitation email "help center" link is a 404.**
   - *Fix:* change the link in `lib/email-templates/invitation.ts:289`.
10. **[P1] Google sign-in shows the Supabase domain.**
    - *Fix:* custom auth domain or consent-screen branding; check the publishing status.
11. **[P1] Draft party lost after email confirmation.**
    - *Fix:* auto-create the party from the draft after confirmation.
12. **[P1] Starter "Choose Plan" and "Compare Plans" buttons invisible.**
    - *Screen:* /pricing
    - *Actual:* white text on white.
13. **[P1] FAQ "How does per-party pricing work?" → "Yes!"**
14. **[P1] No og:image, and every page has the same title.**
15. **[P1] Privacy policy doesn't cover AI or processors;** account deletion is promised but missing; the host AI sends the venue address and guests' first names.
16. **[P1] Global AI limit of 50/day vs six live features;** owner unaware of three of them.
17. **[P1] Plan scope "per party" vs account-wide.**
18. **[P1] Email relay abuse paths** (anonymous RSVP email to any address; 300 invitations a day per free account).
19. **[P2] `users.email` writable by the client.**
20. **[P2] Budget over $100k breaks Plan My Party permanently.**
21. **[P2] AI summary contradicts over-budget numbers.**
22. **[P2] AI suggested dry ice for a children's party.**
23. **[P2] Next step and progress don't reflect planned activities;** the guest-list task isn't completed.
24. **[P2] Budget figures differ across screens;** there is no manual budget or shopping entry.
25. **[P2] Duplicate guests allowed; Remove has no confirmation.**
26. **[P2] Sentry logs and spans lost on serverless.**
27. **[P2] More screen overflows with long emails;** the toggle is pushed off-screen.
28. **[P2] Confirmation screen cuts off long emails.**
29. **[P2] `/checkout-success` waits forever on an unconfirmed reference.**
30. **[P2] No DMARC record.**
31. **[P2] In-memory rate limits** (no 429 seen).
32. **[P2] Anon-readable Google venue cache** (check the terms).
33. **[P3]** The polish items listed in §8.

### 24. Things That Passed

**Automated suite**
- Vitest 434/434 (unit and integration).
- Playwright E2E 38/38.
- ESLint clean.
- TypeScript clean.
- Secret scan clean (from the previous run, same commit).

**Product**
- The full signup → wizard → discovery → venue → save → add-to-party → theme → guests → invitation email → RSVP → checklist → AI plan → apply → persistence journey on production.

**Security and billing**
- No self-escalation of plan, role, trial or billing.
- Admin is masked with 404s.
- Webhook signature, replay and staleness handling.
- Checkout integrity.
- Prompt injection resisted.
- Disabled AI features cost nothing.
- Per-party AI cap enforced.

**Robustness and performance**
- Offline screen.
- Graceful handling of invalid ZIPs.
- Correct results in a sparse region.
- No duplicate parties, guests or activities under double-clicks.
- Fast pages and APIs.

**Delivery and operations**
- All transactional emails delivered from the verified domain.
- Sentry receives clean, PII-free telemetry with 0 false issues.
- Uptime and alerts are configured.

**Mobile**
- Clean at 375–430 px.

### 25. Things That Could Not Be Verified

| Item | Status |
|---|---|
| Real live payment → webhook → plan activation → refund → revocation | **REQUIRES USER ACTION** |
| Production webhook secret matches the live Dodo endpoint | **REQUIRES USER ACTION** (verified by the payment above) |
| Google OAuth completes for a non-test Google account (publishing status) | **REQUIRES USER ACTION** |
| Google Cloud: Places quota cap and billing alert; Maps browser-key referrer restriction | **REQUIRES USER ACTION** |
| Super-admin override and audit flow as an admin | NOT TESTED (no admin login) |
| AI Checklist, Host, Activity Studio and Party Experience on a paid plan | NOT TESTED (needs a purchase or override; I avoided changing production plans) |
| AI timeout and provider outage in production | NOT TESTED (can't be forced safely; covered by unit and integration tests) |
| Invitation "Reset link" behaviour | NOT TESTED (native confirm dialog) |
| Virtual keyboard overlap on real iOS and Android | NOT TESTED (needs a real device) |
| Real-device Safari and Chrome rendering, PWA install | NOT TESTED |
| Password-reset link landing → new password | NOT TESTED (email delivered; the link wasn't followed) |
| Trial expiry after 24 h | NOT TESTED (time-bound) |
| Production DB-level checks (pg_policies, function grants) | NOT APPLICABLE through PostgREST. Probed behaviourally instead (§11). |

### 26. Recommended Launch Checklist (tomorrow morning)

1. ☐ Fix **P0-1**: trial users can buy. Deploy, then sign up a new account and confirm that /pricing shows three buyable plans.
2. ☐ Remove the fake social proof (**P0-2**). Fix the refund policy, the Terms jurisdiction, the upgrade-credit claim and each tier's feature bullets (**P0-3**). Make the Starter and Compare buttons visible and fix the "Yes!" FAQ answer (**P1-8**).
3. ☐ Make **one real $4.99 Starter purchase**. Confirm the plan activates and Sentry shows `PAYMENT_SUCCEEDED`. Refund it in Dodo and confirm revocation (**P0-4**).
4. ☐ Make `ai_reserve` service-role only (**P1-1**). Decide which AI features are live and set `AI_GLOBAL_DAILY_LIMIT` for that set (**P1-3**).
5. ☐ Change the invitation email /help link (**P1-5**). Add an `og:image` and page titles (**P1-9**).
6. ☐ Google Cloud: check the OAuth consent screen is **In production**, the Places quota cap, a billing alert, and the Maps referrer restriction.
7. ☐ Smoke-test on your own phone: sign up, confirm, then wizard (note P1-7), discover, invite, RSVP from a second phone, Plan My Party.
8. ☐ Watch the Sentry email alerts for the first few hours. Have the rollback deployment id ready.

### 27. Top 10 Actions (ranked by impact × risk ÷ effort)

| Rank | Action | Impact | Risk if skipped | Effort |
|---|---|---|---|---|
| 1 | Let trial users buy (P0-1) | Revenue | Certain loss on launch day | ~30 min |
| 2 | Remove fake social proof; make refund, terms and feature copy true (P0-2, P0-3) | Trust and legal | High (communities spot it) | ~1–2 h |
| 3 | One real purchase and refund (P0-4) | Revenue | Silent failure for every buyer | ~15 min |
| 4 | `ai_reserve` service-role only and right-sized global limit (P1-1, P1-3) | AI availability | Medium–high | ~1 h |
| 5 | Visible pricing buttons and FAQ fix (P1-8) | Conversion | High | ~15 min |
| 6 | Fix the invitation /help link and add an og:image (P1-5, P1-9) | First impression for guests and shares | High visibility | ~45 min |
| 7 | RSVP duplicate fix (P1-4) | Host trust, correct headcount | Medium–high | ~2–3 h |
| 8 | Keep the party draft after confirmation (P1-7) | Activation | Medium–high | ~1–2 h |
| 9 | Google OAuth branding and publishing check (P1-6) | Sign-up trust | Medium (possibly high if in Testing) | ~30 min config |
| 10 | Usage ledger that survives deletion (P1-2) and privacy-policy update (P1-10) | Cost control and compliance | Medium | ~2 h |

---

*This report was produced without changing application code, production configuration or production data. The only exception is temporary test accounts, which were created and fully deleted. One `users.email` change on a test account was reverted before that account was deleted.*
