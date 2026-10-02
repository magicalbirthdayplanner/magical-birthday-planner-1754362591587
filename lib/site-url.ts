/** Canonical public origin: NEXT_PUBLIC_BASE_URL, else the Vercel deployment host, else local dev. */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  const raw = env.NEXT_PUBLIC_BASE_URL || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : 'http://localhost:3100')
  return raw.trim().replace(/\/$/, '')
}
