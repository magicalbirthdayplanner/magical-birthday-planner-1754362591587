/**
 * buildPartyAIContext: the only party data a model ever sees. Reads through the caller's RLS-scoped client
 * (ownership is enforced by the database), then keeps just what planning needs.
 *
 * Privacy: never passwords, tokens, keys, billing, emails, phones, street addresses, ZIP, guest names or the
 * child's name ("the birthday child"). Exception: the invitation writer may receive the child's FIRST name and the
 * venue's public name/address the parent already chose (includeInvitationFields).
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/database.types'
import { computeTimeline, effectiveGuests, type TimelineKind } from '@/lib/experience/model'

export interface PartyAIContext {
  childAge: number | null
  childInterests: string[]
  partyDate: string | null
  daysUntilParty: number | null
  city: string | null
  state: string | null
  /** Guests to plan for: the planned count, or confirmed RSVPs when they exceed it. */
  guestCountEstimate: number | null
  /** Aggregates only (never names): confirmed kids/adults, awaiting replies, dietary needs mentioned in RSVPs. */
  rsvp: { kids: number; adults: number; awaiting: number; dietary: string[] } | null
  partyStartTime: string | null
  budget: number | null
  venue: { name: string; type: string | null; booked: boolean } | null
  theme: string | null
  durationMinutes: number
  indoorOutdoor: 'indoor' | 'outdoor' | 'either'
  foodPreferences: string[]
  /** Names of every activity on the party (planned or saved), to avoid repeats. */
  existingActivities: string[]
  /** Planned activities with their length and setting (what the day already holds). */
  activityPlan: { name: string; min: number | null; setting: string; planned: boolean }[]
  timeline: { label: string; min: number }[]
  menu: string[]
  savedVenueCount: number
  existingChecklist: { title: string; done: boolean }[]
  /** amount = planned estimate; actual = what the parent says they spent (null = not entered). */
  currentBudgetLines: { category: string; label: string | null; amount: number; actual: number | null }[]
  existingShoppingItems: string[]
  plan: string
  /** Invitation writer only. */
  invitation?: { childFirstName: string; venueName: string | null; venueAddress: string | null; startTime: string | null; endTime: string | null }
}

/** Whole days from today (UTC date) to the party date; null if no date. */
export function daysUntil(partyDate: string | null, today = new Date()): number | null {
  if (!partyDate || !/^\d{4}-\d{2}-\d{2}$/.test(partyDate)) return null
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  const [y, m, d] = partyDate.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - t) / 86_400_000)
}

const minutesBetween = (a: string | null, b: string | null) => {
  if (!a || !b) return null
  const [ah, am] = a.split(':').map(Number), [bh, bm] = b.split(':').map(Number)
  const d = bh * 60 + bm - (ah * 60 + am)
  return Number.isFinite(d) && d >= 30 && d <= 600 ? d : null
}

export async function buildPartyAIContext(
  supabase: SupabaseClient<Database>,
  partyId: string,
  opts: { plan: string; includeInvitationFields?: boolean; today?: Date },
): Promise<PartyAIContext | null> {
  const { data: party } = await supabase
    .from('parties')
    .select('id, child_name, child_age, interests, party_date, party_time, city, state, guest_count, budget, venue_type, theme, theme_details')
    .eq('id', partyId)
    .maybeSingle()
  if (!party) return null // RLS: another user's party is indistinguishable from a missing one

  const [venueRes, checklistRes, activitiesRes, budgetRes, inviteRes, shoppingRes, guestsRes, timelineRes, foodRes, savedRes] = await Promise.all([
    supabase.from('party_venues').select('custom_name, custom_address, is_custom, venues(name, formatted_address, address, categories, primary_type_label, category)').eq('party_id', partyId).maybeSingle(),
    supabase.from('checklist_items').select('title, completed_at').eq('party_id', partyId).order('sort_order').limit(60),
    supabase.from('party_ai_activities').select('id, name, duration_min, setting, status').eq('party_id', partyId).order('sort_order').order('created_at').limit(30),
    supabase.from('party_budget_lines').select('category, label, amount, actual_amount').eq('party_id', partyId).limit(40),
    supabase.from('party_invitations').select('start_time, end_time').eq('party_id', partyId).maybeSingle(),
    supabase.from('party_shopping_items').select('item').eq('party_id', partyId).limit(40),
    supabase.from('guests').select('rsvp_status, child_count, adult_count, dietary_restrictions').eq('party_id', partyId).limit(300),
    supabase.from('party_timeline_items').select('id, kind, label, duration_min, sort_order, activity_id').eq('party_id', partyId).limit(30),
    supabase.from('party_food_items').select('name, quantity, unit').eq('party_id', partyId).limit(20),
    supabase.from('saved_venues').select('id', { count: 'exact', head: true }).eq('party_id', partyId),
  ])

  const v = venueRes.data as null | { custom_name: string | null; custom_address: string | null; is_custom: boolean | null; venues: { name: string | null; formatted_address: string | null; address: string | null; categories: string[] | null; primary_type_label: string | null; category: string | null } | null }
  const venueName = v ? (v.is_custom ? v.custom_name : v.venues?.name) ?? null : null
  const venueType = v?.venues?.primary_type_label ?? v?.venues?.category ?? v?.venues?.categories?.[0]?.replace(/[-_]/g, ' ') ?? (v?.is_custom ? 'custom venue' : null)
  const details = (party.theme_details ?? null) as null | { name?: string }
  const invite = (inviteRes as { data: null | { start_time: string | null; end_time: string | null } }).data
  const setting = party.venue_type === 'indoor' || party.venue_type === 'outdoor' ? party.venue_type : 'either'
  const acts = activitiesRes.data ?? []
  const guests = guestsRes.data ?? []
  const yes = guests.filter((g) => g.rsvp_status === 'CONFIRMED')
  const rsvp = guests.length
    ? {
        kids: yes.reduce((s, g) => s + (g.child_count ?? 0), 0),
        adults: yes.reduce((s, g) => s + (g.adult_count ?? 0), 0),
        awaiting: guests.filter((g) => !g.rsvp_status || g.rsvp_status === 'PENDING' || g.rsvp_status === 'MAYBE').length,
        dietary: [...new Set(guests.flatMap((g) => g.dietary_restrictions ?? []).map((d) => d.trim().toLowerCase().slice(0, 30)).filter(Boolean))].slice(0, 8),
      }
    : null
  const minutesOf = new Map(acts.map((a) => [a.id, a.duration_min]))
  const nameOf = new Map(acts.map((a) => [a.id, a.name]))
  const startTime = (party.party_time ?? invite?.start_time ?? null)?.slice(0, 5) ?? null
  const tl = computeTimeline((timelineRes.data ?? []).map((r) => ({ ...r, kind: r.kind as TimelineKind, label: (r.activity_id && nameOf.get(r.activity_id)) || r.label })), (id) => minutesOf.get(id) ?? null, startTime)

  const ctx: PartyAIContext = {
    childAge: party.child_age ?? null,
    childInterests: (party.interests ?? []).slice(0, 12),
    partyDate: party.party_date ?? null,
    daysUntilParty: daysUntil(party.party_date ?? null, opts.today),
    city: party.city ?? null,
    state: party.state ?? null,
    guestCountEstimate: effectiveGuests(party.guest_count, rsvp), // guest_count 0 is the column default = "not set"
    rsvp,
    partyStartTime: startTime,
    budget: party.budget != null ? Number(party.budget) : null,
    venue: venueName ? { name: venueName.slice(0, 120), type: venueType, booked: true } : null,
    theme: details?.name ?? (party.theme && !party.theme.startsWith('ai:') ? party.theme : null),
    durationMinutes: minutesBetween(invite?.start_time ?? null, invite?.end_time ?? null) ?? 120,
    indoorOutdoor: setting,
    foodPreferences: [],
    existingActivities: acts.map((a) => a.name),
    activityPlan: acts.filter((a) => a.status === 'planned').slice(0, 12).map((a) => ({ name: a.name, min: a.duration_min, setting: a.setting, planned: true })),
    timeline: tl.rows.slice(0, 14).map((r) => ({ label: r.label.slice(0, 60), min: r.minutes })),
    menu: (foodRes.data ?? []).map((f) => [f.quantity != null ? Number(f.quantity) : null, f.unit, f.name].filter(Boolean).join(' ').slice(0, 60)),
    savedVenueCount: savedRes.count ?? 0,
    existingChecklist: (checklistRes.data ?? []).map((c) => ({ title: c.title, done: !!c.completed_at })),
    currentBudgetLines: (budgetRes.data ?? []).map((b) => ({ category: b.category, label: b.label, amount: Number(b.amount), actual: b.actual_amount != null ? Number(b.actual_amount) : null })),
    existingShoppingItems: (shoppingRes.data ?? []).map((x) => x.item),
    plan: opts.plan,
  }
  if (opts.includeInvitationFields) {
    ctx.invitation = {
      childFirstName: (party.child_name ?? '').trim().split(/\s+/)[0]?.slice(0, 40) ?? '',
      venueName,
      venueAddress: v ? (v.is_custom ? v.custom_address : v.venues?.formatted_address ?? v.venues?.address) ?? null : null,
      startTime: invite?.start_time ?? null,
      endTime: invite?.end_time ?? null,
    }
  }
  return ctx
}

/** The JSON a prompt receives. Keys are stable so prompts stay small and predictable. */
export function contextForPrompt(ctx: PartyAIContext): string {
  const { invitation, activityPlan, existingActivities, timeline, menu, rsvp, savedVenueCount, ...rest } = ctx
  // Compact: empty sections are left out; planned activities carry length/setting, other names are listed once.
  const planned = new Set(activityPlan.map((a) => a.name))
  const out: Record<string, unknown> = {
    ...rest,
    existingActivities: [...activityPlan.map((a) => ({ name: a.name, min: a.min, setting: a.setting })), ...existingActivities.filter((n) => !planned.has(n)).map((name) => ({ name, idea: true }))],
  }
  if (timeline.length) out.timeline = timeline
  if (menu.length) out.menu = menu
  if (rsvp) out.rsvp = rsvp
  if (savedVenueCount) out.savedVenueCount = savedVenueCount
  if (invitation) out.invitation = invitation
  for (const k of ['existingActivities', 'existingChecklist', 'currentBudgetLines', 'existingShoppingItems', 'foodPreferences'] as const) if (Array.isArray(out[k]) && !(out[k] as unknown[]).length) delete out[k]
  return JSON.stringify(out)
}
