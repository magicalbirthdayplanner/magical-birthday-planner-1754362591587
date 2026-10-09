/**
 * Product model on phones: the pricing page always shows all four plans (anonymous, Free, trial, paid) with the right
 * CTA for the visitor, the comparison and the FAQ, without horizontal scroll at 375–430 px; and what each plan
 * actually unlocks in the app (trial = guests & RSVP without AI, Free = upgrade prompts, Starter = AI planning).
 */
import { expect, test, type Page } from '@playwright/test'
import { addParty, login, makeFree, seedUser, setPlanForE2E } from './helpers'

const PLANS = ['FREE', 'STARTER', 'PLUS', 'PRO'] as const
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

async function fourCards(page: Page) {
  for (const p of PLANS) await expect(page.getByTestId(`plan-card-${p}`)).toBeVisible()
  await expect(page.getByTestId('plan-card-STARTER')).toContainText('$9.99per party')
  await expect(page.getByTestId('plan-card-PLUS')).toContainText('$19.99per party')
  await expect(page.getByTestId('plan-card-PRO')).toContainText('$29.99per party')
  await expect(page.getByTestId('plan-card-FREE')).toContainText('$0forever')
  await expect(page.getByTestId('plan-cards')).not.toContainText(/\$4\.99|\$14\.99/) // no stale prices
}

test('anonymous: four plans with prices, founding offer, comparison by category, 15 FAQs, no false claims', async ({ page }) => {
  await page.goto('/pricing')
  await expect(page.getByRole('heading', { name: 'Explore. Plan. Organize. Experience.' })).toBeVisible()
  await fourCards(page)
  await expect(page.getByTestId('plan-card-FREE').getByRole('link', { name: 'Start free' })).toBeVisible()
  for (const p of ['STARTER', 'PLUS', 'PRO']) await expect(page.getByTestId(`checkout-${p}`)).toBeEnabled()
  const cmp = page.getByTestId('plan-comparison')
  for (const c of ['Plan', 'Manage', 'AI planning', 'AI organization', 'AI party experience']) await expect(cmp.getByRole('heading', { name: c, exact: true })).toBeVisible()
  await expect(page.locator('details')).toHaveCount(15)
  await expect(page.getByTestId('founding-offer')).toContainText('Free for our first 25 families')
  await expect(page.getByTestId('founding-left')).toHaveText(/^\d+ of 25 spots left$/)
  await expect(page.getByTestId('founding-offer').getByRole('link', { name: 'Claim your free spot' })).toHaveAttribute('href', '/start')
  await page.getByText('Is the price per party or per month?').click()
  await expect(page.getByText(/Per party\. You pay once for each party/).first()).toBeVisible()
  await expect(page.getByTestId('per-party-note')).toHaveText('Pay once for each party. No monthly subscription.')
  for (const p of ['STARTER', 'PLUS', 'PRO']) await expect(page.getByTestId(`plan-card-${p}`)).toContainText('per party')
  await expect(page.getByTestId('plan-card-PLUS')).toContainText('Most popular')
  await expect(page.locator('body')).not.toContainText(/one-time|lifetime|\/month|monthly plan|annual plan|billed monthly/i)
  await expect(page.locator('body')).not.toContainText(/10,000|thousands of|subscription renews/i)
})

for (const width of [375, 390, 393, 430, 768, 1280]) {
  test(`pricing at ${width}px: every plan reachable, no horizontal scroll, 44px CTAs`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 600, hasTouch: width < 1024 })
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
    await expect(page.getByText('Priced per party · No subscriptions')).toBeVisible()
    await fourCards(page) // the homepage pricing section shows the same prices
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
  await expect(page.getByTestId('upgrade-guests')).toContainText('See Starter — $9.99 per party')
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
  await expect(page.getByTestId('plan-card-STARTER')).toContainText('Included in this party’s plan')
  await expect(page.getByTestId('pricing-party')).toContainText('Choosing a plan for Mia’s party')
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

test('plans are per party: a plan bought for one party does not unlock another; checkout names the party', async ({ page }) => {
  test.setTimeout(150_000)
  const s = await seedUser() // Mia's party
  await makeFree(s.email)
  const second = await addParty(s.email, s.password, 'Leo')
  await login(page, s, '/pricing')
  await expect(page.getByTestId('pricing-party')).toContainText('Choosing a plan for')
  // choose Mia's party explicitly in the selector, then buy Starter for it
  await page.getByTestId('pricing-party').locator('select').selectOption(s.partyId!)
  await expect(page.getByTestId('pricing-party')).toContainText('Mia’s party')
  await page.getByTestId('checkout-STARTER').click()
  await expect(page.getByRole('heading', { name: 'Dodo Payments (test mode)' })).toBeVisible()
  await page.getByRole('button', { name: 'Pay now' }).click()
  await expect(page.getByTestId('checkout-status')).toHaveAttribute('data-phase', 'active', { timeout: 30_000 })
  await expect(page.getByTestId('checkout-status')).toContainText('Your STARTER plan is active for Mia’s party')
  // Mia's party has Starter: guests unlocked
  await page.goto('/guests')
  await expect(page.getByTestId('nav-lock-guests')).toHaveCount(0)
  await page.goto('/more')
  await expect(page.getByTestId('plan-row')).toContainText('Plan for Mia’s party')
  await expect(page.getByTestId('plan-row')).toContainText('Starter')
  // switch to Leo's party: still Free there
  await page.evaluate((id) => localStorage.setItem('mbp.activePartyId', id), second)
  await page.goto('/guests')
  await expect(page.getByTestId('upgrade-guests')).toContainText('Guests & RSVP is part of Starter')
  await page.goto('/pricing')
  await expect(page.getByTestId('pricing-party')).toContainText('Leo’s party')
  await expect(page.getByTestId('plan-current-FREE')).toBeVisible()
  await expect(page.getByTestId('checkout-STARTER')).toContainText('Choose Starter — $9.99')
})

test('signed in without a party: plans ask you to create a party first', async ({ page }) => {
  const s = await seedUser({ withParty: false })
  await login(page, s, '/more')
  await page.goto('/pricing')
  await expect(page.getByTestId('create-party-STARTER')).toHaveText('Create your party first')
  await expect(page.getByTestId('checkout-STARTER')).toHaveCount(0)
})

test('each plan opens the Dodo checkout for its own product at its own price, for the chosen party', async ({ page }) => {
  test.setTimeout(120_000)
  const s = await seedUser({ withParty: true })
  await makeFree(s.email)
  await login(page, s, '/pricing')
  const expected = [['STARTER', 'pdt_e2eStarter01', '$9.99'], ['PLUS', 'pdt_e2ePlus00002', '$19.99'], ['PRO', 'pdt_e2ePro000003', '$29.99']] as const
  for (const [plan, product, price] of expected) {
    await page.goto('/pricing')
    await expect(page.getByTestId('pricing-party')).toContainText('Choosing a plan for Mia’s party')
    await expect(page.getByTestId(`checkout-${plan}`)).toContainText(price)
    await page.getByTestId(`checkout-${plan}`).click()
    await expect(page.getByRole('heading', { name: 'Dodo Payments (test mode)' })).toBeVisible()
    await expect(page.getByText(`Product ${product}`)).toBeVisible()
    await expect(page.getByTestId('dodo-price')).toHaveText(`Total ${price} USD`)
  }
  // nothing was paid: the party is still on Free
  await page.goto('/pricing')
  await expect(page.getByTestId('plan-current-FREE')).toBeVisible()
})
