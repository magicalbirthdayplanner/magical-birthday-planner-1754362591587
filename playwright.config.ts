import { defineConfig, devices } from '@playwright/test'

/**
 * Mobile-first E2E. Requires the local Supabase stack (`npm run db:start`).
 * Google is mocked (tests/mock-google/server.mjs); nothing calls real Google APIs.
 */
const PORT = Number(process.env.E2E_PORT ?? 3101)
export const BASE_URL = `http://localhost:${PORT}`
export const MOCK_GOOGLE = 'http://127.0.0.1:4010'
/** Same build, second server forced into the temporary pre-launch mode (lib/launch.ts). */
export const PRELAUNCH_PORT = Number(process.env.E2E_PRELAUNCH_PORT ?? 3102)

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // Primary: the required end-to-end flow on a 390px iPhone viewport.
    { name: 'iphone-390', use: { ...devices['iPhone 13'], browserName: 'chromium' }, testIgnore: /viewports|mobile-regression|prelaunch/ },
    // Layout checks at every target width.
    { name: 'viewports', use: { browserName: 'chromium' }, testMatch: /viewports|mobile-regression/ },
    // Pre-launch waitlist mode (PRELAUNCH_MODE=on server).
    { name: 'prelaunch', use: { ...devices['iPhone 13'], browserName: 'chromium', baseURL: `http://localhost:${PRELAUNCH_PORT}` }, testMatch: /prelaunch/ },
  ],
  webServer: [
    {
      // Mock Google + Resend + Dodo test mode; delivers signed webhooks to the app under test.
      command: `npx dotenv -e .env.e2e -v MOCK_APP_WEBHOOK_URL=${BASE_URL}/api/webhooks/dodo -- node tests/mock-google/server.mjs`,
      url: `${MOCK_GOOGLE}/health`,
      reuseExistingServer: true,
      timeout: 20_000,
    },
    {
      command: `npx dotenv -e .env.e2e -v NEXT_DIST_DIR=.next-e2e -v NEXT_PUBLIC_BASE_URL=${BASE_URL} -- sh -c "next build && next start -p ${PORT}"`,
      url: `${BASE_URL}/manifest.webmanifest`,
      reuseExistingServer: !process.env.CI,
      timeout: 600_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      // Started after the app server above, so it reuses that build (same NEXT_DIST_DIR).
      command: `npx dotenv -e .env.e2e -v NEXT_DIST_DIR=.next-e2e -v NEXT_PUBLIC_BASE_URL=${BASE_URL} -v PRELAUNCH_MODE=on -- next start -p ${PRELAUNCH_PORT}`,
      url: `http://localhost:${PRELAUNCH_PORT}/manifest.webmanifest`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
})
