'use client'
/** Registry of Plan → AI tools. Each phase (7–13) adds its tool here. */
import type { ComponentType, ReactNode } from 'react'
import type { AIFeature } from '@/lib/ai/types'

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

export const TOOLS: ToolDef[] = []
