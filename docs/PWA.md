# PWA

Goal: “feels like an app when opened on a phone” — installable, full-screen, fast to reopen,
graceful offline. Not a native-capability clone.

| Piece | File |
|---|---|
| Manifest (`/manifest.webmanifest`) — name, `start_url=/home?source=pwa`, `display: standalone`, portrait, ivory theme/background, shortcuts (Discover, Guests, Checklist) | `app/manifest.ts` |
| Icons 192/512, maskable 512, Apple touch 180 | `public/icons/*` (rendered from the logo SVG) |
| `viewport-fit=cover`, `theme-color`, `apple-mobile-web-app-*` | `app/layout.tsx` (`viewport`, `metadata.appleWebApp`) |
| Service worker | `public/sw.js`, registered in production by `components/app/ServiceWorkerRegistrar.tsx` |
| Offline page | `app/(flow)/offline` |
| Offline banner | `components/app/OfflineBanner.tsx` |
| Install prompt (Android `beforeinstallprompt`, iOS instructions) | `components/app/useInstallPrompt.ts`, **More → Add to your home screen** |

## Service worker strategy

* **Never cached**: `/api/*`, `/auth/*`, any cross-origin request (Supabase, Google). User data is
  always live and never persisted by the SW.
* `/_next/static/*`, `/icons/*`: cache-first (content-hashed).
* Page navigations: network-first; app routes (`/home`, `/plan…`, `/discover…`, `/guests`,
  `/more`, `/start`) are cached as an **offline shell**; fallback order is the cached page →
  cached `/home` → `/offline`.
* Versioned caches (`mbp-static-v1`, `mbp-pages-v1`) are cleaned on activate; `sw.js` is served
  `no-cache` so updates roll out on the next visit. Bump `VERSION` in `sw.js` to force-refresh.
* Disable with `NEXT_PUBLIC_DISABLE_SW=true` (and unregister in devtools).

## Analytics

`app_open` carries `standalone: true` when launched from the home screen; `pwa_install_prompted`
and `pwa_installed` are tracked.

## Manual checks per release

* Android Chrome: install banner / More → Add to home screen → opens standalone with ivory status bar.
* iOS Safari: Share → Add to Home Screen → icon correct, opens standalone, safe areas respected
  (notch, home indicator) on header, bottom nav and sticky CTAs.
* Airplane mode after visiting Home: relaunch shows cached shell + offline banner; unvisited pages
  show `/offline`.
* Lighthouse PWA/installability audit on the production URL.
