import { db } from '@/lib/db/browser'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    /** Cheapest plan that unlocks the feature (403 forbidden_plan / 429 limit_reached from AI routes). */
    public upgradeTo: string | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
  get isNetwork() {
    return this.status === 0
  }
}

/** fetch() for our own API routes: adds the user's access token, normalizes errors. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await db.auth.getSession()
  const token = data.session?.access_token
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError(0, 'network', navigatorOffline() ? "You're offline. Check your connection and try again." : 'Network error. Please try again.')
  }
  if (!res.ok) {
    let code = 'server_error'
    let message = 'Something went wrong. Please try again.'
    let upgradeTo: string | null = null
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string; upgradeTo?: string | null } }
      code = body.error?.code ?? code
      message = body.error?.message ?? message
      upgradeTo = typeof body.error?.upgradeTo === 'string' ? body.error.upgradeTo : null
    } catch {
      /* non-JSON error */
    }
    if (res.status === 401) code = 'unauthorized'
    throw new ApiError(res.status, code, message, upgradeTo)
  }
  return (await res.json()) as T
}

function navigatorOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/** Turn any thrown value into copy that is safe to show a parent. */
export function friendlyError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiError) return err.message
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return "You're offline. Check your connection and try again."
  const msg = (err as { message?: string })?.message ?? ''
  if (/JWT|session|refresh token/i.test(msg)) return 'Your session expired. Please sign in again.'
  if (/Failed to fetch|NetworkError|fetch failed/i.test(msg)) return "We couldn't reach our servers. Please try again."
  return fallback
}
