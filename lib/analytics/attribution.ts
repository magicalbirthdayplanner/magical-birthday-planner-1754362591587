/**
 * Ad attribution, client side. The landing URL's UTM tags (and whether Meta added an fbclid) are kept on this device
 * (first and last touch, 30 days) and added to every analytics event, so a sign-up, party or purchase can be traced
 * back to the ad that brought the parent in. No personal data: only campaign tags.
 */

export const ATTRIBUTION_KEY = 'mbp.attr'
const TTL_MS = 30 * 86_400_000
const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

export type Touch = Partial<Record<(typeof UTM)[number], string>> & { fbclid?: boolean; at: number }
export interface Attribution { first: Touch; last: Touch }

const clean = (v: string | null) => {
  const s = (v ?? '').trim().toLowerCase().replace(/[^a-z0-9_.\-]/g, '_').slice(0, 60)
  return s || undefined
}

/** The campaign tags in a query string, or null when it carries none. */
export function touchFrom(search: string, now = Date.now()): Touch | null {
  const q = new URLSearchParams(search)
  const t: Touch = { at: now }
  for (const k of UTM) {
    const v = clean(q.get(k))
    if (v) t[k] = v
  }
  if (q.get('fbclid')) t.fbclid = true
  return Object.keys(t).length > 1 ? t : null
}

/** Merge a new landing into the stored attribution: the first touch is kept (until it expires), the last one replaced. */
export function mergeTouch(prev: Attribution | null, t: Touch | null, now = Date.now()): Attribution | null {
  const live = prev && now - prev.last.at < TTL_MS ? prev : null
  if (!t) return live
  return { first: live && now - live.first.at < TTL_MS ? live.first : t, last: t }
}

/** Facebook / Instagram / Messenger in-app browsers (Google sign-in is blocked inside them). */
export function isInAppBrowser(ua: string): boolean {
  return /FBAN|FBAV|FB_IAB|FBIOS|FB4A|Instagram|Messenger/i.test(ua)
}

function read(): Attribution | null {
  try {
    const raw = localStorage.getItem(ATTRIBUTION_KEY)
    return raw ? (JSON.parse(raw) as Attribution) : null
  } catch {
    return null
  }
}

/** Record the current page's campaign tags (call once per page load). */
export function captureAttribution() {
  if (typeof window === 'undefined') return
  try {
    const next = mergeTouch(read(), touchFrom(window.location.search))
    if (next) localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable */
  }
}

/** Event properties: last-touch tags, the first-touch source, and whether this is an in-app browser. */
export function attributionProps(): Record<string, string | boolean> {
  if (typeof window === 'undefined') return {}
  const a = mergeTouch(read(), null)
  const out: Record<string, string | boolean> = {}
  if (a) {
    for (const k of UTM) if (a.last[k]) out[k] = a.last[k]!
    if (a.last.fbclid) out.fbclid = true
    if (a.first.utm_source && a.first.at !== a.last.at) out.first_utm_source = a.first.utm_source
  }
  if (isInAppBrowser(navigator.userAgent)) out.in_app = true
  return out
}
