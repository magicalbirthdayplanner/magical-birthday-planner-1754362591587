import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'
import robots from '@/app/robots'
import sitemap from '@/app/sitemap'
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
    expect(rules.allow).toEqual(['/', '/pricing', '/privacy', '/terms', '/help'])
    for (const p of ['/api/', '/invite/', '/home', '/plan', '/guests', '/venue/', '/checkout-success']) expect(rules.disallow).toContain(p)
    expect(r.sitemap).toBe('https://example.app/sitemap.xml')
    expect(sitemap().map((e) => e.url)).toEqual(['https://example.app', 'https://example.app/pricing', 'https://example.app/privacy', 'https://example.app/terms', 'https://example.app/help'])
  })
  it('site URL falls back to the deployment host', () => {
    expect(siteUrl({ VERCEL_URL: 'x-git-y.vercel.app' })).toBe('https://x-git-y.vercel.app')
  })
})

describe('security headers', () => {
  const load = () => {
    delete require.cache[require.resolve('../../next.config.js')]
    return require('../../next.config.js') as { headers: () => Promise<{ source: string; headers: { key: string; value: string }[] }[]> }
  }
  it('the app can never be framed (clickjacking)', async () => {
    const all = (await load().headers()).find((h) => h.source === '/:path*')!.headers
    expect(all).toContainEqual({ key: 'X-Frame-Options', value: 'DENY' })
    expect(all.find((h) => h.key === 'Content-Security-Policy')?.value).toContain("frame-ancestors 'none'")
  })
})

describe('canonical production origin', () => {
  it('production deployments use https://magicalbirthdayplanner.app unless explicitly overridden', async () => {
    const { siteUrl, PRODUCTION_ORIGIN } = await import('@/lib/site-url')
    expect(PRODUCTION_ORIGIN).toBe('https://magicalbirthdayplanner.app')
    expect(siteUrl({ VERCEL_ENV: 'production', VERCEL_URL: 'magical-birthday-planner-abc.vercel.app' })).toBe('https://magicalbirthdayplanner.app')
    expect(siteUrl({ VERCEL_ENV: 'production', NEXT_PUBLIC_BASE_URL: 'https://magicalbirthdayplanner.app/' })).toBe('https://magicalbirthdayplanner.app')
    expect(siteUrl({ VERCEL_ENV: 'preview', VERCEL_URL: 'x-git-y.vercel.app' })).toBe('https://x-git-y.vercel.app')
    expect(siteUrl({})).toBe('http://localhost:3100')
  })
  it('invitation links and the Dodo return URL use the canonical origin in production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', '')
    const { inviteLink, appBaseUrl } = await import('@/lib/server/notifications')
    expect(appBaseUrl()).toBe('https://magicalbirthdayplanner.app')
    expect(inviteLink('ab'.repeat(24))).toBe(`https://magicalbirthdayplanner.app/invite/${'ab'.repeat(24)}`)
  })
})
