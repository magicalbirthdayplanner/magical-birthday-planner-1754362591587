/**
 * Deterministic in-memory provider for unit/integration/E2E tests and local UI work. Never used in production
 * (lib/santa/providers/index.ts refuses it when VERCEL_ENV=production).
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import type { CreateSantaSessionInput, SantaAvatarProvider, SantaProviderEvent, SantaSession, SantaSessionStatus, SantaUsage } from './types'

interface MockState { status: SantaSessionStatus; createdAt: number; connectedAt: number | null; endedAt: number | null; maxSeconds: number }

export const MOCK_WEBHOOK_SECRET = 'mock-santa-webhook-secret'

export function signMockEvent(body: string, secret = MOCK_WEBHOOK_SECRET): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

export class MockSantaProvider implements SantaAvatarProvider {
  readonly id = 'mock' as const
  readonly sessions = new Map<string, MockState>()
  constructor(private readonly now: () => number = Date.now) {}

  configured() {
    return true
  }

  async createSession(input: CreateSantaSessionInput): Promise<SantaSession> {
    const id = `mock_${randomUUID()}`
    this.sessions.set(id, { status: 'pending', createdAt: this.now(), connectedAt: null, endedAt: null, maxSeconds: input.maxSeconds })
    return {
      providerSessionId: id,
      join: { provider: 'mock', transport: 'mock', url: `mock://santa/${id}`, token: null, expiresAt: new Date(this.now() + 5 * 60_000).toISOString() },
    }
  }

  async startSession(id: string) {
    const s = this.sessions.get(id)
    if (s && s.status === 'pending') Object.assign(s, { status: 'active', connectedAt: this.now() })
  }

  async endSession(id: string) {
    const s = this.sessions.get(id)
    if (s && s.status !== 'ended') Object.assign(s, { status: 'ended', endedAt: this.now() })
  }

  async getSessionStatus(id: string): Promise<SantaSessionStatus> {
    return this.sessions.get(id)?.status ?? 'unknown'
  }

  async getUsage(id: string): Promise<SantaUsage> {
    const s = this.sessions.get(id)
    if (!s) return { billedSeconds: null, connectedAt: null, endedAt: null }
    const billed = s.connectedAt != null && s.endedAt != null ? Math.min(s.maxSeconds, Math.ceil((s.endedAt - s.connectedAt) / 1000)) : null
    return { billedSeconds: billed, connectedAt: s.connectedAt ? new Date(s.connectedAt).toISOString() : null, endedAt: s.endedAt ? new Date(s.endedAt).toISOString() : null }
  }

  /** Body: {"type":"connected"|"ended"|"failed","session":"…","at":"ISO","reason"?:"…","billed_seconds"?:n}; header x-mock-signature. */
  async handleProviderEvent(rawBody: string, headers: Headers): Promise<SantaProviderEvent | null> {
    const sig = headers.get('x-mock-signature') ?? ''
    const want = signMockEvent(rawBody)
    if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null
    let e: { type?: string; session?: string; at?: string; reason?: string; billed_seconds?: number }
    try {
      e = JSON.parse(rawBody)
    } catch {
      return null
    }
    const sid = typeof e.session === 'string' ? e.session : null
    const at = typeof e.at === 'string' && !Number.isNaN(Date.parse(e.at)) ? e.at : new Date(this.now()).toISOString()
    if (!sid) return { kind: 'ignored', providerSessionId: null, reason: 'no_session' }
    if (e.type === 'connected') return { kind: 'connected', providerSessionId: sid, at }
    if (e.type === 'ended') return { kind: 'ended', providerSessionId: sid, at, reason: e.reason ?? 'ended', billedSeconds: Number.isInteger(e.billed_seconds) ? e.billed_seconds! : null }
    if (e.type === 'failed') return { kind: 'failed', providerSessionId: sid, at, reason: e.reason ?? 'failed' }
    return { kind: 'ignored', providerSessionId: sid, reason: `unknown_type` }
  }
}
