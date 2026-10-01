import type { Metadata } from 'next'
import { PublicInviteScreen } from '@/components/invite/PublicInviteScreen'

export const metadata: Metadata = {
  title: 'You’re invited!',
  robots: { index: false, follow: false },
}

export default function PublicInvitePage({ params }: { params: { token: string } }) {
  return <PublicInviteScreen token={params.token} />
}
