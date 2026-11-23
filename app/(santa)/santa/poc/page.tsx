import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SantaPoc } from '@/components/santa/SantaPoc'

export const metadata: Metadata = { title: 'Santa call — test', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/** Internal proof of concept. Production: only with SANTA_POC_ENABLED=true (the API additionally requires Super Admin). */
export default function SantaPocPage() {
  if (process.env.NODE_ENV === 'production' && process.env.SANTA_POC_ENABLED !== 'true') notFound()
  return <SantaPoc />
}
