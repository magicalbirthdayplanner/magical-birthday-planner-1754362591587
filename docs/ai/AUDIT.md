# AI upgrade — Phase 0 audit

Branch `feat/ai-upgrade` from `mobile-first` @ a50a5fb (Next.js 15.5.27, React 19.3). The repo is the source of truth.

## 1. Tooling
- npm (`package-lock.json`). Scripts: `dev` (3100), `build`, `lint` (`next lint`, ESLint 8), **`typecheck`** (`tsc --noEmit -p .`), `test` (vitest `tests/unit`), `test:integration` (vitest `tests/integration`), `test:e2e` (Playwright), `db:start|stop|reset|types`, `check`, `check:secrets` (`scripts/check-client-secrets.mjs`), `scan:history`.
- Vitest: one config (`vitest.config.ts`), node env, `fileParallelism: false`, `@` → repo root, `server-only` stubbed. Integration tests run against **local** Supabase (`tests/integration/helpers/supabase.ts` refuses non-local URLs) and call route handlers directly (`await import('@/app/api/.../route')` then `POST(new Request(...))`).
- Playwright: `tests/e2e`, projects `iphone-390` + `viewports` (375/390/393/430), production build on :3101 with `.env.e2e` and a mock Google/Resend/Dodo server.
- Deps already present: `zod` 3.23.8, `openai` ^5.11.0.

## 2. Supabase access, RLS, migrations
- Route auth: `lib/server/auth.ts` `getAuthedRequest(req)` → `{ user, supabase, accessToken }`; `supabase` is a **user-scoped client (Bearer JWT), so RLS applies**.
- Service role: `lib/server/supabase-admin.ts` (`getSupabaseAdmin`, `hasServiceRole`) — documented as never for a user's party data.
- Errors: `lib/server/http.ts` `apiError(status, code, message)` → `{ error: { code, message } }`.
- Migrations: `supabase/migrations/YYYYMMDDHHMMSS_snake.sql` (0000 baseline … 0700 super_admin). Canonical RLS in `20251001000200_rls_hardening.sql`: parties own-row; child tables via `public.owns_party(party_id)` (security definer) + `user_id = auth.uid()` on insert/update. Server-only tables (`ai_cache`, `analytics_events`): RLS on, no policies.
- Rate limiting: `lib/server/rate-limit.ts` (in-memory fixed window, per instance). Logging: `lib/analytics/server.ts` `logMetric` (JSON console lines) + `trackServer`; no logger library.

## 3. Plans / entitlements (code is the source of truth)
- Storage: `users.current_plan` (written only by `recompute_entitlement`), `plan_overrides` (Super Admin, own-row SELECT), `billing_purchases`.
- Resolver: `lib/billing/server.ts` `getUserPlan(admin, userId)` → `{ plan, source: admin_override|purchase|trial|free, trialActive, override }` (needs the service-role client; it is the trusted entitlement read). Client reads `/api/billing/status`.
- Super Admin: `lib/server/admin.ts` `requireSuperAdmin(req)` (404 for others); `user_roles` has an own-row SELECT policy, so "am I super admin" can be read with the user's own session.
- **Per-plan feature matrix in code: none.** No feature is gated by plan today; plan is used only for billing display (More, pricing) and admin. `/api/themes/ai` has no plan check.
- Marketing matrix (pricing page + landing): Starter = theme suggestions by age, smart checklist & timeline, simple invitation creator; Plus adds personalized activity ideas, RSVP tracking, task reminders, manual budget tracker; Pro adds vendor recommendations, personalized food suggestions, smart budget tracker with insights. Discrepancies → DECISIONS.md.

## 4. Data model (AI "apply" targets)
| Target | Table | Notes |
|---|---|---|
| Party / child | `parties` | child_name, child_age, interests[], party_date, party_time, zip/city/state, guest_count, budget, venue_type (indoor/outdoor/mixed), theme, theme_details jsonb |
| Children | — | columns on `parties` |
| Guests | `guests` | names/emails/phones are PII → never sent to the model |
| Venue | `party_venues` (+ `venues`, `saved_venues`) | chosen venue per party |
| Theme | `parties.theme` + `theme_details` | apply = `updateParty` (same as ThemeScreen) |
| Checklist | `checklist_items` | UNIQUE (party_id, task_key) → natural dedupe |
| Invitation | `party_invitations` | headline/message/host_name/... (draft prefill, user saves) |
| Activities | `party_activities` | requires catalogue `activity_id` → **new table needed** for custom AI activities |
| Budget lines | — | only `parties.budget` → **new table needed** |
| Food | — | items go to shopping list / checklist |
| Shopping list | — | **new table needed** |

## 5. Screens
Exist: Home (`components/home/HomeScreen.tsx`), Plan (`components/plan/PlanScreen.tsx`), Theme, Checklist, Discover, Guests, Invitation, More. **Missing:** budget, activities, food, shopping list → per brief, one minimal "AI tools" section on `/plan` (between "The party" and "Details").

## 6. Reusable UI
`BottomSheet` (vaul; `open, onOpenChange, title, description?, footer?`), `ui.tsx` (`AppButton` incl. `magic`, `Card`, `Section`, `Chip`, `Skeleton`, `EmptyState`, `ErrorState`, `PageHeader`, `StickyCTA`), `fields.tsx` (`TextField`, `TextArea`), sonner toasts, `lib/data/api.ts` (`apiFetch`, `ApiError`, `friendlyError`). Design tokens in `app/globals.css` (`.mbp-app`).

## 7. Existing AI code
- `lib/server/azure-openai.ts` (Azure OpenAI client, `aiConfigured()`), `app/api/themes/ai/route.ts` (6/h in-memory, 30-day `ai_cache`, no plan check), `lib/planning/ai-themes.ts` (zod schema + parser, profanity filter).
- Env (names): `AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT_NAME, AZURE_OPENAI_API_VERSION`. Left untouched (backward compatible); the new stack is separate.

## 8. Provider (verified 2026-10-03 against https://opencode.ai/docs/go/ and a live call)
- OpenCode Go, OpenAI-compatible: `POST https://opencode.ai/zen/go/v1/chat/completions`, `Authorization: Bearer <key>`, **required** `x-opencode-session` header, model id `deepseek-v4-pro`. `response_format: {type: "json_object"}` accepted. Responses include `usage` and a separate `reasoning_content` (must never be shown). Wrong key → 401. Limits are monthly dollar caps per model.

## 9. Unverified marketing claims (report only; marketing pages not edited)
- `app/(site)/page.tsx:546-552` five stars + "Trusted by 10,000+ parents"; `:538` "Join thousands of parents who trust us…"; `pricing/page.tsx:363` "Join thousands of happy families…".
- "AI-powered" claims: `page.tsx:54,143,152,408`, `pricing/page.tsx:39,54`, `terms/page.tsx:24`, `privacy/page.tsx:33` (AI exists only as optional theme ideas today).
- "automated reminders" `page.tsx:70`, "Task reminders" (pricing) — no reminder feature exists.
- `pricing/page.tsx:370-373` "7-Day Risk-Free Guarantee … refund … No questions asked" vs `terms/page.tsx:60` "All fees are non-refundable except as required by law"; FAQ "7-day risk-free trial" vs code trial = 24 h.
- "priority support" `pricing/page.tsx:91`; "trending themes loved by kids" `page.tsx:205`.
