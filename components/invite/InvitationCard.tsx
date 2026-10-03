import { CalendarDays, Clock, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

export const INVITE_DESIGNS = [
  { id: 'classic', label: 'Magical', swatch: 'bg-hero' },
  { id: 'confetti', label: 'Confetti', swatch: 'bg-[hsl(12_88%_64%)]' },
  { id: 'elegant', label: 'Elegant', swatch: 'bg-[hsl(36_45%_90%)]' },
] as const
export type InviteDesign = (typeof INVITE_DESIGNS)[number]['id']

export interface InvitationView {
  childName: string
  childAge: number | null
  partyDate: string
  startTime?: string | null
  endTime?: string | null
  locationText?: string | null
  headline?: string | null
  message?: string | null
  hostName?: string | null
  rsvpBy?: string | null
  design?: string | null
}

const fmtTime = (t?: string | null) => {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  const d = new Date(2000, 0, 1, h, m)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: m ? '2-digit' : undefined })
}
const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 >= 11 && n % 100 <= 13 ? 0 : n % 10] ?? 'th'}`

export function InvitationCard({ inv, className }: { inv: InvitationView; className?: string }) {
  const design = (inv.design as InviteDesign) || 'classic'
  const first = inv.childName.split(' ')[0]
  const date = new Date(`${inv.partyDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const time = [fmtTime(inv.startTime), fmtTime(inv.endTime)].filter(Boolean).join(' – ')
  const elegant = design === 'elegant'
  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-[32px] p-7 text-center shadow-xl',
        design === 'classic' && 'bg-hero text-white shadow-primary/30',
        design === 'confetti' && 'bg-[hsl(12_88%_64%)] text-white shadow-[hsl(12_88%_64%/0.3)]',
        elegant && 'border border-[hsl(36_30%_80%)] bg-[hsl(36_45%_96%)] text-[hsl(252_32%_14%)]',
        className,
      )}
      aria-label="Invitation"
      data-testid="invitation-card"
    >
      {design === 'confetti' ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(hsl(40 92% 70%) 3px, transparent 4px), radial-gradient(hsl(258 56% 60%) 3px, transparent 4px), radial-gradient(#fff 2px, transparent 3px)', backgroundSize: '46px 46px, 62px 62px, 38px 38px', backgroundPosition: '0 0, 20px 30px, 10px 12px' }} />
      ) : design === 'classic' ? (
        <>
          <div aria-hidden className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10" />
          <div aria-hidden className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-[hsl(40_92%_70%/0.25)]" />
        </>
      ) : null}
      <div className="relative">
        <p className={cn('text-xs font-semibold uppercase tracking-[0.2em]', elegant ? 'text-primary' : 'text-white/85')}>You’re invited</p>
        <h2 className="mt-3 font-display text-[34px] font-extrabold leading-tight text-balance">{inv.headline?.trim() || `${first}’s ${inv.childAge ? `${ordinal(inv.childAge)} ` : ''}Birthday Party`}</h2>
        {inv.message ? <p className={cn('mx-auto mt-3 max-w-xs whitespace-pre-line text-[15px] leading-relaxed', elegant ? 'text-muted-foreground' : 'text-white/90')}>{inv.message}</p> : null}
        <div className={cn('mx-auto mt-6 max-w-xs space-y-2 rounded-2xl p-4 text-left text-[15px]', elegant ? 'bg-white' : 'bg-white/15 backdrop-blur')}>
          <p className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0" /> {date}
          </p>
          {time ? (
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" /> {time}
            </p>
          ) : null}
          {inv.locationText ? (
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> <span className="whitespace-pre-line">{inv.locationText}</span>
            </p>
          ) : null}
        </div>
        {inv.rsvpBy ? (
          <p className={cn('mt-4 text-sm', elegant ? 'text-muted-foreground' : 'text-white/85')}>
            Please RSVP by {new Date(`${inv.rsvpBy}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
          </p>
        ) : null}
        {inv.hostName ? <p className={cn('mt-2 text-sm', elegant ? 'text-muted-foreground' : 'text-white/85')}>— {inv.hostName}</p> : null}
      </div>
    </article>
  )
}
