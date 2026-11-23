import type { Metadata } from 'next'
import { SantaLanding } from '@/components/santa/SantaLanding'

// Absolute: the root layout's "· Magical Birthday Planner" template must not apply on the Santa site.
export const metadata: Metadata = { title: { absolute: 'Magical Santa — a video call with Santa, made just for your child' } }

export default function SantaHome() {
  return <SantaLanding />
}
