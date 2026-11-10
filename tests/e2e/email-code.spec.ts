/**
 * Sign up / sign in with a 6-digit code sent by email (no password, no link to tap). Codes are read from the local
 * Supabase's Mailpit inbox, so the real email template is exercised too.
 */
import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import { appAlert, emailCode, quickWizard, seedUser } from './helpers'

const URL = 'http://127.0.0.1:54321'
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const admin = () => createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
const userByEmail = async (email: string) => (await admin().auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => u.email === email)

test('signed-out parent saves the wizard party with an emailed code', async ({ page }) => {
  const email = `e2e-code-wiz-${Date.now()}@example.test`
  await page.goto('/start')
  await quickWizard(page, { name: 'Ivy', age: 5, postal: '48084' })
  // Ideas first, no account needed.
  await expect(page.getByTestId('preview-venue').first()).toBeVisible()
  await page.getByTestId('preview-venue').first().getByRole('button', { name: /^Save / }).click()
  await expect(page.getByText('Save the party first to keep places you like.')).toBeVisible()

  await expect(page.getByRole('heading', { name: 'Save Ivy’s party — free' })).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0)
  await page.getByLabel('Your first name').fill('Jo')
  await page.getByLabel('Email').fill(email)
  const sentAt = Date.now() - 1000
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await expect(page.getByTestId('email-code-step')).toContainText(email)
  await page.getByLabel('6-digit code').fill(await emailCode(email, sentAt))

  // Verified → signed in → the party is created straight away, no confirmation link needed.
  await expect(page).toHaveURL(/\/discover/)
  const u = await userByEmail(email)
  expect(u?.email_confirmed_at).toBeTruthy()
  expect(u?.user_metadata.display_name).toBe('Jo')
  const { data: parties } = await admin().from('parties').select('child_name, guest_count').eq('user_id', u!.id)
  expect(parties).toEqual([{ child_name: 'Ivy', guest_count: 15 }])
  await admin().auth.admin.deleteUser(u!.id)
})

test('an existing account signs in with an emailed code', async ({ page }) => {
  const s = await seedUser({ withParty: false })
  await page.goto('/login?next=%2Fhome')
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0)
  await page.getByLabel('Email').fill(s.email)
  const sentAt = Date.now() - 1000
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await page.getByLabel('6-digit code').fill(await emailCode(s.email, sentAt))
  await page.waitForURL('**/home')
})

test('signing up with an email that already has an account just signs in', async ({ page }) => {
  const s = await seedUser({ withParty: false })
  await page.goto('/join?next=%2Fhome')
  await page.getByLabel('Email').fill(s.email)
  const sentAt = Date.now() - 1000
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await page.getByLabel('6-digit code').fill(await emailCode(s.email, sentAt))
  await page.waitForURL('**/home')
})

test('a wrong code, an unknown email and resending are handled kindly', async ({ page }) => {
  const s = await seedUser({ withParty: false })
  await page.goto('/login')
  await page.getByLabel('Email').fill(`nobody-${Date.now()}@example.test`)
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await expect(appAlert(page)).toHaveText('We couldn’t find an account for that email. Check it, or create a new account.')

  await page.getByLabel('Email').fill(s.email)
  await page.getByRole('button', { name: 'Email me a code' }).click()
  const code = await emailCode(s.email)
  const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0')
  await page.getByLabel('6-digit code').fill(wrong)
  await expect(appAlert(page)).toHaveText('That code isn’t right or has expired. Check it, or send a new code.')
  await expect(page.getByLabel('6-digit code')).toHaveValue('')
  await expect(page.getByText(/send a new code in \d+s/)).toBeVisible()

  await page.getByRole('button', { name: 'Use a different email' }).click()
  await expect(page.getByLabel('Email')).toHaveValue(s.email)
})
