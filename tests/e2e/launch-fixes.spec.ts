/**
 * Launch-blocker regressions:
 *  - P0-A: a brand-new user on the sign-up Pro trial can see and buy every plan, the purchase wins over the
 *    trial and persists across sign-out/sign-in (Dodo test mode = the local mock).
 *  - P0-B: changing an RSVP from the same phone updates one guest; it never adds a second, conflicting one.
 */
import { expect, test } from '@playwright/test'
import { login, seedUser } from './helpers'

test('a trial user can buy Starter; the paid plan replaces the trial and persists', async ({ page }) => {
  test.setTimeout(120_000)
  const s = await seedUser() // sign-up trigger → 24 h PRO trial (no makeFree)
  await login(page, s, '/more')
  await expect(page.getByTestId('plan-row')).toContainText('Pro (trial)')

  await page.getByTestId('plan-row').click()
  await expect(page).toHaveURL(/\/pricing/)
  await expect(page.getByTestId('trial-note')).toBeVisible()
  for (const plan of ['STARTER', 'PLUS', 'PRO']) {
    const btn = page.getByTestId(`checkout-${plan}`)
    await expect(btn).toBeVisible()
    await expect(btn).toBeEnabled()
    // the label must actually be readable (not white-on-white)
    const { color, bg, image } = await btn.evaluate((el) => ({ color: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor, image: getComputedStyle(el).backgroundImage }))
    const whiteText = color === 'rgb(255, 255, 255)'
    const noFill = image === 'none' && /rgba\(0, 0, 0, 0\)|rgb\(255, 255, 255\)/.test(bg)
    expect(whiteText && noFill, `${plan} button label is invisible (${color} on ${bg})`).toBe(false)
  }

  // upsell deep links land on purchasable plans too
  await page.goto('/pricing?upgrade=starter')
  await expect(page.getByTestId('checkout-STARTER')).toBeVisible()

  await page.getByTestId('checkout-STARTER').click()
  await expect(page.getByRole('heading', { name: 'Dodo Payments (test mode)' })).toBeVisible()
  await page.getByRole('button', { name: 'Pay now' }).click()
  await expect(page.getByTestId('checkout-status')).toHaveAttribute('data-phase', 'active', { timeout: 30_000 })
  await expect(page.getByTestId('checkout-status')).toContainText('Your STARTER plan is active')

  await page.goto('/more')
  await expect(page.getByTestId('plan-row')).toContainText('Starter')
  await expect(page.getByTestId('plan-row')).not.toContainText('trial')
  await page.reload()
  await expect(page.getByTestId('plan-row')).toContainText('Starter')

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { name: /Plan your child’s birthday/ })).toBeVisible()
  await login(page, s, '/more')
  await expect(page.getByTestId('plan-row')).toContainText('Starter')
  await expect(page.getByTestId('plan-row')).not.toContainText('trial')
})

test('changing an RSVP on the same phone updates one guest instead of adding another', async ({ page, browser, context }) => {
  test.setTimeout(120_000)
  const s = await seedUser()
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await login(page, s, '/plan/invite')
  await page.getByRole('button', { name: 'Copy link' }).click()
  await expect(page.getByText('Invite link copied')).toBeVisible()
  const link = await page.evaluate(() => navigator.clipboard.readText())

  const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const guest = await guestCtx.newPage()
  await guest.goto(link)
  await guest.getByRole('radio', { name: /Yes!/ }).click()
  await guest.getByLabel('Your name').fill('The Nguyen family')
  await guest.getByRole('button', { name: 'Send RSVP' }).dblclick() // accidental double-tap
  await expect(guest.getByText('You’re on the list!')).toBeVisible()

  // change of heart, no email given
  await guest.getByRole('button', { name: 'Change my RSVP' }).click()
  await guest.getByRole('radio', { name: /Can’t go/ }).click()
  await guest.getByRole('button', { name: 'Send RSVP' }).click()
  await expect(guest.getByText('Thanks for letting us know')).toBeVisible()

  // refresh: the page says who already answered from this phone; answering again updates that reply
  await guest.reload()
  await expect(guest.getByTestId('rsvp-answered-as')).toContainText('The Nguyen family')
  await guest.getByRole('radio', { name: 'Maybe' }).click()
  await guest.getByLabel('Your name').fill('The Nguyen family')
  await guest.getByRole('button', { name: 'Send RSVP' }).click()
  await expect(guest.getByText('You’re on the list!')).toBeVisible()

  // a second family on the same (shared) phone is a different invitee
  await guest.getByRole('button', { name: 'RSVP for someone else' }).click()
  await expect(guest.getByTestId('rsvp-answered-as')).toHaveCount(0)
  await guest.getByRole('radio', { name: /Yes!/ }).click()
  await guest.getByLabel('Your name').fill('The Garcia family')
  await guest.getByRole('button', { name: 'Send RSVP' }).click()
  await expect(guest.getByText('You’re on the list!')).toBeVisible()
  await guestCtx.close()

  await page.goto('/guests')
  const list = page.getByRole('list', { name: 'Guest list' })
  await expect(list.getByText('The Nguyen family')).toHaveCount(1)
  await expect(list.getByText('The Garcia family')).toHaveCount(1)
  await expect(page.getByText(/^1 going/)).toBeVisible() // Garcia going; Nguyen = Maybe (one current state)
})
