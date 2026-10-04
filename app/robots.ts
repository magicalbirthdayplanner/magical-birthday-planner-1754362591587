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
      allow: ['/', '/pricing', '/privacy', '/terms', '/help'],
      disallow: [
        '/api/', '/auth/', '/invite/', '/venue/', '/home', '/plan', '/discover', '/guests', '/more', '/start',
        '/login', '/join', '/reset-password', '/offline', '/checkout-success',
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
