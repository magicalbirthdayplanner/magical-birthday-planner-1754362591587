/**
 * Row Level Security: User A must never see or modify User B's data.
 * Runs against the local Supabase stack (`npm run db:start && npm run db:reset`).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUser,
  isSupabaseUp,
  type TestUser,
} from './helpers/supabase'


interface World {
  user: TestUser
  partyId: string
  guestId: string
  savedVenueId: string
  checklistId: string
  invitationToken: string
  perGuestInvitationId: string
}

async function seedWorld(user: TestUser, venueId: string, placeId: string, label: string): Promise<World> {
  const c = user.client
  const { data: party, error: pe } = await c
    .from('parties')
    .insert({
      user_id: user.id,
      child_name: `${label} Child`,
      child_age: 7,
      party_date: '2026-12-12',
      zip_code: '48084',
      guest_count: 20,
      budget: 500,
      interests: ['art'],
      venue_type: 'mixed',
      latitude: 42.5627,
      longitude: -83.1799,
    })
    .select('id')
    .single()
  if (pe) throw pe
  const partyId = party!.id

  const { data: guest, error: ge } = await c
    .from('guests')
    .insert({ party_id: partyId, user_id: user.id, name: `${label} Guest`, email: `${label}@guest.test` })
    .select('id')
    .single()
  if (ge) throw ge

  const { data: saved, error: se } = await c
    .from('saved_venues')
    .insert({ party_id: partyId, venue_id: venueId, place_id: placeId, notes: `${label} private note` })
    .select('id')
    .single()
  if (se) throw se

  const { data: item, error: ce } = await c
    .from('checklist_items')
    .insert({ party_id: partyId, task_key: 'book-venue', title: 'Book the venue' })
    .select('id')
    .single()
  if (ce) throw ce

  const { data: inv, error: ie } = await c
    .from('party_invitations')
    .insert({ party_id: partyId, headline: `${label}'s party`, location_text: `${label} secret address` })
    .select('token')
    .single()
  if (ie) throw ie

  const { data: pgi, error: pgie } = await c
    .from('invitations')
    .insert({ party_id: partyId, guest_id: guest!.id, user_id: user.id, token: `${label}-${Date.now()}-tok` })
    .select('id')
    .single()
  if (pgie) throw pgie

  return {
    user,
    partyId,
    guestId: guest!.id,
    savedVenueId: saved!.id,
    checklistId: item!.id,
    invitationToken: inv!.token,
    perGuestInvitationId: pgi!.id,
  }
}

describe('RLS isolation between users', () => {
  let A: World
  let B: World
  let venueId: string
  const placeId = `test-place-${Date.now()}`

  beforeAll(async () => {
    if (!(await isSupabaseUp())) throw new Error('Local Supabase is not running: npm run db:start && npm run db:reset')
    const admin = adminClient()
    const { data: venue, error } = await admin
      .from('venues')
      .insert({ place_id: placeId, name: 'Test Art Studio', latitude: 42.56, longitude: -83.18 })
      .select('id')
      .single()
    if (error) throw error
    venueId = venue!.id
    const [ua, ub] = await Promise.all([createTestUser('rls-a'), createTestUser('rls-b')])
    A = await seedWorld(ua, venueId, placeId, 'A')
    B = await seedWorld(ub, venueId, placeId, 'B')
  })

  afterAll(async () => {
    await Promise.all([deleteTestUser(A?.user), deleteTestUser(B?.user)])
    if (venueId) await adminClient().from('venues').delete().eq('id', venueId)
  })

  const tables = [
    ['parties', (w: World) => w.partyId],
    ['guests', (w: World) => w.guestId],
    ['saved_venues', (w: World) => w.savedVenueId],
    ['checklist_items', (w: World) => w.checklistId],
    ['invitations', (w: World) => w.perGuestInvitationId],
  ] as const

  for (const [table, idOf] of tables) {
    it(`${table}: A can read A, B can read B`, async () => {
      const a = await A.user.client.from(table).select('id').eq('id', idOf(A))
      const b = await B.user.client.from(table).select('id').eq('id', idOf(B))
      expect(a.error).toBeNull()
      expect(a.data).toHaveLength(1)
      expect(b.data).toHaveLength(1)
    })

    it(`${table}: A cannot read B and B cannot read A`, async () => {
      const aReadsB = await A.user.client.from(table).select('id').eq('id', idOf(B))
      const bReadsA = await B.user.client.from(table).select('id').eq('id', idOf(A))
      expect(aReadsB.data).toEqual([])
      expect(bReadsA.data).toEqual([])
    })

    it(`${table}: A cannot update or delete B's row`, async () => {
      const upd = await A.user.client.from(table).update({ updated_at: new Date().toISOString() } as never).eq('id', idOf(B)).select('id')
      expect(upd.data ?? []).toEqual([])
      const del = await A.user.client.from(table).delete().eq('id', idOf(B)).select('id')
      expect(del.data ?? []).toEqual([])
      const still = await adminClient().from(table).select('id').eq('id', idOf(B))
      expect(still.data).toHaveLength(1)
    })

    it(`${table}: anonymous callers see nothing`, async () => {
      const { data } = await anonClient().from(table).select('id').in('id', [idOf(A), idOf(B)])
      expect(data ?? []).toEqual([])
    })
  }

  it('private notes on saved venues are not visible across users', async () => {
    const { data } = await A.user.client.from('saved_venues').select('notes')
    expect(data?.map((r) => r.notes)).toEqual(['A private note'])
  })

  it('party_invitations: A cannot read B (token, location)', async () => {
    const { data } = await A.user.client.from('party_invitations').select('token, location_text').eq('party_id', B.partyId)
    expect(data).toEqual([])
    const own = await A.user.client.from('party_invitations').select('location_text').eq('party_id', A.partyId)
    expect(own.data).toEqual([{ location_text: 'A secret address' }])
  })

  it("A cannot attach rows to B's party", async () => {
    const guest = await A.user.client.from('guests').insert({ party_id: B.partyId, user_id: A.user.id, name: 'Intruder' })
    expect(guest.error).not.toBeNull()
    const saved = await A.user.client.from('saved_venues').insert({ party_id: B.partyId, venue_id: venueId, place_id: placeId })
    expect(saved.error).not.toBeNull()
    const pv = await A.user.client.from('party_venues').insert({ party_id: B.partyId, venue_id: venueId, user_id: A.user.id })
    expect(pv.error).not.toBeNull()
  })

  it('A cannot create a party owned by B', async () => {
    const { error } = await A.user.client
      .from('parties')
      .insert({ user_id: B.user.id, child_name: 'X', child_age: 5, party_date: '2026-12-01' })
    expect(error).not.toBeNull()
  })

  it('users: A sees only their own profile row (was "everything for authenticated")', async () => {
    const { data } = await A.user.client.from('users').select('id')
    expect(data?.map((r) => r.id)).toEqual([A.user.id])
    const upd = await A.user.client.from('users').update({ full_name: 'pwned' }).eq('id', B.user.id).select('id')
    expect(upd.data ?? []).toEqual([])
  })

  it('shared parties are no longer enumerable by anonymous callers', async () => {
    await adminClient().from('parties').update({ is_shared: true }).eq('id', A.partyId)
    const { data } = await anonClient().from('parties').select('id, child_name').eq('is_shared', true)
    expect(data ?? []).toEqual([])
  })

  it('venues are public catalogue data but not writable by users', async () => {
    const read = await anonClient().from('venues').select('id').eq('id', venueId)
    expect(read.data).toHaveLength(1)
    const write = await A.user.client.from('venues').insert({ place_id: 'evil', name: 'Evil' })
    expect(write.error).not.toBeNull()
    const cache = await A.user.client.from('venue_searches').insert({ zip_code: '00000', category: 'x' })
    expect(cache.error).not.toBeNull()
  })

  it('trial escalation RPCs are no longer callable by users', async () => {
    const { error } = await A.user.client.rpc('get_trial_status' as never, { user_id: B.user.id } as never)
    expect(error).not.toBeNull()
  })

  describe('public invitation by token', () => {
    it('returns a minimal projection for a valid token', async () => {
      const { data, error } = await anonClient().rpc('get_invitation', { p_token: A.invitationToken })
      expect(error).toBeNull()
      const inv = data as Record<string, unknown>
      expect(inv.child_name).toBe('A')
      expect(inv).not.toHaveProperty('zip_code')
      expect(inv).not.toHaveProperty('budget')
      expect(inv).not.toHaveProperty('user_id')
    })

    it('returns nothing for an unknown or short token', async () => {
      const bad = await anonClient().rpc('get_invitation', { p_token: 'nope' })
      expect(bad.data).toBeNull()
      const wrong = await anonClient().rpc('get_invitation', { p_token: 'f'.repeat(48) })
      expect(wrong.data).toBeNull()
    })

    it('submit_rsvp cannot be called directly from a browser (server route only)', async () => {
      const { error } = await anonClient().rpc('submit_rsvp', {
        p_token: A.invitationToken, p_name: 'Direct', p_email: 'x@example.test', p_status: 'CONFIRMED', p_adults: 1, p_children: 0,
      })
      expect(error?.code).toBe('42501')
      const authed = await A.user.client.rpc('submit_rsvp', {
        p_token: A.invitationToken, p_name: 'Direct', p_email: 'x@example.test', p_status: 'CONFIRMED', p_adults: 1, p_children: 0,
      })
      expect(authed.error?.code).toBe('42501')
    })

    it('rejects invalid RSVP input', async () => {
      const { error } = await anonClient().rpc('submit_rsvp', {
        p_token: A.invitationToken,
        p_name: '',
        p_email: null as unknown as string,
        p_status: 'CONFIRMED',
      })
      expect(error).not.toBeNull()
    })
  })
})
