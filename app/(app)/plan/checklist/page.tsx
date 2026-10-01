import type { Metadata } from 'next'
import { ChecklistScreen } from '@/components/plan/ChecklistScreen'

export const metadata: Metadata = { title: 'Checklist' }

export default function ChecklistPage() {
  return <ChecklistScreen />
}
