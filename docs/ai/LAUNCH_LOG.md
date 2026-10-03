# AI P0 production launch — 2026-10-03

| | |
|---|---|
| Production | https://magicalbirthdayplanner.app (Vercel project `magical-birthday-planner-1754362591587`, production branch `master`) |
| Code | `master` = `mobile-first` = `feat/ai-upgrade` (fast-forward only, no force push) |
| Rollback | Set `AI_ENABLED=false` in Vercel Production → redeploy. Pre-AI deployment: `dpl_9ztcb389XTSA2NNbbcdi7jDr8ZxY` (a50a5fb). |

## Database (production Supabase `fnrgybrhmjtokmotqotk`)
- Before: migrations 0000–0700 recorded; 0800/0900 pending; no AI tables.
- `supabase db push` (dry run first): applied `20251003000800_ai_assistant.sql` → `20251003000900_ai_hardening.sql`.
- Verified: both versions recorded; 4 AI tables with RLS (1 + 3×4 policies); `ai_finalize` executable by `service_role` only;
  no direct insert/update/delete on `ai_generations` for `authenticated`; `party_budget_lines.actual_amount` present;
  existing data unchanged.

## Vercel Production environment (names only)
`AI_API_KEY` (sensitive), `AI_ENABLED`, `AI_ENABLED_FEATURES` = `party_planner,theme_ideas,checklist`, `AI_PROVIDER`,
`AI_MODEL`, `AI_THINKING`, `AI_TIMEOUT_MS`, `AI_MAX_OUTPUT_TOKENS`, `AI_MAX_RETRIES`, `AI_GLOBAL_DAILY_LIMIT` (50),
`AI_USER_DAILY_LIMIT` (10). Production target only; no Preview/Development change; nothing `NEXT_PUBLIC_*`.

## Found during the launch
- Production smoke test: theme ideas failed 2 of 3 times — answers were cut off at the 1,800-token feature cap after the
  richer theme shape. Fixed in 70638df (cap 3,000, shorter items, truncation-aware retry); 4/4 live, then passed in production.

## Production checks (temporary accounts, all deleted)
- AI: 42 automated production checks passed — P0 flows end to end on the real model, P1/P2 refused (503), Free limits
  (3/party → 429), per-user daily cap → 429 without a model call, finalize bypass closed (42501), cross-user isolation,
  401/400 handling, persistence across sign-out/in, 375/390/393/430 without overflow.
- Regression: sign-up, sign-in, password reset, Google sign-in start, party creation, real Google Places + Maps, save /
  add venue, guests, invitation email, RSVP + host notification (Resend), checklist, budget, sign-out/in persistence,
  mobile layouts; pricing + Dodo **test-mode** checkout; Super Admin (40/40, normal users get 404).
