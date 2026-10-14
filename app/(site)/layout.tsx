import type { Metadata } from 'next'
import ErrorBoundary from '@/components/ErrorBoundary'
import { INDIA_ENABLED } from '@/lib/country/countries'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'

/** Canonical for the landing page; pricing, legal, help and /in set their own. With India on, the landing page and
 *  /in point at each other as the en-US / en-IN versions. */
export const metadata: Metadata = { alternates: { canonical: '/', ...(INDIA_ENABLED ? { languages: { 'en-US': '/', 'en-IN': '/in', 'x-default': '/' } } : {}) } }

/** Public marketing pages (landing, pricing, checkout result, privacy, terms). The product lives in (app)/(flow). */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen pt-14 sm:pt-16">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <SiteFooter />
    </>
  )
}
