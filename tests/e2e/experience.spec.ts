/**
 * Party Experience on phones (mock provider, NEXT_PUBLIC_EXPERIENCE_ENABLED in .env.e2e): one parent journey across
 * Activities → Plan → checklist / shopping / budget / timeline → host speech → refresh → sign out/in, plus guest
 * count and theme changes, Free-plan behaviour and layout at 375/390/393/430.
 */
import { expect, test, type Page } from '@playwright/test'
import { login, partyRows, patchParty, seedUser, setPlanForE2E } from './helpers'

const dialog = (page: Page) => page.getByRole('dialog')

test('create → add → plan, checklist, shopping, budget, timeline → host speech → persists; guests and theme changes', async ({ page }) => {
  test.setTimeout(180_000)
  const s = await seedUser({ withParty: true })
  await setPlanForE2E(s.email, 'PRO')
  await login(page, s, '/activities')
  await expect(page.getByRole('heading', { name: 'Activities', exact: true })).toBeVisible()
  await expect(page.getByText('6th Birthday • 15 guests')).toBeVisible()

  // ✨ Create an activity
  await page.getByTestId('create-activity').click()
  await page.getByLabel('What do you have in mind?').fill('I want a fun space game for 15 kids that takes about 20 minutes and doesn’t make a mess.')
  await page.getByRole('button', { name: '✨ Create it' }).click()
  await expect(dialog(page).getByText('Cosmic Treasure Hunt')).toBeVisible({ timeout: 20_000 })
  await expect(dialog(page).getByText('What to say')).toBeVisible()
  await dialog(page).getByRole('button', { name: 'Add to party' }).click()
  await expect(dialog(page).getByText('✓ Added to your party')).toBeVisible()
  await page.keyboard.press('Escape')
  const card = page.getByTestId('activity-card').filter({ hasText: 'Cosmic Treasure Hunt' })
  await expect(card.getByText('Added')).toBeVisible()
  await expect(page.getByText(/1 planned · 25 min/)).toBeVisible()

  // detail: supplies → shopping, prep → checklist, cost → budget, → timeline
  await card.getByRole('button', { name: 'Open Cosmic Treasure Hunt' }).click()
  await dialog(page).getByRole('button', { name: 'Add all to shopping' }).click()
  await expect(page.getByText('Added 4 supplies to your shopping list.')).toBeVisible()
  await dialog(page).getByRole('button', { name: 'Add to checklist' }).click()
  await expect(page.getByText('Added 3 prep tasks to your checklist.')).toBeVisible()
  await dialog(page).getByRole('button', { name: 'Add to budget' }).click()
  await expect(page.getByText('Added to your budget.')).toBeVisible()
  await dialog(page).getByRole('button', { name: 'Add to timeline' }).click()
  await expect(page.getByText('Added to your timeline.')).toBeVisible()
  // ✨ Make it yours → preview → explicit apply
  await dialog(page).getByRole('button', { name: 'Make it cheaper' }).click()
  await expect(dialog(page).getByText('Suggested change:')).toBeVisible({ timeout: 20_000 })
  await dialog(page).getByRole('button', { name: 'Use this version' }).click()
  await expect(page.getByText('Activity updated.')).toBeVisible()
  // Undo from the toast works while the sheet is open, and doesn't close it
  await page.locator('[data-sonner-toast]').filter({ hasText: 'Activity updated.' }).getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByText('Undone.')).toBeVisible()
  await expect(dialog(page).getByText('✨ Make it yours')).toBeVisible()
  await dialog(page).getByRole('button', { name: 'Make it cheaper' }).click()
  await expect(dialog(page).getByText('Suggested change:')).toBeVisible({ timeout: 20_000 })
  await dialog(page).getByRole('button', { name: 'Use this version' }).click()
  await expect(page.getByText('Activity updated.').first()).toBeVisible()
  await page.keyboard.press('Escape')

  // everything is connected on the Plan tab
  await page.goto('/plan')
  await expect(page.getByTestId('party-plan-activities')).toContainText('1 planned · 25 min')
  await page.getByTestId('party-plan-timeline').click()
  await expect(dialog(page).getByTestId('timeline-row').filter({ hasText: 'Cosmic Treasure Hunt' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByTestId('party-plan-shopping').click()
  await expect(dialog(page).getByText('Glow sticks')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByTestId('party-plan-budget').click()
  await expect(dialog(page).getByText('Activities · Cosmic Treasure Hunt')).toBeVisible()
  await page.keyboard.press('Escape')
  const budget = await partyRows('party_budget_lines', s.partyId!, 'category, amount, actual_amount')
  expect(budget).toEqual([{ category: 'Activities', amount: 12, actual_amount: null }])

  // 🎤 Party Magic → Host → welcome speech → save
  await page.getByTestId('magic-host').click()
  await page.getByRole('button', { name: '✨ Write my welcome speech' }).click()
  await expect(dialog(page).getByText(/Welcome, astronauts!/).first()).toBeVisible({ timeout: 20_000 })
  await dialog(page).getByRole('button', { name: 'Save to party' }).click()
  await expect(page.getByText('Saved to your party.')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('party-plan-host')).toContainText('1 saved')

  // refresh, sign out, sign in → persists
  await page.reload()
  await expect(page.getByTestId('party-plan-host')).toContainText('1 saved')
  await page.goto('/more')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL(/\/home|\/login/)
  await login(page, s, '/plan/checklist')
  await expect(page.getByText('Print the 8 clue cards')).toBeVisible()
  await page.goto('/activities')
  await expect(page.getByTestId('activity-card').filter({ hasText: 'Cosmic Treasure Hunt' })).toBeVisible()

  // 15 → 20 guests: gentle prompt, nothing rewritten
  await patchParty(s.partyId!, { guest_count: 20 })
  await page.reload()
  await expect(page.getByText(/You now have 20 guests/)).toBeVisible()
  // theme change: the approved activity is untouched; an explicit update is offered
  await patchParty(s.partyId!, { theme: 'ai:dino', theme_details: { name: 'Dinosaur Dig' } })
  await page.reload()
  await page.getByRole('button', { name: 'Open Cosmic Treasure Hunt' }).click()
  await expect(dialog(page).getByRole('button', { name: '✨ Update for Dinosaur Dig' })).toBeVisible()
  const [row] = await partyRows('party_ai_activities', s.partyId!, 'name, designed_for_theme')
  expect(row).toEqual({ name: 'Cosmic Treasure Hunt', designed_for_theme: null })
})

test('Free plan: AI creation is locked (calm), parents can still add their own activity', async ({ page }) => {
  const s = await seedUser({ withParty: true })
  await setPlanForE2E(s.email, 'FREE')
  await login(page, s, '/activities')
  await expect(page.getByText('Included with Plus')).toBeVisible()
  await page.getByRole('button', { name: 'Add your own' }).click()
  await page.getByLabel('Name').fill('Freeze dance')
  await page.getByRole('button', { name: 'Add to party' }).click()
  await expect(page.getByText('Added to your party.')).toBeVisible()
  await expect(page.getByTestId('activity-card').filter({ hasText: 'Freeze dance' })).toBeVisible()
})

for (const width of [375, 390, 393, 430]) {
  test(`experience surfaces at ${width}px: bottom nav fits, no horizontal scroll, 44px targets`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true })
    const page = await ctx.newPage()
    const s = await seedUser({ withParty: true })
    await setPlanForE2E(s.email, 'PRO')
    await login(page, s, '/activities')
    const navItems = page.getByRole('navigation', { name: 'Main' }).getByRole('link')
    await expect(navItems).toHaveCount(6)
    for (const box of await Promise.all((await navItems.all()).map((l) => l.boundingBox()))) expect(box!.width).toBeGreaterThanOrEqual(44)
    const small = (sel: string) => page.evaluate((q) => [...document.querySelectorAll(q)].map((b) => ({ r: b.getBoundingClientRect(), n: b.getAttribute('aria-label') || b.textContent?.trim().slice(0, 24) })).filter(({ r }) => r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44)).map(({ r, n }) => `${n} ${r.width.toFixed(1)}x${r.height.toFixed(1)}`), sel)
    const over = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    await page.getByTestId('create-activity').click()
    await page.getByRole('button', { name: '✨ Create it' }).click()
    await expect(dialog(page).getByText('Cosmic Treasure Hunt')).toBeVisible({ timeout: 20_000 })
    expect(await over()).toBeLessThanOrEqual(1)
    await expect.poll(() => small('[role="dialog"] button'), { timeout: 3000 }).toEqual([])
    await dialog(page).getByRole('button', { name: 'Add to party' }).click()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Open Cosmic Treasure Hunt' }).click()
    await expect(dialog(page).getByText('✨ Make it yours')).toBeVisible()
    expect(await over()).toBeLessThanOrEqual(1)
    await expect.poll(() => small('[role="dialog"] button, [role="dialog"] input'), { timeout: 3000 }).toEqual([])
    await page.keyboard.press('Escape')
    await page.goto('/plan')
    await expect(page.getByText('✨ Party Magic')).toBeVisible()
    expect(await over()).toBeLessThanOrEqual(1)
    await page.getByTestId('create-experience').click()
    await page.getByRole('button', { name: '✨ Create my party experience' }).click()
    await expect(dialog(page).getByText('Cosmic Art Adventure').first()).toBeVisible({ timeout: 20_000 })
    expect(await over()).toBeLessThanOrEqual(1)
    await expect.poll(() => small('[role="dialog"] button'), { timeout: 3000 }).toEqual([])
    await ctx.close()
  })
}
