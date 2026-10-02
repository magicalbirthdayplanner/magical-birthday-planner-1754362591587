import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-url'

/**
 * Only marketing pages are crawlable. Private pages additionally carry
 * `noindex` (Disallow alone doesn't stop indexing of linked URLs).
 * Non-production deployments are never indexed.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return { rules: { userAgent: '*', disallow: '/' } }
  }
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/pricing', '/privacy', '/terms'],
      disallow: [
        '/api/', '/auth/', '/invite/', '/rsvp/', '/share/', '/venue/', '/home', '/plan', '/discover', '/guests', '/more', '/start',
        '/login', '/join', '/reset-password', '/offline', '/account', '/dashboard', '/create-party', '/party-plan', '/checkout-success',
        '/signin', '/signup', '/signup-success', '/activities',
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
