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

export interface PartyAIContext {
  childAge: number | null
  childInterests: string[]
  partyDate: string | null
  daysUntilParty: number | null
  city: string | null
  state: string | null
  guestCountEstimate: number | null
  budget: number | null
  venue: { name: string; type: string | null; booked: boolean } | null
  theme: string | null
  durationMinutes: number
  indoorOutdoor: 'indoor' | 'outdoor' | 'either'
  foodPreferences: string[]
  existingActivities: string[]
  existingChecklist: { title: string; done: boolean }[]
  currentBudgetLines: { category: string; label: string | null; amount: number }[]
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
    .select('id, child_name, child_age, interests, party_date, city, state, guest_count, budget, venue_type, theme, theme_details')
    .eq('id', partyId)
    .maybeSingle()
  if (!party) return null // RLS: another user's party is indistinguishable from a missing one

  const [venueRes, checklistRes, activitiesRes, budgetRes, inviteRes] = await Promise.all([
    supabase.from('party_venues').select('custom_name, custom_address, is_custom, venues(name, formatted_address, address, categories, primary_type_label, category)').eq('party_id', partyId).maybeSingle(),
    supabase.from('checklist_items').select('title, completed_at').eq('party_id', partyId).order('sort_order').limit(60),
    supabase.from('party_ai_activities').select('name').eq('party_id', partyId).limit(30),
    supabase.from('party_budget_lines').select('category, label, amount').eq('party_id', partyId).limit(40),
    opts.includeInvitationFields ? supabase.from('party_invitations').select('start_time, end_time').eq('party_id', partyId).maybeSingle() : Promise.resolve({ data: null }),
  ])

  const v = venueRes.data as null | { custom_name: string | null; custom_address: string | null; is_custom: boolean | null; venues: { name: string | null; formatted_address: string | null; address: string | null; categories: string[] | null; primary_type_label: string | null; category: string | null } | null }
  const venueName = v ? (v.is_custom ? v.custom_name : v.venues?.name) ?? null : null
  const venueType = v?.venues?.primary_type_label ?? v?.venues?.category ?? v?.venues?.categories?.[0]?.replace(/[-_]/g, ' ') ?? (v?.is_custom ? 'custom venue' : null)
  const details = (party.theme_details ?? null) as null | { name?: string }
  const invite = (inviteRes as { data: null | { start_time: string | null; end_time: string | null } }).data
  const setting = party.venue_type === 'indoor' || party.venue_type === 'outdoor' ? party.venue_type : 'either'

  const ctx: PartyAIContext = {
    childAge: party.child_age ?? null,
    childInterests: (party.interests ?? []).slice(0, 12),
    partyDate: party.party_date ?? null,
    daysUntilParty: daysUntil(party.party_date ?? null, opts.today),
    city: party.city ?? null,
    state: party.state ?? null,
    guestCountEstimate: party.guest_count ?? null,
    budget: party.budget != null ? Number(party.budget) : null,
    venue: venueName ? { name: venueName.slice(0, 120), type: venueType, booked: true } : null,
    theme: details?.name ?? (party.theme && !party.theme.startsWith('ai:') ? party.theme : null),
    durationMinutes: minutesBetween(invite?.start_time ?? null, invite?.end_time ?? null) ?? 120,
    indoorOutdoor: setting,
    foodPreferences: [],
    existingActivities: (activitiesRes.data ?? []).map((a) => a.name),
    existingChecklist: (checklistRes.data ?? []).map((c) => ({ title: c.title, done: !!c.completed_at })),
    currentBudgetLines: (budgetRes.data ?? []).map((b) => ({ category: b.category, label: b.label, amount: Number(b.amount) })),
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
  const { invitation, ...rest } = ctx
  return JSON.stringify(invitation ? { ...rest, invitation } : rest)
}
