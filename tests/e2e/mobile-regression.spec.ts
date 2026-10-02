/**
 * Phase 19 mobile regression at 375 / 390 / 393 / 430 px: the whole journey,
 * checking at every step that the layout never exceeds the phone width.
 */
import { expect, test, type Page } from '@playwright/test'
import { seedUser } from './helpers'

const WIDTHS = [375, 390, 393, 430]

async function noOverflow(page: Page, step: string) {
  await page.waitForTimeout(250)
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(over, `${step}: overflows by ${over}px`).toBeLessThanOrEqual(1)
}

async function nav(page: Page, label: string) {
  const bar = page.getByRole('navigation', { name: 'Main' })
  await expect(bar).toBeVisible()
  await bar.getByRole('link', { name: label }).click()
}

for (const width of WIDTHS) {
  test(`${width}px — onboarding → discovery → plan → logout/login`, async ({ browser }) => {
    test.setTimeout(150_000)
    const seeded = await seedUser({ withParty: false })
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'])
    const page = await ctx.newPage()

    // login
    await page.goto('/login?next=/start')
    await noOverflow(page, 'login')
    await page.getByLabel('Email').fill(seeded.email)
    await page.getByLabel('Password', { exact: true }).fill(seeded.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL('**/start')

    // onboarding (every step checked)
    const cont = () => page.getByRole('button', { name: /^(Continue|Skip|Skip for now)$/ }).click()
    await noOverflow(page, 'wizard:name')
    await page.getByLabel('Child’s name').fill('Noor')
    await cont()
    await page.getByRole('radio', { name: '6', exact: true }).click()
    await noOverflow(page, 'wizard:age')
    await cont()
    await page.getByRole('button', { name: 'In 2 weeks' }).click()
    await noOverflow(page, 'wizard:date')
    await cont()
    await page.getByLabel('ZIP code').fill('48084')
    await expect(page.getByText('Troy, MI')).toBeVisible()
    await noOverflow(page, 'wizard:zip')
    await cont()
    await noOverflow(page, 'wizard:guests')
    await cont()
    await page.getByRole('button', { name: '$750' }).click()
    await noOverflow(page, 'wizard:budget')
    await cont()
    await page.getByRole('radio', { name: /Indoor/ }).click()
    await noOverflow(page, 'wizard:vibe')
    await cont()
    await page.getByRole('button', { name: 'Science', exact: true }).click()
    await noOverflow(page, 'wizard:interests')
    await cont()
    await noOverflow(page, 'wizard:theme')
    await cont()
    await noOverflow(page, 'wizard:finale')
    await page.getByRole('button', { name: 'Find party places near me' }).click()

    // ZIP search → list
    await expect(page.getByTestId('aha')).toBeVisible()
    await noOverflow(page, 'discover:aha')
    await page.getByRole('button', { name: 'Start browsing' }).click()
    await expect(page.getByTestId('venue-card').first()).toBeVisible()
    await page.mouse.wheel(0, 1500)
    await noOverflow(page, 'discover:list scrolled')

    // filters
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.getByRole('button', { name: /^Filters/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await noOverflow(page, 'filters sheet')
    await page.getByRole('button', { name: '★ 4+' }).click()
    await page.getByRole('button', { name: /^Show \d+ place/ }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // map
    await page.getByRole('tab', { name: 'Map view' }).click()
    await expect(page.getByTestId('map-marker').or(page.getByTestId('map-cluster')).first()).toBeVisible()
    await noOverflow(page, 'map')
    await page.getByRole('tab', { name: 'List view' }).click()

    // detail + save two venues (for compare)
    const cards = page.getByTestId('venue-card')
    const names: string[] = []
    for (const i of [0, 1]) {
      const card = cards.nth(i)
      names.push((await card.locator('h3').textContent())!.trim())
      await card.getByRole('button', { name: /^Save / }).click()
    }
    await cards.first().getByRole('link', { name: 'View', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: names[0] })).toBeVisible()
    await noOverflow(page, 'venue detail')
    await page.goBack()

    // compare
    await page.goto('/discover/saved')
    await expect(page.getByRole('link', { name: names[0] })).toBeVisible()
    for (const n of names) await page.getByRole('listitem').filter({ hasText: n }).getByRole('button', { name: 'Compare' }).click()
    await page.getByRole('button', { name: /^Compare 2 places/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await noOverflow(page, 'compare sheet')
    await page.keyboard.press('Escape')

    // dashboard, theme, guests, checklist, invitation
    await nav(page, 'Plan')
    await expect(page.getByRole('heading', { name: /Noor’s party is/ })).toBeVisible()
    await noOverflow(page, 'plan dashboard')
    await page.goto('/plan/theme')
    await page.locator('section', { has: page.getByRole('heading', { name: 'Recommended for Noor' }) }).getByRole('button').first().click()
    await page.getByRole('button', { name: 'Choose this theme' }).click()
    await expect(page.getByText(/it is!/)).toBeVisible()
    await noOverflow(page, 'theme')
    await nav(page, 'Guests')
    await page.getByRole('button', { name: 'Add a guest' }).click()
    await page.getByLabel('Name').fill('The Okafor family')
    await page.getByRole('button', { name: 'Add guest' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('list', { name: 'Guest list' }).getByText('The Okafor family')).toBeVisible()
    await noOverflow(page, 'guests')
    await page.goto('/plan/checklist')
    await expect(page.getByText('Order the cake')).toBeVisible()
    await noOverflow(page, 'checklist')
    await page.goto('/plan/invite')
    await expect(page.getByTestId('invitation-card')).toContainText('Noor')
    await noOverflow(page, 'invitation')
    await page.getByRole('button', { name: 'Copy link' }).click()
    await expect(page.getByText('Invite link copied')).toBeVisible()

    // reload keeps everything
    await page.goto('/home')
    await page.reload()
    await expect(page.getByText('Noor’s birthday is in')).toBeVisible()
    await noOverflow(page, 'home after reload')

    // logout → login → continue
    await nav(page, 'More')
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('heading', { name: /Plan your child’s birthday/ })).toBeVisible()
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('mbp.') && k !== 'mbp.aid'))).toEqual([])
    await page.goto('/plan')
    await expect(page).toHaveURL(/\/login/)
    await page.getByLabel('Email').fill(seeded.email)
    await page.getByLabel('Password', { exact: true }).fill(seeded.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: /Noor’s party is/ })).toBeVisible()
    await page.goto('/discover/saved')
    await expect(page.getByRole('link', { name: names[0] })).toBeVisible()
    await ctx.close()
  })
}
