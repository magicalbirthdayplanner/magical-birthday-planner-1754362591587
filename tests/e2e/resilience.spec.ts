/**
 * Failure handling on a phone: a database outage must never look like an empty
 * account, and nothing technical may leak to the screen.
 */
import { expect, test } from '@playwright/test'
import { login, seedUser } from './helpers'

test('database unreachable → retryable error, not "No party yet"', async ({ page }) => {
  const s = await seedUser({ withParty: true })
  await login(page, s, '/plan')
  await expect(page.getByRole('heading', { name: /party is \d+ days away/ })).toBeVisible()

  await page.route('**/rest/v1/parties**', (r) => r.abort('connectionrefused'))
  for (const path of ['/guests', '/plan/checklist']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: 'We couldn’t load your party' })).toBeVisible()
    await expect(page.getByText('No party yet')).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText(/TypeError|PGRST|stack|54321/)
  }

  await page.unroute('**/rest/v1/parties**')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: 'We couldn’t load your party' })).toHaveCount(0)
})
