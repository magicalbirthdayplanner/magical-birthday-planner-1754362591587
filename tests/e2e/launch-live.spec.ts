/**
 * After launch (LIVE — this suite's server runs with PRELAUNCH_MODE=off): the normal site is back and the
 * temporary pre-launch pages are gone. The pre-launch behaviour itself is in prelaunch.spec.ts.
 */
import { expect, test } from '@playwright/test'

test('LIVE: homepage, pricing and sign-in are back; the waitlist page is retired', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('prelaunch-page')).toHaveCount(0)
  await expect(page.locator('header').getByRole('link', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByTestId('plan-cards')).toBeVisible()
  await page.goto('/pricing')
  await expect(page.getByTestId('plan-card-STARTER')).toContainText('$9.99')
  await page.goto('/login')
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/prelaunch?utm_source=x')
  await expect(page).toHaveURL(/\/\?utm_source=x$/)
  await expect(page.getByTestId('prelaunch-page')).toHaveCount(0)
  await page.goto('/prelaunch/privacy')
  await expect(page).toHaveURL(/\/privacy$/)
})
