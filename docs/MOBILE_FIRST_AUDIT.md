# Mobile-First Audit — Magical Birthday Planner

_Audit date: 2026-10-01 · Branch: `mobile-first` · Base commit: `a73a9e2`_

This audit covers the repository as found, before the mobile-first work. It answers the ten
questions from the brief, lists what is reused, and records the minimum refactoring plan. Security
findings are summarised here and tracked in detail in [`SECURITY.md`](./SECURITY.md).

---

## 0. Baseline health

| Check | Result |
|---|---|
| `npm ci` | ✅ (2,384 packages; heavy: `n8n`, `apify-client`, `pg`, `jspdf` in runtime deps) |
| `tsc --noEmit` | ✅ passes (but `noImplicitAny: false`) |
| `next build` | ✅ passes; `/party-plan` first-load JS = **399 kB**, `/create-party` 204 kB |
| Lint | ❌ no ESLint config existed. With `next/core-web-vitals`: 85 `no-unescaped-entities`, 13 hook-deps warnings, 2 sync-script errors |
| Tests | ❌ **none** (no unit, integration, E2E, or RLS tests; only two ad-hoc shell scripts) |
| Schema source of truth | ❌ none — 12+ contradictory `.sql` files, DDL also executed from API routes via an undefined `exec_sql` RPC |

---

## 1. What already works?

- **Auth**: Supabase email/password + Google OAuth (`contexts/AuthContext.tsx`, `app/auth/callback`).
  Session is stored in `localStorage` by `supabase-js`; server routes that rely on cookies only work
  where a bearer token is also sent (`/api/parties`, `/api/guests`, `/api/user-parties` use a
  multi-strategy helper that does).
- **Party creation** (`/create-party`): 3-step form → `parties` row (child name, age, gender, date,
  ZIP, guest count, budget). Falls back through four insert strategies.
- **Party plan** (`/party-plan`): tabbed planner (overview, venue, themes, guests, timeline,
  checklist, activities/host mode, vendors & food).
- **Venue search** via `/api/venues-search` → legacy Google Places Nearby Search (real data).
- **Themes**: rich static catalogue (`data/themes-data.ts`, 108 themes with age range, keywords,
  popularity) + AI theme generation via Azure OpenAI (`/api/theme-recommendations`).
- **Guests CRUD** via `/api/guests` (authenticated, ownership-checked).
- **Activities library** (`/activities`) from a seeded `activities` table.
- PDF export (`lib/pdf-generator.ts`).

## 2. What is production-ready?

Very little, strictly speaking:

- ✅ The static theme catalogue, activity catalogue, email templates, shadcn/ui component kit.
- ✅ `/api/guests`, `/api/parties`, `/api/user-parties` (ownership checks are present).
- ⚠️ Auth works but runs two GoTrue clients (`lib/supabase-client.ts` and a cookie client in
  `SessionSync`), and the callback has an open-redirect fallback (`app/auth/callback/route.ts:233`).
- ❌ Everything touching billing/entitlements (see §8), RSVP, sharing, venue caching, and every
  debug/fix route.

## 3. What is mocked or fabricated?

| Where | What |
|---|---|
| `components/FoodTab.tsx:94-99` | Fake restaurants ("Mario's Pizza Palace", 4.8★, 555 numbers) on API failure |
| `app/api/food-vendors/route.ts:383-389` | `distance`, delivery, catering, min order are `Math.random()` |
| `app/api/venues-local/route.ts:185` | Random distances |
| `app/api/venues*/route.ts` | Silent fallback to Detroit coordinates when geocoding fails |
| `app/party-plan/page.tsx:349` | "At home" venue given `rating: 5` |
| `app/party-plan/page.tsx:747-751` | PDF export lists fake vendors |
| `components/ThemesTab.tsx:486-547` | Template themes presented as AI with `matchScore: 95` |
| `app/party-plan/page.tsx:1510-1545` | "Send invitation", RSVP update, reminders only change local state |
| `components/ModernGuestRSVP.tsx:291-328` | "Add with details" dialog is not wired |
| `app/page.tsx:365,691` | "10,000+ parents" marketing claims |
| `CakeBakeryTab`, `ShoppingSuite`, `Budget` | Mock data (and not rendered) |

The new mobile experience **never fabricates** venue data: missing ratings, photos, websites,
hours, or capacity are shown as absent.

## 4. What uses Supabase?

Tables in use (canonical base: `database/database-setup-fixed.sql` + overlays):
`users`, `parties`, `guests`, `invitations`, `party_activities`, `activities`,
`activity_favorites`, `theme_preferences`, `venues`, `venue_searches`, `venue_search_results`,
`party_venues`, `email_logs` (unused).
Used by code but **not defined in any SQL file**: `profiles`, `user_purchases`, `subscriptions`,
`invoices`, RPC `exec_sql`/`exec`.

**PostGIS is not used anywhere**; `venues` stores `latitude`/`longitude` as `DECIMAL` with a
B-tree index.

Many routes create a server client with `cookies: () => []`, which can never hold a session, so
they **always return 401**: `/api/favorites`, `/api/selected-activities`, `/api/party-activities`,
`/api/activity-full-expand`, `/api/activities/personalize`, `/api/custom-themes`, `/api/emails/*`,
`/api/rsvp/[token]` (anon client against owner-only RLS).

## 5. What uses local state / localStorage?

| Key | Purpose | In Supabase? |
|---|---|---|
| `temp_party_${id}`, `current_temp_party` | Anonymous parties | **No** — lost on clear |
| `partyData` | Wizard draft | No (draft) |
| `aiGeneratedThemes` | AI themes (global, not per party/user) | Only the id in `parties.theme` |
| `themesFavorites`, `themeGen*`, `themesTabActiveTab` | Theme UI state & favourites | No |
| `food_bookmarks_${partyId}` | Food bookmarks (write-only) | No |
| `hasPurchasedPlan`, `userSubscriptionPlan`, `userPlanPurchased`, `hasValidSubscription`, `subscriptionPurchaseDate`, `superadmin_plan` | Entitlement flags — **client-spoofable** | Partly |
| `lastCreatedParty`, `localParties`, `currentParty`, `currentPartyData` | Read-never-written / written-never-read | — |

## 6. What APIs already exist?

83 route handlers. Classification (full table in `SECURITY.md`):

- **Core, used by UI (≈30)**: `parties`, `guests`, `user-parties`, `user/*`, `venues-search`,
  `party-venue`, `food-vendors`, `theme-recommendations`, `activities*`, `favorites`,
  `selected-activities`, `party-activities`, `party/share`, `rsvp/[token]`, `check-new-user`,
  `early-access`, `auth/callback`, `webhooks/dodo`.
- **Debug / one-off fix / test (37)**: `bypass-oauth-session`, `fix-*`, `oauth-*`, `debug*`,
  `db-*`, `env-test`, `test-*`, `diagnose-user`, … — **now blocked by middleware**.
- **Unused (≈15)**: `venues`, `venues-local`, `party/create`, `party/get`, `party-data`,
  `party/guests/add`, `custom-themes`, `theme-favorites`, `emails/*`, `subscriptions/*`, `n8n/webhook`.

## 7. What can be reused?

| Asset | Reuse in mobile-first work |
|---|---|
| Next.js 14 app router, Tailwind, shadcn/ui (`components/ui/*`), `vaul` (drawer), `lucide-react`, `sonner` | Foundation of the mobile shell, bottom sheets, toasts |
| `AuthContext` | Kept as-is; mobile screens consume `useAuth()` |
| `parties` table | Extended (location, interests, setting, radius) — **not duplicated** |
| `guests` table | Mobile guest manager writes the same rows the legacy planner reads |
| `venues`, `venue_searches`, `venue_search_results` | Evolved into the cache-first discovery store (PostGIS, TTL, cache key) |
| `party_venues` | "Add to party" (the chosen venue) — same table the legacy planner uses |
| `data/themes-data.ts` | Theme cards & "recommended for your child" ranking |
| `/api/theme-recommendations` | Optional AI themes (now cached + authenticated) |
| Places API (New) request shape in `app/api/venues/route.ts` | Basis of the new typed Places client |

## 8. What should be refactored?

1. **Entitlements**: `/party-plan` replaces the whole page with a paywall for FREE users
   (`app/party-plan/page.tsx:1867`), including venue discovery. New users only get in via a 24 h
   trial and are then locked out of their own party. Plans can be self-granted
   (`/checkout-success?plan=PRO`, `PATCH /api/user/subscription`, localStorage flags). The mobile
   core flow is available to every signed-in user; entitlement checks are centralised in
   `lib/entitlements.ts` (see `RELEASE.md` for the open product decision).
2. **Venue search**: legacy Nearby Search with one call per Google type (≤10 calls/search), a cache
   that never hits (`venue_id` undefined, `.eq(null)`), photos never rendered, ZIP default `48226`.
   Replaced by `lib/discovery/*` + `lib/google/*` (Places API New, field masks, cache-first,
   context-aware query planning, ranking).
3. **Supabase client usage**: one browser client; server routes authenticate with the bearer token
   and query **as the user** so RLS applies (no service role for user data).
4. **Schema management**: a real `supabase/migrations/` directory replaces ad-hoc SQL and
   `exec_sql` API routes.
5. **Party-plan page** (3,953 lines, 399 kB): not rewritten. Mobile users get dedicated screens;
   the legacy planner stays reachable from **More → Full planner**.

## 9. What should be removed?

Removal of working functionality is out of scope. Recommended removals (not yet done, to keep this
change reviewable):

- 37 debug/fix routes (blocked now; delete after confirming nothing external calls them).
- ~10k lines of dead components: `EnhancedRSVPTracker`, `EnhancedBulkInvitations`,
  `EnhancedGuestList`, `RSVPTracker`, `BulkInvitations`, `GuestList`, `EnhancedActivitiesTab`,
  `Budget`, `ConfettiSplash`, `SpecialRequests`, `n8n/WorkflowTrigger`, `hooks/useAutoSave`,
  `data/complete-themes-data.ts`, `data/additional-themes.ts`.
- Runtime deps not used by the app: `n8n` (huge), `apify-client`, `pg` (scripts only), `dotenv`.
- Root-level fix scripts and SQL (`INSTANT_TRIAL_FIX.sql` bulk-upgrades every FREE user to PRO).
- 1,700+ tracked `.ideavo/project/**` session files (some contain the Google API key).

## 10. What is currently desktop-first?

- **Global chrome**: fixed top `Header` with icon-only items and a dropdown, no bottom navigation,
  full marketing `Footer` on every page, no safe-area handling, no `viewport`/`themeColor`, no PWA
  manifest.
- **`/party-plan`**: eight equal-width tabs that truncate on phones (`:2053-2079`); tab switching by
  `document.querySelector(...).click()`; timeline sticky header slides under the fixed header;
  `h-6 w-6` edit/delete buttons; `HostModeTab` sidebar ("👈 Click any activity in the sidebar").
- **FoodTab / ThemesTab**: `lg:grid-cols-4/7` filter panels that stack above results on mobile;
  hover-only `title=` hints on colour swatches.
- **ActivityCard**: icon-only actions relying on hover tooltips.
- **`/pricing`**: comparison `<table>`. **Homepage**: hover-to-pause ribbon, `onMouseEnter` cards.
- Mobile-acceptable today: `/rsvp/[token]`, `/create-party`, `/dashboard`, `/signin`, `/signup`.

---

## Security summary (details: `SECURITY.md`)

| Sev | Finding | Status in this branch |
|---|---|---|
| **Critical** | Live secrets committed (`.env`, `.env.local`, `vercel-env-template.txt`, `.mcprc`, docs, `scripts/fix-supabase-auth.js`, `.ideavo/**`): Supabase service role, DB password, Resend, Azure OpenAI, Google, Apify. Repo is public. | Removed from HEAD & untracked. **Rotation required** — history still contains them |
| **Critical** | `POST /api/bypass-oauth-session` mints a session for **any email** (account takeover) | Blocked (404) by middleware |
| **Critical** | Unauthenticated service-role routes run DDL / rewrite RLS (`fix-rls-policies`, `fix-database-admin`, `automated-supabase-fix`, `fix-schema-mismatch`, …) | Blocked |
| **Critical** | `users` RLS "Allow authenticated users to do everything" — any user can read/modify every user row | Migration replaces with owner-only policies |
| High | `party-venue` uses service role and trusts client `userId`/`partyId` (IDOR) | Fixed (verifies caller, queries as user) |
| High | Self-service plan upgrade (PATCH subscription, `/checkout-success?plan=`, localStorage) | Documented as production blocker |
| High | "Anyone can view shared parties" (`is_shared = true`) — enumerable child names/ages/ZIPs | Policy dropped; share/RSVP via token-scoped RPCs |
| High | Google key hard-coded in source & returned in photo URLs to browsers | Removed; photos proxied server-side |
| High | Unauthenticated paid API calls (Azure OpenAI, Google) | Discovery & AI routes require auth + rate limit |
| Medium | Predictable RSVP tokens; RSVP GET returns `parties(*)`, `guests(*)` | New invitation tokens are 32 random bytes; public RPC returns a minimal projection |
| Medium | `SECURITY DEFINER` trial functions accept any `user_id`; `user_trial_status` view bypasses RLS | Migration revokes from `authenticated` |
| Medium | Open redirect in `auth/callback` fallback | Fixed (same-origin relative paths only) |

---

## Minimum refactoring plan (what this branch does)

1. Keep the Next.js app; add **route groups**: `(site)` keeps the existing pages and URLs with the
   marketing header/footer, `(app)` is the new mobile shell, `(flow)` holds full-screen flows
   (wizard, venue detail, auth, public invite).
2. Add `supabase/` (CLI config + migrations) with a reconstructed baseline for local/CI and
   **additive, idempotent** production migrations.
3. Add `lib/google`, `lib/geo`, `lib/discovery`, `lib/planning`, `lib/analytics`, `lib/data`
   (UI-free domain logic, reusable by a future native client through the same API routes and RLS).
4. Add tests: Vitest (unit + integration + RLS against local Supabase) and Playwright (mobile E2E with
   a mocked Google backend).
