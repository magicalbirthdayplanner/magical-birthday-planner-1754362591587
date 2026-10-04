# Feature inventory

What a parent can do in the current production build (verified against the code on 2026-10-04). AI features are
detailed in [ai/AI_FEATURES.md](ai/AI_FEATURES.md); plan gating in `lib/ai/capabilities.ts`.

### Party creation
- 9-step wizard (`/start`, `components/wizard/PartyWizard.tsx`): child's first name, age (1–14), date (presets or
  picker, no past dates), ZIP (resolved to city/state; unknown ZIPs rejected), guests, budget (presets, custom amount
  or "Not sure yet"), vibe (indoor / outdoor / either), interests, optional theme → summary → "Find party places".
- Works before sign-up: answers are kept as a draft on the device. After sign-up (and email confirmation) the
  parent re-opens the wizard with the answers pre-filled and confirms them (known limitation: not created automatically).
- Several parties per account; switch from Home or More; edit details in Plan → party details; delete with
  confirmation (cascades the party's data; AI usage history is kept anonymised).

### Venue discovery
- `/discover`: real local venues from Google Places (New), ranked for the child's age, interests, budget, setting and
  distance; category chips and filters; list and map views; search within results.
- Cache-first (shared venue cache with TTLs), cost guards per user and instance, degraded mode serves cached results
  when Google is unavailable. See [LOCAL_DISCOVERY.md](LOCAL_DISCOVERY.md), [GOOGLE_PLACES_COST_CONTROL.md](GOOGLE_PLACES_COST_CONTROL.md).

### Google Maps
- Vector map with clustered markers showing category emoji and rating; tap → bottom sheet card; "N places on the map".
- Separate browser key (Maps JS only, referrer-restricted); without a key the app shows a schematic map.

### Venue details
- `/venue/[placeId]`: photo gallery, category and setting, rating and review count, distance, address, open/closed
  and weekly hours, Directions / Call / Website / Share, "Why we recommend it", Save, Add to party.
- Details and photos are fetched only for places discovery surfaced (no arbitrary Place Details spend).

### Saved venues
- `/discover/saved`: shortlist with private notes and side-by-side compare; one venue becomes the party venue and
  appears on the plan and the invitation.

### Guests
- `/guests`: add/edit/remove guests (name, email, phone, kids, adults, notes), RSVP status filters (Going, Waiting,
  Can't go, Not invited), headcount summary, search.

### Invitations
- `/plan/invite`: invitation card (headline, times, place, message, host, RSVP-by, three designs), share via the
  system share sheet / text / email / copy link, **email all guests with an address** (Resend, daily caps), reset
  link (old link stops working).

### RSVP
- `/invite/[token]`: public, no account; Yes / Maybe / Can't go, name, optional email, kids/adults, note, add to
  calendar. **Idempotent:** the same device (hashed per-device key) or the same email updates one guest — changes,
  refreshes, double-taps and retries never duplicate; "RSVP for someone else" for shared phones.
- Host notification and guest confirmation emails are sent once per real change.

### Checklist
- `/plan/checklist`: dated tasks generated from the party date (today / this week / later), mark done, completed
  view; milestones such as choosing a theme complete automatically; AI "What am I forgetting?" (Starter+).

### Activities
- `/activities`: planned activities and ideas with duration, setting, materials, cost estimate and how-to; totals
  ("N planned · time of the party · about $X"); add your own; Activity Studio (AI, Plus+); per-activity actions:
  add to timeline, add supplies to shopping, add cost to budget, edit, remove (cleans its prep tasks and
  estimate-only budget lines).

### Food planning
- "Menu" in *Your party plan* (from Party Experience): items with quantities and dietary notes; add to shopping list.

### Budget
- *Your party plan → Budget*: planned amounts by category vs the party budget, actual spend entered by the parent,
  lines from AI results and activities; undo for AI-added lines.

### Shopping
- *Your party plan → Shopping list*: items with quantity, category and estimated cost; mark bought ("N of M bought").

### Timeline
- *Your party plan → Timeline*: one ordered party-day timeline (arrival, welcome, activities, food, cake, gifts,
  closing); activity rows follow the activity's duration; move, add and remove steps.

### AI planning
- Plan My Party, Theme Ideas, AI Checklist, Activity Studio, Party Host, Party Experience — see [ai/AI_FEATURES.md](ai/AI_FEATURES.md).

### Themes
- `/plan/theme`: curated catalogue with search and categories, "Recommended for <child>", AI theme ideas; the chosen
  theme drives the plan, activities and invitation.

### Party Experience / Party Magic
- Plan → Party Magic: Party Experience generator (Plus+), Activities, Host and Messages entry points.

### Party Host
- "What to say": welcome, activity intros, cake, closing, reminders, thank-you notes — saved to the party; nothing is
  sent automatically.

### Billing
- One-time plans per the pricing page: **Starter $4.99 · Plus $9.99 · Pro $14.99** (USD), Dodo hosted checkout.
- Every new account gets a 24-hour Pro trial; trial users can buy any plan at any time; a purchase replaces the
  trial. Plans are granted only by verified payment webhooks; refunds revoke. See [BILLING_SECURITY.md](BILLING_SECURITY.md).

### Super Admin
- `/admin` (role `super_admin`, server-verified; everyone else gets 404): user search, plan details, timed or
  permanent plan overrides, stats, audit log of every change.

### PWA / mobile experience
- Installable (manifest, icons, iOS/Android prompts), service worker with offline shell and "You're offline" screen,
  bottom navigation, sheets, 44 px touch targets, tested at 375 / 390 / 393 / 430 px. See [PWA.md](PWA.md), [MOBILE_UX.md](MOBILE_UX.md).

### Accounts & email
- Email/password sign-up with confirmation, sign-in, password reset, Google sign-in (OAuth via Supabase), sign-out
  that clears the device's party data, RSVP email preference. Transactional email via Resend from the verified domain.
