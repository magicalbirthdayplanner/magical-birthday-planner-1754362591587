import type { Metadata } from 'next'
import { FlowShell } from '@/components/app/AppShell'

/** Signed-in app / flow screens are private: never indexed. */
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function FlowLayout({ children }: { children: React.ReactNode }) {
  return <FlowShell>{children}</FlowShell>
}
