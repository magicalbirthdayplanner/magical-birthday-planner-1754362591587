# Testing

| Layer | Tool | Location | Needs | Count |
|---|---|---|---|---|
| Unit | Vitest | `tests/unit` | nothing | 156 |
| Integration (RLS, security, billing, email, API routes) | Vitest + supabase-js | `tests/integration` | local Supabase | 112 |
| E2E (mobile) | Playwright (Chromium, mobile emulation) | `tests/e2e` | local Supabase; starts mock Google/Resend/Dodo + a production build | 21 |

Google is **always mocked** in tests (`tests/mock-google/server.mjs` or injected fakes). No test
calls real Google, OpenAI or Resend. Integration tests refuse to run against a non-local Supabase URL.

## Run

```bash
npm ci
npm run db:start && npm run db:reset     # Docker; first start pulls images
npm test                                 # unit
npm run test:integration                 # RLS + API (spawns mock Google on :4011)
npx playwright install chromium
npm run test:e2e                         # builds into .next-e2e with .env.e2e, serves on :3101
npm run check                            # lint + typecheck + unit + build + client secret scan
```

`.env.e2e` holds only the public demo keys of the local Supabase stack and blanks every production
secret, so nothing in an untracked `.env` can leak into tests.

## What is covered

**Unit** — ZIP normalization & dataset lookup (arbitrary ZIPs, fallback geocoder), haversine,
taxonomy integrity, context-aware query plans (art 7-year-old, indoor-only, outdoor toddler),
ranking (Bayesian rating, interest beats rating, not a rating sort, closed/out-of-radius, setting
penalty, neutral unknowns, fact-only reasons, configurable weights), Places client (field mask,
key never in URL, **success, no results, timeout, quota, auth/400/503, network, missing key**,
photo URI without redirect, path-traversal rejection), normalization (**missing photos, rating,
website, address, price**; malformed photo names), discovery service (cache hit/miss/TTL,
stale-if-error, stored-venue fallback, typed failures, **duplicate places**, radius filter, vendor
on-demand, metrics), filters & chips, map clustering/projection, wizard validation & drafts,
checklist generation/buckets/DST/state-aware, progress & next action, theme recommendations
(word-boundary matching), AI theme parsing, analytics catalogue & PII stripping, debug-route
blocking.

**Integration** — RLS: User A/B/anon across `parties`, `guests`, `saved_venues` (+ private notes),
`checklist_items`, `invitations`, `party_invitations`, `users`; cross-party inserts; shared-party
enumeration; catalogue/cache write protection; trial RPCs revoked; public invitation projection and
RSVP. API: discovery auth, ownership, ranked/deduped results, no key in payload, Supabase cache
hits on repeat, quota mapping, vendors, details fetched once, photo proxy, ZIP endpoint;
hardened `/api/party-venue`.

**E2E** (`iphone-390` project unless noted)
1. `required-flow.spec.ts` — the exact spec flow and Definition of Done: open site → create account
   → party (age 7, ZIP 48084, 20 guests, $500, Art, Either) → automatic discovery with “We found N
   party options near you” → art places ranked first → open venue → save → map, tap marker →
   view persisted → saved venue persists after reload (+ private note) → theme selected → guest
   added → checklist (auto-completed theme task) → invitation link copied → public RSVP appears on
   the guest list → reload → new browser session continues planning.
2. `error-states.spec.ts` — auth redirect & return, wrong password, invalid ZIP (format + unknown),
   Google quota with retry recovery, Google down with stored venues (graceful degradation), zero results within radius, empty saved/guests, offline banner,
   unknown invitation, debug/account-takeover routes return 404.
3. `viewports.spec.ts` (375, 390, 393, 430 px) — 10 screens + map: no horizontal overflow, bottom
   nav targets ≥ 44 px, map markers render; screenshots in `test-results/viewports/`.

Bugs the suites caught (all fixed): build failed without `RESEND_API_KEY`; duplicate places broke
cache writes; checklist missed milestones done before it existed; ~1.8k px page width on phones
(unclipped skeleton, `sr-only` inside scrollers); theme “Loves art” on Minecraft/Pool Party;
`slugify` mangled accents.

## Not covered (manual QA needed)

* Real iPhone Safari / Android Chrome devices (Playwright here is Chromium mobile emulation;
  WebKit isn’t installed in this environment). See the device checklist in `RELEASE.md`.
* Google Maps JS map (needs a browser key) — the schematic fallback is what E2E exercises.
* Real Google OAuth round-trip; email confirmation flows; AI theme generation against Azure.
* Legacy `(site)` pages beyond smoke-level (they have no tests; behaviour unchanged except the
  security fixes noted in `SECURITY.md`).

## Release-gate security tests (added)

* `tests/integration/security.test.ts` — explicit User A/B matrix (read/update/delete/insert-as-other
  for parties, guests, saved venues, private notes, invitations), entitlement self-grant attempts,
  invitation token strength/projection/rotation, RSVP route isolation + rate limit, discovery input
  validation, error-leak checks.
* `tests/unit/google-cost-control.test.ts` — malformed Google responses, radius capping/snapping,
  per-request and per-user Google call budgets.
* `tests/unit/redirect.test.ts` — open-redirect protection.
* `tests/unit/blocked-routes.test.ts` — debug + insecure legacy routes blocked, path variants.
* `tests/e2e/mobile-regression.spec.ts` — full journey incl. filters, compare, logout/login at
  375/390/393/430 px with an overflow check at every step.
* `scripts/scan-git-history-secrets.mjs` — masked history secret scan; `npm run check:secrets` —
  client bundle scan.
