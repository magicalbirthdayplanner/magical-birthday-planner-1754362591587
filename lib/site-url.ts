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
