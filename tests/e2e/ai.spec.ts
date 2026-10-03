/** AI planning assistant on phones (deterministic mock provider via .env.e2e). */
import { expect, test } from '@playwright/test'
import { login, seedUser } from './helpers'

test('Plan with AI: one sentence → plan → add an activity (undo available)', async ({ page }) => {
  const s = await seedUser({ withParty: true })
  await login(page, s, '/home')
  await page.getByTestId('plan-with-ai').click()
  await page.getByPlaceholder('Tell us about the birthday you\'re planning…').fill('My daughter is turning 7. She loves art and animals. About 12 kids, $250, indoors.')
  await page.getByRole('button', { name: 'Create plan' }).click()
  await expect(page.getByText('Your AI plan')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Wild Art Safari')).toBeVisible()
  await expect(page.getByText('Please check allergies and dietary needs with each family.').first()).toBeVisible()
  await page.getByRole('button', { name: /Add to activities: Paint-your-own animal masks/ }).click()
  await expect(page.getByText('Added to your activities.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible()
})

test('Theme ideas: 5 ideas → use one → saved as the party theme', async ({ page }) => {
  const s = await seedUser({ withParty: true })
  await login(page, s, '/plan/theme')
  await page.getByTestId('ai-theme-ideas').click()
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
    await page.getByRole('button', { name: 'Create plan' }).click()
    await expect(page.getByText('Your AI plan')).toBeVisible({ timeout: 20_000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('[role="dialog"] button')]
        .map((b) => ({ r: b.getBoundingClientRect(), name: b.getAttribute('aria-label') || b.textContent?.trim().slice(0, 30) }))
        .filter(({ r }) => r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44))
        .map(({ r, name }) => `${name} ${Math.round(r.width)}x${Math.round(r.height)}`),
    )
    expect(small).toEqual([])
    await ctx.close()
  })
}

test('AI tools on Plan: Free sees calm locked rows; Plus builds the checklist and adds all', async ({ page }) => {
  const { setPlanForE2E } = await import('./helpers')
  const s = await seedUser({ withParty: true })
  await setPlanForE2E(s.email, 'FREE')
  await login(page, s, '/plan')
  await expect(page.getByText('AI tools')).toBeVisible()
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
