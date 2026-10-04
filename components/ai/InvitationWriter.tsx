'use client'
/** Invite editor: "Write it for me" → tone → options → "Use this wording" fills the editor (draft; never sent). */
import { useState } from 'react'
import { PenLine } from 'lucide-react'
import { AppButton, Card, Chip } from '@/components/app/ui'
import type { InvitationResult } from '@/lib/ai/schemas/invitation'
import { AIToolSheet } from './AIToolSheet'
import { useAICapabilities } from './useAI'
import { UpgradePrompt } from '@/components/billing/UpgradePrompt'

const TONES = ['playful', 'elegant', 'funny', 'simple', 'adventurous'] as const

export function InvitationWriter({ partyId, onUse }: { partyId: string; onUse: (headline: string, message: string) => void }) {
  const caps = useAICapabilities(partyId)
  const cap = caps.get('invitation')
  const [tone, setTone] = useState<(typeof TONES)[number]>('playful')
  const [open, setOpen] = useState(false)
  if (!cap?.enabled) return null
  if (!cap.allowed) return <UpgradePrompt compact capability="invitation" plan={cap.upgradeTo} />
  return (
    <div className="space-y-2" data-testid="ai-invitation-writer">
      <p className="text-sm font-semibold">Need wording? Pick a tone</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tone">
        {TONES.map((t) => (
          <Chip key={t} role="radio" aria-checked={tone === t} active={tone === t} onClick={() => setTone(t)} className="capitalize">{t}</Chip>
        ))}
      </div>
      <AppButton variant="outline" block onClick={() => setOpen(true)}><PenLine className="h-4 w-4" /> Write it for me</AppButton>
      {open ? (
        <AIToolSheet<InvitationResult>
          open
          onOpenChange={(o) => !o && setOpen(false)}
          title="Invitation wording"
          description="Pick one to drop into your invitation. You can edit it before sharing."
          path="/api/ai/invitation"
          body={{ partyId, tone }}
          steps={['Reading your party details…', `Writing in a ${tone} tone…`]}
          onUsed={() => caps.mutate()}
          render={(r) => (
            <div className="space-y-3">
              {r.options.map((o) => (
                <Card key={o.id} className="p-4">
                  <p className="font-semibold">{o.headline}</p>
                  <p className="mt-1 whitespace-pre-line text-sm">{o.message}</p>
                  <AppButton size="sm" className="mt-3 min-h-[44px]" onClick={() => { onUse(o.headline, o.message); setOpen(false) }}>Use this wording</AppButton>
                </Card>
              ))}
              <p className="text-xs text-muted-foreground">Nothing is sent until you share the invitation yourself.</p>
            </div>
          )}
        />
      ) : null}
    </div>
  )
}
