/** Super Admin "Usage" page: a real family's journey (before and after sign-up), their party, the funnel, problems —
 *  and staff/test accounts left out. */
import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { grantSuperAdmin, login, seedUser, serviceClient } from './helpers'

test('usage page: funnel, problems, a family with their party and full activity; staff are left out; others get 404', async ({ page, request }) => {
  const db = serviceClient()
  const stamp = Date.now()
  // A "real" family (not a reserved test address), with browsing before sign-up on the same browser.
  const email = `family-${stamp}@example.com`
  const { data: created, error } = await db.auth.admin.createUser({ email, password: 'family-pass-123', email_confirm: true, user_metadata: { display_name: `Jordan ${stamp}` } })
  if (error) throw error
  const uid = created.user!.id
  try {
    const { data: party, error: pe } = await db
      .from('parties')
      .insert({ user_id: uid, child_name: `Kai${stamp}`, child_age: 7, party_date: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10), zip_code: '48084', city: 'Troy', state: 'MI', theme: 'dino-dig', guest_count: 15, interests: ['dinosaurs'], venue_type: 'mixed', latitude: 42.56, longitude: -83.18, search_radius_miles: 20 })
      .select('id')
      .single()
    if (pe) throw pe
    const anon = randomUUID()
    const at = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
    await db.from('analytics_events').insert([
      { event: 'landing_page_view', anonymous_id: anon, properties: { fbclid: true, in_app: true }, path: '/', created_at: at(30) },
      { event: 'party_creation_started', anonymous_id: anon, properties: {}, path: '/start', created_at: at(29) },
      { event: 'venue_search_completed', anonymous_id: anon, properties: { results: 42, preview: true }, path: '/start', created_at: at(28) },
      { event: 'signup_started', anonymous_id: anon, properties: {}, path: '/start', created_at: at(27) },
      { event: 'signup_completed', anonymous_id: anon, user_id: uid, properties: { method: 'email_code' }, path: '/start', created_at: at(26) },
      { event: 'party_created', anonymous_id: anon, user_id: uid, party_id: party!.id, properties: {}, path: '/start', created_at: at(25) },
    ])
    await db.from('ai_generations').insert({ user_id: uid, party_id: party!.id, feature: 'party_planner', status: 'failed', error_code: 'provider_error:auth', provider: 'azure', model: 'm' })

    const admin = await seedUser({ withParty: false })
    await grantSuperAdmin(admin.email)
    await login(page, admin, '/admin')
    await page.getByTestId('admin-insights-link').click()
    await page.waitForURL('**/admin/insights')
    await expect(page.getByTestId('insights-screen')).toBeVisible()
    await expect(page.getByTestId('insights-totals')).toContainText('Visitors')
    await expect(page.getByTestId('insights-funnel')).toContainText('Saved a party')
    await expect(page.getByTestId('insights-problems')).toContainText('AI request')
    await expect(page.getByTestId('insights-sources')).toContainText('Facebook link')
    await page.setViewportSize({ width: 375, height: 740 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    // Users: the family is listed; the admin (and every *.test seed) is not.
    await page.getByRole('tab', { name: 'Users' }).click()
    const users = page.getByTestId('insights-users')
    await expect(users).toContainText(`Jordan ${stamp}`)
    await expect(users).not.toContainText(admin.email)
    await users.getByRole('button', { name: new RegExp(`Jordan ${stamp}`) }).click()
    const detail = page.getByTestId('insights-user-detail')
    await expect(detail.getByTestId('insights-party')).toContainText(`Kai${stamp}, 7`)
    await expect(detail.getByTestId('insights-party')).toContainText('dino dig')
    const timeline = detail.getByTestId('insights-timeline')
    await expect(timeline).toContainText('Opened the homepage') // before they signed in
    await expect(timeline).toContainText('Created an account')
    await expect(timeline).toContainText('provider_error:auth')

    // Parties tab links back to the owner.
    await page.getByRole('tab', { name: 'Parties' }).click()
    await page.getByTestId('insights-parties').getByTestId('insights-party').filter({ hasText: `Kai${stamp}` }).getByRole('button', { name: `Jordan ${stamp}` }).click()
    await expect(page.getByRole('tab', { name: 'Users' })).toHaveAttribute('aria-selected', 'true')

    // Visitors tab shows the anonymous journey.
    await page.getByRole('tab', { name: 'Visitors' }).click()
    await expect(page.getByTestId('insights-visitors')).toContainText(`Jordan ${stamp}`)

    // Everyone else: 404, no data.
    await page.context().clearCookies()
    const res = await request.get('/api/admin/insights?days=7')
    expect(res.status()).toBe(404)
  } finally {
    await db.auth.admin.deleteUser(uid)
  }
})
