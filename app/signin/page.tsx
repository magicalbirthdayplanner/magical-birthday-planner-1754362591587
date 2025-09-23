import SignIn from '@/components/auth/SignIn'
import { Suspense } from 'react'

// Force dynamic rendering for this page since it uses useSearchParams
export const dynamic = 'force-dynamic'

export default function SignInPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignIn />
    </Suspense>
  )
}