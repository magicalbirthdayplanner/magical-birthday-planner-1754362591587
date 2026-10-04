# Product model audit and implementation — Free · Starter · Plus · Pro

Status: **implemented on branch `feat/product-model`, NOT deployed.** Date: 2026-10-04.
Single source of truth: [`lib/entitlements.ts`](../lib/entitlements.ts). Legend: 🟢 works and was verified ·
🟡 works with a known limitation · 🔴 broken / not sellable · ⚪ not built (not sold).

## A. The finalized model

| Plan | Stage | Price | What it adds | AI allowance |
|---|---|---|---|---|
| **Free** | Explore | $0 | Create a party, Discover (Google Places) + map, save/shortlist venues, dated checklist, curated themes, party plan + your own activities, account | none |
| **Starter** | Plan | $4.99 per party | Guests & RSVP (link, emailed invites, RSVP collection) · AI Plan My Party · AI theme ideas · AI checklist · AI Activity Studio | 10 / party |
| **Plus** | Organize | $9.99 per party | AI Food Planner · AI Budget Assistant · AI Invitation Writer · AI party-day Timeline · AI Shopping List | 25 / party |
| **Pro** | Experience | $14.99 per party | AI Party Host (welcome, activity intros, cake, closing) · thank-you & reminder messages · AI Party Experience | 50 / party |

- **Trial (decision 1):** every new account gets 24 h of Starter's *non-AI* features (guests & RSVP). No AI in the trial.
- **Scope of a purchase (decision 2, revised 2026-10-04):** plans are priced and enforced **per party** — each purchase
  unlocks its plan for the party it was bought for (migration `20251004001400_per_party_purchases`; legacy purchases
  stay account-wide). Originally a purchase unlocked the account (all its parties). Pricing page, FAQ, Terms §4,
  Help and checkout confirmation say "per party".
- Fair use (unchanged): 10 AI requests per user per hour and per day, global daily breaker; Super Admin bypasses.
- Dodo prices and the AI provider/model are **unchanged**.

## B. Feature inventory (what exists in the code)

Core: party wizard, Discover (Google Places, map, filters, ranking), saved venues + notes, chosen venue, checklist
(dated, auto-milestones), curated themes, party plan (activities, budget, shopping, timeline, menu), manual activities,
guests (add/edit/import, dietary, RSVP status), invitation (link, editor, emailed invites via Resend), public RSVP page
(idempotent per invitee), host notifications, account (profile, delete, export), billing (Dodo checkout, webhook,
entitlement), admin (plan overrides), analytics (first-party), Sentry.

AI (all through `lib/ai/handler.ts`): `party_planner`, `theme_ideas`, `checklist`, `activity_studio`, `activities`
(legacy list, not sold), `food`, `budget_optimizer`, `invitation`, `timeline`, `shopping_list`, `discover_explain`
(not sold), `host_content` (welcome, activity_intro, cake, closing, thank_you_all, thank_you_guest, reminder),
`party_experience`.

## C. Validation matrix (per feature, after this change)

| Feature | Plan | Status | Evidence |
|---|---|---|---|
| Create party (wizard) | Free | 🟢 | E2E required-flow, mobile-regression ×4 widths |
| Discover + map + filters | Free | 🟢 | unit (ranking, taxonomy, cost control), E2E |
| Save / shortlist venues | Free | 🟢 | E2E, RLS integration |
| Checklist (dated) | Free | 🟢 | unit planning, E2E |
| Curated themes | Free | 🟢 | E2E |
| Party plan + own activities | Free | 🟢 | E2E "Free plan … add their own activity" |
| Account (profile, delete, export) | Free | 🟢 | E2E account |
| Guests | Starter (+trial) | 🟢 | integration plan-entitlements (RLS), E2E journey + pricing |
| Invitation & RSVP | Starter (+trial) | 🟢 | integration plan-entitlements + rsvp-idempotency + security, E2E journey |
| AI Plan My Party | Starter | 🟢 | integration ai-planner, E2E ai, live (earlier runs) |
| AI theme ideas | Starter | 🟢 | integration ai-features, E2E ai |
| AI checklist | Starter | 🟢 | integration ai-features, E2E ai |
| AI Activity Studio | Starter | 🟢 | integration experience, E2E experience |
| AI Food Planner | Plus | 🟢 (fixed) | integration, E2E pricing "Plus tools", **live** — see F1 |
| AI Budget Assistant | Plus | 🟡 | integration, E2E, live — see F4 |
| AI Invitation Writer | Plus | 🟢 | integration, E2E, live |
| AI Timeline | Plus | 🟢 (fixed) | integration, E2E, live — see F2 |
| AI Shopping List | Plus | 🟢 | integration, E2E, live (no invented items) |
| AI Party Host (welcome/intros/cake/closing) | Pro | 🟢 | integration experience, E2E experience |
| Thank-you & reminder messages | Pro | 🟢 | integration experience |
| AI Party Experience | Pro | 🟢 | integration experience, E2E experience |
| "Party-day assistance" as a separate live assistant | — | ⚪ | not built → not advertised (the Pro day-of value is Host + Experience) |
| AI activity list (legacy `activities`) | Starter | 🟢 not sold | superseded by Activity Studio |
| "Why these places" (`discover_explain`) | Plus | ⚪ not sold | flag off in production; not advertised |
| Task reminders, vendor recommendations, priority support | — | ⚪ | claimed by the old pricing page; not built → removed |

## D. Current (before) vs. new mapping

| Capability | Before | Now |
|---|---|---|
| Plan My Party / theme ideas | Free (3 per party) | Starter |
| AI checklist | Starter | Starter |
| AI Activity Studio | Plus | Starter |
| Party Host / messages | Starter | Pro |
| Party Experience | Plus | Pro |
| Food, Budget | Pro | Plus |
| Invitation writer, Timeline | Starter | Plus |
| Shopping list | Plus | Plus |
| Guests & RSVP | everyone (no gating) | Starter (+ trial) |
| Trial | Pro tier, AI counted as Free (3/party) | Starter non-AI, no AI |
| Free AI allowance | 3 per party | 0 |

## E. Pricing page gaps found (old page) and what replaced them

Old claims that were not true: "Task reminders", "Vendor recommendations", "priority support", "We'll credit your
original purchase toward the upgrade cost" (no proration exists), "7-day risk-free trial … full refund" (Terms say
non-refundable), "per-party payments" (purchases are account-wide), "PayPal" (unverified), "Join thousands…" and
"Trusted by 10,000+ parents ★" on the homepage, "reminders" in a homepage feature card. Free was not shown at all.

New page (`app/(site)/pricing/page.tsx`): four cards always visible (anonymous / Free / trial / paid, each with the
right CTA: current plan, included, upgrade), comparison by category (Plan · Manage · AI planning · AI organization ·
AI party experience), the 14 required FAQ answers written against real behaviour, no testimonials or counts. Homepage
pricing uses the same `PlanCards`. Copy lives in `components/billing/planContent.ts` and a unit test checks every
comparison row against `lib/entitlements.ts`.

## F. Broken / weak features found during validation

- **F1 🔴→🟢 Food Planner text corruption.** Live run: the allergen-claim filter replaced "gluten-free" with the token
  `check-with-families` ("Check with the check-with-families family", "check-with-families cheese pizza"). Fixed in
  `lib/ai/features/food.ts`: dish names become "Cheese pizza (gluten-free option)"; dietary words in advice stay;
  blanket promises ("allergen-free", "safe for everyone", "allergy-safe") become "allergy-aware"; the allergy note is
  always attached. Unit + integration + E2E + live re-run.
- **F2 🟡→🟢 Timeline showed offsets ("0:10")** even when the party has a start time. Now real clock times
  ("1:10 PM") via the app's own `clockAt`, offsets ("+0:10") without a start time.
- **F3 🟡→🟢 Reopened plans never noticed party changes.** Plan My Party sent the party's own values as "overrides",
  so drift was undetectable. Now only values the parent changed are overrides, and reopened Plan My Party / Party
  Experience results show "Refresh with your new party details" when age, budget, theme or (materially) guests changed.
- **F4 🟡 Budget Assistant quality.** Live: once suggested a decorations amount ($20) below what was already spent
  ($35), and `projectedTotal` excludes the "missing" costs it recommends. Usable; totals are server-computed. Not
  changed (AI logic), listed under remaining issues.
- **F5 🔴→🟢 Guests & RSVP had no plan enforcement at all** (browser writes straight to RLS). Fixed in the database.
- **F6 🔴→🟢 Plus features are flagged OFF in production** (`AI_ENABLED_FEATURES`). Selling Plus without enabling
  them would sell nothing. Requires the env change in §J before/with deploy.
- Copy conflicts flagged, not invented: Terms "[Your Jurisdiction]" placeholder; invitation email links to `/help`
  (404); no og:image; privacy policy has no processor list.

## G. Security and gating

- **Server enforcement:** AI — `lib/ai/handler.ts` checks `planAllows` before any reservation (403 `forbidden_plan`
  with `upgradeTo` = the cheapest plan that unlocks). Guests/invitations — migration
  `20251004001300_plan_entitlements.sql`: `public.has_paid_access()` (security definer, `auth.uid()` only, no
  arguments to spoof; anon has no execute) and `WITH CHECK` on insert/update of `guests` and `party_invitations`.
  Emailing invitations — `/api/invitations/send` returns 403 without paid access.
- **Downgrade-safe:** Free accounts keep read + delete of their guests/invitation; guests can still RSVP to an
  already-shared link (service-role `submit_rsvp`).
- The UI only displays (`usePlanStatus().can`, `UpgradePrompt`, nav lock); a direct API/PostgREST call is refused
  (integration tests call the routes and PostgREST with real user tokens).
- Unchanged: billing/webhook verification, AI usage hardening (server-only `ai_reserve`), Sentry, RSVP idempotency.

## H. Tests

| Suite | Result |
|---|---|
| Lint / typecheck | clean |
| Unit + integration (vitest, local Supabase) | **42 files, 517 tests passed** |
| E2E (Playwright, 375–430 px phones, mock Google/Resend/Dodo) | **49 passed** (full suite 48/48, then the added Plus-tools test 1/1) |
| Build | passed |
| `check:secrets` | clean (115 client files) |
| `scan:history` | 0 secrets at HEAD (historical findings pre-existing, unchanged — rotate per SECURITY.md) |
| Live AI (opt-in, real provider, ~$0.03) | Plus features 5/5 passed; food + timeline re-run after fixes 2/2 |

New: `tests/unit/entitlements.test.ts` (model, trial, Super Admin, prices, AI tiers, pricing copy vs. model),
`tests/unit/food-claims.test.ts`, `tests/unit/party-refresh.test.ts`, `tests/integration/plan-entitlements.test.ts`
(RLS per plan state, downgrade, invitations/send), `tests/e2e/pricing.spec.ts` (anonymous/trial/Free/Plus, 4 widths,
Plus tools end-to-end), `tests/live/plus-live.test.ts`. Updated (not weakened): every "Free gets 3 AI" test now
asserts Free/trial get 403 and the per-party cap on Starter (10); the "sold features" regression tests every
advertised AI feature at exactly its plan and refuses the trial and the plan below.

## I. Funnel analytics (existing first-party pipeline, no new vendor)

`landing_page_view`, `pricing_viewed`, `signup_started`/`signup_completed`, `party_creation_started`/`_completed`,
`upgrade_prompt_viewed`, `plan_upgrade_clicked`, `checkout_started`, `purchase_completed`, `ai_feature_viewed`,
`ai_feature_used`, `ai_feature_blocked`, `rsvp_started`/`rsvp_completed` → `/api/analytics` → `analytics_events`.
No PII in properties (feature / plan / capability / status only).

## J. Deployment plan (needs explicit authorization — nothing was deployed)

1. Production DB: apply `supabase/migrations/20251004001300_plan_entitlements.sql` (additive, re-runnable, no data
   change). Then `notify pgrst, 'reload schema'`.
2. Vercel production env: `AI_ENABLED_FEATURES=party_planner,theme_ideas,checklist,activity_studio,host_content,party_experience,food,budget_optimizer,invitation,timeline,shopping_list`.
3. Merge `feat/product-model` → `master` (deploys).
4. Smoke: anonymous /pricing; a Free test account sees the Guests upgrade; a Starter override can add a guest and run
   Plan My Party; a Plus override can run Food; delete test data.

Order matters: the migration first is safe for the current app (the old UI only writes guests for accounts that
will still have access, except Free accounts — see risks). Rollback: revert the merge commit; restore
`AI_ENABLED_FEATURES`; to undo the DB gate, recreate `guests_insert_own`/`guests_update_own`/
`party_invitations_insert_own`/`party_invitations_update_own` exactly as in migration 20251004001300 minus the
`and (select public.has_paid_access())` clause — the function can stay.

**Risks:** (1) Existing Free users who used guests/RSVP lose the ability to add/edit them (data stays, RSVPs still
arrive) — intended by the model, but a visible change. (2) Existing trial users lose AI access immediately. (3)
Existing buyers can lose AI they already had, because features moved up: of the features live in production today,
Starter buyers lose the Party Host (now Pro) and Plus buyers lose the Party Host and Party Experience (now Pro).
Not measured — production data was not read in this task. Before deploy, the owner should count active STARTER/PLUS
purchases and consider a goodwill override to the next plan. (4) Higher AI spend once Plus features are on (bounded by the
unchanged per-user and global caps).

## K. Recommendations and GO / NO-GO

- **GO for deploy** of this branch once §J is authorized, after the existing-buyer check in risk (3).
- Before wide launch (not blockers for this change): fill the Terms jurisdiction, fix the `/help` link in the
  invitation email, add an og:image and a processor list in the privacy policy; consider upgrade credit (today a
  Starter → Plus upgrade pays the full $9.99 — the page doesn't promise otherwise).
