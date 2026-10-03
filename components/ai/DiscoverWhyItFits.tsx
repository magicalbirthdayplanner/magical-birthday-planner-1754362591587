'use client'
/** Discover (list view): rank the top already-loaded results and say why each fits. Own flag; Plus+. */
import { useState } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { Card } from '@/components/app/ui'
import type { DiscoverExplainResult } from '@/lib/ai/features/discoverExplain.types'
import { AIToolSheet } from './AIToolSheet'
import { useAICapabilities } from './useAI'

export function DiscoverWhyItFits({ partyId, placeIds }: { partyId: string; placeIds: string[] }) {
  const caps = useAICapabilities(partyId)
  const cap = caps.get('discover_explain')
  const [open, setOpen] = useState(false)
  if (!cap?.enabled || !cap.allowed || placeIds.length === 0) return null
  return (
    <div className="px-4 pb-2">
      <button type="button" onClick={() => setOpen(true)} className="tap flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-primary" data-testid="ai-discover-explain">
        <Sparkles className="h-4 w-4" /> Why these places might work for your party
      </button>
      {open ? (
        <AIToolSheet<DiscoverExplainResult>
          open
          onOpenChange={(o) => !o && setOpen(false)}
          title="Best fits for your party"
          path="/api/ai/discover-explain"
          body={{ partyId, placeIds: placeIds.slice(0, 10) }}
          steps={['Comparing places…', 'Matching them to your child…']}
          onUsed={() => caps.mutate()}
          render={(r) => (
            <Card className="divide-y divide-border">
              {r.picks.map((p, i) => (
                <Link key={p.id} href={`/venue/${encodeURIComponent(p.placeId)}`} className="tap flex min-h-[56px] gap-3 px-4 py-3 text-sm">
                  <span className="font-semibold text-primary">{i + 1}</span>
                  <span><span className="block font-semibold">{p.name}</span><span className="block text-muted-foreground">{p.reason}</span></span>
                </Link>
              ))}
            </Card>
          )}
        />
      ) : null}
    </div>
  )
}
