# AI upgrade — report (2026-10-03)

## Completed
| Feature | Status | Notes |
|---|---|---|
| Provider abstraction, flags, mock, structured client | **Done** | OpenCode Go (OpenAI-compatible), deepseek-v4-pro; timeout + cancel, JSON repair, exactly one retry, friendly errors |
| Party context engine (`buildPartyAIContext`) | **Done** | RLS-scoped; no names/ZIP/guest PII/street address (invitation writer may use first name + chosen venue) |
| P0-A AI Party Planner | **Done — recommended ON** | Home + Plan card; verified live (golden A ≤ $250, ~21–31 s) |
| P0-B Theme ideas (`/plan/theme`) | **Done — recommended ON** | verified live (~12 s) |
| Apply / edit / dismiss / undo / regenerate | **Done** | server reads items from the stored generation; dedupe; undo |
| Usage, limits, entitlements, capabilities | **Done** | race-safe reserve→rank; global breaker; trial = Free for AI; Super Admin bypass |
| P1-A AI Checklist | **Done — recommended ON** | verified live (golden B, ~14 s) |
| P1-B Budget assistant | Done — flagged off | Pro; server-computed totals |
| P1-C Activity generator | Done — flagged off | Plus |
| P1-D Food planner | Done — flagged off | Pro; disclaimer + allergen-claim stripping server-side |
| P2-A Invitation writer | Done — flagged off | Starter; copy only, never sends |
| P2-B Day-of timeline | Done — flagged off | Starter; enum adjusters |
| P2-C Shopping list | Done — flagged off | Plus; deterministic merge, model only categorises |
| Stretch: Discover "why it fits" | Done — flagged off | Plus; supplied candidates only, no Places calls |

## Git
- Branch `feat/ai-upgrade` (from `mobile-first` @ a50a5fb), pushed (never force). `master`/production untouched by this work.
- Commits: audit → provider → context → planner → contextual → apply → usage → P0 checkpoint → checklist → budget → activities → food → invitation → timeline → shopping list → discover explain → full regression → DeepSeek live fix → this report. Working tree clean after the final commit.

## AI provider
- Provider: OpenCode Go, OpenAI-compatible chat completions (`AI_PROVIDER=opencode`), base URL `https://opencode.ai/zen/go/v1` (default), model env var `AI_MODEL` (default `deepseek-v4-pro`). Verified against https://opencode.ai/docs/go/ and live calls: `Authorization: Bearer`, **required `x-opencode-session` header**, JSON mode supported.
- **Critical live finding:** DeepSeek V4 Pro "thinking" consumed the entire token budget (empty answer → timeouts). The adapter sends `thinking: {type: "disabled"}` (`AI_THINKING=off`); with it, valid JSON in ~12–31 s.
- Env var names: `AI_ENABLED`, `AI_ENABLED_FEATURES`, `AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `AI_MAX_OUTPUT_TOKENS`, `AI_TIMEOUT_MS`, `AI_MAX_RETRIES`, `AI_GLOBAL_DAILY_LIMIT`, `AI_THINKING`. The key is in no file in the repo and not in Vercel.

## Database
- Migration `supabase/migrations/20251003000800_ai_assistant.sql` (additive). Tables: `ai_generations`, `party_ai_activities`, `party_shopping_items`, `party_budget_lines`; RPCs `ai_reserve`, `ai_finalize`, `ai_mark_applied`, `ai_global_count_today`.
- RLS: `ai_generations` owner SELECT only; no direct insert/update/delete (prevents un-counting usage); RPCs are security-definer, scoped to `auth.uid()` and the caller's own party/pending rows. Apply-target tables use the existing `owns_party()` pattern. Proven by integration tests (user A cannot read B's generations or apply them).
- **Applied only to the local Supabase stack. Not applied to production** (production is the only remote database) — see LAUNCH_CHECKLIST step 1.

## Billing
- No billing code, Dodo products, webhooks or settings changed. `DODO_PAYMENTS_ENVIRONMENT=test_mode` and `DODO_LIVE_PAYMENTS_ENABLED=false` unchanged (branch diff touches no billing/Dodo file or variable).

## Security
- No secrets in source, branch history or client bundle (scanned for the OpenCode key, `AI_API_KEY`, provider URL, system prompt, Supabase service key, Places key, Resend key — all 0). AI modules are `server-only` with a test guard against client imports.
- Every AI route: authentication → zod input (free text ≤ 1,500 chars, control chars stripped) → party ownership → flag → plan → limits; friendly error codes, no stack traces or raw provider errors.
- Injection defences: parent text is delimited data (delimiter can't be closed), shared rules, outputs validated, HTML/URLs stripped, protected characters/franchises/artists replaced, prompt-leak responses rejected. RLS preserved; no service role in AI writes.
- Logging: `ai_generation` metric lines (feature, user, party, provider, model, duration, status, tokens) — no keys, prompts or free text.

## Tests
- Lint ✔ · typecheck ✔ · unit **191** ✔ · integration **167** ✔ (local Supabase, mock provider) · E2E **32** ✔ (Playwright production build, 7 AI specs at 375/390/393/430) · build ✔ · secret scans ✔.
- Covered: valid, malformed (repair), beyond repair, timeout, 5xx, rate-limited, exactly one retry, plan denied, limits incl. concurrency, unauthenticated, missing/foreign party, empty/long/injected prompts, flag off, apply dedupe + DB-copy, server budget recompute, checklist date clamping/compression, protected-name filtering, bundle key scan, Super Admin bypass, RLS isolation, golden A/B (fixtures).
- Manual live check (opt-in `vitest.live.config.ts`, never in CI): golden A/B + theme ideas pass on the real model.
- Not run: E2E against a non-production environment with the real model (none exists; production E2E not run by rule) → MANUAL_QA.md.

## Entitlement discrepancies (code vs marketing)
- Before this work no feature was plan-gated in code; AI features are now gated per `lib/ai/capabilities.ts` (mapped from the pricing page). Non-AI features the pricing page assigns to tiers (RSVP tracking — Plus; invitation creator — Starter; manual budget tracker — Plus) remain available to everyone.
- "Task reminders" (Plus) and "Vendor recommendations" (Pro) have no implementation.
- Refunds: pricing FAQ "7-day risk-free … full refund" vs Terms "non-refundable"; FAQ "7-day trial" vs a 24 h trial in code.

## Unverified marketing claims (reported only; not edited)
- "Trusted by 10,000+ parents" + 5 stars (`app/(site)/page.tsx:546-552`), "Join thousands of parents…" (`page.tsx:538`, `pricing/page.tsx:363`).
- "AI-powered" (landing, pricing, terms, privacy) — true only once AI is enabled; "automated reminders" — not implemented; "7-Day Risk-Free Guarantee … No questions asked" (`pricing/page.tsx:370-373`); "priority support".

## Remaining issues
- Migration 0800 is not applied in production; AI env vars are not set (by design).
- Real-model latency 12–31 s (planner slowest; OpenCode peak hours are slower and pricier) — within the 45 s timeout and 60 s route limit, but a retry can push past it (friendly timeout error).
- The OpenCode key was shared in chat — rotate before use.
- The older Azure theme route (`/api/themes/ai`) is unchanged and ungated (only active if Azure vars are set).
- Real iPhone/Android checks pending (MANUAL_QA.md).
- The 30 historical secrets in the original repository history (pre-existing) still need rotation.

## Single most important action before enabling AI in production
**Rotate the OpenCode key, set it as `AI_API_KEY` in Vercel (server-only), and apply migration `20251003000800_ai_assistant.sql` to production — then enable only `party_planner,theme_ideas,checklist` with `AI_GLOBAL_DAILY_LIMIT=100` and run the 5-minute smoke test.**
