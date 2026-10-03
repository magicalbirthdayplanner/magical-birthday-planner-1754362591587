'use client'
/** The party facts the Activities/Party Magic screens show ("7th Birthday • Space Theme • 15 guests • 2 hours"). */
import { useMemo } from 'react'
import type { Party } from '@/lib/data/parties'
import { useGuests, useInvitation } from '@/lib/data/hooks'
import { guestTotals } from '@/lib/data/guests'
import { resolveTheme, useThemeCatalog } from '@/lib/data/summary'
import { effectiveGuests, formatMinutes } from '@/lib/experience/model'

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
const minutesBetween = (a?: string | null, b?: string | null) => {
  if (!a || !b) return null
  const [ah, am] = a.split(':').map(Number), [bh, bm] = b.split(':').map(Number)
  const d = bh * 60 + bm - (ah * 60 + am)
  return d >= 30 && d <= 600 ? d : null
}

export function usePartyFacts(party: Party | null | undefined) {
  const catalog = useThemeCatalog()
  const guests = useGuests(party?.id)
  const invitation = useInvitation(party?.id)
  return useMemo(() => {
    if (!party) return null
    const theme = resolveTheme(party, catalog.data)
    const t = guestTotals(guests.data ?? [])
    const guestsNow = effectiveGuests(party.guest_count, { kids: t.confirmedKids, adults: t.confirmedHeads - t.confirmedKids })
    const minutes = minutesBetween(invitation.data?.start_time, invitation.data?.end_time)
    const startTime = (party.party_time ?? invitation.data?.start_time ?? null)?.slice(0, 5) ?? null
    const label = [party.child_age ? `${ordinal(party.child_age)} Birthday` : null, theme ? `${theme.name} Theme` : null, guestsNow ? `${guestsNow} guests` : null, minutes ? formatMinutes(minutes).replace(' h', ' hours').replace(/^1 hours/, '1 hour') : null].filter(Boolean).join(' • ')
    // "Based on your Space theme, 15 guests and your $200 budget" — what the AI will use, in the parent's words
    const parts = [theme ? `your ${theme.name} theme` : party.child_age ? `a ${party.child_age}-year-old` : null, guestsNow ? `${guestsNow} guests` : null, party.budget != null ? `your $${Number(party.budget).toLocaleString('en-US')} budget` : null].filter(Boolean) as string[]
    const basedOn = parts.length ? `Based on ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]}.` : 'Based on your party details.'
    return { theme: theme?.name ?? null, guests: guestsNow, confirmed: t.confirmedHeads, minutes, startTime, label, basedOn }
  }, [party, catalog.data, guests.data, invitation.data])
}
