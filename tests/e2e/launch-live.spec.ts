/**
 * The site is open: no waitlist. Homepage, pricing and sign-up are public, and the retired pre-launch pages are gone.
 */
import { expect, test } from '@playwright/test'

test('open for sign-ups: homepage, pricing and sign-up are public; the waitlist is gone', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('header').getByRole('link', { name: 'Sign in' })).toBeVisible()
  await expect(page.locator('header').getByRole('link', { name: 'Get started' })).toBeVisible()
  await expect(page.getByTestId('plan-cards')).toBeVisible()
  await expect(page.getByText(/waitlist/i)).toHaveCount(0)
  await page.goto('/pricing')
  await expect(page.getByTestId('plan-card-STARTER')).toContainText('$9.99')
  await page.goto('/join')
  await expect(page).toHaveURL(/\/join$/)
  await page.goto('/terms')
  await expect(page).toHaveURL(/\/terms$/)
  for (const p of ['/prelaunch', '/prelaunch/privacy']) expect((await page.request.get(p)).status(), p).toBe(404)
  expect((await page.request.post('/api/waitlist', { data: { email: 'x@example.test' }, failOnStatusCode: false })).status()).toBe(404)
})
