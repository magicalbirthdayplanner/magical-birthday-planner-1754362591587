# Local Discovery

The core differentiator: a parent enters their child, ZIP, guests, budget, vibe and interests,
and **immediately** gets ranked local party places — no searching required.

```
wizard (ZIP validated live) ──▶ parties row (lat/lng stored)
                                     │
/discover opens ──▶ POST /api/discovery/search { partyId }
                                     │  (auth: bearer token; party loaded AS THE USER → RLS)
                                     ▼
              planQueries(party)  ── 8 context-aware Places queries
                                     │
          per query: cache fresh? ──yes──▶ cached venues (Supabase)
                         │ no
                         ▼
            Places Text Search (New) ──▶ normalize ──▶ dedupe ──▶ store (venues + cache)
                         │ error
                         ▼
            stale cache (stale-if-error) ──▶ else PostGIS venues_near() ──▶ else friendly 503
                                     │
                 merge by place id ─▶ rankVenues() ─▶ client payload (photo proxy URLs)
```

## Code map

| Concern | File |
|---|---|
| ZIP → coordinates (offline dataset + Google fallback) | `lib/geo/zip.ts`, `data/geo-us-zips.json`, `lib/google/geocoding.ts` |
| Distance, projection, clustering | `lib/geo/distance.ts`, `lib/geo/cluster.ts` |
| Taxonomy (41 categories, interests, age bands, chips) | `lib/discovery/taxonomy.ts` |
| Which searches to run for a party | `lib/discovery/query-plan.ts` |
| Ranking engine (configurable weights) | `lib/discovery/ranking.ts` |
| Orchestration (cache-first, fallbacks, metrics) | `lib/discovery/service.ts` |
| Storage interface + memory impl / Supabase impl | `lib/discovery/store.ts`, `lib/discovery/supabase-store.ts` |
| Client filters & chips | `lib/discovery/filters.ts` |
| API routes | `app/api/discovery/{zip,search,places/[placeId],photo}` |
| UI | `components/discover/*`, `app/(app)/discover`, `app/(flow)/venue/[placeId]` |

Everything under `lib/` is UI-free and reusable by a future native client (same API routes, same RLS).

## ZIP → location

1. `normalizeZip()` accepts `48084`, `48084-1234`; rejects anything else.
2. Offline lookup in `data/geo-us-zips.json` — 41,488 US ZIPs (incl. PO-box ZIPs, territories) from
   [GeoNames](https://www.geonames.org) (CC BY 4.0, attribution in **More → About**). Free, instant,
   deterministic, and permanently storable.
3. Only for a valid-looking ZIP missing from the dataset: Google Geocoding
   (`components=postal_code:XXXXX|country:US`).
4. The wizard validates live (`GET /api/discovery/zip`) and shows “📍 Troy, MI”; coordinates, city
   and state are stored on the party, so discovery never geocodes again. Nothing is hard-coded to 48084.

## Context-aware query planning

`planQueries()` scores each venue category against the party:

* **Interest match** +4 (+1 per extra matched interest, + specificity bonus so an *art studio*
  beats a catch-all *activity center* for an art lover)
* **Age fit** +1 inside the category’s age range, −1 one year outside, dropped beyond that
  (no laser tag for toddlers)
* **Setting** +1 match; categories of the opposite setting are dropped (indoor party ⇒ no parks)
* Generic categories are kept but ranked behind specific matches
* “kids birthday party venue” is always searched first

The top `DISCOVERY_MAX_QUERIES` (default 8) are run. Example — Ava, 7, Art, either:
`birthday-party-venue, art-studio, pottery-studio, childrens-museum, kids-activity-center, …`

Vendors (bakeries, cake shops, decorators, rentals, photographers, face painters, magicians,
entertainers, DJs, caterers) are **not** searched up front — only when the parent taps the
*Cakes & vendors* chip (cost control).

## Ranking

`score = Σ wᵢ·fᵢ / Σ wᵢ`, every factor in [0, 1]. Unknown data scores a neutral 0.5 — it is never
treated as good or bad.

| Factor | Default weight | How |
|---|---|---|
| relevance | 0.27 | interest match 1.0 · “party venue” 0.7 · kid-oriented 0.6 · other 0.35 (+0.1 if Google says good for children) |
| distance | 0.20 | `1 − (d/radius)^0.8` |
| rating | 0.18 | Bayesian average (prior 4.2, weight 15) so a 5.0★ with 3 reviews doesn’t beat 4.7★ with 900 |
| age | 0.10 | best category age fit |
| setting | 0.09 | indoor/outdoor vs the party’s vibe |
| reviews | 0.08 | `log10(1+n)/log10(2001)` |
| capacity | 0.04 | known capacity ≥ guests; Google “good for groups” for 10+; else neutral |
| budget | 0.04 | Google price level vs expected level for $/guest (<$15 → $, <$35 → $$, <$70 → $$$) |

Permanently closed places are removed; temporarily closed are ×0.3. Places outside the radius are
removed (Text Search only *biases* toward the circle).

**Override weights** without a deploy-time code change:

```bash
DISCOVERY_RANKING_WEIGHTS='{"distance":0.3,"rating":0.25}'
```

### Reasons & tags — facts only

“Why we recommend it” and card tags are generated from data we actually have: matched interest,
Google rating ≥ 4.3 with ≥ 25 reviews, distance, Google’s `goodForChildren` / `goodForGroups`,
category age range, setting, price level vs budget. Capacity (“Good for 10–20 guests”) is shown
**only** when known — Google does not publish it, so it is normally absent.

## Filters & chips (client-side)

Radius (5/10/20/30/50 mi — changing it re-queries and is saved on the party), venue type, rating
(4+/4.5+), price ($–$$$$), age band, party size, interest; chips Recommended · Indoor · Outdoor ·
Art · Sports · Play · Museums · Parks · Budget · Cakes & vendors. Filters on missing data exclude
that place (e.g. a price filter hides places without a published price) and say so in the sheet.
View (list/map) and filters persist in `localStorage`.

## Error handling

| Situation | User sees |
|---|---|
| Invalid / unknown ZIP | inline wizard error; on Discover a link to fix the ZIP |
| Google quota / outage / timeout, nothing cached | “Place search is taking a break” + Try again |
| Google failing, cache exists | results + “Showing recently found places” notice |
| Zero results | “No places within N miles” + one-tap wider search |
| Offline | offline banner + offline error state |
| Session expired | redirect to sign-in with “Your session expired” |
