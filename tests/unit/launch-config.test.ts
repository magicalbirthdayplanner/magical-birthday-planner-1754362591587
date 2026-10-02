import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'
import robots from '@/app/robots'
import sitemap from '@/app/sitemap'
import { builderScriptsEnabled } from '@/lib/builder-scripts'
import { siteUrl } from '@/lib/site-url'

const require = createRequire(import.meta.url)

afterEach(() => vi.unstubAllEnvs())

describe('robots / sitemap', () => {
  it('non-production deployments are never indexed', () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    expect(robots().rules).toEqual({ userAgent: '*', disallow: '/' })
  })
  it('production allows marketing pages only', () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://example.app/')
    const r = robots()
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules
    expect(rules.allow).toEqual(['/', '/pricing', '/privacy', '/terms'])
    for (const p of ['/api/', '/invite/', '/rsvp/', '/home', '/plan', '/guests', '/venue/', '/account']) expect(rules.disallow).toContain(p)
    expect(r.sitemap).toBe('https://example.app/sitemap.xml')
    expect(sitemap().map((e) => e.url)).toEqual(['https://example.app', 'https://example.app/pricing', 'https://example.app/privacy', 'https://example.app/terms'])
  })
  it('site URL falls back to the deployment host', () => {
    expect(siteUrl({ VERCEL_URL: 'x-git-y.vercel.app' })).toBe('https://x-git-y.vercel.app')
  })
})

describe('builder (Ideavo) scripts', () => {
  it('never load on Vercel deployments', () => {
    expect(builderScriptsEnabled({ VERCEL_ENV: 'production' })).toBe(false)
    expect(builderScriptsEnabled({ VERCEL_ENV: 'preview' })).toBe(false)
    expect(builderScriptsEnabled({})).toBe(true)
  })
})

describe('security headers', () => {
  const load = () => {
    delete require.cache[require.resolve('../../next.config.js')]
    return require('../../next.config.js') as { headers: () => Promise<{ source: string; headers: { key: string; value: string }[] }[]> }
  }
  it('Vercel deployments refuse framing (clickjacking)', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    const all = (await load().headers()).find((h) => h.source === '/:path*')!.headers
    expect(all).toContainEqual({ key: 'X-Frame-Options', value: 'DENY' })
    expect(all.find((h) => h.key === 'Content-Security-Policy')?.value).toContain("frame-ancestors 'none'")
  })
  it('builder environment keeps framing allowed', async () => {
    vi.stubEnv('VERCEL_ENV', '')
    const all = (await load().headers()).find((h) => h.source === '/:path*')!.headers
    expect(all.find((h) => h.key === 'X-Frame-Options')).toBeUndefined()
  })
})
