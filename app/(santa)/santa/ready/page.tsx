import { Suspense } from 'react'
import type { Metadata } from 'next'
import { SantaReady } from '@/components/santa/SantaReady'

export const metadata: Metadata = { title: 'Your Santa call', robots: { index: false, follow: false } }

export default function SantaReadyPage() {
  return (
    <Suspense>
      <SantaReady />
    </Suspense>
  )
}
