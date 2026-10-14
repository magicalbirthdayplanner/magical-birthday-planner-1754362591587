import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-url'
import { INDIA_ENABLED } from '@/lib/country/countries'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  return ['', ...(INDIA_ENABLED ? ['/in'] : []), '/pricing', '/privacy', '/terms', '/help'].map((path) => ({ url: `${base}${path}`, changeFrequency: 'monthly', priority: path ? 0.5 : 1 }))
}
