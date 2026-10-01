import type { Metadata } from 'next'
import { VenueDetailScreen } from '@/components/discover/VenueDetailScreen'
import { RequireSignedIn } from '@/components/app/RequireSignedIn'

export const metadata: Metadata = { title: 'Venue' }

export default function VenuePage({ params }: { params: { placeId: string } }) {
  return (
    <RequireSignedIn>
      <VenueDetailScreen placeId={decodeURIComponent(params.placeId)} />
    </RequireSignedIn>
  )
}
