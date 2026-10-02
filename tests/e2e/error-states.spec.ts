/** Polished error and empty states (spec §40). No stack traces, always a way forward. */
import { expect, test } from '@playwright/test'
import { appAlert, clearArea, clearSearches, login, mockMode, seedUser } from './helpers'

test.afterEach(async () => {
  await mockMode('ok')
})

test('signed-out visitors are sent to sign in, then back', async ({ page }) => {
  const s = await seedUser()
  await page.goto('/discover')
  await expect(page).toHaveURL(/\/login\?next=%2Fdiscover/)
  await page.getByLabel('Email').fill(s.email)
  await page.getByLabel('Password', { exact: true }).fill(s.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/discover/)
})

test('wrong password shows a friendly message', async ({ page }) => {
  const s = await seedUser({ withParty: false })
  await page.goto('/login')
  await page.getByLabel('Email').fill(s.email)
  await page.getByLabel('Password', { exact: true }).fill('nope-nope-nope')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(appAlert(page)).toHaveText('That email and password don’t match. Try again?')
})

test('invalid ZIP codes are caught in the wizard', async ({ page }) => {
  await page.goto('/start')
  await page.getByLabel('Child’s name').fill('Zed')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('radio', { name: '5', exact: true }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Next Saturday' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('ZIP code').fill('1234')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(appAlert(page)).toContainText('5-digit US ZIP')
  await page.getByLabel('ZIP code').fill('99999')
  await expect(page.getByText('We couldn’t find that ZIP code. Double-check it?')).toBeVisible()
})

test('Google outage: friendly error, retry recovers', async ({ page }) => {
  // Nothing cached or stored near this party, so the outage cannot be masked by fallbacks.
  await clearArea(40.7506, -73.9971)
  const s = await seedUser({ zip: '10001', lat: 40.7506, lng: -73.9971 })
  await mockMode('quota')
  await login(page, s, '/discover')
  await expect(appAlert(page)).toContainText('Place search is taking a break')
  await expect(appAlert(page)).not.toContainText(/RESOURCE_EXHAUSTED|Error:|at /)
  await mockMode('ok')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByTestId('venue-card').first()).toBeVisible()
})

test('Google outage with known venues nearby: degrade gracefully to stored places', async ({ page }) => {
  // Populate venues near Chicago, then drop the search cache so only stored venues remain.
  await clearArea(41.8781, -87.6298)
  const warm = await seedUser({ zip: '60602', lat: 41.8781, lng: -87.6298 })
  await login(page, warm, '/discover')
  await expect(page.getByTestId('venue-card').first()).toBeVisible()
  await clearSearches(41.8781, -87.6298)
  await mockMode('quota')
  const cold = await seedUser({ zip: '60602', lat: 41.8781, lng: -87.6298 })
  await page.context().clearCookies()
  await page.evaluate(() => localStorage.clear())
  await login(page, cold, '/discover')
  await expect(page.getByText('Showing recently found places — live search is temporarily unavailable.')).toBeVisible()
  await expect(page.getByTestId('venue-card').first()).toBeVisible()
})

test('no venues within radius suggests widening the search', async ({ page }) => {
  await clearArea(45.5, -109.3)
  const s = await seedUser({ zip: '59001', lat: 45.5, lng: -109.3 })
  await mockMode('empty')
  await login(page, s, '/discover')
  await expect(page.getByText('No places within 20 miles')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Search 40 miles' })).toBeVisible()
})

test('empty states: no saved venues, no guests', async ({ page }) => {
  const s = await seedUser()
  await login(page, s, '/discover/saved')
  await expect(page.getByText('No saved places yet')).toBeVisible()
  await page.goto('/guests')
  await expect(page.getByText('No guests yet')).toBeVisible()
})

test('network loss shows an offline banner', async ({ page, context }) => {
  const s = await seedUser()
  await login(page, s, '/guests')
  await context.setOffline(true)
  await expect(page.getByText('You’re offline — changes will fail until you reconnect.')).toBeVisible()
  await context.setOffline(false)
  await expect(page.getByText('You’re offline — changes will fail until you reconnect.')).toHaveCount(0)
})

test('unknown invitation links explain what to do', async ({ page }) => {
  await page.goto(`/invite/${'ab'.repeat(24)}`)
  await expect(page.getByText('Invitation not found')).toBeVisible()
})

test('debug and account-takeover routes are gone', async ({ request }) => {
  for (const path of ['/api/bypass-oauth-session', '/api/env-test', '/api/fix-rls-policies', '/env-check']) {
    const res = await request.post(path, { data: { userEmail: 'victim@example.com' }, failOnStatusCode: false })
    expect(res.status(), path).toBe(404)
  }
})
