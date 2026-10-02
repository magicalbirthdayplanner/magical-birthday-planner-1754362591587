import type { Metadata } from 'next'
import { ResetPasswordScreen } from '@/components/app/ResetPasswordScreen'

export const metadata: Metadata = { title: 'Reset password', robots: { index: false } }

export default function ResetPasswordPage() {
  return <ResetPasswordScreen />
}
