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
    return { theme: theme?.name ?? null, guests: guestsNow, confirmed: t.confirmedHeads, minutes, startTime, label }
  }, [party, catalog.data, guests.data, invitation.data])
}
