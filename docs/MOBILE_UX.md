# Mobile UX

The mobile experience is the primary product. It lives in the same Next.js app as the original
site, in two new route groups:

| Group | Chrome | Routes |
|---|---|---|
| `(app)` | sticky header (logo + profile) · content · 5-tab bottom nav | `/home`, `/plan`, `/plan/checklist`, `/plan/theme`, `/plan/invite`, `/discover`, `/discover/saved`, `/guests`, `/more` |
| `(flow)` | full screen, no tab bar | `/start` (wizard), `/login`, `/join`, `/venue/[placeId]`, `/invite/[token]` (public RSVP), `/offline` |
| `(site)` | site header (sign in / get started / open app) + footer | public pages: `/`, `/pricing`, `/checkout-success`, `/privacy`, `/terms` |

Bottom nav: **Home · Plan · Discover · Guests · More**.

## Principles applied

* **Designed at 375 / 390 / 393 / 430 px**; desktop renders the same column centred (max 576 px).
* **Touch**: every control ≥ 44×44 px (nav items 64 px tall, inputs and primary buttons 48–56 px),
  `touch-action: manipulation`, no hover-only affordances.
* **Safe areas**: `viewport-fit=cover`; header uses `env(safe-area-inset-top)`, bottom nav and
  sticky CTAs `env(safe-area-inset-bottom)`.
* **Inputs**: 16 px+ text (no iOS zoom on focus), correct `inputmode`/`autocomplete`/
  `enterkeyhint`, native date/time pickers.
* **One question per screen** in the wizard; progress bar; draft survives refresh and OAuth.
* **Bottom sheets** (vaul) for filters, forms, compare, previews and confirmations; a non-modal
  draggable sheet over the map.
* **Progressive disclosure**: completed tasks collapse, hours expand, vendors load on demand.
* **Skeletons** for every async screen; **empty states** with a single next action; **error
  states** with plain-language copy and retry — never stack traces.
* **Optimistic updates** for save, checklist, guest delete.
* **Accessibility**: semantic headings, `aria-current` nav, `aria-pressed` toggles,
  `role="radio"` choice grids, labelled icon buttons, live regions for counts/status, decorative
  duplicates hidden, `prefers-reduced-motion` respected.

## Design language

“Magical, premium, trustworthy — the parent is the user.” Deep ink-violet primary, warm ivory
background, coral and gold accents used sparingly; Fraunces display type for headlines with Inter
for UI. Tokens are scoped with `html:has(.mbp-app)` so portals inherit them and the marketing pages are
unaffected (`app/globals.css`).

## Screens

| Screen | Answers / does |
|---|---|
| Home | “What should I do next?” — greeting, countdown, % complete, next step + *Continue planning*, recommended venues, saved count, guest progress, theme, next 3 tasks. Signed-out: welcome |
| Wizard `/start` | 9 questions → account (inline) → party → straight to Discover |
| Discover | “We found N party options near you.” — search, filter sheet, list/map toggle (persisted), chips, infinite list |
| Map | Google map (or schematic fallback) with clustered markers; tap marker → sheet shows it first |
| Venue | photos (swipe), rating, distance, price, hours, phone, website, directions, share, why recommended, Save / Add to party |
| Saved | shortlist with private notes, compare (2–4), share list, add to party |
| Plan | progress, next action, venue/theme/guests/invite/checklist rows, details, edit sheet |
| Theme | recommended for the child, popular, AI ideas (optional), browse/search, custom |
| Guests | headcounts, search, filters, add/edit/delete, RSVP & invite status |
| Checklist | Today (incl. overdue) / This week / Later / Completed; custom tasks |
| Invitation | 3 designs, live preview, native share / SMS / email / copy; public RSVP page with add-to-calendar |
| More | plan, party switcher, install app, account (name, RSVP-email preference), legal, sign out |

