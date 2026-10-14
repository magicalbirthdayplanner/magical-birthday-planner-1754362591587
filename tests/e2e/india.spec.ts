/**
 * India on a phone (mock Google + mock Razorpay test mode, tests/mock-google/server.mjs):
 * /in landing → wizard with the event country, 6-digit PIN and a ₹ budget → discovery in km → INR pricing →
 * Razorpay checkout → verified plan → guest with a +91 number (duplicates refused) → WhatsApp share (manual, the host
 * sends) → guest RSVP page in Indian date/time format. Nothing here calls real Google, Razorpay or WhatsApp.
 */
import { expect, test, type Page } from '@playwright/test'
import { login, seedUser } from './helpers'

async function continueStep(page: Page) {
  await page.getByRole('button', { name: /^(Continue|Skip|Skip for now)$/ }).click()
}

test.describe.configure({ mode: 'serial' })

test('/in explains the India offer honestly and links into the wizard with India preselected', async ({ page }) => {
  const res = await page.goto('/in')
  expect(res?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Plan the celebration. Skip the chaos.' })).toBeVisible()
  for (const t of ['Find nearby venues', 'Organise the guest list', 'Manage your budget in ₹', 'Share invitations on WhatsApp', 'Collect RSVPs in one place']) await expect(page.getByRole('heading', { name: t })).toBeVisible()
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/in$/)
  await expect(page.locator('link[rel="alternate"][hreflang="en-IN"]')).toHaveAttribute('href', /\/in$/)
  await expect(page.getByTestId('india-pricing-note')).toContainText('₹499')
  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(width).toBeLessThanOrEqual(page.viewportSize()!.width)
})

test('a parent plans, pays and invites for a party in India', async ({ page, browser, context }) => {
  test.setTimeout(180_000)
  await context.route('https://wa.me/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>WhatsApp (stub)</p>' }))
  const s = await seedUser({ withParty: false })
  await login(page, s, '/home')

  // ------------------------------------------------------------ wizard: event country India, PIN, rupees
  await page.goto('/start?country=IN')
  await page.getByLabel('Child’s name').fill('Aarav')
  await continueStep(page)
  await page.getByRole('radio', { name: '7', exact: true }).click()
  await continueStep(page)
  await page.getByRole('button', { name: 'In a month' }).click()
  await expect(page.getByText(/^[A-Z][a-z]+day,? \d{1,2} [A-Z][a-z]+,? \d{4}$/)).toBeVisible() // en-IN: "Saturday, 14 November 2026"
  await continueStep(page)

  await expect(page.getByRole('heading', { name: 'Where are you planning?' })).toBeVisible()
  await expect(page.getByTestId('wizard-country-IN')).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('We’ll find party places within 32 km.')).toBeVisible()
  await page.getByLabel('PIN code').fill('48084')
  await continueStep(page)
  await expect(page.getByRole('alert').filter({ hasText: '6-digit PIN' })).toBeVisible()
  await page.getByLabel('PIN code').fill('560 001')
  await expect(page.getByText('Bengaluru, Karnataka')).toBeVisible()
  await continueStep(page)

  await page.getByRole('button', { name: '20', exact: true }).click()
  await continueStep(page)
  await expect(page.getByRole('button', { name: '₹15,000' })).toBeVisible()
  await page.getByRole('button', { name: '₹15,000' }).click()
  await expect(page.getByText('About ₹750 per guest.')).toBeVisible()
  await continueStep(page)
  await page.getByRole('radio', { name: /Indoor/ }).click()
  await continueStep(page)
  await continueStep(page) // interests: skip
  await continueStep(page) // theme: skip
  await expect(page.getByRole('button', { name: /₹15,000/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /32 km/ })).toBeVisible()
  await page.getByRole('button', { name: 'Find party places near me' }).click()

  // ------------------------------------------------------------ discovery near the PIN, in km
  await expect(page).toHaveURL(/\/discover/)
  await expect(page.getByTestId('aha')).toHaveText(/We found \d+ party options? near you\./)
  await expect(page.getByText('560001 • Within 32 km')).toBeVisible()
  await page.getByRole('button', { name: 'Start browsing' }).click()
  await expect(page.getByTestId('venue-card').first()).toBeVisible()
  await expect(page.getByTestId('venue-card').first()).toContainText(/km/)

  await page.goto('/plan')
  await expect(page.getByText(/₹15,000 budget · about ₹750\/guest/)).toBeVisible()

  // ------------------------------------------------------------ INR pricing → Razorpay (mock test mode) → verified plan
  await page.goto('/pricing')
  await expect(page.getByTestId('plan-price-STARTER')).toHaveText('₹499')
  await expect(page.getByTestId('plan-price-PRO')).toHaveText('₹1,499')
  await expect(page.getByText('Payments for parties in India are processed securely by Razorpay, in INR.')).toBeVisible()
  await page.getByTestId('checkout-STARTER').click()
  await expect(page.getByTestId('rzp-mock')).toBeVisible()
  await expect(page.getByTestId('rzp-amount')).toHaveText('INR 499')
  // closing Checkout charges nothing
  await page.getByTestId('rzp-mock').getByRole('button', { name: 'Close' }).click()
  await expect(page.getByTestId('checkout-note-STARTER')).toHaveText('Checkout closed — you haven’t been charged.')
  await page.getByTestId('checkout-STARTER').click()
  await page.getByTestId('rzp-mock').getByRole('button', { name: 'Pay (success)' }).click()
  await expect(page).toHaveURL(/\/checkout-success\?ref=/)
  await expect(page.getByTestId('checkout-status')).toHaveAttribute('data-phase', 'active', { timeout: 30_000 })
  await expect(page.getByTestId('checkout-status')).toContainText('Your STARTER plan is active for Aarav’s party')

  // ------------------------------------------------------------ guests: +91 numbers, one number = one guest
  await page.goto('/guests')
  await page.getByRole('button', { name: 'Add a guest' }).click()
  await page.getByLabel('Name').fill('The Iyer family')
  await page.getByLabel('Phone (optional)').fill('98450 12345')
  await page.getByRole('button', { name: 'Add guest' }).click()
  await expect(page.getByText('The Iyer family added')).toBeVisible()
  await page.getByLabel('Name').fill('Iyers again')
  await page.getByLabel('Phone (optional)').fill('+91 98450-12345')
  await page.getByRole('button', { name: 'Add guest' }).click()
  await expect(page.getByText('The Iyer family already has this phone number on your guest list.')).toBeVisible()
  await page.keyboard.press('Escape')

  // ------------------------------------------------------------ invitation: WhatsApp share is manual and honest
  await page.goto('/plan/invite')
  await expect(page.getByTestId('invitation-card')).toContainText(/\d{1,2} [A-Z][a-z]+/) // "14 November"
  await page.getByLabel('Where').fill('Jumping Jacks Play Area, Koramangala')
  const popup = page.waitForEvent('popup')
  await page.getByTestId('share-whatsapp').click()
  const wa = await popup
  const shared = new URL(wa.url())
  expect(shared.origin + shared.pathname).toBe('https://wa.me/')
  const text = shared.searchParams.get('text')!
  expect(text).toContain('You’re invited to Aarav’s 7th birthday party!')
  expect(text).toContain('📍 Jumping Jacks Play Area, Koramangala')
  expect(text).not.toContain('98450')
  const inviteLink = text.match(/https?:\/\/\S+\/invite\/[0-9a-f]{48}/)![0]
  await wa.close()
  await expect(page.getByText('WhatsApp opened — choose who to send it to.')).toBeVisible()

  // ------------------------------------------------------------ guest RSVP page: Indian formats, no account
  const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const guest = await guestCtx.newPage()
  await guest.goto(inviteLink.replace(/^https?:\/\/[^/]+/, ''))
  await expect(guest.getByTestId('invitation-card')).toContainText(/[A-Z][a-z]+day,? \d{1,2} [A-Z][a-z]+/)
  await expect(guest.getByTestId('invitation-card')).toContainText(/\d pm/)
  await expect(guest.getByTestId('invitation-card')).not.toContainText('98450')
  await guest.getByRole('radio', { name: /Yes!/ }).click()
  await guest.getByLabel('Your name').fill('The Rao family')
  await guest.getByRole('button', { name: 'Send RSVP' }).click()
  await expect(guest.getByText('You’re on the list!')).toBeVisible()
  await guestCtx.close()
  await page.goto('/guests')
  await expect(page.getByRole('list', { name: 'Guest list' }).getByText('The Rao family')).toBeVisible()
})

test('India screens fit a 375 px phone (₹ prices, PIN, km, WhatsApp button)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const s = await seedUser({ zip: '400050', lat: 19.0596, lng: 72.8295, party: { country_code: 'IN', timezone: 'Asia/Kolkata', budget: 125000, child_name: 'Anaya' } })
  await login(page, s, '/plan')
  for (const path of ['/plan', '/pricing', '/plan/invite', '/guests', '/discover', '/more']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0)
  }
  await page.goto('/plan')
  await expect(page.getByText(/₹1,25,000 budget/)).toBeVisible()
  await page.goto('/plan/invite')
  await expect(page.getByTestId('share-whatsapp')).toBeVisible()
  await ctx.close()
})
