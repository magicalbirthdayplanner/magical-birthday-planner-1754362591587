'use client'
/** Registry of Plan → AI tools. Each phase (7–13) adds its tool here. */
import type { ComponentType, ReactNode } from 'react'
import { ListChecks } from 'lucide-react'
import type { AIFeature } from '@/lib/ai/types'
import type { ChecklistResult } from '@/lib/ai/schemas/checklist'
import { ChecklistResultView } from './results/ChecklistResultView'

export interface ToolDef {
  feature: AIFeature
  label: (budget: number | null) => string
  sub: string
  title: string
  path: string
  icon: ComponentType<{ className?: string }>
  steps?: string[]
  body?: () => Record<string, unknown>
  render: (result: never, generationId: string, partyId: string) => ReactNode
}

export const TOOLS: ToolDef[] = [
  {
    feature: 'checklist',
    label: () => 'Build my checklist',
    sub: 'Tasks that fit the days you have left',
    title: 'Your AI checklist',
    path: '/api/ai/checklist',
    icon: ListChecks,
    steps: ['Looking at what’s already done…', 'Working back from the party date…', 'Putting your list together…'],
    render: (r: ChecklistResult, gid, partyId) => <ChecklistResultView r={r} generationId={gid} partyId={partyId} />,
  },
]
