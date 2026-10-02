/**
 * Integrations journey on a phone: invitation email (Resend) → guest RSVP →
 * confirmation + host notification → Dodo test checkout → signed webhook →
 * server-side entitlement → logout/login persistence.
 * Resend and Dodo are the local mocks in tests/mock-google/server.mjs.
 */
import { expect, test } from '@playwright/test'
import { login, makeFree, mockEmails, seedUser } from './helpers'

test('invitation email → RSVP emails → Dodo checkout → webhook → plan active → persists', async ({ page, browser }) => {
  test.setTimeout(120_000)
  const s = await seedUser()
  await makeFree(s.email)
  const stamp = Date.now()
  const guestEmail = `patel-${stamp}@example.test`
  const rsvpEmail = `nguyen-${stamp}@example.test`

  // Guest with an email address
  await login(page, s, '/guests')
  await page.getByRole('button', { name: 'Add a guest' }).click()
  await page.getByLabel('Name').fill('Patel family')
  await page.getByLabel('Email (optional)').fill(guestEmail)
  await page.getByRole('button', { name: 'Add guest' }).click()
  await expect(page.getByText('Patel family added')).toBeVisible()
  await page.keyboard.press('Escape')

  // Email the invitation (Resend)
  await page.goto('/plan/invite')
  await page.getByRole('button', { name: /Email 1 guest/ }).click()
  await expect(page.getByText('Invitation emailed to 1 family')).toBeVisible()
  const invite = (await mockEmails()).find((e) => e.to.includes(guestEmail))
  expect(invite?.subject).toBe('You’re invited to Mia’s birthday party!')
  expect(invite?.from).toBe('Magical Birthday Planner <noreply@magicalbirthdayplanner.com>')
  const link = invite!.html.match(/https?:\/\/[^"'\s]+\/invite\/[0-9a-f]{48}/)![0]
  await page.goto('/guests')
  await expect(page.getByRole('list', { name: 'Guest list' }).getByText('Patel family')).toBeVisible()
  await expect(page.getByText(/not invited/)).toHaveCount(0)

  // Guest RSVPs from their own phone
  const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const guest = await guestCtx.newPage()
  await guest.goto(link.replace(/^https?:\/\/[^/]+/, 'http://localhost:3101'))
  await guest.getByRole('radio', { name: /Yes!/ }).click()
  await guest.getByLabel('Your name').fill('Nguyen family')
  await guest.getByLabel('Email (optional)').fill(rsvpEmail)
  await guest.getByRole('button', { name: 'Send RSVP' }).click()
  await expect(guest.getByText('You’re on the list!')).toBeVisible()
  await guestCtx.close()

  await expect.poll(async () => (await mockEmails()).filter((e) => e.to.includes(rsvpEmail) || e.to.includes(s.email)).map((e) => e.subject).sort()).toEqual(
    expect.arrayContaining(['Nguyen family is coming — Mia’s party', 'Your RSVP for Mia’s party']),
  )

  // Plan starts FREE (server-side)
  await page.goto('/more')
  await expect(page.getByTestId('plan-row')).toContainText('Free')

  // Dodo checkout (test mode) → pay → signed webhook → plan
  await page.getByTestId('plan-row').click()
  await expect(page).toHaveURL(/\/pricing/)
  await page.getByTestId('checkout-PLUS').click()
  await expect(page.getByRole('heading', { name: 'Dodo Payments (test mode)' })).toBeVisible()
  await page.getByRole('button', { name: 'Pay now' }).click()
  await expect(page).toHaveURL(/\/checkout-success\?ref=.*status=succeeded/)
  await expect(page.getByTestId('checkout-status')).toHaveAttribute('data-phase', 'active', { timeout: 30_000 })
  await expect(page.getByTestId('checkout-status')).toContainText('Your PLUS plan is active')

  await page.goto('/more')
  await expect(page.getByTestId('plan-row')).toContainText('Plus')

  // logout → login → persists
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { name: /Plan your child’s birthday/ })).toBeVisible()
  await login(page, s, '/more')
  await expect(page.getByTestId('plan-row')).toContainText('Plus')
  await page.goto('/guests')
  await expect(page.getByRole('list', { name: 'Guest list' }).getByText('Nguyen family')).toBeVisible()
})

test('a declined card never grants a plan, and URL tampering does nothing', async ({ page }) => {
  const s = await seedUser()
  await makeFree(s.email)
  await login(page, s, '/pricing')
  await page.getByTestId('checkout-PRO').click()
  await page.getByRole('button', { name: 'Decline card' }).click()
  await expect(page.getByTestId('checkout-status')).toHaveAttribute('data-phase', 'failed')
  // Tampered return URL claiming success for PRO
  await page.goto('/checkout-success?plan=PRO&status=succeeded&payment_id=pay_fake')
  await expect(page.getByTestId('checkout-status')).toHaveAttribute('data-phase', /failed|checking|pending/)
  await page.goto('/more')
  await expect(page.getByTestId('plan-row')).toContainText('Free')
})
