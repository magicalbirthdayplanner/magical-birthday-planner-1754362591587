/** Super Admin on a phone: access, user search, plan overrides that persist, and normal-user denial. */
import { expect, test } from '@playwright/test'
import { grantSuperAdmin, login, makeFree, seedUser } from './helpers'

test('super admin switches plans FREE → STARTER → PLUS → PRO; it persists across refresh and re-login', async ({ page }) => {
  const target = await seedUser({ withParty: false })
  await makeFree(target.email)
  const s = await seedUser({ withParty: true })
  await grantSuperAdmin(s.email)
  await login(page, s, '/more')

  await page.getByRole('link', { name: 'Admin' }).click()
  await page.waitForURL('**/admin')
  await expect(page.getByTestId('admin-screen')).toBeVisible()
  await expect(page.getByText('Super Admin', { exact: true })).toBeVisible()
  await expect(page.getByTestId('admin-stats')).toContainText('Users:')
  await page.setViewportSize({ width: 375, height: 740 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  // Find the target user and walk through every plan.
  await page.getByPlaceholder('Search by email or name…').fill(target.email)
  await page.getByRole('button', { name: 'Search' }).click()
  await page.getByTestId('admin-user-list').getByText(target.email).first().click()
  const detail = page.getByTestId('admin-user-detail')
  await expect(detail.getByTestId('effective-plan')).toHaveText('Free')
  for (const plan of ['Starter', 'Plus', 'Pro']) {
    await detail.getByRole('radio', { name: plan }).click()
    await detail.getByRole('radio', { name: '7 days' }).click()
    await detail.getByRole('button', { name: 'Apply override' }).click()
    await expect(detail.getByTestId('effective-plan')).toHaveText(plan)
    await expect(detail.getByTestId('plan-source')).toHaveText('Admin override')
  }
  await expect(page.getByTestId('admin-audit')).toContainText('Override changed')

  // Own account quick switch → visible on More as "Admin override".
  const mine = page.getByTestId('my-plan')
  await mine.getByRole('radio', { name: 'Starter' }).click()
  await mine.getByRole('radio', { name: 'No expiration' }).click()
  await mine.getByRole('button', { name: 'Apply override' }).click()
  await expect(mine.getByTestId('effective-plan')).toHaveText('Starter')

  await page.reload()
  await expect(page.getByTestId('my-plan').getByTestId('effective-plan')).toHaveText('Starter')
  await page.goto('/more')
  await expect(page.getByTestId('plan-row')).toContainText('Starter')
  await expect(page.getByTestId('plan-row').getByTestId('plan-source')).toHaveText('Admin override')

  // logout → login: still overridden (server state).
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { name: /Plan your child’s birthday/ })).toBeVisible()
  await login(page, s, '/more')
  await expect(page.getByTestId('plan-row')).toContainText('Starter')

  // The target user sees their override too.
  await page.getByRole('button', { name: 'Sign out' }).click()
  await login(page, target, '/more')
  await expect(page.getByTestId('plan-row')).toContainText('Pro')
  await expect(page.getByTestId('plan-row').getByTestId('plan-source')).toHaveText('Admin override')

  // …and remove restores normal state (FREE).
  await page.getByRole('button', { name: 'Sign out' }).click()
  await login(page, s, '/admin')
  await page.getByPlaceholder('Search by email or name…').fill(target.email)
  await page.getByRole('button', { name: 'Search' }).click()
  await page.getByTestId('admin-user-list').getByText(target.email).first().click()
  await page.getByTestId('admin-user-detail').getByRole('button', { name: 'Remove override' }).click()
  await expect(page.getByTestId('admin-user-detail').getByTestId('effective-plan')).toHaveText('Free')
  await expect(page.getByTestId('admin-audit')).toContainText('Override removed')
})

test('a normal user has no Admin link and /admin shows not-found with no admin data', async ({ page }) => {
  const s = await seedUser({ withParty: true })
  await login(page, s, '/more')
  await expect(page.getByTestId('plan-row')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0)

  const apiCalls: number[] = []
  page.on('response', (r) => {
    if (r.url().includes('/api/admin/')) apiCalls.push(r.status())
  })
  await page.goto('/admin')
  await expect(page.getByText('Page not found')).toBeVisible()
  await expect(page.getByTestId('admin-screen')).toHaveCount(0)
  await expect(page.getByText('Super Admin')).toHaveCount(0)
  expect(apiCalls.length).toBeGreaterThan(0)
  expect(apiCalls.every((s) => s === 404)).toBe(true)
})
