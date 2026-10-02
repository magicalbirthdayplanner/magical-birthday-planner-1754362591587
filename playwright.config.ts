import { defineConfig, devices } from '@playwright/test'

/**
 * Mobile-first E2E. Requires the local Supabase stack (`npm run db:start`).
 * Google is mocked (tests/mock-google/server.mjs); nothing calls real Google APIs.
 */
const PORT = Number(process.env.E2E_PORT ?? 3101)
export const BASE_URL = `http://localhost:${PORT}`
export const MOCK_GOOGLE = 'http://127.0.0.1:4010'

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
    { name: 'iphone-390', use: { ...devices['iPhone 13'], browserName: 'chromium' }, testIgnore: /viewports|mobile-regression/ },
    // Layout checks at every target width.
    { name: 'viewports', use: { browserName: 'chromium' }, testMatch: /viewports|mobile-regression/ },
  ],
  webServer: [
    {
      command: 'node tests/mock-google/server.mjs',
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
  ],
})
