# Google Places cost control

Goal: no client — signed in or not — can make one request (or a stream of requests) turn into an
unbounded number of paid Google calls.

## Upper bounds per request

| Endpoint | Max Google calls per request | Why |
|---|---|---|
| `POST /api/discovery/search` | **≤ 8** Text Search (planned queries; config hard-capped at 16) or **≤ 10** for explicit categories (validated against the taxonomy, deduped) | each call `pageSize ≤ 20`; concurrency ≤ 8 |
| `GET /api/discovery/places/:id` | **≤ 1** Place Details, only for places discovery already surfaced; cached 7 days | arbitrary ids ⇒ 404 without calling Google |
| `GET /api/discovery/photo` | **≤ 1** Photo media, only for surfaced places; URI cached 6 h; CDN cache 6 h | |
| `GET /api/discovery/zip` | **0** for the 41,488 ZIPs in the offline dataset; otherwise ≤ 1 Geocoding with 24 h negative cache | |
| ZIP resolution inside search | 0 when the party already has coordinates (the normal case) | |

No loops call Google per result; no pagination tokens are followed; details are never fetched
during discovery.

## Bounds over time

| Control | Default | Config |
|---|---|---|
| Search cache (shared by all users at the same ~1 km cell + radius) | 24 h | `DISCOVERY_SEARCH_TTL_HOURS` |
| Details cache | 7 days | `DISCOVERY_DETAILS_TTL_DAYS` |
| Radius values | snapped to 5/10/20/30/50 mi ⇒ at most 5 cache keys per location × query | code |
| Per-user Google call budget (cache hits are free) | 60 calls / hour | `GOOGLE_USER_HOURLY_CALLS` |
| Per-instance Google call budget | 2,000 calls / hour | `GOOGLE_INSTANCE_HOURLY_CALLS` |
| Search rate limit | 20 / min / user; forced refresh 5 / h / user | code |
| Details rate limit | 60 / min / user | code |
| Photo rate limits | 240 / min / IP; 600 uncached / h / IP | code |
| ZIP lookups | 30 / min / IP; geocoding fallback budgeted per IP | code |
| AI themes (Azure) | 6 / h / user; 30-day shared cache | code |

When the budget is exhausted, discovery serves cached or stored (PostGIS) venues, or a friendly
“try again later” — it does not call Google.

**Worst case per user per hour** (cold cache everywhere, new party locations): 60 Google calls.
A user can create many parties at different locations, but every cold query still draws from the
same per-user and per-instance budgets.

## Known limitation — be explicit

The budgets and rate limits are **in-memory per serverless instance**. Vercel can run many
instances, so the fleet-wide ceiling is `instances × limits`. This is a guard against runaway clients,
not a billing guarantee. For production:

1. **Google Cloud quotas (required)**: APIs & Services → Places API (New) → Quotas: cap
   *Text Search requests per day* and *per minute*, *Place Details*, *Place Photos*; same for
   Geocoding. Add a **billing budget with alerts** (e.g. 50 %/90 %/100 %).
2. **Key restrictions**: server key restricted to Places API (New) + Geocoding; browser Maps key
   restricted to Maps JavaScript API + your referrers.
3. **Distributed limits (recommended)**: back `lib/server/rate-limit.ts` and
   `lib/server/google-budget.ts` with Upstash Redis, or add Vercel WAF rate limiting on
   `/api/discovery/*`.

## Tests

`tests/unit/google-cost-control.test.ts`, `tests/unit/places-client.test.ts`,
`tests/unit/discovery-service.test.ts`, `tests/integration/{discovery-api,security}.test.ts` cover:
normal search, empty search, invalid ZIP (422, no Google call), large radius (Google circle capped
at 50 km), invalid radius (400) and snapping, Google timeout, quota, malformed JSON / unexpected
shapes, duplicates, missing fields, ≤ maxQueries calls per discovery, per-user budget exhaustion
with fallback, cache hits not consuming budget, details budget, details refused for unknown places.
