# Observability (Sentry)

Sentry is the only observability platform: errors, tracing, structured logs, metrics, AI monitoring, uptime and
alerts. Org `magical-birthday-planner`, project `javascript-nextjs` (US region).

## Setup

| File | Purpose |
|---|---|
| `instrumentation-client.ts` | Browser init + App Router navigation spans |
| `sentry.server.config.ts` | Node.js init (the app has no edge code) |
| `instrumentation.ts` | Loads the server config; `onRequestError` sends uncaught route/RSC/server-action errors |
| `next.config.js` | `withSentryConfig`: source-map upload at build time, maps deleted from the output |
| `lib/observability/sentry-options.ts` | Shared options: sampling, privacy (`dataCollection`), scrubbing hooks |
| `lib/observability/privacy.ts` | Scrubbers for events, breadcrumbs, spans, logs and metrics |
| `lib/observability/telemetry.ts` | The only API the app uses: `track`, `timing`, `reportError`, `reportDbError`, `withSpan`, `safeId` |
| `lib/observability/{ai,billing,auth,google}.ts` | Domain telemetry (metadata only) |

### Environment variables

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Production (+ Preview if wanted) | Public by design (send-only). Empty → Sentry off everywhere |
| `SENTRY_DSN` | optional | Server override; defaults to the public DSN |
| `SENTRY_AUTH_TOKEN` | Production **build** (Vercel "Sensitive") | Source-map upload only. Never `NEXT_PUBLIC_`. Empty → no upload, build still succeeds |
| `SENTRY_ORG` / `SENTRY_PROJECT` | optional | Default `magical-birthday-planner` / `javascript-nextjs` |

Source maps: uploaded by the build, then deleted (`deleteSourcemapsAfterUpload`), so no `.map` is served and no
`sourceMappingURL` remains in `/_next/static`. `npm run check:secrets` fails on any public `.map`, a Sentry token
literal, or a server secret value in the client bundle.

## Fail-safety

Every telemetry function catches its own errors and never awaits the network. No DSN → the SDK is disabled and calls
are no-ops. E2E (38 tests) passes with the SDK enabled and its endpoint unreachable. `withSpan` runs the wrapped
work exactly once even if Sentry throws.

## What becomes an issue (and what doesn't)

Issues (`reportError`, tagged `area` + `op`): uncaught server errors (`onRequestError`), React/route/global error
boundaries, API 5xx catch sites, AI provider failures / rate limits / timeouts, AI post-processing bugs, AI usage
recording failures, Dodo webhook processing/config failures, unmatched paid events, payments held for price review,
checkout creation failures, Google Places auth/quota/outage, Maps JS load failure, auth 5xx, database failures
(party/guest create, RSVP, invitations, admin override, discovery).

Never issues (metrics/logs only): 401/403/404, validation, rate limits, plan limits, wrong password, unconfirmed
email, expired links, offline clients, client aborts, a single invalid AI answer, card declines.

## Metrics

Counters carry low-cardinality attributes only (feature, plan, provider, model, status…). Request ids and a hashed
party id appear only on logs/spans.

- **AI:** `AI_REQUEST_STARTED|SUCCEEDED|FAILED|TIMEOUT|RETRIED|VALIDATION_FAILED|LIMIT_REACHED`, `AI_POST_PROCESSING_FAILED`,
  `ai.limit.party|user|global` (the global breaker also raises a warning issue `ai-global-limit`), `ai.reserve.unauthorized`
  (server-side reservation refused for a party the user doesn't own; also a warning issue);
  distributions `ai.latency`, `PLAN_MY_PARTY_LATENCY`, `THEME_IDEAS_LATENCY`, `AI_CHECKLIST_LATENCY`, `ai.tokens.input`,
  `ai.tokens.output`, `ai.estimated_cost_usd`. Each model call is a `gen_ai.chat` span (Sentry AI monitoring) with
  model, usage, attempts, retry count, failure category and `mbp.ai.estimated_cost_usd`. Token counts the provider
  didn't report are `unknown`, never invented. Cost is an **estimate** from the published DeepSeek V4 Pro prices
  (peak/off-peak); unknown models get no estimate.
- **Dodo:** `CHECKOUT_STARTED|FAILED`, `CHECKOUT_LATENCY`, `WEBHOOK_RECEIVED|PROCESSED|DUPLICATE|INVALID_SIGNATURE|PROCESSING_FAILED`,
  `PAYMENT_PROCESSING|SUCCEEDED|FAILED|CANCELLED`, `REFUND_SUCCEEDED|FAILED`, `dodo.webhook.latency`. Attributes: plan,
  product id, event type, outcome, environment (live/test). Never the payload, customer, card or secrets.
- **Auth:** `AUTH_LOGIN_FAILED`, `AUTH_SIGNUP_FAILED`, `AUTH_PASSWORD_RESET_FAILED`, `AUTH_GOOGLE_SIGNIN_FAILED`,
  `AUTH_CALLBACK_FAILED`, `AUTH_SESSION_ERROR` with Supabase's error code, status and category (expected/network/system).
- **Google:** `GOOGLE_PLACES_REQUEST|SUCCESS|FAILURE`, `GOOGLE_PLACES_LATENCY` (operation search/details/photo/geocode,
  status class, result count), `GOOGLE_MAPS_LOAD_FAILED`.
- **Database:** `DB_ERROR` (operation + Postgres code).

## Privacy

`dataCollection` turns off user info, cookies, headers, bodies, query strings, AI inputs/outputs, DB query data and
stack-frame variables. Session Replay is not installed. Scrubbers remove URL query strings and fragments (Supabase
tokens), invite tokens in paths, emails, JWTs, bearer tokens, API keys and phone/card-like numbers from every event,
breadcrumb, span, log and metric; console breadcrumbs are dropped. Project settings: server-side data scrubber on,
IP addresses scrubbed, extra sensitive fields (email, phone, address, prompt, notes, child_name, guest_name…).

## Alerts (Sentry Monitors, environment `production`)

All are connected to the alert "MBP production monitors → email" (emails active members, at most every 30 min).

| Priority | Monitor | Condition |
|---|---|---|
| P0 | Server error spike | > 10 error/fatal events in 1 h |
| P0 | Dodo webhook failures | any `area:billing op:webhook_processing|webhook_config` event in 5 min |
| P0 | AI provider unavailable | ≥ 3 `area:ai op:ai_call level:error` in 15 min |
| P0 | Auth system failure | ≥ 5 `area:auth` events in 15 min |
| P0 | Uptime `GET /api/health` | every 5 min, down after 3 failures |
| P1 | AI failure rate elevated | `failure_rate()` of `gen_ai.chat` spans > 25 % in 1 h |
| P1 | AI timeouts elevated | ≥ 4 AI timeout/rate-limit warnings in 1 h |
| P1 | Checkout failures elevated | ≥ 3 checkout failures in 1 h |
| P1 | Google Places failures | ≥ 6 in 1 h |
| P2 | AI latency elevated | p95 `gen_ai.chat` > 45 s over 1 h |
| P2 | Unusual AI usage | > 40 model calls in 1 h |
| P2 | Repeated database errors | ≥ 4 in 1 h |

Plus Sentry's default "high priority issues" email alert for any new high-priority issue. Card declines are
deliberately not alerted (customer behaviour, visible in Dodo and the `PAYMENT_FAILED` metric).

## Health

`GET /api/health` → `200 {"status":"ok","service":"magical-birthday-planner"}`. No database, AI, Google or payment
calls and no environment details. Monitored by Sentry Uptime.
