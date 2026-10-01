import { Suspense } from 'react'
import type { Metadata } from 'next'
import { DiscoverScreen } from '@/components/discover/DiscoverScreen'

export const metadata: Metadata = { title: 'Discover party places' }

export default function DiscoverPage() {
  return (
    <Suspense>
      <DiscoverScreen />
    </Suspense>
  )
}
