# Magical Holidays — Technical Architecture

Companion docs: [audit](MAGICAL_HOLIDAYS_ARCHITECTURE_AUDIT.md) · [product](MAGICAL_HOLIDAYS_PRODUCT_REQUIREMENTS.md) ·
[providers](MAGICAL_HOLIDAYS_PROVIDER_COMPARISON.md) · [launch checklist](MAGICAL_HOLIDAYS_LAUNCH_CHECKLIST.md).

## Shape

Same repository, same Supabase project, same auth and Dodo account as Magical Birthday Planner. Magical Holidays is
served by a **second Vercel project** from this repo with `NEXT_PUBLIC_BRAND=holidays` on its own domain. The birthday
site is unaffected (its build keeps `NEXT_PUBLIC_BRAND` unset → `birthday`).

```
Parent browser ──(Bearer JWT)──► Next.js /api/santa/*  ──service role──► Supabase (santa_* ledger, RPCs)
     │                                   │  mint session (API key, server only)
     │                                   ▼
     └──── WebRTC (LiveKit) ◄──── Avatar provider (LiveAvatar FULL) ──► POST /api/santa/llm (OpenAI-compatible,
                                         streaming)                         our prompt + phase cue + safety filter
                                                                              └─► Azure OpenAI (existing integration)
Vercel cron ─► /api/cron/santa (reaper: stop stale sessions at the provider, settle, close expired visits)
```

Media never passes through our servers. Our servers: authorise, mint short-lived credentials, own the prompt and
the LLM turn, and settle usage.

## Code layout

| Path | Purpose |
|---|---|
| `lib/brand/` | Brand registry (`birthday`, `holidays`): names, wordmark, colours, icons, metadata, manifest, email sender name |
| `lib/santa/persona.ts` | Prompt layers (personality / safety / child data), visit phases, greeting, child profile schema |
| `lib/santa/providers/types.ts` | `SantaAvatarProvider` interface |
| `lib/santa/providers/{liveavatar,tavus,mock}.ts` | Vendor adapters (only place vendor APIs appear) |
| `lib/santa/server.ts` | Start/end session orchestration over the RPCs; error mapping |
| `app/api/santa/children` | CRUD for child profiles (zod-validated) |
| `app/api/santa/consent` | Record versioned parental notice/consent |
| `app/api/santa/sessions` | `POST` start (preview or visit) → join info; `POST /:id/connected`; `POST /:id/end`; `GET /:id` |
| `app/api/santa/llm/chat/completions` | Provider-facing LLM endpoint (bearer secret), streams SSE |
| `app/api/santa/checkout` + Dodo webhook branch | Santa visit purchase |
| `app/api/cron/santa` | Reaper |
| `app/api/admin/santa` | Ops: stats, settings (kill switch, caps) |
| `app/(holidays)/…` | Landing, setup, preview, visit, dashboard pages |
| `supabase/migrations/20251122002400_santa_calls.sql` | Data model + RPCs |

## Data model (migration `20251122002400_santa_calls`)

`santa_settings` (kill switch, preview switch, concurrency cap, daily caps, preview length/count, min charge seconds,
recovery window) · `santa_checkouts` · `santa_orders` (visits granted, seconds per visit) · `santa_children` ·
`santa_consents` (notice version, affirmations, method) · `santa_visits` (budget, used, recover_until, status) ·
`santa_sessions` (kind preview|visit, provider session, max_seconds, connected/ended, billed seconds, cost, reason).

RLS: owners read their rows; **all writes are server-only**; all RPCs are service-role only.
`santa_start_session` is atomic (per-user + global advisory locks) and enforces: kill switch, one live session per
parent, child ownership, consent for the current notice version, concurrency cap, daily caps, preview limits, and
credit (FIFO across orders). It sets each session's `max_seconds` to the visit's remaining time.
`santa_end_session` is idempotent and settles the visit (drop → resumable; time up / parent end → completed, or
voided if under the charge threshold). Tested in `tests/integration/santa-ledger.test.ts`.

Separate from `billing_purchases` on purpose: that table's plan check, per-party scope trigger and entitlement
functions drive the live birthday product and stay untouched.

## Session lifecycle

1. `POST /api/santa/sessions {childId, kind}` — auth → rate limit → `santa_start_session` → provider
   `createSession` with: avatar, voice, our LLM configuration, the composed prompt for this session (or a per-session
   context), greeting, `max_session_duration = max_seconds` → `santa_attach_session` → returns `SantaJoinInfo`.
   Any provider error → `santa_end_session(failed, provider_error)` (no charge) and a friendly retry message.
2. Browser joins via the provider SDK. On first remote video frame → `POST …/connected`. The server also treats the
   **first LLM turn** for the session as connection evidence (whichever is earlier), so a client cannot delay the
   start of counting.
3. Every LLM turn (`/api/santa/llm`): verify provider bearer secret → resolve session → reject if the session is not
   live or past its cap → build messages: system prompt + `phaseCue(visitPhase(elapsed, max))` + the conversation →
   Azure OpenAI streaming → output safety filter (no URLs/contact requests; fallback line on violation) → stream back.
   Children's words are never logged; only token counts and latency.
4. End: parent *End visit* → `POST …/end` → provider `endSession` → `santa_end_session(ended, parent_ended)`.
   Cap reached → provider ends it (hard cap) and the browser reports `time_up`; the reaper settles anything left.
   Drop → `dropped`, visit resumable for 30 min. Max 4 reconnects per visit.
5. Reaper (every minute): `santa_stale_sessions()` → provider `endSession` + `getUsage` → settle; then
   `santa_close_expired_visits()`; alerts if provider-reported time exceeds ours.

## Security

- Provider API keys and the LLM bearer secret are server-only (`check:secrets` enforces no `NEXT_PUBLIC_`).
- Browser gets only single-session, short-lived credentials.
- Paid access decided only by the ledger; URL/localStorage flags never grant anything.
- Purchases: Dodo hosted checkout, signed webhook, idempotent on webhook id and on `(provider, provider_ref)`;
  product id → pack from server config only.
- Duration enforced by the provider's max duration + our LLM refusing turns past the cap + reaper.
- Kill switch and caps in `santa_settings` (admin UI), plus env master switch `SANTA_ENABLED`.
- `Permissions-Policy` changes to allow `camera`/`microphone` for `self` on the Holidays deployment only.

## New environment variables (server-only unless noted)

`NEXT_PUBLIC_BRAND` (public; `birthday` | `holidays`) · `SANTA_ENABLED` · `SANTA_PROVIDER` (`liveavatar` | `tavus` |
`mock`) · `LIVEAVATAR_API_KEY` · `LIVEAVATAR_AVATAR_ID` · `LIVEAVATAR_VOICE_ID` · `LIVEAVATAR_LLM_CONFIGURATION_ID` ·
`SANTA_LLM_SECRET` (bearer the provider uses to call `/api/santa/llm`) · `SANTA_LLM_MODEL` (Azure deployment) ·
`TAVUS_API_KEY` · `TAVUS_PERSONA_ID` · `TAVUS_WEBHOOK_SECRET` · `DODO_PRODUCT_SANTA_VISIT` ·
`DODO_PRICE_SANTA_VISIT_CENTS` (default 999) · `SANTA_SECONDS_PER_VISIT` (default 600).

## Critical path (to Dec 1)

| Day | Track A — Santa engine (critical) | Track B — product | Owner actions |
|---|---|---|---|
| Nov 22 | Audit, architecture, ledger, persona ✅ | | Domain; LiveAvatar account; vendor child-use questions |
| Nov 23 | LiveAvatar PoC: Santa image avatar, voice, custom LLM loop, mobile Safari | Brand registry, Santa icons | Legal counsel engaged |
| Nov 24 | Provider adapter + sessions API + LLM route + reaper | Landing page | Dodo product $9.99 |
| Nov 25 | Call UI (permissions, autoplay, reconnect) | Setup flow (3 steps) + consent | |
| Nov 26 | Preview flow; Dodo Santa checkout + webhook | Dashboard | Privacy notice text approved |
| Nov 27 | Safety red-team suite (live) + fixes | Admin ops panel, analytics | |
| Nov 28–29 | E2E, real devices, load (concurrency) | Polish | Real-device testing help |
| Nov 30 | Staging sign-off, rollback plan | | Launch approval |
| Dec 1 | Launch with conservative caps; watch cost & failures | | |

Decision point **Nov 24 noon**: if the LiveAvatar PoC is not working on iPhone Safari with acceptable latency, switch
the adapter to Tavus (Growth/Business plan, concurrency ask) — the rest of the stack is provider-agnostic.
