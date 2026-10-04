# AI planning assistant — launch checklist

Everything ships **off**. Nothing changes for users until you complete steps 1–4. Branch: `feat/ai-upgrade`.
Full assessment: `docs/ai/AI_PRODUCTION_READINESS_REPORT.md`.

## 0. Before anything
- [ ] **Rotate the OpenCode key** that was pasted into chat (OpenCode console → API keys), then use the new key below.
- [ ] Review/merge `feat/ai-upgrade` → `mobile-first` → fast-forward `master` (normal pushes; production deploys from `master`).

## 1. Database (production Supabase `<project-ref>`)
Apply in this order (0700 is already applied). **Both** are required — 0900 closes a usage-limit bypass in 0800.
- [ ] Dry-run first: `npx supabase db push --db-url "$DBURL" --dry-run` → must list exactly
  `20251003000800_ai_assistant.sql` and `20251003000900_ai_hardening.sql`, then apply.
  - 0800 — additive: `ai_generations` (+ RPCs `ai_reserve`, `ai_finalize`, `ai_mark_applied`, `ai_global_count_today`),
    `party_ai_activities`, `party_shopping_items`, `party_budget_lines`. RLS on all; no existing table changed.
  - 0900 — `ai_finalize` becomes service-role only (new signature with `p_user`); breaker counts failed calls;
    `party_budget_lines.actual_amount` (parent-entered spend). Touches only objects created by 0800.
- [ ] Verify RLS: `select relname, relrowsecurity from pg_class where relname in ('ai_generations','party_ai_activities','party_shopping_items','party_budget_lines');` → all `t`.
- [ ] Verify the bypass is closed: `select has_function_privilege('authenticated', 'public.ai_finalize(uuid,uuid,text,text,text,integer,integer,integer,text,jsonb)', 'execute');` → `f`.
- **Apply the migrations before deploying code that has AI enabled** (with AI disabled the new code is safe without them;
  the Plan tab's "Your party plan" simply stays hidden).

## 2. Vercel → Production environment variables (names; set values in the Vercel UI)
| Variable | Value | Notes |
|---|---|---|
| `AI_API_KEY` | your **rotated** OpenCode key | server only — never `NEXT_PUBLIC_` |
| `AI_PROVIDER` | `opencode` | |
| `AI_MODEL` | `deepseek-v4-pro` | default if unset |
| `AI_BASE_URL` | *(leave empty)* | default `https://opencode.ai/zen/go/v1` |
| `AI_THINKING` | `off` | keep off (with it on, answers were empty / timed out) |
| `AI_TIMEOUT_MS` | `45000` | route max duration is 60 s (Hobby) |
| `AI_MAX_OUTPUT_TOKENS` | `3000` | |
| `AI_MAX_RETRIES` | `1` | hard-capped at 1 in code |
| `AI_GLOBAL_DAILY_LIMIT` | `50` | circuit breaker. On OpenCode **Go** ($15/month DeepSeek V4 Pro cap) 50/day keeps peak-hour spend ≈ $0.50/day; 100/day can exhaust the monthly cap at peak prices. Raise with Go Plus or after real usage data. |
| `AI_USER_DAILY_LIMIT` | `10` | per user, rolling 24 h, all parties, failures included (code default 30). Stops one account from using the whole daily breaker. |
| `AI_ENABLED_FEATURES` | `party_planner,theme_ideas,checklist` | **recommended set for launch** |
| `AI_ENABLED` | `true` | master switch (set last) |
- `SUPABASE_SERVICE_ROLE_KEY` must be set (it already is in production): AI fails closed without it.
- Do **not** set `AI_PROVIDER=mock` in production.
- Dodo, Supabase, Google, Resend settings: unchanged. `DODO_PAYMENTS_ENVIRONMENT=test_mode`, `DODO_LIVE_PAYMENTS_ENABLED=false` stay as they are.
- Preview: if you ever enable AI on Preview, scope the AI variables to Preview separately with their own (ideally separate) key and `AI_GLOBAL_DAILY_LIMIT` — never share production values.
- [ ] Redeploy production (env changes apply to new deployments).

## 3. Which features to turn on
- Launch: `party_planner`, `theme_ideas`, `checklist` (verified live with the real model on 2026-10-03: 17–29 s, valid output, context-specific).
- Next, one at a time after a phone check: `activities` (Plus; verified live), `budget_optimizer` (Pro; verified live), `food` (Pro; verified live), then `timeline`, `shopping_list`, `invitation`, `discover_explain`.
- Plan access (server-enforced, `lib/ai/capabilities.ts`): Free/trial = planner + theme ideas, 3 generations per party; Starter 10; Plus 25; Pro 50; 10 per user per hour; `AI_USER_DAILY_LIMIT` per day; Super Admin unlimited.

## 4. Five-minute smoke test (production, your own account)
1. Super Admin → switch your plan to **Pro** (admin override).
2. Home → **Plan My Party** → "My daughter is turning 7, loves art and animals, 12 kids, $250, indoors in October" → **✨ Plan my party**. Expect a plan in ≤ 40 s, total ≤ $250 (or shown in red with a trim note), no named artists/characters.
3. Tap **Add to activities** on one activity → toast → **Undo** works. Tap **Add all** on the shopping list.
4. Close the sheet → Plan tab → **Your party plan** shows the activity and shopping list; tick an item; open **Budget** and enter a "Spent" amount.
5. Reopen **Plan My Party** → the same plan appears (no new suggestion used) with added items marked.
6. Plan → Theme → **Dream up themes with AI** → "she loves unicorns but not pink" → **Use this theme** → the Plan page shows it.
7. Plan → Checklist → **What am I forgetting?** → **Add all to checklist** → tasks appear with sensible dates.
8. Switch back to **Free** → Plan → Planning help rows show "Included with Starter" (locked) — then remove the override.
9. Vercel logs: `ai_generation` lines show `status: success`, token counts, no keys or prompts.

## 5. Rollback (instant, no data loss)
- Set `AI_ENABLED=false` in Vercel → redeploy. All AI surfaces disappear; AI routes return `ai_disabled`.
- To disable one feature: remove it from `AI_ENABLED_FEATURES` → redeploy.
- The migrations are additive and can stay applied. Saved AI items (checklist tasks, activities, shopping/budget lines, theme) remain as normal party data and stay visible on the Plan tab.
