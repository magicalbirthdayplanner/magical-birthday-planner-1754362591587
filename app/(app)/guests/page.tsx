import type { Metadata } from 'next'
import { GuestsScreen } from '@/components/guests/GuestsScreen'

export const metadata: Metadata = { title: 'Guests' }

export default function GuestsPage() {
  return <GuestsScreen />
}
