'use client'
/** Registry of Plan → AI tools. Each phase (7–13) adds its tool here. */
import type { ComponentType, ReactNode } from 'react'
import { Clock, ListChecks, PiggyBank, Puzzle, ShoppingBasket, UtensilsCrossed } from 'lucide-react'
import type { AIFeature } from '@/lib/ai/types'
import type { AskConfig } from './AIToolSheet'
import type { ChecklistResult } from '@/lib/ai/schemas/checklist'
import { ChecklistResultView } from './results/ChecklistResultView'
import type { BudgetResult } from '@/lib/ai/schemas/budget'
import { BudgetResultView } from './results/BudgetResultView'
import type { ActivitiesResult } from '@/lib/ai/schemas/activities'
import { ActivitiesResultView } from './results/ActivitiesResultView'
import type { FoodResult } from '@/lib/ai/schemas/food'
import { FoodResultView } from './results/FoodResultView'
import type { TimelineResult } from '@/lib/ai/schemas/timeline'
import { TimelineResultView } from './results/TimelineResultView'
import type { ShoppingListResult } from '@/lib/ai/schemas/shoppingList'
import { ShoppingListResultView } from './results/ShoppingListResultView'

export interface ToolDef {
  feature: AIFeature
  label: (budget: number | null) => string
  sub: string
  title: string
  path: string
  icon: ComponentType<{ className?: string }>
  steps?: string[]
  body?: () => Record<string, unknown>
  /** Optional question before generating (free text, sent as notes). */
  ask?: AskConfig
  render: (result: never, generationId: string, partyId: string, rerun: (extra: Record<string, unknown>) => void) => ReactNode
}

export const TOOLS: ToolDef[] = [
  {
    feature: 'checklist',
    label: () => 'What am I forgetting?',
    sub: 'Specific tasks with dates, based on your plan so far',
    title: 'Your AI checklist',
    path: '/api/ai/checklist',
    icon: ListChecks,
    steps: ['Looking at what’s already done…', 'Working back from the party date…', 'Putting your list together…'],
    render: (r: ChecklistResult, gid, partyId) => <ChecklistResultView r={r} generationId={gid} partyId={partyId} />,
  },
  {
    feature: 'budget_optimizer',
    label: (budget) => (budget != null ? `Help me stretch my $${budget} budget` : 'Help me plan my budget'),
    sub: 'Where the money goes, savings and missing costs',
    title: 'Budget assistant',
    path: '/api/ai/budget',
    icon: PiggyBank,
    steps: ['Adding up your plan…', 'Finding savings that keep the fun…', 'Checking for missing costs…'],
    render: (r: BudgetResult, gid, partyId) => <BudgetResultView r={r} generationId={gid} partyId={partyId} />,
  },
  {
    feature: 'activities',
    label: () => 'Need activity ideas?',
    sub: 'Age-right games and crafts with materials and costs',
    title: 'Activity ideas',
    path: '/api/ai/activities',
    icon: Puzzle,
    steps: ['Thinking about the birthday…', 'Matching activities to age and space…', 'Writing simple instructions…'],
    ask: { label: 'Anything we should know?', placeholder: 'e.g. “small living room”, “we have lots of cardboard”, “one calm activity please”', cta: '✨ Suggest activities' },
    render: (r: ActivitiesResult, gid, partyId) => <ActivitiesResultView r={r} generationId={gid} partyId={partyId} />,
  },
  {
    feature: 'food',
    label: () => 'What should I serve?',
    sub: 'Menu, quantities and a food shopping list',
    title: 'Food plan',
    path: '/api/ai/food',
    icon: UtensilsCrossed,
    steps: ['Counting hungry guests…', 'Picking kid-friendly food…', 'Writing your shopping list…'],
    ask: { label: 'Any food preferences?', placeholder: 'e.g. “nut-free school”, “two vegetarian kids”, “no time to cook”', cta: '✨ Plan the food' },
    render: (r: FoodResult, gid, partyId) => <FoodResultView r={r} generationId={gid} partyId={partyId} />,
  },
  {
    feature: 'timeline',
    label: () => 'Plan the party day',
    sub: 'A minute-by-minute schedule',
    title: 'Party-day timeline',
    path: '/api/ai/timeline',
    icon: Clock,
    steps: ['Thinking about the party day…', 'Fitting everything into the time you have…'],
    render: (r: TimelineResult, gid, partyId, rerun) => <TimelineResultView r={r} generationId={gid} partyId={partyId} rerun={rerun} />,
  },
  {
    feature: 'shopping_list',
    label: () => 'Make my shopping list',
    sub: 'Everything in one de-duplicated list',
    title: 'Shopping list',
    path: '/api/ai/shopping-list',
    icon: ShoppingBasket,
    steps: ['Collecting everything you’ve planned…', 'Removing duplicates…', 'Grouping your list…'],
    render: (r: ShoppingListResult, gid, partyId) => <ShoppingListResultView r={r} generationId={gid} partyId={partyId} />,
  },
]
