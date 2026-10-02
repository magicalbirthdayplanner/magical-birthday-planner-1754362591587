import type { Metadata } from 'next'
import { AppShell } from '@/components/app/AppShell'

/** Signed-in app / flow screens are private: never indexed. */
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
