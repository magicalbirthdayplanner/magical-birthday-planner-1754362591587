/** Every key screen at every target phone width: no sideways scrolling, real touch targets. */
import { expect, test } from '@playwright/test'
import { login, seedUser } from './helpers'

const WIDTHS = [
  { name: 'iPhone SE / mini', width: 375, height: 667 },
  { name: 'iPhone 13/14', width: 390, height: 844 },
  { name: 'Pixel 7', width: 393, height: 851 },
  { name: 'iPhone Pro Max', width: 430, height: 932 },
]
const SCREENS = ['/home', '/discover', '/discover/saved', '/plan', '/plan/checklist', '/plan/theme', '/plan/invite', '/guests', '/more', '/start']

for (const vp of WIDTHS) {
  test(`${vp.width}px (${vp.name}): no horizontal overflow, 44px tap targets`, async ({ browser }) => {
    const seeded = await seedUser()
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
    const page = await ctx.newPage()
    await login(page, seeded)
    for (const path of SCREENS) {
      await page.goto(path)
      await page.waitForLoadState('load')
      if (path === '/discover') await expect(page.getByTestId('venue-card').first()).toBeVisible()
      await page.waitForTimeout(400)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, `${path} overflows by ${overflow}px at ${vp.width}px`).toBeLessThanOrEqual(1)
      if (path !== '/start') {
        const nav = page.getByRole('navigation', { name: 'Main' })
        await expect(nav).toBeVisible()
        for (const box of await nav.getByRole('link').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
          expect(box.height).toBeGreaterThanOrEqual(44)
          expect(box.width).toBeGreaterThanOrEqual(44)
        }
      }
      await page.screenshot({ path: `test-results/viewports/${vp.width}${path.replace(/\//g, '_')}.png` })
    }
    // Map mode fits between header and nav.
    await page.goto('/discover')
    await page.getByRole('tab', { name: 'Map view' }).click()
    await expect(page.getByTestId('map-sheet')).toBeVisible()
    await expect(page.getByTestId('map-marker').or(page.getByTestId('map-cluster')).first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
    await page.screenshot({ path: `test-results/viewports/${vp.width}_discover-map.png` })
    await ctx.close()
  })
}
