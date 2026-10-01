import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AuthScreen } from '@/components/app/AuthForm'

export const metadata: Metadata = { title: 'Create account' }

export default function JoinPage() {
  return (
    <Suspense>
      <AuthScreen mode="signup" />
    </Suspense>
  )
}
