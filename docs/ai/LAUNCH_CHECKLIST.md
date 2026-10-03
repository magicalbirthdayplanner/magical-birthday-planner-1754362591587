# AI planning assistant — launch checklist

Everything ships **off**. Nothing changes for users until you complete steps 1–4. Branch: `feat/ai-upgrade`.

## 0. Before anything
- [ ] **Rotate the OpenCode key** that was pasted into chat (OpenCode console → API keys), then use the new key below.
- [ ] Review/merge `feat/ai-upgrade` → `mobile-first` → fast-forward `master` (normal pushes; production deploys from `master`).

## 1. Database (production Supabase `fnrgybrhmjtokmotqotk`)
Apply in this order (0700 is already applied):
- [ ] `supabase/migrations/20251003000800_ai_assistant.sql` — dry-run first:
  `npx supabase db push --db-url "$DBURL" --dry-run` → must list only `20251003000800_ai_assistant.sql`, then apply.
  Additive only: `ai_generations` (+ RPCs `ai_reserve`, `ai_finalize`, `ai_mark_applied`, `ai_global_count_today`),
  `party_ai_activities`, `party_shopping_items`, `party_budget_lines`. RLS on all; no existing table changed.
- [ ] Verify: `select relname, relrowsecurity from pg_class where relname in ('ai_generations','party_ai_activities','party_shopping_items','party_budget_lines');` → all `t`.
- **Apply the migration before deploying code that has AI enabled** (with AI disabled, the new code is safe without it).

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
| `AI_MAX_RETRIES` | `1` | |
| `AI_GLOBAL_DAILY_LIMIT` | `100` | circuit breaker; OpenCode Go caps DeepSeek V4 Pro at ~$15/month (~5k requests). Raise once you see real usage. |
| `AI_ENABLED_FEATURES` | `party_planner,theme_ideas,checklist` | **recommended minimal set for launch** |
| `AI_ENABLED` | `true` | master switch (set last) |
- Do **not** set `AI_PROVIDER=mock` in production.
- Dodo, Supabase, Google, Resend settings: unchanged. `DODO_PAYMENTS_ENVIRONMENT=test_mode`, `DODO_LIVE_PAYMENTS_ENABLED=false` stay as they are.
- [ ] Redeploy production (env changes apply to new deployments).

## 3. Which features to turn on
- Launch: `party_planner`, `theme_ideas`, `checklist` (verified live with the real model: ~12–31 s, valid output).
- Later, one at a time after a phone check: `activities` (Plus), `invitation` (Starter), `timeline` (Starter), `shopping_list` (Plus), `food` (Pro), `budget_optimizer` (Pro), `discover_explain` (Plus, stretch).
- Plan access (server-enforced, `lib/ai/capabilities.ts`): Free/trial = planner + theme ideas, 3 generations per party; Starter 10; Plus 25; Pro 50; 10 per user per hour; Super Admin unlimited.

## 4. Five-minute smoke test (production, your own account)
1. Super Admin → switch your plan to **Pro** (admin override).
2. Home → **Plan with AI** → "My daughter is turning 7, loves art and animals, 12 kids, $250, indoors in October" → **Create plan**. Expect a plan in ≤ 40 s, total ≤ $250, no named artists/characters.
3. Tap **Add to activities** on one activity → toast → **Undo** works.
4. Plan → Theme → **Give me 5 theme ideas** → **Use this theme** → the Plan page shows it.
5. Plan → Checklist → **Build my checklist** → **Add all** → tasks appear with sensible dates.
6. Switch back to **Free** → Plan → AI tools rows show "Included with Starter" (locked) — then remove the override.
7. Vercel logs: `ai_generation` lines show `status: success`, no keys or prompts logged.

## 5. Rollback (instant, no data loss)
- Set `AI_ENABLED=false` in Vercel → redeploy. All AI surfaces disappear; AI routes return `ai_disabled`.
- To disable one feature: remove it from `AI_ENABLED_FEATURES` → redeploy.
- The migration is additive and can stay applied. Saved AI items (checklist tasks, activities, shopping/budget lines, theme) remain as normal party data.
