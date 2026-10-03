/* Magical Birthday Planner service worker — offline shell + static asset cache.
 * Never caches API responses or cross-origin requests (user data stays live). */
const VERSION = 'v2'
const STATIC = `mbp-static-${VERSION}`
const PAGES = `mbp-pages-${VERSION}`
const PRECACHE = ['/offline', '/icons/icon-192.png', '/icons/apple-touch-icon.png', '/manifest.webmanifest']
const APP_ROUTES = /^\/(home|plan|discover|guests|more|start)(\/|$)/

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mbp-') && ![STATIC, PAGES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return

  // Hashed build assets: cache-first, immutable.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(STATIC).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  // Page navigations: network-first; fall back to the cached app shell, then /offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && APP_ROUTES.test(url.pathname)) {
            const copy = res.clone()
            caches.open(PAGES).then((c) => c.put(url.pathname, copy))
          }
          return res
        })
        .catch(async () => (await caches.match(url.pathname, { cacheName: PAGES })) || (await caches.match('/home', { cacheName: PAGES })) || caches.match('/offline')),
    )
  }
})
