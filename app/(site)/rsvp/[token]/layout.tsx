import type { Metadata } from 'next'

/** Token / account pages are private: never indexed. */
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function NoIndexLayout({ children }: { children: React.ReactNode }) {
  return children
}
