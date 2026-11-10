/**
 * The required mobile flow (product spec §37) plus the Definition of Done (§46):
 * account → quick party (age 7, ZIP 48084) → ideas → Art → automatic
 * discovery → open venue → map → save (persists) → theme → guest → checklist →
 * invitation shared + public RSVP → reload / new session → party still there.
 */
import { expect, test } from '@playwright/test'
import { emailCode, quickWizard } from './helpers'

const email = `e2e-${Date.now()}@example.test`

test.describe.configure({ mode: 'serial' })

test('parent plans a party end-to-end on a phone', async ({ page, context, browser }) => {
  // ------------------------------------------------------------ open mobile site
  await page.goto('/home')
  await expect(page.getByRole('heading', { name: /Plan your child’s birthday/ })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()

  // ------------------------------------------------------------ create account
  await page.getByRole('link', { name: 'Sign in' }).click()
  await page.getByRole('link', { name: 'Create an account' }).click()
  await expect(page).toHaveURL(/\/join/)
  await page.getByLabel('Your first name').fill('Sam')
  await page.getByLabel('Email').fill(email)
  const sentAt = Date.now() - 1000
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await page.getByLabel('6-digit code').fill(await emailCode(email, sentAt))
  await expect(page).toHaveURL(/\/home/)
  await expect(page.getByRole('heading', { name: 'Let’s plan your first party.' })).toBeVisible()

  // ------------------------------------------------------------ create party (wizard)
  await page.getByRole('link', { name: /Plan a party/ }).click()
  await expect(page).toHaveURL(/\/start/)

  await quickWizard(page, { name: 'Ava', age: 7, postal: '48084' })
  // Ideas show before anything else is asked; interests refine them (art places for an art-loving 7-year-old).
  await expect(page.getByTestId('preview-venue').first()).toBeVisible()
  await expect(page.getByTestId('preview-count')).toHaveText(/We found \d+ places within 20 miles/)
  await page.getByTestId('wizard-interests').getByRole('button', { name: /Art/ }).click()
  await expect(page.getByTestId('preview-venue').first()).toContainText(/art|paint|clay|glaze|picasso|easel|brush|kiln/i)
  await page.getByRole('button', { name: 'Save party & see all places' }).click()

  // ------------------------------------------------------------ discovery happens automatically
  await expect(page).toHaveURL(/\/discover/)
  const aha = page.getByTestId('aha')
  await expect(aha).toHaveText(/We found \d+ party options? near you\./)
  const found = Number((await aha.textContent())!.match(/\d+/)![0])
  expect(found).toBeGreaterThan(5)
  await expect(page.getByText('48084 • Within 20 miles')).toBeVisible()

  // Context-aware ranking: art places lead for an art-loving 7-year-old.
  await page.getByRole('button', { name: 'Start browsing' }).click()
  const cards = page.getByTestId('venue-card')
  await expect(cards.first()).toBeVisible()
  const topNames = (await cards.locator('h3').allTextContents()).slice(0, 4).join(' | ')
  expect(topNames).toMatch(/art|paint|clay|glaze|picasso|easel|brush|kiln/i)
  // Places Google marks closed / outside the radius never appear.
  await expect(page.getByText('Closed Forever Fun House')).toHaveCount(0)
  await expect(page.getByText('Way Too Far Funland')).toHaveCount(0)

  // ------------------------------------------------------------ open a venue
  const firstName = (await cards.first().locator('h3').textContent())!.trim()
  await cards.first().getByRole('link', { name: 'View', exact: true }).click()
  await expect(page).toHaveURL(/\/venue\//)
  await expect(page.getByRole('heading', { level: 1, name: firstName })).toBeVisible()
  await expect(page.getByText('Why we recommend it')).toBeVisible()
  await expect(page.getByText('Matches Ava’s love of art').or(page.getByText("Matches Ava's love of art"))).toBeVisible()
  await expect(page.getByText('Monday:', { exact: false }).or(page.getByText('Open now'))).toBeVisible()

  // ------------------------------------------------------------ save venue
  await page.getByRole('button', { name: 'Save', exact: true }).last().click()
  await expect(page.getByText(/Saved to Ava’s shortlist/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Saved' }).last()).toBeVisible()

  // ------------------------------------------------------------ map view works
  await page.goBack()
  await expect(page).toHaveURL(/\/discover/)
  await page.getByRole('tab', { name: 'Map view' }).click()
  const map = page.getByTestId('schematic-map').or(page.locator('gmp-map, .gm-style').first())
  await expect(map).toBeVisible()
  const marker = page.getByTestId('map-marker').first()
  const cluster = page.getByTestId('map-cluster').first()
  if (!(await marker.isVisible().catch(() => false))) {
    await cluster.click() // zooms in
  }
  await page.getByTestId('map-marker').first().click()
  await expect(page.getByTestId('map-sheet')).toBeVisible()
  await expect(page.getByTestId('map-sheet').getByTestId('venue-card').first()).toBeVisible()
  // The chosen view is remembered.
  await page.reload()
  await expect(page.getByRole('tab', { name: 'Map view' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: 'List view' }).click()

  // ------------------------------------------------------------ saved venue persists
  await page.goto('/discover/saved')
  await expect(page.getByRole('link', { name: firstName })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('link', { name: firstName })).toBeVisible()
  const note = page.getByLabel(`Private note for ${firstName}`)
  await note.fill('Ask about the Saturday package')
  await note.blur()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()

  // ------------------------------------------------------------ theme can be selected
  await page.goto('/plan/theme')
  await expect(page.getByRole('heading', { name: 'Recommended for Ava' })).toBeVisible()
  const themeCard = page.locator('section', { has: page.getByRole('heading', { name: 'Recommended for Ava' }) }).getByRole('button').first()
  const themeName = (await themeCard.locator('span.text-base').textContent())!.trim()
  await themeCard.click()
  await page.getByRole('button', { name: 'Choose this theme' }).click()
  await expect(page.getByText(`${themeName} it is!`, { exact: false })).toBeVisible()

  // ------------------------------------------------------------ guest can be added
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Guests' }).click()
  await expect(page).toHaveURL(/\/guests/)
  await page.getByRole('button', { name: 'Add a guest' }).click()
  await page.getByLabel('Name').fill('The Patel family')
  await page.getByRole('button', { name: 'Add guest' }).click()
  await expect(page.getByText('The Patel family added')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('list', { name: 'Guest list' }).getByText('The Patel family')).toBeVisible()

  // ------------------------------------------------------------ checklist appears
  await page.goto('/plan/checklist')
  await expect(page.getByRole('heading', { name: 'Checklist' })).toBeVisible()
  await expect(page.getByText('Order the cake')).toBeVisible()
  await expect(page.getByText('Pick a theme')).toHaveCount(0) // completed automatically when a theme was chosen
  await page.getByRole('checkbox', { name: /Mark done: Order the cake/ }).click()
  // Done tasks move to the collapsed "Completed" section.
  await page.getByRole('button', { name: /^Completed/ }).click()
  await expect(page.getByRole('checkbox', { name: /Order the cake/ })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('checkbox', { name: /Pick a theme/ })).toHaveAttribute('aria-checked', 'true')

  // ------------------------------------------------------------ share invitation + public RSVP
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/plan/invite')
  await expect(page.getByTestId('invitation-card')).toContainText('Ava’s 7th Birthday Party')
  await page.getByRole('button', { name: 'Copy link' }).click()
  await expect(page.getByText('Invite link copied')).toBeVisible()
  const inviteLink = await page.evaluate(() => navigator.clipboard.readText())
  expect(inviteLink).toMatch(/\/invite\/[0-9a-f]{48}$/)

  const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const guest = await guestCtx.newPage()
  await guest.goto(inviteLink)
  await expect(guest.getByTestId('invitation-card')).toContainText('Ava')
  await guest.getByRole('radio', { name: /Yes!/ }).click()
  await guest.getByLabel('Your name').fill('The Nguyen family')
  await guest.getByRole('button', { name: 'Send RSVP' }).click()
  await expect(guest.getByText('You’re on the list!')).toBeVisible()
  await guestCtx.close()

  await page.goto('/guests')
  await expect(page.getByRole('list', { name: 'Guest list' }).getByText('The Nguyen family')).toBeVisible()

  // ------------------------------------------------------------ reload: party remains
  await page.goto('/home')
  await page.reload()
  await expect(page.getByTestId('countdown')).toBeVisible()
  await expect(page.getByText('Ava’s birthday is in')).toBeVisible()

  // ------------------------------------------------------------ close browser, return later, continue planning
  const state = await context.storageState()
  await context.close()
  const later = await browser.newContext({ storageState: state, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const again = await later.newPage()
  await again.goto('/plan')
  await expect(again.getByRole('heading', { name: /Ava’s party is \d+ days away/ })).toBeVisible()
  await expect(again.getByText(themeName)).toBeVisible()
  await again.goto('/discover/saved')
  await expect(again.getByRole('link', { name: firstName })).toBeVisible()
  await expect(again.getByLabel(`Private note for ${firstName}`)).toHaveValue('Ask about the Saturday package')
  await later.close()
})
