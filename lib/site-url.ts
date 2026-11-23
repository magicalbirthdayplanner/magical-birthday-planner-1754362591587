/** The one canonical production origin. Every other host (www, *.vercel.app) redirects here. */
export const PRODUCTION_ORIGIN = 'https://magicalbirthdayplanner.app'

/**
 * Public origin used for absolute URLs built on the server (email links, invitation and
 * RSVP links, Dodo return URL, metadata, sitemap):
 *   NEXT_PUBLIC_BASE_URL → production deployment: PRODUCTION_ORIGIN → preview: its Vercel URL → local dev.
 */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  const raw =
    env.NEXT_PUBLIC_BASE_URL ||
    (env.VERCEL_ENV === 'production' ? PRODUCTION_ORIGIN : env.VERCEL_URL ? `https://${env.VERCEL_URL}` : 'http://localhost:3100')
  return raw.trim().replace(/\/$/, '')
}

/** Magical Santa's own domain (same deployment, host-routed by middleware.ts). */
export const SANTA_PRODUCTION_ORIGIN = 'https://magicalholidays.app'
export const SANTA_PRODUCTION_HOSTS = ['magicalholidays.app', 'www.magicalholidays.app']

/** Public origin for Magical Santa links (checkout return, metadata): SANTA_BASE_URL → production: the Santa domain →
 *  otherwise the deployment's own origin (previews, local dev serve Santa under /santa). */
export function santaUrl(env: Record<string, string | undefined> = process.env): string {
  const raw = env.SANTA_BASE_URL || (env.VERCEL_ENV === 'production' ? SANTA_PRODUCTION_ORIGIN : siteUrl(env))
  return raw.trim().replace(/\/$/, '')
}
