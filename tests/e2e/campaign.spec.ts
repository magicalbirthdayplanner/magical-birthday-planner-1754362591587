/**
 * Site-wide free launch campaign on a phone: banner on the public site and in the app, pricing says it is free,
 * a Free account can use paid features (guests) with no upgrade prompt, More names the offer.
 */
import { expect, test } from '@playwright/test'
import { login, makeFree, seedUser, setLaunchCampaign } from './helpers'

test.describe.configure({ mode: 'serial' })
test.beforeAll(async () => setLaunchCampaign(true))
test.afterAll(async () => setLaunchCampaign(false))

test('visitors see the offer everywhere and can start free', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('campaign-banner')).toContainText('Every plan is free until November 13')
  await expect(page.getByTestId('founding-offer')).toHaveCount(0)
  await page.goto('/pricing')
  await expect(page.getByTestId('campaign-banner')).toBeVisible()
  await expect(page.getByTestId('plan-free-until-PRO')).toHaveText('Free until November 13')
  await expect(page.getByTestId('campaign-start-PRO')).toHaveAttribute('href', '/start')
  await expect(page.getByText('Is everything really free right now?')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('a Free account gets every plan while the offer runs', async ({ page }) => {
  const s = await seedUser()
  await makeFree(s.email)
  await login(page, s, '/guests')
  await expect(page.getByTestId('campaign-banner')).toBeVisible()
  await expect(page.getByTestId('upgrade-guests')).toHaveCount(0)
  await page.getByRole('button', { name: 'Add a guest' }).click()
  await page.getByLabel('Name').fill('Campaign family')
  await page.getByRole('button', { name: 'Add guest' }).click()
  await expect(page.getByText('Campaign family added')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.goto('/more')
  await expect(page.getByTestId('plan-row')).toContainText('Pro')
  await expect(page.getByTestId('plan-source')).toContainText('Launch offer — every plan free until November 13')
  await page.goto('/pricing')
  await expect(page.getByTestId('campaign-note')).toContainText('every plan, free')
  await expect(page.getByTestId('checkout-PRO')).toHaveCount(0)
  // the in-app banner can be dismissed
  await page.goto('/home')
  await page.getByRole('button', { name: 'Dismiss offer' }).click()
  await expect(page.getByTestId('campaign-banner')).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('campaign-banner')).toHaveCount(0)
})
