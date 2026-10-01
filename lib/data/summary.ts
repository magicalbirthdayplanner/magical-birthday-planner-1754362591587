'use client'
import { useMemo } from 'react'
import useSWR from 'swr'
import { useChecklist, useChosenVenue, useGuests, useInvitation, useSavedVenues } from './hooks'
import type { Party } from './parties'
import { localToday } from '@/lib/planning/checklist'
import { daysUntil, nextAction, partyProgress, type ProgressInput } from '@/lib/planning/progress'
import type { ClassicTheme } from '@/data/themes-data'

export interface ThemeInfo {
  id: string
  name: string
  emoji: string
  description: string
  color: string
  ai: boolean
}

/** Theme catalogue, loaded lazily and cached for the session. */
export function useThemeCatalog() {
  return useSWR('theme-catalog', async () => (await import('@/data/themes-data')).classicThemes as ClassicTheme[], {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  })
}

export function resolveTheme(party: Party | null | undefined, catalog: ClassicTheme[] | undefined): ThemeInfo | null {
  if (!party?.theme) return null
  const details = party.theme_details as { name?: string; emoji?: string; description?: string } | null
  if (details?.name) {
    return { id: party.theme, name: details.name, emoji: details.emoji ?? '✨', description: details.description ?? '', color: 'bg-hero', ai: true }
  }
  const t = catalog?.find((x) => x.id === party.theme)
  if (t) return { id: t.id, name: t.name, emoji: t.emoji, description: t.description, color: t.color, ai: false }
  // Legacy planner theme ids that aren't in the catalogue.
  return { id: party.theme, name: party.theme.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), emoji: '🎈', description: '', color: 'bg-hero', ai: false }
}

/** Everything the Home and Plan screens need to answer "what should I do next?". */
export function usePartySummary(party: Party | null | undefined) {
  const chosen = useChosenVenue(party?.id)
  const saved = useSavedVenues(party?.id)
  const guests = useGuests(party?.id)
  const invitation = useInvitation(party?.id)
  const checklist = useChecklist(party, !!chosen.data)
  const catalog = useThemeCatalog()

  return useMemo(() => {
    if (!party) return null
    const today = localToday()
    const tasks = checklist.data ?? []
    const open = tasks.filter((t) => !t.completed_at).sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
    const input: ProgressInput = {
      today,
      partyDate: party.party_date,
      hasVenue: !!chosen.data,
      savedVenueCount: saved.data?.length ?? 0,
      hasTheme: !!party.theme,
      guestCount: guests.data?.length ?? 0,
      invitationShared: (invitation.data?.share_count ?? 0) > 0,
      checklistDone: tasks.length - open.length,
      checklistTotal: tasks.length,
      nextChecklistTitle: open[0]?.title ?? null,
    }
    return {
      days: daysUntil(party.party_date, today),
      progress: partyProgress(input),
      next: nextAction(input),
      input,
      chosenVenue: chosen.data ?? null,
      saved: saved.data ?? [],
      guests: guests.data ?? [],
      invitation: invitation.data ?? null,
      tasks,
      openTasks: open,
      theme: resolveTheme(party, catalog.data),
      loading: chosen.isLoading || guests.isLoading || checklist.isLoading,
    }
  }, [party, chosen.data, chosen.isLoading, saved.data, guests.data, guests.isLoading, invitation.data, checklist.data, checklist.isLoading, catalog.data])
}
