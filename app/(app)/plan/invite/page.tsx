import type { Metadata } from 'next'
import { InviteScreen } from '@/components/invite/InviteScreen'

export const metadata: Metadata = { title: 'Invitation' }

export default function InvitePage() {
  return <InviteScreen />
}
