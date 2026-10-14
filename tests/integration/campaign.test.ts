/**
 * Site-wide free launch campaign (migration 20251014002300): while it runs, every account gets every plan (Pro) on
 * every party — in the database (has_paid_access → guests/invitations RLS) and on the server (getUserPlan /
 * getPartyPlan → AI tiers, checkout). Overrides still win; purchases are untouched; everything reverts when it ends.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL, adminClient, anonClient, createTestUser, deleteTestUser, isSupabaseUp, setLaunchCampaign, type TestUser } from './helpers/supabase'

Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  DODO_PAYMENTS_API_KEY: 'test_dodo_key',
  DODO_PAYMENTS_ENVIRONMENT: 'test_mode',
  DODO_PRODUCT_STARTER: 'pdt_itStarter001',
  DODO_PRODUCT_PLUS: 'pdt_itPlus000002',
  DODO_PRODUCT_PRO: 'pdt_itPro0000003',
})

const { getPartyPlan, getUserPlan } = await import('@/lib/billing/server')
const { tierFor } = await import('@/lib/ai/capabilities')
const checkout = await import('@/app/api/billing/checkout/route')
const campaignRoute = await import('@/app/api/campaign/route')
const { resetRateLimits } = await import('@/lib/server/rate-limit')

const admin = adminClient()
let U: TestUser
let partyUS: string
let partyIN: string
const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
const makeFree = async (u: TestUser) => {
  await admin.from('users').update({ is_trial_active: false, trial_expires_at: '2020-01-01T00:00:00Z' }).eq('id', u.id)
  await admin.rpc('recompute_entitlement', { p_user: u.id })
}
const buy = (plan: string, partyId: string) =>
  checkout.POST(new Request('http://app.test/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${U.accessToken}` }, body: JSON.stringify({ plan, partyId }) }))

beforeAll(async () => {
  if (!(await isSupabaseUp())) throw new Error('Local Supabase is not running')
  U = await createTestUser('campaign-u')
  await makeFree(U)
  const mk = async (over: Record<string, unknown>) => (await U.client.from('parties').insert({ user_id: U.id, child_name: 'Mia', child_age: 6, party_date: inDays(20), zip_code: '48084', ...over }).select('id').single()).data!.id as string
  partyUS = await mk({})
  partyIN = await mk({ country_code: 'IN', zip_code: '560001', timezone: 'Asia/Kolkata' })
})

afterAll(async () => {
  await setLaunchCampaign(false)
  await deleteTestUser(U)
})

beforeEach(() => resetRateLimits())

describe('launch campaign', () => {
  it('off (the normal model): a Free account has no paid access', async () => {
    await setLaunchCampaign(false)
    expect((await U.client.rpc('has_paid_access', { p_party: partyUS })).data).toBe(false)
    expect((await getPartyPlan(admin, U.id, partyUS)).source).toBe('free')
    expect(await (await campaignRoute.GET()).json()).toEqual({ active: false })
  })

  it('on: every account gets every plan on every party, US and India — DB, server and AI agree', async () => {
    await setLaunchCampaign(true)
    const pub = await (await campaignRoute.GET()).json()
    expect(pub).toMatchObject({ active: true, id: 'launch-free-30', plan: 'PRO' })
    expect((await anonClient().rpc('active_campaign')).data).toHaveLength(1)
    for (const party of [partyUS, partyIN]) {
      expect((await U.client.rpc('has_paid_access', { p_party: party })).data).toBe(true)
      const plan = await getPartyPlan(admin, U.id, party)
      expect(plan).toMatchObject({ plan: 'PRO', source: 'campaign' })
      expect(tierFor(plan)).toBe('PRO')
      // guests & invitations writes (RLS) work for a Free account
      expect((await U.client.from('guests').insert({ party_id: party, user_id: U.id, name: 'The Lees' }).select('id')).error).toBeNull()
    }
    expect((await getUserPlan(admin, U.id)).campaign).toMatchObject({ id: 'launch-free-30', endsOn: '2026-11-13' })
  })

  it('on: nothing to buy — checkout answers 409 and creates nothing, for US and India parties', async () => {
    await setLaunchCampaign(true)
    for (const party of [partyUS, partyIN]) {
      const res = await buy('pro', party)
      expect(res.status).toBe(409)
      expect((await res.json()).error.message).toMatch(/free right now/)
    }
    expect((await admin.from('billing_checkouts').select('id').eq('user_id', U.id)).data).toEqual([])
  })

  it('an admin override still wins (e.g. FREE for testing)', async () => {
    await setLaunchCampaign(true)
    await admin.from('plan_overrides').upsert({ user_id: U.id, plan: 'FREE' })
    expect((await U.client.rpc('has_paid_access', { p_party: partyUS })).data).toBe(false)
    expect((await getPartyPlan(admin, U.id, partyUS)).source).toBe('admin_override')
    await admin.from('plan_overrides').delete().eq('user_id', U.id)
  })

  it('a party’s own purchase is untouched and returns when the campaign ends; data stays', async () => {
    await setLaunchCampaign(true)
    await admin.from('billing_purchases').insert({ user_id: U.id, provider: 'dodo', provider_ref: `pay_campaign_${Date.now()}`, kind: 'payment', plan: 'PLUS', status: 'active', scope: 'party', party_id: partyUS, amount_minor: 1999, currency: 'USD' })
    expect(await getPartyPlan(admin, U.id, partyUS)).toMatchObject({ plan: 'PRO', source: 'campaign', partyPurchase: 'PLUS' })
    await setLaunchCampaign(false)
    expect(await getPartyPlan(admin, U.id, partyUS)).toMatchObject({ plan: 'PLUS', source: 'purchase' })
    // India party (no purchase) is back to Free: guests created during the campaign stay readable, new ones are refused
    expect((await getPartyPlan(admin, U.id, partyIN)).source).toBe('free')
    expect((await U.client.from('guests').select('name').eq('party_id', partyIN)).data).toEqual([{ name: 'The Lees' }])
    expect((await U.client.from('guests').insert({ party_id: partyIN, user_id: U.id, name: 'Late guest' }).select('id')).error).not.toBeNull()
  })

  it('clients cannot see or change the campaign table', async () => {
    expect((await U.client.from('promo_campaigns').select('id')).error).not.toBeNull()
    const { error } = await U.client.from('promo_campaigns').update({ ends_at: '2099-01-01T00:00:00Z' }).eq('id', 'launch-free-30')
    expect(error).not.toBeNull()
  })
})
