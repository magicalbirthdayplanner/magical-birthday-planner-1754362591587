/**
 * Opt-in, READ-ONLY X credential check (never part of `npm test`). It calls GET /2/users/me and nothing else —
 * no post, no upload, no follow, no like. Run:
 *   X_LIVE=1 X_API_KEY=… X_API_SECRET=… X_ACCESS_TOKEN=… X_ACCESS_TOKEN_SECRET=… npx vitest run tests/live/x-live.test.ts -c vitest.live.config.ts
 */
import { describe, expect, it } from 'vitest'
import { XMarketingProvider, xCredentialsFromEnv } from '@/lib/marketing/providers/x'

describe.skipIf(process.env.X_LIVE !== '1')('X credentials (live, read-only)', () => {
  it('the OAuth 1.0a user-context credentials authenticate', async () => {
    const credentials = xCredentialsFromEnv()
    expect(credentials, 'set the four X_* variables').not.toBeNull()
    const me = await new XMarketingProvider({ credentials, maxChars: 280 }).verify()
    expect(me.id).toMatch(/^\d+$/)
    console.info(`X credentials OK — authenticated as @${me.username}; access level: ${me.accessLevel ?? 'unknown'} (posting needs read-write)`)
  })
})
