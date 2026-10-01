import type { Metadata } from 'next'
import { ThemeScreen } from '@/components/plan/ThemeScreen'

export const metadata: Metadata = { title: 'Theme' }

export default function ThemePage() {
  return <ThemeScreen />
}
