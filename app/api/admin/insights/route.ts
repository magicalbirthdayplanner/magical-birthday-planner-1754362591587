import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/server/admin'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { apiError } from '@/lib/server/http'
import { reportDbError } from '@/lib/observability/telemetry'
import {
  biggestDrop,
  buildDays,
  buildDevices,
  buildFeatures,
  buildFunnel,
  buildSources,
  etMidnightIso,
  lastDays,
  withoutStaff,
  type EventRow,
} from '@/lib/admin/insights'
import { allAuthUsers, displayName, staffIds } from '@/lib/admin/server'

export const fetchCache = 'force-no-store'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

type Admin = ReturnType<typeof getSupabaseAdmin>
const MAX_EVENTS = 50_000
const PAGE = 1000

async function loadEvents(admin: Admin, sinceIso: string): Promise<EventRow[]> {
  const out: EventRow[] = []
  for (let from = 0; from < MAX_EVENTS; from += PAGE) {
    const { data, error } = await admin
      .from('analytics_events')
      .select('event, user_id, anonymous_id, party_id, properties, path, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    out.push(...((data ?? []) as EventRow[]))
    if (!data || data.length < PAGE) break
  }
  return out
}

/**
 * GET /api/admin/insights?days=7 → how people use the product (Super Admin only; 404 for everyone else):
 * funnel by device, biggest drop-off, per-day trend, traffic sources, feature use, problems (AI/email/search/payment
 * failures, unconfirmed sign-ups), every real user, every real party and the most recent visitors.
 * Staff, test and ADMIN_EXCLUDE_EMAILS accounts — and every device they ever signed in on — are left out.
 */
export async function GET(req: Request) {
  const { error } = await requireSuperAdmin(req)
  if (error) return error
  const n = Number(new URL(req.url).searchParams.get('days') ?? 7)
  const days = Number.isInteger(n) && n >= 1 && n <= 90 ? n : 7
  const dayList = lastDays(days)
  const since = etMidnightIso(dayList[0])
  const admin = getSupabaseAdmin()

  try {
    const users = await allAuthUsers(admin)
    const staff = await staffIds(admin, users)
    const real = users.filter((u) => !staff.has(u.id))
    const realIds = real.map((u) => u.id)
    const inReal = realIds.length ? realIds : ['00000000-0000-0000-0000-000000000000']

    const [rawEvents, partiesRes, aiRes, foundingRes, overridesRes, purchasesRes, emailRes, webhookRes] = await Promise.all([
      loadEvents(admin, since),
      admin.from('parties').select('id, user_id, child_name, child_age, party_date, party_time, city, state, zip_code, country_code, theme, interests, guest_count, budget, status, created_at, updated_at').in('user_id', inReal).order('created_at', { ascending: false }).limit(300),
      admin.from('ai_generations').select('user_id, party_id, feature, status, error_code, created_at').in('user_id', inReal).order('created_at', { ascending: false }).limit(2000),
      admin.from('founding_members').select('user_id, seat'),
      admin.from('plan_overrides').select('user_id, plan, expires_at'),
      admin.from('billing_purchases').select('user_id, plan, status').eq('status', 'active'),
      admin.from('email_logs').select('email_type, status, error_message, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(500),
      admin.from('billing_webhook_events').select('event_type, status, detail, received_at').gte('received_at', since).in('status', ['unmatched', 'rejected', 'failed', 'error']).limit(200),
    ])
    for (const r of [partiesRes, aiRes, foundingRes, overridesRes, purchasesRes, emailRes, webhookRes]) if (r.error) throw r.error

    const events = withoutStaff(rawEvents, staff)
    const devices = buildDevices(events)
    // Magical Santa has its own journey; keep its visitors out of the birthday funnel (they stay in Visitors).
    const isSanta = (d: (typeof devices)[number]) => d.pages.length > 0 && d.pages.every((p) => p.startsWith('/santa'))
    const birthdayDevices = devices.filter((d) => !isSanta(d))
    const funnel = buildFunnel(birthdayDevices)
    const parties = partiesRes.data ?? []
    const partyIds = parties.length ? parties.map((p) => p.id) : ['00000000-0000-0000-0000-000000000000']

    const [venuesRes, guestsRes, invitesRes, checklistRes, activitiesRes] = await Promise.all([
      admin.from('party_venues').select('party_id, venue_id, custom_name').in('party_id', partyIds),
      admin.from('guests').select('party_id, rsvp_status').in('party_id', partyIds),
      admin.from('party_invitations').select('party_id, share_count, is_active').in('party_id', partyIds),
      admin.from('checklist_items').select('party_id, completed_at').in('party_id', partyIds),
      admin.from('party_activities').select('party_id').in('party_id', partyIds),
    ])
    for (const r of [venuesRes, guestsRes, invitesRes, checklistRes, activitiesRes]) if (r.error) throw r.error
    const venueIds = [...new Set((venuesRes.data ?? []).map((v) => v.venue_id).filter((x): x is string => !!x))]
    const { data: venueRows } = venueIds.length ? await admin.from('venues').select('id, name, city, rating').in('id', venueIds) : { data: [] }
    const venueName = new Map((venueRows ?? []).map((v) => [v.id, v.name]))

    const ai = aiRes.data ?? []
    const byId = new Map(users.map((u) => [u.id, u]))
    const firstDeviceOf = new Map<string, string>()
    for (const d of [...devices].reverse()) if (d.userId && !firstDeviceOf.has(d.userId)) firstDeviceOf.set(d.userId, d.source)
    const lastEventOf = new Map<string, string>()
    const eventCountOf = new Map<string, number>()
    for (const e of events) {
      if (!e.user_id) continue
      lastEventOf.set(e.user_id, e.created_at)
      eventCountOf.set(e.user_id, (eventCountOf.get(e.user_id) ?? 0) + 1)
    }
    const founding = new Map((foundingRes.data ?? []).map((f) => [f.user_id, f.seat]))
    const override = new Map((overridesRes.data ?? []).map((o) => [o.user_id, o]))
    const paid = new Set((purchasesRes.data ?? []).map((p) => p.user_id))

    const userRows = real
      .map((u) => {
        const mine = ai.filter((a) => a.user_id === u.id)
        const lastActive = [lastEventOf.get(u.id), u.last_sign_in_at].filter(Boolean).sort().pop() ?? null
        const seat = founding.get(u.id)
        const o = override.get(u.id)
        return {
          id: u.id,
          name: displayName(u),
          email: u.email ?? null,
          joinedAt: u.created_at,
          confirmed: !!u.email_confirmed_at,
          lastActive,
          plan: paid.has(u.id) ? 'Paid' : seat ? `Founding #${seat} (Pro)` : o ? `${o.plan} (admin)` : 'Free',
          parties: parties.filter((p) => p.user_id === u.id).length,
          eventsInRange: eventCountOf.get(u.id) ?? 0,
          aiOk: mine.filter((a) => a.status === 'success').length,
          aiFailed: mine.filter((a) => a.status === 'failed').length,
          source: firstDeviceOf.get(u.id) ?? null,
        }
      })
      .sort((a, b) => (b.lastActive ?? b.joinedAt).localeCompare(a.lastActive ?? a.joinedAt))

    const today = dayList[dayList.length - 1]
    const partyRows = parties.map((p) => {
      const owner = byId.get(p.user_id)
      const checklist = (checklistRes.data ?? []).filter((c) => c.party_id === p.id)
      const mineAi = ai.filter((a) => a.party_id === p.id)
      return {
        id: p.id,
        owner: owner ? displayName(owner) ?? owner.email : null,
        ownerId: p.user_id,
        child: p.child_name,
        age: p.child_age,
        date: p.party_date,
        daysAway: p.party_date ? Math.round((Date.parse(p.party_date) - Date.parse(today)) / 86_400_000) : null,
        time: p.party_time,
        place: [p.city, p.state].filter(Boolean).join(', ') || p.zip_code,
        country: p.country_code,
        theme: p.theme,
        interests: p.interests ?? [],
        guestCount: p.guest_count,
        budget: p.budget,
        status: p.status,
        venues: (venuesRes.data ?? []).filter((v) => v.party_id === p.id).map((v) => v.custom_name || (v.venue_id ? venueName.get(v.venue_id) : null) || 'Venue'),
        guestsAdded: (guestsRes.data ?? []).filter((g) => g.party_id === p.id).length,
        rsvpsYes: (guestsRes.data ?? []).filter((g) => g.party_id === p.id && /^(yes|attending|confirmed)$/i.test(g.rsvp_status ?? '')).length,
        invitations: (invitesRes.data ?? []).filter((i) => i.party_id === p.id).length,
        invitesShared: (invitesRes.data ?? []).filter((i) => i.party_id === p.id).reduce((s, i) => s + (i.share_count ?? 0), 0),
        activities: (activitiesRes.data ?? []).filter((a) => a.party_id === p.id).length,
        checklistDone: checklist.filter((c) => c.completed_at).length,
        checklistTotal: checklist.length,
        aiOk: mineAi.filter((a) => a.status === 'success').length,
        aiFailed: mineAi.filter((a) => a.status === 'failed').length,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }
    })

    // ------------------------------------------------------------ problems, worst first
    type Problem = { severity: 'critical' | 'serious' | 'warning'; title: string; detail: string; count: number; lastAt: string | null }
    const problems: Problem[] = []
    const aiFailedInRange = ai.filter((a) => a.status === 'failed' && a.created_at >= since)
    const aiOkInRange = ai.filter((a) => a.status === 'success' && a.created_at >= since)
    if (aiFailedInRange.length) {
      const codes = [...new Set(aiFailedInRange.map((a) => a.error_code ?? 'unknown'))]
      problems.push({
        severity: aiOkInRange.length ? 'serious' : 'critical',
        title: aiOkInRange.length ? 'Some AI requests fail' : 'Every AI request fails',
        detail: `${aiFailedInRange.length} failed, ${aiOkInRange.length} worked · ${new Set(aiFailedInRange.map((a) => a.user_id)).size} ${new Set(aiFailedInRange.map((a) => a.user_id)).size === 1 ? 'person' : 'people'} affected · ${codes.join(', ')}`,
        count: aiFailedInRange.length,
        lastAt: aiFailedInRange[0]?.created_at ?? null,
      })
    }
    const unconfirmed = real.filter((u) => !u.email_confirmed_at && u.created_at >= since && Date.now() - Date.parse(u.created_at) > 30 * 60_000)
    if (unconfirmed.length) problems.push({ severity: 'serious', title: 'Sign-ups that never entered their email code', detail: unconfirmed.map((u) => displayName(u) ?? u.email).join(', '), count: unconfirmed.length, lastAt: unconfirmed.map((u) => u.created_at).sort().pop() ?? null })
    const emailFailed = (emailRes.data ?? []).filter((e) => e.status && !/^(sent|delivered|queued)$/i.test(e.status))
    if (emailFailed.length) problems.push({ severity: 'serious', title: 'Emails that failed to send', detail: [...new Set(emailFailed.map((e) => `${e.email_type ?? 'email'}: ${e.error_message ?? e.status}`))].slice(0, 4).join(' · '), count: emailFailed.length, lastAt: emailFailed[0].created_at })
    const badSearch = events.filter((e) => e.event === 'venue_search_completed' && ((Number(e.properties?.apiErrors) || 0) > 0 || e.properties?.degraded || e.properties?.results === 0))
    if (badSearch.length) problems.push({ severity: 'warning', title: 'Venue searches with errors or no results', detail: `${badSearch.length} of ${events.filter((e) => e.event === 'venue_search_completed').length} searches`, count: badSearch.length, lastAt: badSearch[badSearch.length - 1].created_at })
    const payFailed = events.filter((e) => e.event === 'payment_failed')
    const hooks = webhookRes.data ?? []
    if (payFailed.length || hooks.length) problems.push({ severity: 'serious', title: 'Payment problems', detail: `${payFailed.length} failed payments · ${hooks.length} payment notifications not matched`, count: payFailed.length + hooks.length, lastAt: null })
    const blocked = events.filter((e) => e.event === 'ai_feature_blocked')
    if (blocked.length) problems.push({ severity: 'warning', title: 'AI features blocked (plan or limit)', detail: [...new Set(blocked.map((e) => String(e.properties?.reason ?? e.properties?.feature ?? '')))].filter(Boolean).join(', '), count: blocked.length, lastAt: blocked[blocked.length - 1].created_at })
    const drop = biggestDrop(funnel)
    if (drop && drop.lost >= 3) problems.push({ severity: 'warning', title: `Biggest drop-off: after “${drop.after}”`, detail: `${drop.lost} people (${Math.round(drop.share * 100)}%) went no further`, count: drop.lost, lastAt: null })
    const rank = { critical: 0, serious: 1, warning: 2 }
    problems.sort((a, b) => rank[a.severity] - rank[b.severity] || b.count - a.count)

    return NextResponse.json({
      range: { days, since, dayList },
      totals: { visitors: birthdayDevices.length, santaVisitors: devices.length - birthdayDevices.length, accounts: userRows.filter((u) => u.joinedAt >= since).length, parties: partyRows.filter((p) => (p.createdAt ?? "") >= since).length, allUsers: userRows.length, allParties: partyRows.length },
      funnel,
      days: buildDays(events, dayList),
      sources: buildSources(birthdayDevices),
      features: buildFeatures(events),
      problems,
      users: userRows,
      parties: partyRows,
      devices: devices.slice(0, 200).map((d) => ({ ...d, userName: d.userId ? (byId.get(d.userId) ? displayName(byId.get(d.userId)!) ?? byId.get(d.userId)!.email : null) : null })),
    })
  } catch (err) {
    reportDbError('admin_insights', err as { code?: string })
    return apiError(500, 'server_error', 'Could not build the usage report.')
  }
}
