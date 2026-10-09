#!/usr/bin/env node
/**
 * Paid-acquisition funnel report (read-only). Counts per day (America/New_York) and per ad (utm_source / utm_content):
 * landing views → sign-ups → confirmed → founding seats → parties → activated → checkouts → purchases.
 *
 *   SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/funnel-report.mjs [--since 2026-10-10] [--until 2026-10-14]
 *
 * Test, smoke and staff accounts (*.test, *.invalid, @resend.dev, super admins) are left out. Prints no emails or
 * names — only counts. Ad spend comes from Ads Manager; add it to the daily template by hand.
 */
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? process.argv[i + 1] : d
}
const since = arg('since', '2026-10-10')
const until = arg('until', '2026-10-14')
const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: key } = process.env
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY')
const H = { apikey: key, Authorization: `Bearer ${key}` }
// ET midnight ≈ 04:00Z in October (EDT).
const sinceZ = `${since}T04:00:00Z`
const untilZ = `${until}T04:00:00Z`

async function rest(path) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${url}/rest/v1/${path}`, { headers: { ...H, Range: `${from}-${from + 999}` } })
    if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`)
    const rows = await r.json()
    out.push(...rows)
    if (rows.length < 1000) return out
  }
}
async function authUsers() {
  const out = []
  for (let page = 1; ; page++) {
    const r = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: H })
    if (!r.ok) throw new Error(`auth users: ${r.status}`)
    const { users } = await r.json()
    out.push(...users)
    if (users.length < 1000) return out
  }
}

const day = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
const isTest = (email) => !email || /\.(test|invalid)$/i.test(email) || /@resend\.dev$/i.test(email)
const PRICE = { STARTER: 9.99, PLUS: 19.99, PRO: 29.99 }

const [users, admins, founding, parties, events, purchases] = await Promise.all([
  authUsers(),
  rest('user_roles?select=user_id&role=eq.super_admin'),
  rest(`founding_members?select=user_id,granted_at`),
  rest(`parties?select=id,user_id,created_at&created_at=gte.${sinceZ}&created_at=lt.${untilZ}`),
  rest(`analytics_events?select=event,user_id,anonymous_id,properties,created_at&created_at=gte.${sinceZ}&created_at=lt.${untilZ}&event=in.(landing_page_view,signup_started,signup_completed,checkout_started,venue_saved,venue_added_to_party,theme_selected,ai_feature_used,guest_added,invitation_shared,checklist_completed)`),
  rest(`billing_purchases?select=user_id,plan,status,amount_minor,created_at&created_at=gte.${sinceZ}&created_at=lt.${untilZ}`),
])
const staff = new Set(admins.map((a) => a.user_id))
const real = new Map(users.filter((u) => !isTest(u.email) && !staff.has(u.id)).map((u) => [u.id, u]))
const adOf = (u) => {
  const a = u?.user_metadata?.signup_attribution ?? {}
  return `${a.utm_source ?? '(none)'} / ${a.utm_content ?? '-'}`
}

const rows = {}
const byAd = {}
const bump = (t, k, f, n = 1) => {
  t[k] ??= { landing: 0, signups: 0, confirmed: 0, founding: 0, parties: 0, activated: 0, checkouts: 0, purchases: 0, revenue: 0 }
  t[k][f] += n
}
for (const u of real.values()) {
  if (u.created_at < sinceZ || u.created_at >= untilZ) continue
  bump(rows, day(u.created_at), 'signups'); bump(byAd, adOf(u), 'signups')
  if (u.email_confirmed_at) { bump(rows, day(u.created_at), 'confirmed'); bump(byAd, adOf(u), 'confirmed') }
}
for (const f of founding) if (real.has(f.user_id) && f.granted_at >= sinceZ && f.granted_at < untilZ) { bump(rows, day(f.granted_at), 'founding'); bump(byAd, adOf(real.get(f.user_id)), 'founding') }
for (const p of parties) if (real.has(p.user_id)) { bump(rows, day(p.created_at), 'parties'); bump(byAd, adOf(real.get(p.user_id)), 'parties') }
const landed = new Set()
const activated = new Set()
const checkout = new Set()
for (const e of events) {
  if (e.event === 'landing_page_view') {
    const k = e.anonymous_id ?? e.created_at
    if (landed.has(k)) continue
    landed.add(k)
    bump(rows, day(e.created_at), 'landing'); bump(byAd, `${e.properties?.utm_source ?? '(none)'} / ${e.properties?.utm_content ?? '-'}`, 'landing')
  } else if (e.event === 'checkout_started') {
    if (!real.has(e.user_id) || checkout.has(e.user_id)) continue
    checkout.add(e.user_id); bump(rows, day(e.created_at), 'checkouts'); bump(byAd, adOf(real.get(e.user_id)), 'checkouts')
  } else if (!['signup_started', 'signup_completed'].includes(e.event)) {
    if (!real.has(e.user_id) || activated.has(e.user_id)) continue
    activated.add(e.user_id); bump(rows, day(e.created_at), 'activated'); bump(byAd, adOf(real.get(e.user_id)), 'activated')
  }
}
for (const p of purchases) {
  if (!real.has(p.user_id) || p.status !== 'active') continue
  const v = p.amount_minor != null ? p.amount_minor / 100 : PRICE[p.plan] ?? 0
  bump(rows, day(p.created_at), 'purchases'); bump(rows, day(p.created_at), 'revenue', v)
  bump(byAd, adOf(real.get(p.user_id)), 'purchases'); bump(byAd, adOf(real.get(p.user_id)), 'revenue', v)
}

const left = await (await fetch(`${url}/rest/v1/rpc/founding_seats_left`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: '{}' })).json()
console.log(`Funnel ${since} → ${until} (ET). Founding seats left now: ${left}/25. "landing" = unique devices on the homepage.\n`)
const sorted = (t) => Object.fromEntries(Object.entries(t).sort(([a], [b]) => a.localeCompare(b)))
console.log('By day'); console.table(sorted(rows))
console.log('By ad (utm_source / utm_content; sign-ups attributed from the account, landing from the visit)'); console.table(byAd)
