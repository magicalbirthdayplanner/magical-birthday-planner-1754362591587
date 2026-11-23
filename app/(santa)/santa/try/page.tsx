import type { Metadata } from 'next'
import { SantaTry } from '@/components/santa/SantaTry'

export const metadata: Metadata = { title: 'Say hi to Santa — free 30-second preview' }

export default function SantaTryPage() {
  return <SantaTry />
}
