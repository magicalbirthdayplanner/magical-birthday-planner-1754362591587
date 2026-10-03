/** AI planning assistant on phones (deterministic mock provider via .env.e2e). */
import { expect, test } from '@playwright/test'
import { login, seedUser } from './helpers'

test('Plan My Party: describe it → plan → add an activity (undo) → Add all → saved on the Plan tab; reopening restores', async ({ page }) => {
  const s = await seedUser({ withParty: true })
  await login(page, s, '/home')
  await page.getByTestId('plan-with-ai').click()
  await page.getByPlaceholder('My daughter is turning 7, loves art, and we’re expecting 12 kids…').fill('My daughter is turning 7. She loves art and animals. About 12 kids, $250, indoors.')
  await page.getByRole('button', { name: '✨ Plan my party' }).click()
  await expect(page.getByText('Your AI plan')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Wild Art Safari')).toBeVisible()
  await expect(page.getByText('Please check allergies and dietary needs with each family.').first()).toBeVisible()
  await page.getByRole('button', { name: /Add to activities: Paint-your-own animal masks/ }).click()
  await expect(page.getByText('Added to your activities.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible()
  // Add all on the shopping list, then the theme
  await page.getByRole('dialog').getByRole('button', { name: 'Add all' }).nth(1).click()
  await expect(page.getByText(/Added 7 items to your shopping list/)).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Use this theme: Wild Art Safari' }).click()
  await expect(page.getByText('Wild Art Safari it is!')).toBeVisible()
  await expect(page.getByRole('link', { name: /Find a venue near you/ })).toBeVisible()
  await page.keyboard.press('Escape')
  // saved items are real: the Plan tab shows them
  await page.goto('/plan')
  await expect(page.getByText('Your party plan')).toBeVisible()
  await page.getByTestId('party-plan-shopping').click()
  await expect(page.getByRole('dialog', { name: 'Shopping list' }).getByText('Air-dry clay')).toBeVisible()
  await page.getByRole('checkbox').first().check()
  await expect(page.getByRole('dialog', { name: 'Shopping list' }).getByText('1 of 7 bought.', { exact: false })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('party-plan-activities')).toContainText('1 planned')
  // reopening shows the last plan (no new generation) with applied items marked
  await page.getByTestId('plan-with-ai').click()
  await expect(page.getByText(/Your plan from/)).toBeVisible()
  await expect(page.getByRole('dialog').getByText('Added').first()).toBeVisible()
})

test('Theme ideas: say what they love → 5 ideas → use one → saved as the party theme', async ({ page }) => {
  const s = await seedUser({ withParty: true })
  await login(page, s, '/plan/theme')
  await expect(page.getByText('Dream up original themes')).toHaveCount(0) // one AI theme entry point
  await page.getByTestId('ai-theme-ideas').click()
  await page.getByLabel('What does your child love?').fill('She loves unicorns but I don’t want a typical pink unicorn party')
  await page.getByRole('button', { name: '✨ Get 5 theme ideas' }).click()
  await expect(page.getByText('Pop-Star Concert Party')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Use this theme: Wild Art Safari' }).click()
  await expect(page.getByText('🦁 Wild Art Safari it is!')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.goto('/plan')
  await expect(page.getByText('Wild Art Safari').first()).toBeVisible()
})

for (const width of [375, 390, 393, 430]) {
  test(`AI surfaces at ${width}px: no horizontal scroll, 44px targets`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true })
    const page = await ctx.newPage()
    const s = await seedUser({ withParty: true })
    await login(page, s, '/plan')
    await expect(page.getByTestId('plan-with-ai')).toBeVisible()
    await page.getByTestId('plan-with-ai').click()
    await page.getByRole('button', { name: '✨ Plan my party' }).click()
    await expect(page.getByText('Your AI plan')).toBeVisible({ timeout: 20_000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('[role="dialog"] button')]
        .map((b) => ({ r: b.getBoundingClientRect(), name: b.getAttribute('aria-label') || b.textContent?.trim().slice(0, 30) }))
        .filter(({ r }) => r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44))
        .map(({ r, name }) => `${name} ${Math.round(r.width)}x${Math.round(r.height)}`),
    )
    expect(small).toEqual([])
    // saved plan sheets (budget has inputs + remove buttons) at the same width
    await page.getByRole('dialog').getByRole('button', { name: 'Use all' }).click()
    await expect(page.getByText(/Added 4 budget lines to your budget/)).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('Escape')
    await page.getByTestId('party-plan-budget').click()
    await expect(page.getByRole('dialog', { name: 'Budget' })).toBeVisible()
    await page.getByLabel('Actually spent on Activities').fill('41.50')
    await page.getByLabel('Actually spent on Activities').press('Enter')
    await expect(page.getByRole('dialog', { name: 'Budget' }).getByText('$41.50')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
    const smallPlan = await page.evaluate(() =>
      [...document.querySelectorAll('[role="dialog"] button, [role="dialog"] input')]
        .map((b) => ({ r: b.getBoundingClientRect(), name: b.getAttribute('aria-label') || b.textContent?.trim().slice(0, 30) }))
        .filter(({ r }) => r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44))
        .map(({ r, name }) => `${name} ${Math.round(r.width)}x${Math.round(r.height)}`),
    )
    expect(smallPlan).toEqual([])
    await ctx.close()
  })
}

test('AI tools on Plan: Free sees calm locked rows; Plus builds the checklist and adds all', async ({ page }) => {
  const { setPlanForE2E } = await import('./helpers')
  const s = await seedUser({ withParty: true })
  await setPlanForE2E(s.email, 'FREE')
  await login(page, s, '/plan')
  await expect(page.getByText('✨ Planning help')).toBeVisible()
  await expect(page.getByText('Included with Starter').first()).toBeVisible()
  await setPlanForE2E(s.email, 'PLUS')
  await page.reload()
  await page.getByTestId('ai-tool-checklist').click()
  await expect(page.getByRole('dialog', { name: 'Your AI checklist' })).toBeVisible()
  await page.getByRole('button', { name: 'Add all to checklist' }).click()
  await expect(page.getByText(/Added \d+ tasks? to your checklist/)).toBeVisible({ timeout: 15_000 })
  await page.keyboard.press('Escape')
  await page.goto('/plan/checklist')
  await expect(page.getByText('Ask the studio what kids should wear')).toBeVisible()
})
