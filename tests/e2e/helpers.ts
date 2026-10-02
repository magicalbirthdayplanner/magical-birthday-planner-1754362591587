import { createClient } from '@supabase/supabase-js'
import type { Page } from '@playwright/test'

const URL = 'http://127.0.0.1:54321'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const opts = { auth: { persistSession: false, autoRefreshToken: false } }

export interface Seeded {
  email: string
  password: string
  partyId: string | null
}

/** Create a confirmed user (and optionally a party) directly in the local stack. */
export async function seedUser(opts2: { zip?: string; lat?: number; lng?: number; withParty?: boolean } = {}): Promise<Seeded> {
  const admin = createClient(URL, SERVICE, opts)
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`
  const password = 'e2e-password-123'
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: 'Riley' } })
  if (error) throw error
  if (opts2.withParty === false) return { email, password, partyId: null }
  const user = createClient(URL, ANON, opts)
  await user.auth.signInWithPassword({ email, password })
  const date = new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10)
  const { data: party, error: pe } = await user
    .from('parties')
    .insert({
      user_id: data.user!.id, child_name: 'Mia', child_age: 6, party_date: date, zip_code: opts2.zip ?? '48084', guest_count: 15, budget: 400,
      interests: ['science'], venue_type: 'mixed', latitude: opts2.lat ?? 42.5627, longitude: opts2.lng ?? -83.1799, search_radius_miles: 20,
    })
    .select('id')
    .single()
  if (pe) throw pe
  return { email, password, partyId: party!.id }
}

export async function login(page: Page, s: Seeded, next = '/home') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByLabel('Email').fill(s.email)
  await page.getByLabel('Password', { exact: true }).fill(s.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(`**${next}`)
}

export async function mockMode(mode: 'ok' | 'empty' | 'quota' | 'timeout' | 'error') {
  await fetch('http://127.0.0.1:4010/__mock/mode', { method: 'POST', body: JSON.stringify({ mode }) })
}

/** App alerts, excluding Next.js's own route announcer (also role="alert"). */
export const appAlert = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)')

/** Remove cached searches and stored venues around a point so a test starts from "nothing known". */
export async function clearArea(lat: number, lng: number, deg = 0.6) {
  const admin = createClient(URL, SERVICE, opts)
  await admin.from('venue_searches').delete().gte('latitude', lat - deg).lte('latitude', lat + deg).gte('longitude', lng - deg).lte('longitude', lng + deg)
  await admin.from('venues').delete().gte('latitude', lat - deg).lte('latitude', lat + deg).gte('longitude', lng - deg).lte('longitude', lng + deg)
}

/** Remove only cached searches (keep stored venues) around a point. */
export async function clearSearches(lat: number, lng: number, deg = 0.6) {
  const admin = createClient(URL, SERVICE, opts)
  await admin.from('venue_searches').delete().gte('latitude', lat - deg).lte('latitude', lat + deg).gte('longitude', lng - deg).lte('longitude', lng + deg)
}

/** End any sign-up trial so the account is on FREE (as an expired-trial user would be). */
export async function makeFree(email: string) {
  const admin = createClient(URL, SERVICE, opts)
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const user = data.users.find((u) => u.email === email)
  if (!user) throw new Error('user not found')
  await admin.from('users').update({ is_trial_active: false, trial_expires_at: '2020-01-01T00:00:00Z' }).eq('id', user.id)
  await admin.rpc('recompute_entitlement', { p_user: user.id })
}

export interface MockEmail {
  to: string[]
  subject: string
  from: string
  html: string
}
export async function mockEmails(): Promise<MockEmail[]> {
  return (await fetch('http://127.0.0.1:4010/__mock/emails')).json()
}

/** Grant the server-managed super_admin role (as the production seed does) — test stack only. */
export async function grantSuperAdmin(email: string) {
  const admin = createClient(URL, SERVICE, opts)
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const user = data.users.find((u) => u.email === email)
  if (!user) throw new Error('user not found')
  const { error } = await admin.from('user_roles').insert({ user_id: user.id, role: 'super_admin' })
  if (error) throw error
  return user.id
}
