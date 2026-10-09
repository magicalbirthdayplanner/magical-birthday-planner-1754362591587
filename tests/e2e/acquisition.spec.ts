/**
 * Paid-acquisition funnel: ad UTMs ride along with analytics events and the sign-up; an email confirmed in another
 * browser (Instagram in-app → Safari) resumes the party from the sign-up instead of starting over; Google sign-in is
 * hidden inside the Facebook / Instagram in-app browsers.
 */
import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

const URL = 'http://127.0.0.1:54321'
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const admin = () => createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
const AD = '?utm_source=instagram&utm_medium=paid_social&utm_campaign=mbp_founding_25&utm_content=tabs&fbclid=abc'
const IG_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0'

test('landing from an ad: offer above the button, UTMs on events and on the new account', async ({ page }) => {
  await page.goto('/' + AD)
  await expect(page.getByTestId('hero-steps')).toHaveText('Discover → Plan → Organize → Celebrate')
  await expect(page.getByTestId('founding-offer')).toContainText('Pro free')
  const cta = page.getByTestId('hero-cta')
  await expect(cta).toBeInViewport()
  await cta.click()
  await expect(page).toHaveURL(/\/start$/)

  // A sign-up on /join (another page, no UTMs in its URL) still carries the ad's tags.
  const email = `e2e-acq-${Date.now()}@example.test`
  await page.goto('/join')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('e2e-password-123')
  await page.getByRole('button', { name: /create account/i }).click()
  await page.waitForURL('**/home')
  const db = admin()
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 })
  const u = users.users.find((x) => x.email === email)!
  expect(u.user_metadata.signup_attribution).toMatchObject({ utm_source: 'instagram', utm_medium: 'paid_social', utm_campaign: 'mbp_founding_25', utm_content: 'tabs', fbclid: true })
  await expect.poll(async () => (await db.from('analytics_events').select('properties').eq('user_id', u.id).eq('event', 'signup_completed')).data?.[0]?.properties ?? null, { timeout: 10_000 })
    .toMatchObject({ utm_source: 'instagram', utm_content: 'tabs', method: 'password' })
  await db.auth.admin.deleteUser(u.id)
})

test('email confirmed in another browser: the party draft travels with the sign-up', async ({ browser }) => {
  const db = admin()
  const email = `e2e-xb-${Date.now()}@example.test`
  const date = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
  const party_draft = { childName: 'Zoe', childAge: 5, partyDate: date, zip: '48084', zipPlace: { lat: 42.5627, lng: -83.1799, city: 'Troy', state: 'MI' }, guestCount: 12, budget: 300, budgetUnsure: false, setting: 'either', interests: ['art'], theme: null }
  const { data, error } = await db.auth.admin.createUser({ email, password: 'e2e-password-123', email_confirm: true, user_metadata: { display_name: 'Riley', party_draft } })
  expect(error).toBeNull()
  const page = await (await browser.newContext()).newPage() // a fresh browser: no local draft
  await page.goto('/login?next=' + encodeURIComponent('/start?resume=1'))
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('e2e-password-123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Let’s find your perfect party.' })).toBeVisible()
  await page.getByRole('button', { name: 'Find party places near me' }).click()
  await expect(page).toHaveURL(/\/discover/)
  const { data: parties } = await db.from('parties').select('child_name, guest_count, budget').eq('user_id', data.user!.id)
  expect(parties).toEqual([{ child_name: 'Zoe', guest_count: 12, budget: 300 }])
  await expect.poll(async () => (await db.auth.admin.getUserById(data.user!.id)).data.user?.user_metadata.party_draft ?? null).toBeNull()
  await db.auth.admin.deleteUser(data.user!.id)
})

test('Instagram in-app browser: no Google button (Google blocks it there), email sign-up only', async ({ browser }) => {
  const page = await (await browser.newContext({ userAgent: IG_UA, viewport: { width: 390, height: 844 } })).newPage()
  await page.goto('/join')
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0)
  const normal = await (await browser.newContext()).newPage()
  await normal.goto('/join')
  await expect(normal.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
})
