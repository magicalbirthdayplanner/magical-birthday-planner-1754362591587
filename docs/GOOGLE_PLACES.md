# Google Places integration

## APIs and keys

| Key | Where | APIs | Restrictions |
|---|---|---|---|
| `GOOGLE_PLACES_API_KEY` | **server only** (route handlers) | Places API (New), Geocoding API | Restrict to these two APIs; restrict by server IP if your host allows |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | browser (map tiles only) | Maps JavaScript API | **Separate key**, restricted to Maps JavaScript API + your HTTP referrers |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | browser | Map ID for Advanced Markers | optional (`DEMO_MAP_ID` used otherwise) |

The server key never reaches the browser:

* Requests send it in the `X-Goog-Api-Key` header, never in a URL.
* Photos are served through `GET /api/discovery/photo?name=…&w=…`, which calls
  `…/media?skipHttpRedirect=true` and 302-redirects to the short-lived `googleusercontent.com`
  URL (no key). It only serves photos of places we have surfaced, is rate-limited, and is cached
  6 h at the edge.
* `npm run check:secrets` fails if any server secret value is present in `.next/static`.

> The previous integration hard-coded a key in `lib/google-places.ts` and returned
> `…/media?key=…` URLs to browsers (`/api/venues`, `/api/food-vendors`). Those are fixed, but the
> key is in git history: **rotate it**.

## Calls and cost control

| Call | When | Field mask / SKU | Cached |
|---|---|---|---|
| Text Search (New) | Discovery, per planned category (≤ 8) | id, displayName, formattedAddress, shortFormattedAddress, addressComponents, location, types, primaryType(+DisplayName), rating, userRatingCount, priceLevel, photos, businessStatus, googleMapsUri — *Text Search Enterprise* (rating/price) | `venue_searches` 24 h, keyed by query + ~1 km rounded location + radius |
| Place Details (New) | Only when a parent opens a venue | adds nationalPhoneNumber, websiteUri, regularOpeningHours, editorialSummary, goodForChildren, goodForGroups — *Enterprise + Atmosphere* | `venues.details_synced_at` 7 days |
| Place Photo | When an image is rendered | — | in-memory URI cache 6 h + `Cache-Control` |
| Geocoding | Only for ZIPs missing from the offline dataset | — | stored on the party |

Rules implemented in `lib/discovery/service.ts`:

* **Search → rank → fetch details only on demand.** No details calls during discovery.
* **Dedupe by place id** within a response (Google can repeat a place) and across queries.
* **Same location ⇒ same cache key** — parents in the same ZIP share cached searches.
* **Vendors on demand** (chip), not on every discovery.
* **Stale-if-error**: expired cache is served when Google fails.
* **Rate limits** (per instance): discovery 20/min/user, manual refresh 5/h/user, details 60/min/user,
  photos 240/min/IP, ZIP 30/min/IP.
* `DISCOVERY_MAX_QUERIES` (default 8) caps calls per cold discovery.

Rough cold-cache cost per new party location: 8 Text Search calls + photos for visible cards;
warm cache: 0 Google calls. Check current prices on the Google Maps Platform pricing page — Text
Search with rating/price fields bills at the Enterprise tier.

## Configuration

```bash
DISCOVERY_SEARCH_TTL_HOURS=24      # search cache freshness
DISCOVERY_DETAILS_TTL_DAYS=7       # place details freshness
DISCOVERY_MAX_QUERIES=8            # Text Search calls per cold discovery
DISCOVERY_CONCURRENCY=4            # parallel Google calls
DISCOVERY_RANKING_WEIGHTS='{"relevance":0.3}'
GOOGLE_PLACES_API_BASE_URL=…       # tests point this at the mock server
GOOGLE_GEOCODING_API_BASE_URL=…
```

## Metrics

Every search logs structured lines (`type: "metric"`) and writes one `venue_search_completed`
server event to `analytics_events` with: `results`, `cacheHits`, `cacheMisses`, `apiCalls`,
`apiErrors`, `latencyMs`, `degraded`, `radiusMiles`. Errors write `venue_search_failed {kind}`;
per-call `places_search` / `places_error` / `places_details` metrics go to logs.

```sql
-- cache hit rate and latency, last 7 days
select date_trunc('day', created_at) d,
       sum((properties->>'cacheHits')::int)::float
         / nullif(sum((properties->>'cacheHits')::int + (properties->>'cacheMisses')::int), 0) hit_rate,
       percentile_cont(0.5) within group (order by (properties->>'latencyMs')::int) p50_ms,
       sum((properties->>'apiErrors')::int) api_errors
from analytics_events where event = 'venue_search_completed' and created_at > now() - interval '7 days'
group by 1 order by 1;
```

## Terms-of-service notes (needs legal review before launch)

* **Maps**: Places content shown on a map must be shown on a Google map. Production must set
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; the schematic map is a dev/CI fallback only.
* **Attribution**: list views show “Place data © Google Maps”; every photo shows its author
  attribution; detail pages say “Details from Google Maps”.
* **Caching**: Google permits storing place IDs indefinitely; other Places content has limited
  caching rights. The 24 h / 7 day TTLs are configurable, and
  `select public.purge_stale_places_content(30);` deletes stale searches and unreferenced venues —
  schedule it daily (pg_cron or a Vercel cron). Confirm the TTLs with counsel.

## Mock server (CI / E2E)

`tests/mock-google/server.mjs` implements Text Search, Place Details, Photo media and Geocoding with
fictional, deterministic places generated around the requested location — including a duplicate,
a place without photo/rating/address/website, a permanently closed place and an out-of-radius place.
`POST /__mock/mode {"mode":"quota"|"timeout"|"error"|"empty"|"ok"}` switches failure modes.
