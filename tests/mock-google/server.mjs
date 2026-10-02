#!/usr/bin/env node
/**
 * Mock Google Places API (New) + Geocoding for CI and E2E. No network, no cost.
 * Fixture places are FICTIONAL and generated deterministically around the
 * requested location.
 *
 *   node tests/mock-google/server.mjs            (PORT=4010 by default)
 *
 * Control endpoints (tests only):
 *   POST /__mock/mode   {"mode":"ok"|"empty"|"quota"|"timeout"|"error"}
 *   GET  /__mock/stats  → call counts
 *   POST /__mock/reset
 */
import http from 'node:http'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PORT = Number(process.env.MOCK_GOOGLE_PORT || process.env.PORT || 4010)
const HOST = '127.0.0.1'
let mode = 'ok'
let stats = { searchText: 0, details: 0, photo: 0, geocode: 0 }
// placeId → raw place (for details). Persisted so details still work after a restart
// when the app serves search results from its Supabase cache.
const KNOWN_FILE = join(tmpdir(), 'mock-google-known-places.json')
const known = new Map(existsSync(KNOWN_FILE) ? Object.entries(JSON.parse(readFileSync(KNOWN_FILE, 'utf8') || '{}')) : [])
let saveTimer = null
const remember = (id, place) => {
  known.set(id, place)
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => writeFileSync(KNOWN_FILE, JSON.stringify(Object.fromEntries(known))), 50)
}

const NAMES = [
  [/art studio/i, ['Little Picasso Art Studio', 'Color Splash Kids Art', 'Brushstrokes Creative Lab', 'The Messy Easel']],
  [/pottery/i, ['Clay Cafe Paint-Your-Own', 'Glaze & Gather Pottery', 'Kiln Kids Studio']],
  [/children's museum/i, ["Discovery Children's Museum", 'Curiosity Corner Museum']],
  [/activity center/i, ['Kid Quest Activity Center', 'Imagination Station']],
  [/indoor playground/i, ['Jungle Jam Indoor Play', 'Bounce & Climb Playland']],
  [/trampoline/i, ['SkyHop Trampoline Park', 'AirZone Jump Center']],
  [/bowling/i, ['Strike Zone Lanes', 'Lucky Pin Bowl']],
  [/science center/i, ['Spark Science Center']],
  [/park with picnic|picnic/i, ['Maple Grove Park', 'Riverside Commons Park']],
  [/playground/i, ['Sunny Hill Playground']],
  [/birthday party venue/i, ['Party Palace Kids Venue', 'Celebration Station', 'Confetti Club Party Space']],
  [/bakery|cake/i, ['Sugar Bloom Bakery', 'Frosted Dreams Cake Shop', 'Golden Crumb Bakery']],
  [/zoo/i, ['Wild Trails Zoo']],
]
const TYPES = [
  [/art studio/i, ['art_studio', 'point_of_interest', 'establishment']],
  [/bowling/i, ['bowling_alley', 'point_of_interest', 'establishment']],
  [/park/i, ['park', 'point_of_interest', 'establishment']],
  [/bakery|cake/i, ['bakery', 'food', 'store', 'establishment']],
  [/museum/i, ['museum', 'tourist_attraction', 'establishment']],
]

const h = (s) => createHash('sha1').update(s).digest('hex')

function placesFor(query, lat, lng) {
  const names = NAMES.find(([re]) => re.test(query))?.[1] ?? [`${query.replace(/\b\w/g, (c) => c.toUpperCase())} Place`]
  const types = TYPES.find(([re]) => re.test(query))?.[1] ?? ['point_of_interest', 'establishment']
  const out = names.map((name, i) => {
    const seed = parseInt(h(`${query}|${i}`).slice(0, 8), 16)
    const dLat = (((seed % 1000) / 1000) - 0.5) * 0.18 // within ~6 miles
    const dLng = ((((seed >> 10) % 1000) / 1000) - 0.5) * 0.22
    // Real place ids identify one physical place: include the area so the same
    // fictional name in two cities never collides.
    const id = `ChIJmock${h(`${name}|${lat.toFixed(1)},${lng.toFixed(1)}`).slice(0, 18)}`
    const place = {
      id,
      displayName: { text: name, languageCode: 'en' },
      formattedAddress: `${100 + (seed % 900)} ${['Maple', 'Oak', 'Big Beaver', 'Crooks', 'Long Lake'][seed % 5]} Rd, Troy, MI 48084, USA`,
      shortFormattedAddress: `${100 + (seed % 900)} ${['Maple', 'Oak', 'Big Beaver', 'Crooks', 'Long Lake'][seed % 5]} Rd, Troy`,
      addressComponents: [
        { longText: 'Troy', shortText: 'Troy', types: ['locality', 'political'] },
        { longText: 'Michigan', shortText: 'MI', types: ['administrative_area_level_1', 'political'] },
        { longText: '48084', shortText: '48084', types: ['postal_code'] },
      ],
      location: { latitude: lat + dLat, longitude: lng + dLng },
      types,
      primaryType: types[0],
      primaryTypeDisplayName: { text: types[0].replace(/_/g, ' ') },
      rating: Math.round((4 + (seed % 10) / 10) * 10) / 10,
      userRatingCount: 20 + (seed % 700),
      priceLevel: ['PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_MODERATE', 'PRICE_LEVEL_EXPENSIVE'][seed % 3],
      photos: [
        {
          name: `places/${id}/photos/AUmockphoto${h(name).slice(0, 16)}`,
          widthPx: 1200,
          heightPx: 800,
          authorAttributions: [{ displayName: 'Mock Photographer', uri: 'https://maps.google.com/maps/contrib/0' }],
        },
      ],
      businessStatus: 'OPERATIONAL',
      googleMapsUri: `https://maps.google.com/?q=${encodeURIComponent(name)}`,
    }
    remember(id, place)
    return place
  })

  // Edge cases, attached to the generic party-venue query.
  if (/birthday party venue/i.test(query)) {
    const shared = out[0]
    out.push({ ...shared }) // duplicate within one response
    const noPhoto = { ...out[1], id: `ChIJmocknophoto${h(query).slice(0, 10)}`, displayName: { text: 'Hidden Gem Party Loft' }, photos: undefined, rating: undefined, userRatingCount: undefined, priceLevel: undefined, formattedAddress: undefined, shortFormattedAddress: undefined }
    const closed = { ...out[2], id: `ChIJmockclosed${h(query).slice(0, 10)}`, displayName: { text: 'Closed Forever Fun House' }, businessStatus: 'CLOSED_PERMANENTLY' }
    const far = { ...out[2], id: `ChIJmockfaraway${h(query).slice(0, 10)}`, displayName: { text: 'Way Too Far Funland' }, location: { latitude: lat + 1.5, longitude: lng } }
    for (const p of [noPhoto, closed, far]) remember(p.id, p)
    out.push(noPhoto, closed, far)
  }
  return out
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch {
        resolve({})
      }
    })
  })
}

async function failIfMode(res) {
  if (mode === 'quota') return send(res, 429, { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded (mock)' } }), true
  if (mode === 'error') return send(res, 503, { error: { code: 503, status: 'UNAVAILABLE', message: 'Backend error (mock)' } }), true
  if (mode === 'timeout') {
    await new Promise((r) => setTimeout(r, 15_000))
    return send(res, 504, { error: { status: 'DEADLINE_EXCEEDED' } }), true
  }
  return false
}

// ---------------------------------------------------------------------------
// Mock Resend (POST /emails) and mock Dodo test mode (POST /checkouts + a hosted
// pay page that delivers a Standard-Webhooks-signed event to the app).
// ---------------------------------------------------------------------------
const emails = []
const sessions = new Map()
const WEBHOOK_SECRET = process.env.DODO_PAYMENTS_WEBHOOK_SECRET || ''
const APP_WEBHOOK_URL = process.env.MOCK_APP_WEBHOOK_URL || ''

function signStandardWebhook(id, ts, body) {
  const key = WEBHOOK_SECRET.startsWith('whsec_') ? Buffer.from(WEBHOOK_SECRET.slice(6), 'base64') : Buffer.from(WEBHOOK_SECRET)
  return `v1,${createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64')}`
}

async function deliverWebhook(event) {
  const id = `msg_${randomUUID()}`
  const ts = Math.floor(Date.now() / 1000)
  const body = JSON.stringify(event)
  const r = await fetch(APP_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': signStandardWebhook(id, ts, body) }, body })
  return r.status
}

const PRICES = { STARTER: 999, PLUS: 1999, PRO: 2999 }

async function handleServices(req, res, url) {
  const path = url.pathname
  if (path === '/emails' && req.method === 'POST') {
    const body = await readBody(req)
    emails.push({ ...body, idempotencyKey: req.headers['idempotency-key'] || null, at: Date.now() })
    send(res, 200, { id: `email_${emails.length}` })
    return true
  }
  if (path === '/__mock/emails') {
    send(res, 200, emails.map((e) => ({ to: e.to, subject: e.subject, from: e.from, html: e.html })))
    return true
  }
  if (path === '/checkouts' && req.method === 'POST') {
    if (!/^Bearer \S+/.test(req.headers.authorization || '')) return send(res, 401, { message: 'unauthorized' }), true
    const body = await readBody(req)
    const id = `cks_${randomUUID().slice(0, 12)}`
    sessions.set(id, body)
    send(res, 200, { session_id: id, checkout_url: `http://${HOST}:${PORT}/__dodo/pay/${id}` })
    return true
  }
  const pay = path.match(/^\/__dodo\/pay\/(cks_[\w-]+)(\/(complete|decline))?$/)
  if (pay) {
    const session = sessions.get(pay[1])
    if (!session) return send(res, 404, { message: 'unknown session' }), true
    if (!pay[3]) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`<!doctype html><meta name=viewport content="width=device-width"><title>Dodo test checkout</title><body style="font-family:sans-serif;padding:24px"><h1>Dodo Payments (test mode)</h1><p>Product ${session.product_cart?.[0]?.product_id}</p><form method=post action="/__dodo/pay/${pay[1]}/complete"><button style="font-size:20px;padding:12px 24px">Pay now</button></form><form method=post action="/__dodo/pay/${pay[1]}/decline"><button>Decline card</button></form></body>`)
      return true
    }
    const ok = pay[3] === 'complete'
    const plan = session.metadata?.mbp_plan
    const paymentId = `pay_${randomUUID().slice(0, 12)}`
    const event = {
      business_id: 'bus_mock',
      type: ok ? 'payment.succeeded' : 'payment.failed',
      timestamp: new Date().toISOString(),
      data: {
        payload_type: 'Payment',
        payment_id: paymentId,
        status: ok ? 'succeeded' : 'failed',
        total_amount: PRICES[plan] ?? 0,
        currency: 'USD',
        product_cart: session.product_cart,
        customer: { customer_id: `cus_${createHash('sha1').update(String(session.customer?.email || session.customer?.customer_id)).digest('hex').slice(0, 10)}`, email: session.customer?.email, name: session.customer?.name },
        metadata: session.metadata || {},
      },
    }
    const status = await deliverWebhook(event)
    const ret = new URL(session.return_url)
    ret.searchParams.set('payment_id', paymentId)
    ret.searchParams.set('status', ok ? 'succeeded' : 'failed')
    res.writeHead(303, { Location: ret.toString(), 'x-webhook-status': String(status) })
    res.end()
    return true
  }
  return false
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`)
  const path = url.pathname
  if (await handleServices(req, res, url)) return

  if (path === '/__mock/mode' && req.method === 'POST') {
    mode = (await readBody(req)).mode || 'ok'
    return send(res, 200, { mode })
  }
  if (path === '/__mock/stats') return send(res, 200, { mode, ...stats })
  if (path === '/__mock/reset') {
    mode = 'ok'
    stats = { searchText: 0, details: 0, photo: 0, geocode: 0 }
    return send(res, 200, { ok: true })
  }
  if (path === '/health') return send(res, 200, { ok: true })

  if (!req.headers['x-goog-api-key'] && !url.searchParams.get('key') && !path.startsWith('/__photo/')) {
    return send(res, 403, { error: { status: 'PERMISSION_DENIED', message: 'API key missing (mock)' } })
  }

  if (path === '/v1/places:searchText' && req.method === 'POST') {
    stats.searchText++
    if (await failIfMode(res)) return
    const body = await readBody(req)
    if (mode === 'empty') return send(res, 200, {})
    const c = body?.locationBias?.circle?.center ?? { latitude: 42.5627, longitude: -83.1799 }
    return send(res, 200, { places: placesFor(String(body.textQuery || ''), c.latitude, c.longitude) })
  }

  const media = path.match(/^\/v1\/(places\/[^/]+\/photos\/[^/]+)\/media$/)
  if (media) {
    stats.photo++
    if (await failIfMode(res)) return
    return send(res, 200, { name: media[1], photoUri: `http://${HOST}:${PORT}/__photo/${encodeURIComponent(media[1])}.svg` })
  }

  const details = path.match(/^\/v1\/places\/([A-Za-z0-9_-]+)$/)
  if (details && req.method === 'GET') {
    stats.details++
    if (await failIfMode(res)) return
    const base = known.get(details[1])
    if (!base) return send(res, 404, { error: { status: 'NOT_FOUND', message: 'Place not found (mock)' } })
    const hasWebsite = !/nophoto/.test(base.id)
    return send(res, 200, {
      ...base,
      nationalPhoneNumber: '(248) 555-0142',
      websiteUri: hasWebsite ? 'https://example.com/' : undefined,
      regularOpeningHours: {
        openNow: true,
        weekdayDescriptions: ['Monday: 10:00 AM – 8:00 PM', 'Tuesday: 10:00 AM – 8:00 PM', 'Wednesday: 10:00 AM – 8:00 PM', 'Thursday: 10:00 AM – 8:00 PM', 'Friday: 10:00 AM – 9:00 PM', 'Saturday: 9:00 AM – 9:00 PM', 'Sunday: 11:00 AM – 6:00 PM'],
      },
      editorialSummary: { text: 'Fictional mock venue used for automated tests.' },
      goodForChildren: true,
      goodForGroups: true,
    })
  }

  if (path.startsWith('/__photo/')) {
    const hue = parseInt(h(path).slice(0, 2), 16) * 1.4
    res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' })
    return res.end(
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,72%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},70%,55%)"/></linearGradient></defs><rect width="640" height="420" fill="url(#g)"/><circle cx="520" cy="90" r="46" fill="rgba(255,255,255,.35)"/><text x="40" y="380" font-family="sans-serif" font-size="22" fill="rgba(255,255,255,.85)">mock photo</text></svg>`,
    )
  }

  if (path === '/maps/api/geocode/json') {
    stats.geocode++
    const comp = url.searchParams.get('components') || ''
    const zip = comp.match(/postal_code:(\d{5})/)?.[1]
    if (!zip || zip === '99999') return send(res, 200, { status: 'ZERO_RESULTS', results: [] })
    return send(res, 200, {
      status: 'OK',
      results: [{ geometry: { location: { lat: 40, lng: -100 } }, address_components: [{ long_name: 'Mockville', short_name: 'Mockville', types: ['locality'] }, { long_name: 'Kansas', short_name: 'KS', types: ['administrative_area_level_1'] }] }],
    })
  }

  send(res, 404, { error: { status: 'NOT_FOUND', message: `No mock for ${req.method} ${path}` } })
})

server.listen(PORT, HOST, () => console.log(`mock-google listening on http://${HOST}:${PORT}`))
