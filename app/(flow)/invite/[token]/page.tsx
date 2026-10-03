import type { Metadata } from 'next'
import { PublicInviteScreen } from '@/components/invite/PublicInviteScreen'

export const metadata: Metadata = {
  title: 'You’re invited!',
  robots: { index: false, follow: false },
}

export default async function PublicInvitePage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params
  return <PublicInviteScreen token={params.token} />
}
