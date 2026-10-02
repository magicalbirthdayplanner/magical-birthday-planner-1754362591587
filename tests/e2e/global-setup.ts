import { clearArea } from './helpers'

export default async function globalSetup() {
  const url = 'http://127.0.0.1:54321/auth/v1/health'
  try {
    const res = await fetch(url, { headers: { apikey: 'anon' } })
    if (!res.ok && res.status !== 401) throw new Error(String(res.status))
  } catch (e) {
    throw new Error(`Local Supabase is not reachable at ${url}. Run: npm run db:start && npm run db:reset\n${e}`)
  }
  // Start every run with a cold discovery cache for the 48084 test area so results
  // (and Place Details) come from this run's mock server, not an earlier one.
  await clearArea(42.5627, -83.1799, 0.8)
}
