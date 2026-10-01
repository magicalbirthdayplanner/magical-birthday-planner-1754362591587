'use client'
/**
 * Product analytics, client side. One call site for the whole app:
 *   track('venue_saved', { category: 'art-studio' })
 * Events are batched and sent to /api/analytics (stored in Supabase). Add more
 * sinks (PostHog, GA4, …) in `sinks` without touching call sites.
 */
import { db } from '@/lib/db/browser'
import { sanitizeProps, type AnalyticsEvent, type AnalyticsProps } from './events'

interface QueuedEvent {
  event: AnalyticsEvent
  properties: ReturnType<typeof sanitizeProps>
  partyId?: string | null
  path: string
  ts: string
}

type Sink = (e: QueuedEvent) => void

const queue: QueuedEvent[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let currentPartyId: string | null = null

const sinks: Sink[] = [
  (e) => {
    if (process.env.NODE_ENV === 'development') console.debug('[analytics]', e.event, e.properties)
  },
]

export function addAnalyticsSink(sink: Sink) {
  sinks.push(sink)
}

export function setAnalyticsParty(partyId: string | null) {
  currentPartyId = partyId
}

function ids() {
  try {
    let anon = localStorage.getItem('mbp.aid')
    if (!anon) {
      anon = crypto.randomUUID()
      localStorage.setItem('mbp.aid', anon)
    }
    let session = sessionStorage.getItem('mbp.sid')
    if (!session) {
      session = crypto.randomUUID()
      sessionStorage.setItem('mbp.sid', session)
    }
    return { anonymousId: anon, sessionId: session }
  } catch {
    return { anonymousId: null, sessionId: null }
  }
}

export function track(event: AnalyticsEvent, props: AnalyticsProps = {}) {
  if (typeof window === 'undefined') return
  const e: QueuedEvent = {
    event,
    properties: sanitizeProps(props),
    partyId: currentPartyId,
    path: window.location.pathname,
    ts: new Date().toISOString(),
  }
  for (const s of sinks) {
    try {
      s(e)
    } catch {
      /* a sink must never break the app */
    }
  }
  queue.push(e)
  if (queue.length >= 10) void flush()
  else if (!timer) timer = setTimeout(() => void flush(), 2000)
}

export async function flush() {
  if (timer) clearTimeout(timer)
  timer = null
  if (!queue.length || typeof window === 'undefined') return
  const batch = queue.splice(0, queue.length)
  try {
    const { data } = await db.auth.getSession()
    const token = data.session?.access_token
    await fetch('/api/analytics', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ ...ids(), events: batch }),
    })
  } catch {
    /* analytics is best-effort */
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => void flush())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush()
  })
}
