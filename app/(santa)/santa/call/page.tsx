import { Suspense } from 'react'
import type { Metadata } from 'next'
import { SantaCallPage } from '@/components/santa/SantaCallPage'

export const metadata: Metadata = { title: 'Calling Santa', robots: { index: false, follow: false } }

export default function SantaCallRoute() {
  return (
    <Suspense>
      <SantaCallPage />
    </Suspense>
  )
}
