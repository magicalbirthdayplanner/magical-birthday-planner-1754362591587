# Real-time Santa — provider comparison

Researched 2026-11-22 from official docs, pricing and legal pages. Items marked **[unverified]** were not confirmed
from official sources and must be confirmed in the proof of concept (PoC) or with the vendor.

## Summary

| | HeyGen **LiveAvatar** (FULL mode) | **Tavus** CVI | **D-ID** Agents |
|---|---|---|---|
| Browser transport | LiveKit (WebRTC), `@heygen/liveavatar-web-sdk` | Daily (WebRTC), `@daily-co/daily-js` / `@tavus/cvi-ui` | `@d-id/client-sdk` (WebRTC) |
| Server session API | `POST /v1/sessions/token` (X-API-KEY) → browser `/v1/sessions/start`; `/v1/sessions/stop` | `POST /v2/conversations` → `conversation_url` + JWT `meeting_token` (`require_auth`); `/v2/conversations/{id}/end` | `POST /v2/agents/{id}/sessions` / client key **[duration controls undocumented]** |
| Server-set max duration | `max_session_duration` (Essential ≤ 20 min, Business ≤ 60 min) | `max_call_duration` (Builder ≤ 15 min) | **[undocumented]** |
| Custom Santa look | From one image (no consent video per docs; image endpoint is **alpha**); or 2-min video + consent video | Photo → usable in ~1 min (watermarked), clean after a few hours; or 30 s + 30 s video; text-to-face | 1-min video + consent passcode |
| Custom voice | Stock, clone, ElevenLabs/Cartesia/Fish | Cartesia / ElevenLabs incl. private clones | ElevenLabs / Azure |
| Own LLM | Any OpenAI-compatible `/chat/completions` (`llm_configuration_id`) | Any streaming OpenAI-compatible endpoint; tools; guardrails API | Custom LLM (own body shape) |
| Webhooks | **None documented** | HMAC-SHA256 `X-Tavus-Signature`; shutdown reason | None documented |
| Data retention | FULL keeps transcripts (deletable via API); LITE keeps none | Recording off by default; **ZDR on Enterprise** | **[unverified]** |
| Concurrency | "Unlimited" on paid tiers | Builder 3 · Growth 10 · Business 15 · Enterprise custom | **[unpublished]** |
| Price | Essential $99 / 1,100 credits; Business $475 / 6,000; overage ≈ $0.09–0.095/credit; FULL = 2 credits/min → **≈ $0.18–0.19/min** | Overage $0.35 / $0.31 / $0.26 per min (+ $59 / $397 / $975 per month); 30 s minimum per call | ≈ $0.35–0.56/min **[3rd-party]** |
| Latency claim | < 300 ms to first frame | ~600 ms reply | sub-0.5 s |
| Child users in terms | Terms: users 18+; privacy: services "not intended for minors under 18" | Privacy: not for under-18 use; ToS puts end-user consent (incl. biometric) on the customer | Users 18+; "do not offer … for use by children" |

**OpenAI Realtime** (`gpt-realtime-2.1`, WebRTC with ephemeral `ek_` keys) has no avatar and no server-side max duration
we could find. Its API policy forbids processing data of children under 13 without **Zero Data Retention** (approved
per account). It can drive LiveAvatar LITE through LiveAvatar's hosted connector (OpenAI stock voices only).

## Cost per 10-minute visit (worst case: full 10 minutes)

| | LiveAvatar FULL | Tavus Growth | Tavus Business |
|---|---|---|---|
| Avatar + voice + speech | $1.80–1.90 | $3.10 | $2.60 |
| Our LLM (Azure, small model) | < $0.10 **[estimate]** | (own LLM or Tavus default) | same |
| Free previews (≈ 60 s, ~1.3 per previewing parent, ~35 % convert) | ≈ $0.70 per purchase | ≈ $1.15 | ≈ $0.97 |
| Reconnects/failed sessions (+10 %) | ≈ $0.19 | ≈ $0.31 | ≈ $0.26 |
| Dodo fee **[verify contract; assumed 4 % + $0.40]** | ≈ $0.80 | ≈ $0.80 | ≈ $0.80 |
| **Contribution on $9.99** | **≈ $6.30 (63 %)** | **≈ $4.60 (46 %)** | **≈ $5.30 (53 %)** |

Plus monthly plan fees and Vercel/Supabase (negligible per visit). Real visits are likely shorter than 10 minutes;
measure in the PoC and the first days.

## Recommendation

- **Primary: LiveAvatar FULL mode**, Santa avatar from an original AI-generated image (no real actor → no consent
  video), Santa voice (stock or ElevenLabs), and **our own LLM endpoint** (`/api/santa/llm`, OpenAI-compatible,
  backed by the existing Azure OpenAI deployment). Owning the LLM step gives us server-side safety filtering, the
  invisible visit phases (wrap-up at minute 9 cannot be skipped by the browser) and no transcript storage on our
  side. Cheapest per minute and "unlimited" concurrency for Christmas peaks.
- **Fallback: Tavus** (best server controls: `max_call_duration`, signed webhooks, guardrails, ZDR on Enterprise),
  implemented behind the same `SantaAvatarProvider` interface if the LiveAvatar PoC fails on avatar quality,
  mobile Safari, latency or the custom-LLM loop.
- **Not D-ID** (undocumented concurrency, duration and webhooks).

## Open questions for the PoC / vendors

1. **Children as end users** — every vendor's terms are written for adult users. We need written confirmation that a
   B2B app whose end users include children under 13 (with verifiable parental consent) is permitted, plus a DPA,
   no training on our sessions, and the shortest retention available. **Launch blocker until answered.**
2. LiveAvatar: how the custom-LLM request identifies the session (for per-call phases and context); token TTL;
   avatar-from-image processing time; whether "Santa" is accepted by moderation; transcript deletion after each call.
3. Mobile Safari + Android Chrome behaviour of the SDK (autoplay, mic permission, backgrounding).
4. Real latency with our LLM on Vercel (time to first token).
5. Session usage data available after the call (for cost reconciliation, since there are no webhooks).

Sources: docs.liveavatar.com (sessions, custom LLM, credits, rate limits), help.heygen.com LiveAvatar FAQ, heygen.com
terms/privacy/moderation policy; docs.tavus.io (conversations, faces, LLM, guardrails, webhooks), tavus.io pricing,
privacy, AUP, ToS; docs.d-id.com; developers.openai.com (realtime, pricing, under-18 API guidance, data controls).

## Low-cost options (added 2026-11-22 — owner: $99/$475 monthly plans are too expensive)

| Option | Monthly fee | Per 10-min visit (estimate) | Notes |
|---|---|---|---|
| **A. Simli avatar + OpenAI Realtime mini (browser-direct)** | Simli Free $0 (50 min, preset faces, 1 session) for the PoC → Hobby **$10** (1,000 min, 1 custom face, 2 concurrent) → Pro $49 (5,500 min, 10 concurrent) only when sales justify it | Simli ≈ $0.10 + OpenAI `gpt-realtime-2.1-mini` ≈ $0.20–0.35 → **≈ $0.30–0.45** | Simli renders Santa's lip-synced face from the voice audio; OpenAI does listening + talking. Both connect browser-direct with server-minted tokens (fits Vercel). Custom Santa face from one image (`POST /faces/trinity`). Stock OpenAI voice. Official sample: github.com/simliai/create-simli-app-openai |
| B. Anam | Starter $12 (1 session, 5-min cap) / Explorer $49 (3 sessions, 10-min cap) | ≈ $1.40–1.60 overage | Image avatars on all plans; caps too tight for launch |
| C. Own animated (storybook) Santa + OpenAI Realtime mini | $0 | **≈ $0.20–0.35** | No avatar vendor at all; illustrated Santa animated in the browser from the voice (mouth, blinks). Not photoreal. Needs an illustrated Santa asset. |
| LiveAvatar FULL (previous primary) | $99 / $475 | ≈ $1.80–1.90 | |
| Tavus | $59 / $397 / $975 | ≈ $2.60–3.50 | |

Rates used: Simli $0.0095–0.01/min (simli.com/pricing); OpenAI `gpt-realtime-2.1-mini` audio $10 in / $0.30 cached /
$20 out per 1M tokens (developers.openai.com/api/docs/pricing). Tokens-per-minute is not published — **measure in the
PoC**. GPT-Live is $0.05/min plus backend model, i.e. ≈ $0.50+ per visit.

Constraints that still apply:
- **Children's terms:** Simli ToS: users must be 18+, and "If You are under 13 years of age, You are not authorized to
  use the Services" — same written-confirmation requirement as the other vendors. OpenAI requires **Zero Data
  Retention** before processing under-13 data (per-account approval). Azure OpenAI Realtime is the alternative
  (existing Azure account; verify model availability, WebRTC support and abuse-monitoring retention).
- No child camera is needed in any option — only the microphone. Santa does not see the child.
- Without a server-side LLM hop, the safety layer is the prompt + the model provider's own moderation; visit phases
  are sent by the browser (cosmetic); the hard cap is Simli `maxSessionLength` + the reaper hanging up the OpenAI call.

**New recommendation: Option A.** PoC costs ≈ $5–10 (OpenAI prepaid credit; Simli free tier).

## Decision 2026-11-22 (owner): build the storybook Santa first

Option C above ("own animated storybook Santa + OpenAI Realtime mini") is now the **default** (`SANTA_AVATAR=storybook`);
Simli stays available behind `SANTA_AVATAR=simli` for a later comparison. Measured in desktop Chrome: Santa's first
words ≈ 2–4 s after Start (no avatar vendor to connect), replies ≈ 1–2 s after the child stops, mouth follows the voice
in the browser (Web Audio analyser). Running cost ≈ OpenAI only (≈ $0.01 per Santa reply). No camera, no avatar vendor
receives the child's voice.

### Update 2026-11-22: Photo Santa (default look)

The owner's photoreal portrait (`docs/brand/santa/santa-portrait-master.png`, 941 × 1672) is animated in the browser by
`components/santa/PhotoSanta.tsx` (WebGL): the beard/lower lip drop with the loudness of Santa's voice, revealing a
mouth (the moustache hides the upper lip); eyelids blink; slow breathing/sway; lean-in while listening. Still no
avatar vendor and $0 running cost beyond OpenAI. Verified in a live call: mouth openness 0–1 tracks speech, 0 in
silence. Falls back to the still photo without WebGL. Storybook (SVG) Santa remains as an alternative look.
