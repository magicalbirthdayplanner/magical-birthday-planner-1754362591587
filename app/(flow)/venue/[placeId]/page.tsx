import type { Metadata } from 'next'
import { VenueDetailScreen } from '@/components/discover/VenueDetailScreen'
import { RequireSignedIn } from '@/components/app/RequireSignedIn'

export const metadata: Metadata = { title: 'Venue' }

export default async function VenuePage(props: { params: Promise<{ placeId: string }> }) {
  const params = await props.params
  return (
    <RequireSignedIn>
      <VenueDetailScreen placeId={decodeURIComponent(params.placeId)} />
    </RequireSignedIn>
  )
}
