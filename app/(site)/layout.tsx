import type { Metadata } from 'next'
import ErrorBoundary from '@/components/ErrorBoundary'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'

/** Canonical for the landing page; pricing, legal and help pages set their own. */
export const metadata: Metadata = { alternates: { canonical: '/' } }

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
