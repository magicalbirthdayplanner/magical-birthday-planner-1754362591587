/**
 * Magical Santa — the parent journey on a phone: landing → 4-step setup → email-code sign-in → approve →
 * 6 minutes ($9.98) checkout (mock Dodo, signed webhook) → "Santa is ready" with 6 minutes. The live call itself needs real
 * OpenAI/Simli and is checked manually (docs/MAGICAL_HOLIDAYS_LAUNCH_CHECKLIST.md).
 */
import { expect, test } from '@playwright/test'
import { emailCode } from './helpers'

test('a parent sets up and buys a Santa call on a phone', async ({ page }) => {
  const email = `santa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`
  await page.goto('/santa')
  await expect(page.getByRole('heading', { name: 'Your child can talk to Santa tonight.' })).toBeVisible()
  await expect(page.getByText('No app needed', { exact: false }).first()).toBeVisible()
  await page.getByRole('link', { name: 'Create your Santa call' }).first().click()

  // 1 — name + age (Continue stays disabled until both are given)
  await expect(page.getByRole('heading', { name: 'Who is Santa calling?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
  await page.getByPlaceholder('e.g. Emma').fill('Emma')
  await page.getByRole('button', { name: '6', exact: true }).click()
  await page.getByRole('button', { name: 'Continue' }).click()

  // 2 — tap suggestions, add one of our own
  await expect(page.getByRole('heading', { name: 'What makes Emma special?' })).toBeVisible()
  await page.getByRole('button', { name: 'Dinosaurs', exact: true }).click()
  await page.getByRole('button', { name: 'Learned to ride a bike' }).click()
  await page.getByRole('button', { name: 'Add your own' }).nth(3).click()
  await page.getByPlaceholder(/our dog Biscuit · our elf Jingle/).fill('our elf Jingle')
  await page.getByPlaceholder(/our dog Biscuit · our elf Jingle/).press('Enter')
  await page.getByRole('button', { name: 'Continue' }).click()

  // 3 — style
  await page.getByRole('radio', { name: /Gentle/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()

  // 4 — exactly what Santa will say and know; one parent confirmation
  await expect(page.getByText('Ho, ho, ho! Hello, Emma!', { exact: false })).toBeVisible()
  await expect(page.getByText('have you been good this year?', { exact: false })).toBeVisible()
  await expect(page.getByText('our elf Jingle')).toBeVisible()
  await page.getByRole('button', { name: 'Looks perfect — continue' }).click()
  await expect(page.getByText('Please tick the box to continue.')).toBeVisible()
  await page.getByRole('checkbox').check()
  const since = Date.now() - 1000
  await page.getByRole('button', { name: 'Looks perfect — continue' }).click()

  // sign in with an emailed code, without leaving the page
  await page.getByPlaceholder('you@example.com').fill(email)
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await page.getByPlaceholder('••••••').fill(await emailCode(email, since))

  // choose and pay; URL parameters never unlock anything — only the signed webhook does
  await expect(page.getByRole('heading', { name: 'Choose Emma’s time with Santa' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('radio', { name: /3 minutes with Santa.*\$4\.99/ })).toBeVisible()
  await page.getByRole('radio', { name: /6 minutes with Santa/ }).click()
  await page.getByRole('button', { name: /Continue to payment · \$9\.98/ }).click()
  await expect(page.getByTestId('dodo-price')).toHaveText('Total $9.98 USD')
  await page.getByRole('button', { name: 'Pay now' }).click()
  await expect(page.getByRole('heading', { name: 'Santa is ready to call Emma!' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('You have 6 minutes with Santa.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Call Santa now' })).toHaveAttribute('href', /\/santa\/call\?child=/)
})

test('anyone can open the free 30-second preview without signing up', async ({ page }) => {
  await page.goto('/santa')
  await page.getByRole('link', { name: 'Try a free 30-second preview' }).click()
  await expect(page.getByRole('heading', { name: 'Say hi to Santa — free' })).toBeVisible()
  await expect(page.getByText('Free · 30 seconds · No sign-up')).toBeVisible()
  await page.getByPlaceholder('First name, e.g. Emma').fill('Emma3')
  await expect(page.getByText('Letters only, please.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start free preview' })).toBeDisabled()
  await page.getByPlaceholder('First name, e.g. Emma').fill('Emma')
  await expect(page.getByRole('button', { name: 'Start free preview' })).toBeEnabled()
})

test('the Santa page asks a signed-out parent to sign in, and checkout needs an account', async ({ page, request }) => {
  await page.goto('/santa/ready')
  await expect(page.getByRole('heading', { name: 'Sign in to your Santa calls' })).toBeVisible()
  const res = await request.post('/api/santa/checkout', { data: { pack: 'SANTA_ONE' } })
  expect(res.status()).toBe(401)
  const start = await request.post('/api/santa/sessions', { data: { childId: '00000000-0000-0000-0000-000000000000' } })
  expect(start.status()).toBe(401)
})
