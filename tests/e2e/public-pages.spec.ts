/** Public pages: legal + help reachable, social preview metadata and image, phone layout. */
import { expect, test } from '@playwright/test'

for (const path of ['/terms', '/privacy', '/help', '/pricing']) {
  test(`${path} loads and has its own canonical URL`, async ({ page }) => {
    const res = await page.goto(path)
    expect(res!.status()).toBe(200)
    await expect(page.locator('h1').first()).toBeVisible()
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${path}$`))
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  })
}

test('Open Graph and X card metadata point to a loadable 1200×630 image', async ({ page, request }) => {
  await page.goto('/')
  const meta = (sel: string) => page.locator(sel).first().getAttribute('content')
  expect(await meta('meta[property="og:type"]')).toBe('website')
  expect(await meta('meta[property="og:title"]')).toBeTruthy()
  expect(await meta('meta[property="og:description"]')).toBeTruthy()
  expect(await meta('meta[property="og:image:width"]')).toBe('1200')
  expect(await meta('meta[property="og:image:height"]')).toBe('630')
  expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image')
  const img = (await meta('meta[property="og:image"]'))!
  expect(img).toMatch(/^https?:\/\/[^/]+\/og-image\.png$/)
  expect(await meta('meta[name="twitter:image"]')).toBe(img)
  const r = await request.get(new URL(img).pathname)
  expect(r.status()).toBe(200)
  expect(r.headers()['content-type']).toBe('image/png')
})

test('help page links to pricing, terms, privacy and the support email; footer links to help', async ({ page }) => {
  await page.goto('/help')
  for (const name of ['pricing page', 'Terms', 'Privacy Policy']) await expect(page.getByRole('link', { name, exact: true }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'magicalbirthdayplanner@gmail.com' })).toHaveAttribute('href', 'mailto:magicalbirthdayplanner@gmail.com')
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { name: '4. Service Providers We Use' })).toBeVisible()
  await page.getByRole('contentinfo').getByRole('link', { name: 'Help' }).click()
  await expect(page).toHaveURL(/\/help$/)
})
