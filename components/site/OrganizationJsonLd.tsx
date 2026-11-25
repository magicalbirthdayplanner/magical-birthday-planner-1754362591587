import { SOCIAL_PROFILES } from '@/lib/social'
import { siteUrl } from '@/lib/site-url'

/**
 * schema.org Organization + WebSite structured data for the public pages. `sameAs` lists the official social profiles
 * so search engines can tie them to this site (knowledge panel, brand search results).
 */
export function OrganizationJsonLd() {
  const base = siteUrl()
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${base}/#organization`,
        name: 'Magical Birthday Planner',
        url: `${base}/`,
        logo: `${base}/icons/icon-512.png`,
        email: 'magicalbirthdayplanner@gmail.com',
        sameAs: SOCIAL_PROFILES.map((p) => p.url),
      },
      {
        '@type': 'WebSite',
        '@id': `${base}/#website`,
        name: 'Magical Birthday Planner',
        url: `${base}/`,
        publisher: { '@id': `${base}/#organization` },
      },
    ],
  }
  // JSON in a <script> must not be able to close the tag early.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />
}
