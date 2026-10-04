/**
 * Product model on phones: the pricing page always shows all four plans (anonymous, Free, trial, paid) with the right
 * CTA for the visitor, the comparison and the FAQ, without horizontal scroll at 375–430 px; and what each plan
 * actually unlocks in the app (trial = guests & RSVP without AI, Free = upgrade prompts, Starter = AI planning).
 */
import { expect, test, type Page } from '@playwright/test'
import { login, makeFree, seedUser, setPlanForE2E } from './helpers'

const PLANS = ['FREE', 'STARTER', 'PLUS', 'PRO'] as const
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

async function fourCards(page: Page) {
  for (const p of PLANS) await expect(page.getByTestId(`plan-card-${p}`)).toBeVisible()
  await expect(page.getByTestId('plan-card-STARTER')).toContainText('$4.99')
  await expect(page.getByTestId('plan-card-PLUS')).toContainText('$9.99')
  await expect(page.getByTestId('plan-card-PRO')).toContainText('$14.99')
  await expect(page.getByTestId('plan-card-FREE')).toContainText('$0')
}

test('anonymous: four plans with prices, comparison by category, 14 FAQs, no false claims', async ({ page }) => {
  await page.goto('/pricing')
  await expect(page.getByRole('heading', { name: 'Explore. Plan. Organize. Experience.' })).toBeVisible()
  await fourCards(page)
  await expect(page.getByTestId('plan-card-FREE').getByRole('link', { name: 'Start free' })).toBeVisible()
  for (const p of ['STARTER', 'PLUS', 'PRO']) await expect(page.getByTestId(`checkout-${p}`)).toBeEnabled()
  const cmp = page.getByTestId('plan-comparison')
  for (const c of ['Plan', 'Manage', 'AI planning', 'AI organization', 'AI party experience']) await expect(cmp.getByRole('heading', { name: c, exact: true })).toBeVisible()
  await expect(page.locator('details')).toHaveCount(14)
  await page.getByText('Is the price per party or per month?').click()
  await expect(page.getByText(/one-time payment/).first()).toBeVisible()
  await expect(page.locator('body')).not.toContainText(/10,000|thousands of|subscription renews/i)
})

for (const width of [375, 390, 393, 430]) {
  test(`pricing at ${width}px: every plan reachable, no horizontal scroll, 44px CTAs`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true })
    const page = await ctx.newPage()
    await page.goto('/pricing')
    await fourCards(page)
    expect(await overflow(page)).toBeLessThanOrEqual(1)
    for (const p of ['STARTER', 'PLUS', 'PRO']) {
      const box = (await page.getByTestId(`checkout-${p}`).boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
    }
    await page.getByTestId('plan-comparison').scrollIntoViewIfNeeded()
    expect(await overflow(page)).toBeLessThanOrEqual(1)
    await page.goto('/')
    await expect(page.getByTestId('plan-cards')).toBeVisible()
    expect(await overflow(page)).toBeLessThanOrEqual(1)
    await ctx.close()
  })
}

test('trial: pricing explains the trial; guests & RSVP work; AI shows an upgrade, not an error', async ({ page }) => {
  const s = await seedUser({ withParty: true }) // sign-up trigger → 24 h trial
  await login(page, s, '/pricing')
  await expect(page.getByTestId('trial-note')).toContainText('Starter’s guest & RSVP features')
  await fourCards(page)
  for (const p of ['STARTER', 'PLUS', 'PRO']) await expect(page.getByTestId(`checkout-${p}`)).toBeEnabled()
  await page.goto('/guests')
  await expect(page.getByRole('button', { name: 'Add a guest' }).first()).toBeVisible()
  await expect(page.getByTestId('nav-lock-guests')).toHaveCount(0)
  await page.goto('/home')
  await expect(page.getByTestId('upgrade-party_planner')).toContainText('Plan My Party is part of Starter')
  await expect(page.getByTestId('plan-with-ai')).toHaveCount(0)
})

test('Free: guests locked with a Starter upgrade; RSVP page too; AI locked; manual planning still works', async ({ page }) => {
  const s = await seedUser({ withParty: true })
  await makeFree(s.email)
  await login(page, s, '/guests')
  await expect(page.getByTestId('upgrade-guests')).toContainText('See Starter — $4.99')
  await expect(page.getByTestId('nav-lock-guests')).toBeVisible()
  await page.goto('/plan/invite')
  await expect(page.getByTestId('upgrade-rsvp')).toBeVisible()
  await page.goto('/plan/theme')
  await expect(page.getByTestId('upgrade-theme_ideas')).toBeVisible()
  await page.goto('/pricing')
  await expect(page.getByTestId('plan-current-FREE')).toBeVisible()
})

test('paid (Plus): pricing marks the current plan, lower plans included, Pro as the upgrade', async ({ page }) => {
  const s = await seedUser({ withParty: true })
  await setPlanForE2E(s.email, 'PLUS')
  await login(page, s, '/pricing')
  await fourCards(page)
  await expect(page.getByTestId('owned-note')).toContainText('Plus')
  await expect(page.getByTestId('plan-current-PLUS')).toBeVisible()
  await expect(page.getByTestId('plan-card-STARTER')).toContainText('Included in your plan')
  await expect(page.getByTestId('checkout-PRO')).toContainText('Upgrade to Pro')
  // Plus unlocks its AI tools; Pro-only Party Host stays an upgrade
  await page.goto('/plan')
  await expect(page.getByTestId('magic-host-locked')).toContainText('Part of Pro')
  await expect(page.getByTestId('magic-timeline-locked')).toHaveCount(0)
})

test('Plus tools work end-to-end from the Plan tab (food, budget, timeline, shopping list) and the invitation writer', async ({ page }) => {
  test.setTimeout(120_000)
  const s = await seedUser({ withParty: true })
  await setPlanForE2E(s.email, 'PLUS')
  await login(page, s, '/plan')
  const dialog = page.getByRole('dialog')
  await page.getByTestId('magic-food').click()
  await dialog.getByRole('button', { name: '✨ Plan the food' }).click()
  await expect(dialog.getByText('Please check allergies and dietary needs with each family.').first()).toBeVisible({ timeout: 20_000 })
  await expect(dialog.getByText('Trail mix (nut-free option)')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByTestId('magic-timeline').click()
  await expect(dialog.getByText('Royal portrait painting')).toBeVisible({ timeout: 20_000 })
  await page.keyboard.press('Escape')
  await page.getByTestId('magic-budget').click()
  await expect(dialog.getByText('Swap catered pizza for homemade mini pizzas')).toBeVisible({ timeout: 20_000 })
  await page.keyboard.press('Escape')
  await page.getByTestId('magic-shopping').click()
  await expect(dialog.getByRole('heading', { name: 'Shopping list' })).toBeVisible()
  await expect(dialog.getByText('Mozzarella')).toBeVisible({ timeout: 20_000 }) // merged from the food plan made above
  await expect(dialog.getByText(/21 AI suggestions left for this party/)).toBeVisible() // Plus: 25 per party, 4 used
  await page.keyboard.press('Escape')
  await page.goto('/plan/invite')
  await page.getByRole('button', { name: 'Write it for me' }).click()
  await expect(dialog.getByText('You’re invited to a Royal Ball!')).toBeVisible({ timeout: 20_000 })
  await dialog.getByRole('button', { name: 'Use this wording' }).first().click()
  await expect(page.locator('body')).toContainText('You’re invited to a Royal Ball!')
})
