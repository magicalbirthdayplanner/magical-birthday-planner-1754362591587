import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-url'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  return ['', '/pricing', '/privacy', '/terms'].map((path) => ({ url: `${base}${path}`, changeFrequency: 'monthly', priority: path ? 0.5 : 1 }))
}
