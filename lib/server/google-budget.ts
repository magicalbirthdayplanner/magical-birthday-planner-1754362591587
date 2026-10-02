/**
 * Hourly ceiling on outbound Google calls — per user and per server instance.
 * Cache hits never consume budget. When exhausted, discovery falls back to cached
 * or stored venues (or a friendly "try later") instead of calling Google.
 *
 * In-memory: limits each serverless instance, not the whole fleet. For a hard,
 * fleet-wide cap also set quotas in Google Cloud Console (see GOOGLE_PLACES_COST_CONTROL.md).
 */
const HOUR = 3_600_000
const windows = new Map<string, number[]>()

function intEnv(name: string, fallback: number): number {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

export const userHourlyLimit = () => intEnv('GOOGLE_USER_HOURLY_CALLS', 60)
export const instanceHourlyLimit = () => intEnv('GOOGLE_INSTANCE_HOURLY_CALLS', 2000)

function take(key: string, limit: number, n: number, now: number): boolean {
  const list = (windows.get(key) ?? []).filter((t) => t > now - HOUR)
  if (list.length + n > limit) {
    windows.set(key, list)
    return false
  }
  for (let i = 0; i < n; i++) list.push(now)
  windows.set(key, list)
  return true
}

export interface GoogleBudget {
  /** Reserve `n` outbound Google calls; false means "do not call Google". */
  allow(n?: number): boolean
}

export function googleBudgetFor(subject: string, now: () => number = Date.now): GoogleBudget {
  return {
    allow(n = 1) {
      const t = now()
      if (!take('instance', instanceHourlyLimit(), n, t)) return false
      if (!take(`subject:${subject}`, userHourlyLimit(), n, t)) {
        // Give the instance-level reservation back.
        const inst = windows.get('instance') ?? []
        inst.splice(inst.length - n, n)
        return false
      }
      return true
    },
  }
}

export function resetGoogleBudgets() {
  windows.clear()
}
