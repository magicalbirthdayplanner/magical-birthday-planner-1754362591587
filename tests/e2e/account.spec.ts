/** Account settings moved from the retired desktop /account page into More. */
import { expect, test } from '@playwright/test'
import { login, seedUser } from './helpers'

test('More → Account: RSVP-email preference and name persist', async ({ page }) => {
  const s = await seedUser({ withParty: true })
  await login(page, s, '/more')
  const toggle = page.getByTestId('rsvp-email-toggle')
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')

  const name = page.getByLabel('Your name')
  await name.fill('Jordan')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Name saved')).toBeVisible()

  await page.reload()
  await expect(page.getByTestId('rsvp-email-toggle')).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByLabel('Your name')).toHaveValue('Jordan')
  // Retired desktop tools are no longer offered.
  await expect(page.getByText('Full planner (desktop tools)')).toHaveCount(0)
  await expect(page.getByText('Account settings')).toHaveCount(0)
})
