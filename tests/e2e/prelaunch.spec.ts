/**
 * Temporary pre-launch mode (Oct 6–12, 2026) against a server forced into PRE_LAUNCH (project `prelaunch`).
 * The waitlist page is the whole public site: no pricing, sign-in, sign-up, party creation or checkout.
 */
import { createClient } from '@supabase/supabase-js'
import { expect, test, type Page } from '@playwright/test'

const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const admin = () => createClient('http://127.0.0.1:54321', SERVICE, { auth: { persistSession: false } })
const waitlistRow = async (email: string) => (await admin().from('launch_waitlist').select('*').eq('email', email)).data ?? []
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const uniq = () => `e2e-wl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`

/** Anything that would sell, sign in or start the product. */
const FORBIDDEN = /\$\d|\bStarter\b|\bPlus\b|\bPro\b|pricing|Sign in|Sign up|Get started|Create (a|your) party|Start planning|checkout|per party|subscription/i

test.afterAll(async () => {
  await admin().from('launch_waitlist').delete().like('email', 'e2e-wl-%@example.test')
})

test('the waitlist page explains the product, shows real screens and has one action: join the waitlist', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your child’s birthday. Magically planned.')
  await expect(page.getByText('Planning a kid’s birthday shouldn’t feel like managing a project.')).toBeVisible()
  await expect(page.getByTestId('launch-pill')).toContainText('Launching October 13')
  await expect(page.getByTestId('waitlist-submit-hero')).toHaveText('Join the waitlist')
  for (const id of ['how-it-works', 'ai', 'features', 'join-final']) await expect(page.locator(`#${id}`)).toHaveCount(1)
  for (const h of ['Describe the birthday. Get the whole party back.', 'Find party places near you.', 'Keep the guest list out of the group-chat chaos.', 'AI helpers for every part of the party.']) {
    await expect(page.getByRole('heading', { name: h })).toBeAttached()
  }
  expect(await page.locator('img[src*="/prelaunch/"]').count()).toBeGreaterThanOrEqual(15)
  await expect(page.locator('body')).not.toContainText(FORBIDDEN)
  for (const href of ['/pricing', '/login', '/join', '/start', '/home', '/terms', '/help']) await expect(page.locator(`a[href^="${href}"]`), href).toHaveCount(0)
  const header = page.getByTestId('prelaunch-header')
  await expect(header).not.toContainText(/Sign in|Get started|Open app|Pricing/i)
})

test('product pages, sign-in, sign-up, pricing and checkout are closed until launch', async ({ page, request }) => {
  for (const p of ['/pricing', '/signin', '/signup', '/terms', '/login', '/join', '/start', '/home', '/plan', '/discover', '/guests', '/more', '/admin', '/help', '/checkout-success', '/prelaunch']) {
    await page.goto(`${p}?utm_source=x`)
    await expect(page, p).toHaveURL(/\/\?utm_source=x$/)
    await expect(page.getByTestId('prelaunch-page'), p).toBeVisible()
  }
  const checkout = await request.post('/api/billing/checkout', { data: { plan: 'STARTER', partyId: '00000000-0000-4000-8000-000000000000' } })
  expect(checkout.status()).toBe(403)
  // still open: the privacy policy (in the pre-launch shell), existing guests' RSVP links, password reset, health
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible()
  await expect(page.getByTestId('prelaunch-header')).toBeVisible()
  await expect(page.locator('body')).toContainText('Launch waitlist sign-ups')
  await page.goto('/reset-password')
  await expect(page).toHaveURL(/\/reset-password$/)
  await page.goto(`/invite/${'0'.repeat(48)}`)
  await expect(page).toHaveURL(new RegExp(`/invite/${'0'.repeat(48)}$`))
  expect((await request.get('/api/health')).status()).toBe(200)
})

test('join the waitlist: validation, success, campaign attribution and a duplicate handled gracefully', async ({ page, browser }) => {
  const email = uniq()
  await page.goto('/?utm_source=instagram&utm_medium=story&utm_campaign=prelaunch_oct13&utm_content=d07_story')
  const form = page.getByTestId('waitlist-form-hero')
  await form.getByLabel('Parent email').fill('not-an-email')
  await page.getByTestId('waitlist-submit-hero').click()
  await expect(form.getByRole('alert')).toHaveText('Please enter a valid email address.')
  await form.getByLabel('Parent email').fill(email.toUpperCase())
  await form.getByLabel('First name (optional)').fill('Sam')
  await page.getByTestId('waitlist-submit-hero').click()
  await expect(page.getByTestId('waitlist-success-hero')).toContainText('You’re on the list! 🎂')
  await expect(page.getByTestId('waitlist-success-hero')).toContainText('We’ll let you know when Magical Birthday Planner opens on October 13.')
  await expect(page.getByTestId('waitlist-success-footer')).toBeAttached() // every form on the page switches together
  await expect.poll(async () => (await waitlistRow(email)).length).toBe(1)
  expect((await waitlistRow(email))[0]).toMatchObject({ email, first_name: 'Sam', utm_source: 'instagram', utm_medium: 'story', utm_campaign: 'prelaunch_oct13', utm_content: 'd07_story' })
  // the confirmation email went out once (mock Resend), with no pricing in it
  const confirmations = async () => (await (await fetch('http://127.0.0.1:4010/__mock/emails')).json() as { to: string[]; subject: string; html: string }[]).filter((m) => m.to.includes(email))
  await expect.poll(async () => (await confirmations()).length).toBe(1)
  const [mail] = await confirmations()
  expect(mail.subject).toBe('You’re on the list 🎂 Magical Birthday Planner launches October 13')
  expect(mail.html).toContain('October 13')
  expect(mail.html).not.toMatch(/\$\d|\bStarter\b|\bPlus\b|\bPro\b|pricing/)
  await expect.poll(async () => (await waitlistRow(email))[0].confirmation_sent_at).not.toBeNull()

  // same person again from another device and another link: same friendly answer, still one row
  const ctx = await browser.newContext()
  const other = await ctx.newPage()
  await other.goto('/?utm_source=reddit')
  await other.locator('#join-final').scrollIntoViewIfNeeded()
  await other.getByTestId('waitlist-form-footer').getByLabel('Parent email').fill(email)
  await other.getByTestId('waitlist-submit-footer').click()
  await expect(other.getByTestId('waitlist-success-footer')).toContainText('You’re on the list!')
  await ctx.close()
  const rows = await waitlistRow(email)
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ utm_source: 'instagram', signup_count: 2 })
  expect(await confirmations()).toHaveLength(1) // no second confirmation for a repeat sign-up
})

test('a server error shows a friendly retry message, not a success', async ({ page }) => {
  await page.route('**/api/waitlist', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'server_error', message: 'x' } }) }))
  await page.goto('/')
  await page.getByTestId('waitlist-form-hero').getByLabel('Parent email').fill(uniq())
  await page.getByTestId('waitlist-submit-hero').click()
  await expect(page.getByTestId('waitlist-form-hero').getByRole('alert')).toHaveText('We couldn’t add you just now. Please try again.')
  await expect(page.getByTestId('waitlist-success-hero')).toHaveCount(0)
})

for (const width of [375, 390, 393, 430, 768, 1280]) {
  test(`pre-launch page at ${width}px: no horizontal scroll, waitlist button above the fold, 44px targets`, async ({ browser }) => {
    const mobile = width < 600
    const height = mobile ? 664 : width < 1024 ? 1024 : 800 // visible area: iPhone Safari / portrait tablet / laptop
    const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: width < 1024 })
    const page = await ctx.newPage()
    await page.goto('/')
    await expect(page.getByTestId('prelaunch-page')).toBeVisible()
    expect(await overflow(page)).toBeLessThanOrEqual(1)
    const btn = (await page.getByTestId('waitlist-submit-hero').boundingBox())!
    expect(btn.height).toBeGreaterThanOrEqual(44)
    expect(btn.y + btn.height, 'join button visible without scrolling').toBeLessThanOrEqual(height)
    expect(btn.x + btn.width).toBeLessThanOrEqual(width)
    await page.locator('#join-final').scrollIntoViewIfNeeded()
    expect(await overflow(page)).toBeLessThanOrEqual(1)
    if (mobile) {
      await page.locator('#ai').scrollIntoViewIfNeeded()
      await expect(page.getByTestId('sticky-join')).toBeInViewport()
    }
    await ctx.close()
  })
}

test('phones: large swipeable screens, sticky CTA on short screens, hidden while typing', async ({ browser }) => {
  // iPhone SE-sized visible area: the hero button starts below the fold, so the sticky CTA is there from the start
  const ctx = await browser.newContext({ viewport: { width: 375, height: 548 }, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto('/')
  const sticky = page.getByTestId('sticky-join')
  await expect(sticky).toBeInViewport()
  await sticky.click()
  await expect(page.getByTestId('waitlist-submit-hero')).toBeInViewport()
  await expect(sticky).not.toBeInViewport()
  // typing: the sticky bar never covers the keyboard area
  await page.locator('#ai').scrollIntoViewIfNeeded()
  await expect(sticky).toBeInViewport()
  await page.getByTestId('waitlist-form-footer').getByLabel('Parent email').focus()
  await expect(sticky).not.toBeInViewport()
  // screens: one large phone per swipe, inside the rail (the page itself never scrolls sideways)
  const rail = page.getByTestId('phone-rail').nth(3)
  await rail.scrollIntoViewIfNeeded()
  const item = (await rail.locator('li').first().boundingBox())!
  expect(item.width).toBeGreaterThanOrEqual(270)
  expect(await rail.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
  await rail.evaluate((el) => el.scrollBy({ left: el.clientWidth }))
  await expect.poll(() => rail.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  await ctx.close()
})
