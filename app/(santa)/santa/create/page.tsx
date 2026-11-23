import { Suspense } from 'react'
import type { Metadata } from 'next'
import { SantaSetup } from '@/components/santa/SantaSetup'

export const metadata: Metadata = { title: 'Create your Santa call', robots: { index: false, follow: false } }

export default function SantaCreatePage() {
  return (
    <Suspense>
      <SantaSetup />
    </Suspense>
  )
}
