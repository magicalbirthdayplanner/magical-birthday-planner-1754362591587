# AI upgrade — production readiness report (2026-10-03)

Branch `feat/ai-upgrade` (pushed; **not merged, not deployed**). Production (`master`, magicalbirthdayplanner.app) was
not touched: no merge, no deploy, no production database query or migration, no Vercel/Google/Supabase-auth/DNS/Dodo change.
Companion docs: `PRODUCTION_AUDIT.md` (audit table), `LAUNCH_CHECKLIST.md` (human steps), `MANUAL_QA.md` (phone checks).

## Executive summary

**Code: ready for a controlled launch of `party_planner`, `theme_ideas` and `checklist`.**
**Launch: NOT YET — it needs four human steps** (rotate the key and set the env vars, apply migrations 0800 + 0900 to production, real-phone QA).

This pass found and fixed one **blocker**: a user could stop any generation counting toward their limits, which meant
unlimited AI calls at our cost. It also found the biggest product gap. Activities, shopping items and budget lines
"added" from AI suggestions went to tables that no screen showed, so the parent saw "Added", then nothing. Both are fixed.
The planner's "Use this theme" button had never worked, which is also fixed. Plan My Party is now an actionable plan:
- Add or Add all per section.
- The saved items show up on the Plan tab, where the parent can tick them off and enter what they spent.
- Next steps link to Discover, the invitation and the checklist.
- Reopening shows the same plan without using another suggestion.

The real model (DeepSeek V4 Pro via OpenCode Go) produced plans specific to each party in scenarios A–E. Plans arrived
in 17–29 s, and adversarial input did not leak instructions or secrets.

## Features

| Feature | Implemented | Tested | Production ready |
|---|---|---|---|
| Plan My Party (P0) | ✅ | unit/integration/E2E (mock) + live A–E | ✅ enable |
| Theme Suggestions (P0) | ✅ | integration/E2E + live (unicorn, not pink) | ✅ enable |
| Smart Checklist (P1) | ✅ | integration/E2E + live golden B | ✅ enable |
| Activity Planner (P1) | ✅ | integration + live (scenario C) | ✅ after phone check (Plus) |
| Budget Assistant (P1) | ✅ | integration + live | ✅ after phone check (Pro) |
| Food Planner (P1) | ✅ | integration + live (1 empty answer seen → now rejected) | ✅ after phone check (Pro) |
| Invitation Writer (P2) | ✅ | integration (mock) | later — not live-tested this pass |
| Timeline (P2) | ✅ | integration (mock) | later — not live-tested this pass |
| Shopping List (P2) | ✅ (deterministic merge) | integration (mock) | later |
| Discover explanations (P2) | ✅ | integration (mock) | later |

## P0

**Party Planner.** The entry point is the "✨ Plan My Party" card on Home and the Plan tab: "Tell us about the birthday. We'll help you plan it."
- **Input:** free text (placeholder from the brief) plus optional details pre-filled from the party.
- **Context:** combined with the party's age, date, guests, city/state, budget, interests, theme, venue, existing activities, checklist, budget lines (planned and actual) and shopping list.
- **Output:** structured JSON with summary, theme, activities, food, decorations, timeline, shopping list, budget, backup plan, assumptions and follow-up questions. The server recomputes totals and times.
- **Actions:**
  - Per item: Add (with Edit and Dismiss) and Undo.
  - Per section: Add all for activities and the shopping list, Use all for budget lines.
  - Use this theme carries the plan's decorations and activities.
  - Next-step links: Discover, invitation, checklist.
- **Where saved items go:** the Plan tab's **Your party plan** section:
  - activities, with details and remove
  - shopping list: tick off, remove, estimated total
  - budget: your budget vs planned estimates vs actually spent

  Only the parent enters "spent"; AI never writes it.
- **Reopening** shows the last plan with "Added" states, so no suggestion is spent.
- **Scenario D** (little information) returns a full starting plan plus 4 useful follow-up questions.

**Theme Suggestions.** The parent can say what the child loves and what to avoid ("unicorns but not a typical pink unicorn party", "dinosaurs and space").
- **Each idea has:** name, description, why it fits, palette, decorations, activities, food and an invitation concept. Use this theme saves all of it.
- **Reopening** shows the last ideas.
- **The existing theme picker is unchanged.** The older Azure "AI ideas" section hides only when the new feature is enabled, so there is one AI entry point.

## P1
- **Checklist ("What am I forgetting?").** Tasks are specific and use the guest count and theme. Live example: "Order 16 royal ball themed plates and cups". The server sets due dates, never in the past. Booked-venue rules apply, and duplicates are skipped. Add all.
- **Activities.** Each one has a description, duration, materials scaled to the guests, cost estimate, difficulty and indoor/outdoor. Optional question first. Add all to the party.
- **Budget.** An allocation when there are no lines yet, otherwise savings plus missing costs. Totals are server-computed. Estimates and actual spend are kept separate; AI changes only the planned amount, and only when the parent taps.
- **Food.** Menu with quantities scaled to the guests, dessert, drinks and dietary alternatives. The allergy disclaimer is always added by the server, and allergen-safety claims are stripped. Food list → shopping list (Add all).

## P2
- **Invitation:** fills the editor and never sends.
- **Timeline:** view, plus prep tasks to the checklist (Add all).
- **Shopping list:** deterministic dedupe; the model only categorises.
- **Discover:** ranks only venues already loaded.

All of these work with the mock provider, but they haven't been checked with the real model in this pass. Keep them off at launch.

## Security

| # | Finding | Severity | Status |
|---|---|---|---|
| S1 | `ai_finalize` callable by users → mark an in-flight generation failed → never counted (limit bypass, unlimited cost) | Blocker | **Fixed**: migration 0900, service-role only, owner must match; AI fails closed without the service role; attack reproduced in a test |
| S2 | Failed/cancelled calls didn't count toward per-user caps or the breaker | Important | **Fixed** |
| S3 | No per-user daily cap (Free = 3/party × unlimited parties) | Important | **Fixed**: `AI_USER_DAILY_LIMIT` |
| S4 | No request-size limit | Important | **Fixed**: 16 KB streamed cap (AI + apply routes) |
| S5 | Undo could run twice and restore stale values | Polish | **Fixed** |
| S6/S7 | Post-processing errors left rows pending; tokens not recorded on failures | Polish | **Fixed** |

Verified, no change needed:
- **Keys:** server-only. The client bundle scans clean for the OpenCode key, `AI_API_KEY`, the provider URL, the system prompt and the Supabase secret. None of the 8 local secrets appear in the branch history or tree.
- **Identity:** taken from the bearer token.
- **Plan:** from the trusted `getUserPlan`. A trial counts as Free, and Super Admin is read from the user's own `user_roles` row.
- **Ownership:** RLS applies to every read and write. Another user's party or generation reads as not found.
- **Apply:** reads items from the stored generation, never from the client.
- **AI output:** plain text, with HTML and URLs stripped. The model gets no tools or database handle.
- **Injection:** parent text is delimited data and can't close the delimiter. Overrides are sanitised too. Prompt-leak answers are rejected.
- **Privacy:** no child name, surname, ZIP or guest PII in prompts (tested).
- **Logs:** no prompts or keys.
- **Untouched:** billing, Dodo, auth, admin and older migrations.

## Cost

Measured live (DeepSeek V4 Pro via OpenCode Go; $0.66 / $1.98 per 1M in/out off-peak, $1.32 / $3.96 peak, Mon–Fri 01–04 and 06–10 UTC):

| Call | Tokens in → out | Cost off-peak / peak |
|---|---|---|
| Plan My Party | ~900–1,000 → ~1,850–2,250 | ≈ $0.005 / $0.010 |
| Theme ideas | ~780 → ~1,820 | ≈ $0.004 / $0.008 |
| Food | ~810 → ~1,500 | ≈ $0.004 / $0.007 |
| Activities | ~670 → ~1,300 | ≈ $0.003 / $0.006 |
| Checklist | ~960 → ~980 | ≈ $0.003 / $0.005 |
| Budget | ~640 → ~900 | ≈ $0.002 / $0.004 |

- **Worst case per request:** about $0.025 (a retry with 2 × 3,000 output tokens at peak).
- **Provider caps on Go:** DeepSeek V4 Pro is limited to $15/month ($3 per 5 h, $7.50 per week), about 1,500 plans a month at peak prices.
- **Controls in code:**
  - 45 s timeout and at most 1 retry (only for invalid output, never for timeouts or 5xx)
  - output caps of 900–3,000 tokens per feature
  - 16 KB request cap and 1,500-character free text
  - per-party caps of 3, 10, 25 or 50 depending on plan
  - 10 per user per hour
  - `AI_USER_DAILY_LIMIT` per user per day
  - `AI_GLOBAL_DAILY_LIMIT` breaker
  - reopening shows stored results instead of generating again
- **Recommended values** (not changed in code defaults): `AI_GLOBAL_DAILY_LIMIT=50` and `AI_USER_DAILY_LIMIT=10` on Go, which keeps worst-case spend at about $0.50/day. 100/day could use up the Go monthly cap at peak prices. After that the provider returns 429 and users see "very busy". Raise the limits with Go Plus ($60 cap) or once real usage is known.

## Database

| Migration | Changes | Safe? | Status |
|---|---|---|---|
| `20251003000800_ai_assistant.sql` | `ai_generations` + 4 RPCs; `party_ai_activities`, `party_shopping_items`, `party_budget_lines`; RLS via `owns_party()`; indexes; `updated_at` triggers | Additive and idempotent; no existing table, function, billing or auth object changed. Its `ai_finalize` grant is the S1 bug, so **always apply it together with 0900** | Local only |
| `20251003000900_ai_hardening.sql` (new) | Replaces `ai_finalize` (service role, `p_user`); breaker counts `failed`; `party_budget_lines.actual_amount` + check | Additive and idempotent; touches only 0800's objects | Local only |

Production: **not applied** (by rule; a read-only check of the production migration table was blocked by the
permission classifier, so this relies on the earlier record that production stops at 0700). Apply both migrations in order, with a dry run first (LAUNCH_CHECKLIST §1).

## Environment

Names only, no values:
- **Required:** `AI_ENABLED`, `AI_ENABLED_FEATURES`, `AI_API_KEY` (server), `SUPABASE_SERVICE_ROLE_KEY` (already set).
- **Optional (defaults):**
  - `AI_PROVIDER` (opencode)
  - `AI_MODEL` (deepseek-v4-pro)
  - `AI_BASE_URL` (OpenCode Go)
  - `AI_THINKING` (off)
  - `AI_TIMEOUT_MS` (45000)
  - `AI_MAX_OUTPUT_TOKENS` (3000)
  - `AI_MAX_RETRIES` (1, capped at 1)
  - `AI_GLOBAL_DAILY_LIMIT` (2000; set 50)
  - `AI_USER_DAILY_LIMIT` (30; set 10)
- **Where the key is:** not in the repo or Vercel. It exists only in the operator's local secrets file and must be rotated before use. Preview and Production must have separate values (see the checklist).

## Testing (exact results, final run on the branch head)

| Check | Result |
|---|---|
| `npm run lint` | ✔ no warnings or errors |
| `npm run typecheck` | ✔ |
| Unit (`npm test`) | ✔ 191/191 |
| Integration (`npm run test:integration`, local Supabase, mock AI) | ✔ 180/180 (was 167; +13 AI: `ai-security`, `ai-quality`, updated RLS test) |
| E2E (`npx playwright test`, production build, 375/390/393/430) | ✔ 32/32 (auth, password reset, wizard/party creation, discovery + venue details + save/add to party with mocked Google, guests, invitations + RSVP, checklist, Dodo test-mode checkout/webhooks, Super Admin, mobile layouts, AI flows) |
| `npm run build` | ✔ |
| `npm run check:secrets` + bundle/branch scans | ✔ clean |
| Live model (manual, `AI_LIVE=1`) | 10 checks. Scenarios A, C, D, E, golden-B checklist, themes, activities, budget pass. **B** came out over budget by $11, then by $5 after a prompt fix; the server flags it in red with a trim note, and the test now allows ≤ 10 % only when it's flagged. **Food** returned an empty menu once; that is now rejected and retried, and it passed on the rerun. |

Not covered by automation: real Google sign-in (OAuth), real Google Places and Maps, and real email. These use mocks in E2E. Their code is unchanged on this branch.
Real-device iPhone/Android QA: **pending** (MANUAL_QA.md).

## Remaining issues

**Blockers (human steps, not code):**
1. Rotate the OpenCode key, then set the AI variables in Vercel Production.
2. Apply migrations 0800 **and** 0900 to production.
3. Real-phone QA (MANUAL_QA A, B, D2, F).
4. Merge and deploy, which needs your authorization.

**Important:**
- The model's arithmetic can overshoot small budgets by about 3–7 %. The server always shows the real total in red with trim advice.
- Latency is 17–29 s (more at OpenCode peak hours). A retry after invalid output can hit the 45 s timeout, which gives a friendly error.
- The global breaker isn't atomic, so concurrent calls can overshoot it by a few.
- The apply route's rate limit is per instance. Writes are RLS-scoped, so this isn't a cost risk.
- The legacy `/api/themes/ai` (Azure) route is still ungated. It's only active if Azure variables are set; leave them unset.

**Polish:**
- The timeline is view-only; there's no saved day-of schedule.
- Planner food lines are display-only; food goes to the list via the shopping list.
- Budget lines can't be re-labelled in the UI (remove and re-add instead).

**Future enhancements:**
- Plan My Party for parents with no party yet: create the party from the description.
- Save the timeline.
- Per-plan Free-tier party-creation cap.
- Streaming responses for perceived speed.
- AI Party Rescue (deliberately not started).

## Recommended launch configuration

```
AI_ENABLED=true
AI_ENABLED_FEATURES=party_planner,theme_ideas,checklist
AI_PROVIDER=opencode
AI_THINKING=off
AI_GLOBAL_DAILY_LIMIT=50
AI_USER_DAILY_LIMIT=10
```
Then enable `activities`, then `budget_optimizer` and `food`, one at a time after a phone check each. Leave invitation, timeline, shopping_list and discover_explain off until they've had a live-model check.
