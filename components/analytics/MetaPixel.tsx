'use client'
/**
 * Meta Pixel (Facebook + Instagram ads measurement). Off unless NEXT_PUBLIC_META_PIXEL_ID is set. Not loaded for
 * visitors who send Global Privacy Control, nor on guest RSVP / admin / auth pages, nor while the URL still carries
 * sign-in tokens. Sends PageView on each page and the
 * funnel events mapped in lib/analytics/meta-pixel.ts. No advanced matching: no personal data leaves the app.
 */
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { addAnalyticsSink } from '@/lib/analytics/client'
import { pixelAllowedOn, pixelCallsFor, urlHasAuthTokens } from '@/lib/analytics/meta-pixel'

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue: unknown[]; loaded: boolean; version: string; push: unknown }
declare global {
  interface Window { fbq?: Fbq; _fbq?: Fbq }
}

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? ''
const FIRST_ACTION_KEY = 'mbp.fpa'

const optedOut = () => typeof navigator !== 'undefined' && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true

/** Meta's standard base code, without the inline <script>. */
function loadPixel(id: string) {
  if (window.fbq) return
  const n = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod(...args)
    else n.queue.push(args)
  } as Fbq
  n.push = n
  n.loaded = true
  n.version = '2.0'
  n.queue = []
  window.fbq = n
  window._fbq = n
  const s = document.createElement('script')
  s.async = true
  s.src = 'https://connect.facebook.net/en_US/fbevents.js'
  document.head.appendChild(s)
  n('init', id)
}

const enabledOn = (pathname: string) => !!PIXEL_ID && !optedOut() && pixelAllowedOn(pathname)

/** Run `fn` once the URL no longer carries sign-in tokens (the auth client strips them within moments); give up after ~10 s. */
function whenUrlClean(fn: () => void, tries = 20) {
  if (!urlHasAuthTokens(window.location.hash)) fn()
  else if (tries > 0) setTimeout(() => whenUrlClean(fn, tries - 1), 500)
}

// Registered at import, so events tracked by a page's own first effects (e.g. signup_started on /join) are not missed.
if (typeof window !== 'undefined' && PIXEL_ID) {
  addAnalyticsSink((e) => whenUrlClean(() => {
    if (!enabledOn(window.location.pathname)) return
    loadPixel(PIXEL_ID)
    let sent = false
    try {
      sent = localStorage.getItem(FIRST_ACTION_KEY) === '1'
    } catch {
      /* storage unavailable */
    }
    for (const c of pixelCallsFor(e.event, e.properties, sent)) {
      if (c.name === 'FirstPlanningAction') {
        try {
          localStorage.setItem(FIRST_ACTION_KEY, '1')
        } catch {
          /* storage unavailable */
        }
      }
      if (c.params) window.fbq?.(c.kind, c.name, c.params)
      else window.fbq?.(c.kind, c.name)
    }
  }))
}

/** PageView on every page the pixel may run on. */
export function MetaPixel() {
  const pathname = usePathname() ?? '/'
  useEffect(() => {
    whenUrlClean(() => {
      if (!enabledOn(window.location.pathname)) return
      loadPixel(PIXEL_ID)
      window.fbq?.('track', 'PageView')
    })
  }, [pathname])
  return null
}
