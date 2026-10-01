import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PartyWizard } from '@/components/wizard/PartyWizard'

export const metadata: Metadata = { title: 'Plan a party' }

export default function StartPage() {
  return (
    <Suspense>
      <PartyWizard />
    </Suspense>
  )
}
