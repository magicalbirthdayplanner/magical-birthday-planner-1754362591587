import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ActivitiesScreen } from '@/components/activities/ActivitiesScreen'
import { EXPERIENCE_ENABLED } from '@/lib/experience/flags'

export const metadata: Metadata = { title: 'Activities' }

export default function ActivitiesPage() {
  if (!EXPERIENCE_ENABLED) notFound()
  return (
    <Suspense>
      <ActivitiesScreen />
    </Suspense>
  )
}
