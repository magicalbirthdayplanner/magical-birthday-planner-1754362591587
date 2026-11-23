/**
 * SantaAvatarProvider — the only surface the app uses to talk to a real-time avatar vendor.
 * Vendor-specific code lives in one adapter file per provider (lib/santa/providers/<vendor>.ts) and never leaks
 * vendor types past this interface. SERVER ONLY implementations; the browser receives a `SantaJoinInfo` only.
 *
 * Media never passes through our servers: the browser joins the vendor's WebRTC room directly with short-lived,
 * single-session credentials minted here. Duration is enforced twice: by the vendor (max session length set at
 * creation) and by us (end-session call + webhook/reaper settlement). Browser timers are cosmetic.
 */
import type { SantaChildProfile } from '../persona'

export type SantaProviderId = 'tavus' | 'heygen' | 'did' | 'mock'

export interface CreateSantaSessionInput {
  /** Our santa_calls.id — passed to the vendor as an idempotency/reference key and echoed in webhooks. */
  callId: string
  child: SantaChildProfile
  /** Hard cap enforced by the vendor. */
  maxSeconds: number
  /** Public HTTPS URL for vendor callbacks (signed). */
  webhookUrl: string | null
}

/** What the browser needs to join. Contains no API keys; credentials expire quickly and are bound to one session. */
export interface SantaJoinInfo {
  provider: SantaProviderId
  /** Kind of client the browser must start. */
  transport: 'daily' | 'livekit' | 'webrtc-sdk' | 'mock'
  /** Room URL / server URL, as the vendor client expects. */
  url: string
  /** Short-lived token, if the vendor uses one (null when the URL itself is the capability). */
  token: string | null
  expiresAt: string
}

export interface SantaSession {
  providerSessionId: string
  join: SantaJoinInfo
}

export type SantaSessionStatus = 'pending' | 'active' | 'ended' | 'failed' | 'unknown'

export interface SantaUsage {
  /** Seconds the vendor will bill for this session (null if not reported yet). */
  billedSeconds: number | null
  /** When the vendor reports the session actually connected (participant joined), if known. */
  connectedAt: string | null
  endedAt: string | null
}

/** A verified, normalised vendor event. */
export type SantaProviderEvent =
  | { kind: 'connected'; providerSessionId: string; at: string }
  | { kind: 'ended'; providerSessionId: string; at: string; reason: string; billedSeconds: number | null }
  | { kind: 'failed'; providerSessionId: string; at: string; reason: string }
  | { kind: 'ignored'; providerSessionId: string | null; reason: string }

export interface SantaAvatarProvider {
  readonly id: SantaProviderId
  /** Is the adapter configured (keys, avatar/persona ids)? Never throws. */
  configured(): boolean
  /** Create the vendor session with persona, personalisation and max duration; returns join credentials. */
  createSession(input: CreateSantaSessionInput): Promise<SantaSession>
  /**
   * Vendors that need an explicit start after creation implement this; others resolve immediately.
   * Called by our server, never trusted from the browser.
   */
  startSession(providerSessionId: string): Promise<void>
  /** End the session at the vendor. Idempotent: ending an ended session succeeds. */
  endSession(providerSessionId: string): Promise<void>
  getSessionStatus(providerSessionId: string): Promise<SantaSessionStatus>
  getUsage(providerSessionId: string): Promise<SantaUsage>
  /**
   * Verify the signature of a raw webhook request and normalise it. Must use the RAW body.
   * Returns null when the signature is invalid (caller answers 401).
   */
  handleProviderEvent(rawBody: string, headers: Headers): Promise<SantaProviderEvent | null>
}

export class SantaProviderError extends Error {
  constructor(
    message: string,
    /** capacity = vendor concurrency/rate limit; unavailable = outage; config = our misconfiguration */
    readonly code: 'capacity' | 'unavailable' | 'config' | 'rejected' | 'unknown',
    readonly retryable: boolean,
  ) {
    super(message)
    this.name = 'SantaProviderError'
  }
}
