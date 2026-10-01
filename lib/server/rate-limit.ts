/**
 * Fixed-window, in-memory rate limiter. Per server instance — a guard against
 * runaway clients and casual abuse of paid APIs, not a distributed quota.
 * Production at scale: back this with Redis/Upstash (see docs/SECURITY.md).
 */
const buckets = new Map<string, { count: number; resetAt: number }>()

export interface RateLimitResult {
  ok: boolean
  remaining: number
  retryAfterSeconds: number
}

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  if (buckets.size > 10_000) {
    buckets.forEach((b, k) => {
      if (b.resetAt <= now) buckets.delete(k)
    })
  }
  let b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs }
    buckets.set(key, b)
  }
  b.count++
  return {
    ok: b.count <= limit,
    remaining: Math.max(0, limit - b.count),
    retryAfterSeconds: Math.max(0, Math.ceil((b.resetAt - now) / 1000)),
  }
}

export function resetRateLimits() {
  buckets.clear()
}
