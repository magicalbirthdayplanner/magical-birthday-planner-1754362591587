import 'server-only'
import { getAuthedRequest, type AuthedRequest } from './auth'
import { googleBudgetFor } from './google-budget'
import { apiError } from './http'
import { rateLimit } from './rate-limit'

/**
 * Guard for legacy planner routes that call paid providers (Google, Azure OpenAI):
 * signed-in users only, a per-user rate limit, and (optionally) the shared hourly
 * Google call budget. Returns the authed request, or a ready error response.
 */
export async function guardPaidLegacyRoute(
  req: Request,
  opts: { key: string; perMinute: number; googleCalls?: number },
): Promise<{ auth: AuthedRequest; error?: undefined } | { auth?: undefined; error: Response }> {
  const auth = await getAuthedRequest(req)
  if (!auth) return { error: apiError(401, 'unauthorized', 'Please sign in to continue.') }
  const rl = rateLimit(`${opts.key}:${auth.user.id}`, opts.perMinute, 60_000)
  if (!rl.ok) return { error: apiError(429, 'rate_limited', 'Slow down a little — try again in a moment.', { 'Retry-After': String(rl.retryAfterSeconds) }) }
  if (opts.googleCalls && !googleBudgetFor(auth.user.id).allow(opts.googleCalls)) {
    return { error: apiError(429, 'quota', 'Search limit reached for now. Please try again later.') }
  }
  return { auth }
}
