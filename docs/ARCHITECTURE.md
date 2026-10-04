# Architecture

Current as of 2026-10-04. Companion docs: [SUPABASE_SCHEMA.md](SUPABASE_SCHEMA.md) (column-level reference),
[SECURITY.md](SECURITY.md), [ai/AI_FEATURES.md](ai/AI_FEATURES.md), [LOCAL_DISCOVERY.md](LOCAL_DISCOVERY.md),
[BILLING_SECURITY.md](BILLING_SECURITY.md), [MOBILE_UX.md](MOBILE_UX.md), [PWA.md](PWA.md).

## System

```
                         ┌───────────────────────────── Vercel ─────────────────────────────┐
Browser / installed PWA  │ Next.js 15 App Router                                             │
  anon key + user JWT ──►│  pages: app/(site) public · app/(flow) full-screen · app/(app) tabs │
  Maps JS (browser key)  │  route handlers: app/api/*  (server-only modules, `server-only`)  │
  Sentry browser SDK     │  instrumentation.ts → Sentry (Node)                               │
                         └──────┬───────────────┬────────────────┬───────────────┬──────────┘
                                │ RLS (user)    │ service role   │               │
                                ▼               ▼                ▼               ▼
                     Supabase Postgres + Auth   Google Places (New)   AI provider   Dodo Payments ◄─ webhooks
                     (RLS, RPCs, PostGIS)       Geocoding fallback    (OpenAI-compatible)  Resend (email)
```

- **Rendering:** client components fetch data with SWR from Supabase (RLS) and from `/api/*`; nothing private is
  server-rendered, so pages can be static shells.
- **Server authority:** anything that grants, spends or charges runs in a route handler with a `server-only`
  module: AI (`lib/ai/handler.ts`), billing (`lib/billing/*`), RSVP (`app/api/invite/[token]/rsvp`), invitation
  email (`app/api/invitations/send`), discovery (`lib/discovery/*`, Google keys), admin (`app/api/admin/*`).
- **Service role** (`lib/server/supabase-admin.ts`) is used only after the request has been authenticated and,
  where relevant, ownership has been verified with the user's own RLS session.

## Data model

Owner-scoped tables use `owns_party(party_id)` / `user_id = auth.uid()` policies. Server-only tables have RLS on
with no client policies and revoked writes.

| Entity | Table(s) | Notes |
|---|---|---|
| User profile & entitlement | `users` (1:1 `auth.users`) | `current_plan`, trial columns are server-managed (guard trigger) |
| Roles / overrides / audit | `user_roles`, `plan_overrides`, `admin_audit_log` | Super Admin; read-own or server-only |
| Party | `parties` | child, age, date, ZIP + coordinates, guests, budget, setting, interests, theme / `theme_details` |
| Venues (shared cache) | `venues`, `venue_searches`, `venue_search_results` | Google Places cache with TTLs, PostGIS |
| Saved / party venue | `saved_venues`, `party_venues` | shortlist with notes; the chosen venue |
| Guests | `guests` | RSVP status, kids/adults, source (`host` / `rsvp_link`), hashed `rsvp_respondent` |
| Invitation | `party_invitations` | one per party; 192-bit token; design and copy; `get_invitation` public RPC |
| RSVP | `submit_rsvp(...)` RPC (service role) | idempotent per invitee, serialized per party |
| Checklist | `checklist_items` | stable task keys; links to activities |
| Plan items | `party_ai_activities`, `party_shopping_items`, `party_budget_lines` (`amount` planned, `actual_amount`), `party_timeline_items`, `party_food_items`, `party_host_content` | apply targets for AI and manual edits; dedupe indexes |
| AI usage & results | `ai_generations` | ledger + stored result; usage survives deletion (FKs set null + scrub trigger) |
| Billing | `billing_checkouts`, `billing_customers`, `billing_purchases`, `billing_webhook_events` | server-only writes; webhook idempotency ledger; checkouts and purchases carry the party (plans are per party) |
| Email | `email_logs` | daily caps across instances |
| Analytics | `analytics_events` | first-party events (allow-listed) |
| Legacy (kept, not used by current code) | `invitations` (per-guest), `activities`, `activity_favorites`, `party_activities`, `theme_preferences` | from the pre-2026 app; covered by RLS hardening |
| AI cache | `ai_cache` | used only by the legacy, unconfigured `/api/themes/ai` route |

Relationships: `users 1─* parties 1─* (guests, checklist_items, saved_venues, party_* plan items, ai_generations)`,
`parties 1─1 party_invitations`, `users 1─* billing_purchases *─0..1 parties`, `ai_generations ─0..1 parties / users`.

## Migrations

`supabase/migrations/` is the schema source of truth (applied with `supabase db push`):

| Migration | Purpose |
|---|---|
| `20251001000000_baseline_existing_schema` | Reconstructed pre-existing schema (local/CI baseline) |
| `…0100_mobile_first_core` | Location-aware parties, PostGIS venue store, cache-first discovery, saved venues, checklist, invitations, analytics, AI cache |
| `…0200_rls_hardening` | Owner-scoped RLS on every table |
| `…0300_party_theme_details` | AI theme details on parties |
| `…0400_entitlements_and_rsvp_hardening` | Server-managed entitlements, guarded columns, RSVP RPC |
| `…0500_billing` | Dodo billing tables and entitlement recompute |
| `…0600_launch_hardening` | Launch review hardening |
| `…0700_super_admin` | Roles, plan overrides, audit log |
| `20251003000800_ai_assistant` | `ai_generations`, apply-target tables |
| `…0900_ai_hardening` | `ai_finalize` service-role only, failed calls count globally, `actual_amount` |
| `20251004001000_party_experience` | Activities, timeline, host content, food |
| `…1100_rsvp_idempotency` | Respondent key, per-party serialization, change detection |
| `…1200_ai_usage_hardening` | Server-only `ai_reserve` with atomic global breaker; usage survives deletion |
| `…1300_plan_entitlements` | `has_paid_access()`; guests/invitations writes need paid access |
| `…1400_per_party_purchases` | Purchases tied to one party (`party_id`, `scope`, `unresolved_reason`), `party_plan()`, `has_paid_access(party)`, scope guard trigger, `reconcile_purchase()` |

All migrations are additive and re-runnable. Each header states deployment order constraints.

## Key flows

- **Discovery:** `/api/discovery/search` → query plan from the party → cache-first (`venue_searches`) → Places Text
  Search (field-masked) → normalise, filter, rank → cached; details/photos only for venues discovery surfaced.
- **AI:** see [ai/AI_FEATURES.md](ai/AI_FEATURES.md).
- **Billing:** `/api/billing/checkout` (plan name only) → Dodo hosted checkout → signed webhook
  `/api/webhooks/dodo` → `billing_purchases` → `recompute_entitlement` (override → purchase → trial → free).
- **RSVP:** public page → `/api/invite/[token]/rsvp` (rate-limited) → `submit_rsvp` (service role) → host
  notification + guest confirmation only when the answer actually changed.
