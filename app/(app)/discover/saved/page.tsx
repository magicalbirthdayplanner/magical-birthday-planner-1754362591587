import type { Metadata } from 'next'
import { SavedScreen } from '@/components/discover/SavedScreen'

export const metadata: Metadata = { title: 'Saved places' }

export default function SavedPage() {
  return <SavedScreen />
}
