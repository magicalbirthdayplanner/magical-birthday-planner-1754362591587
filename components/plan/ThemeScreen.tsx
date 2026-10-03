'use client'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useSWRConfig } from 'swr'
import { Check, Search, Sparkles, Wand2 } from 'lucide-react'
import { useParty } from '@/components/app/PartyProvider'
import { BottomSheet } from '@/components/app/BottomSheet'
import { AppButton, Chip, EmptyState, LinkButton, PageHeader, Section, Skeleton } from '@/components/app/ui'
import { TextField } from '@/components/app/fields'
import { resolveTheme, useThemeCatalog } from '@/lib/data/summary'
import { updateParty } from '@/lib/data/parties'
import { completeTaskByKey } from '@/lib/data/checklist'
import { ApiError, apiFetch, friendlyError } from '@/lib/data/api'
import { recommendThemes } from '@/lib/planning/themes'
import { slugify, type AiTheme } from '@/lib/planning/ai-themes'
import { sanitizeInterests } from '@/lib/discovery/party-context'
import { track } from '@/lib/analytics/client'
import { cn } from '@/lib/utils'
import type { ClassicTheme } from '@/data/themes-data'
import type { Json } from '@/lib/db/database.types'
import { ThemeIdeasSection } from '@/components/ai/ThemeIdeasSection'

interface PreviewTheme {
  id: string
  name: string
  emoji: string
  description: string
  color: string
  palette: string[]
  decorations: string[]
  activities: string[]
  ageRange?: string
  ai?: AiTheme
  custom?: boolean
}

const fromClassic = (t: ClassicTheme): PreviewTheme => ({ id: t.id, name: t.name, emoji: t.emoji, description: t.description, color: t.color, palette: t.colorPalette, decorations: t.decorations, activities: t.activities, ageRange: t.ageRange })
const fromAi = (t: AiTheme): PreviewTheme => ({ id: t.id, name: t.name, emoji: t.emoji, description: t.description, color: 'bg-hero', palette: t.colors, decorations: t.decorations, activities: t.activities, ai: t })

function ThemeCard({ theme, selected, onClick, size = 'md', badge }: { theme: PreviewTheme; selected: boolean; onClick: () => void; size?: 'md' | 'lg'; badge?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'tap relative flex w-full flex-col justify-end overflow-hidden rounded-3xl bg-gradient-to-br p-3.5 text-left text-white shadow-sm transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
        size === 'lg' ? 'h-48' : 'h-40',
        theme.color,
        selected && 'ring-4 ring-primary ring-offset-2 ring-offset-background',
      )}
    >
      {!theme.ai && theme.palette.length ? (
        <span aria-hidden className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(circle at 80% 20%, ${theme.palette[1] ?? '#fff'}, transparent 60%)` }} />
      ) : null}
      <span className="absolute right-3 top-2 text-5xl drop-shadow-md" aria-hidden>
        {theme.emoji}
      </span>
      {selected ? (
        <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white text-primary shadow">
          <Check className="h-4 w-4" />
        </span>
      ) : badge ? (
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-foreground">{badge}</span>
      ) : null}
      <span className="relative text-base font-semibold leading-tight drop-shadow">{theme.name}</span>
      {theme.ageRange ? <span className="relative text-xs text-white/90">Ages {theme.ageRange}</span> : null}
    </button>
  )
}

export function ThemeScreen() {
  const { party, replaceParty } = useParty()
  const { mutate } = useSWRConfig()
  const catalog = useThemeCatalog()
  const [preview, setPreview] = useState<PreviewTheme | null>(null)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [ai, setAi] = useState<{ state: 'idle' | 'loading' | 'done' | 'error'; themes: AiTheme[]; message?: string }>({ state: 'idle', themes: [] })
  const [customOpen, setCustomOpen] = useState(false)
  const [customName, setCustomName] = useState('')

  const current = resolveTheme(party, catalog.data)
  const all = useMemo(() => (catalog.data ?? []).map(fromClassic), [catalog.data])
  const recommended = useMemo(
    () => (catalog.data && party ? recommendThemes(catalog.data, { age: party.child_age, interests: sanitizeInterests(party.interests) }, 6).map((r) => ({ ...fromClassic(r.theme), matched: r.matched })) : []),
    [catalog.data, party],
  )
  const popular = useMemo(() => [...all].sort((a, b) => (catalog.data?.find((t) => t.id === b.id)?.popularity ?? 0) - (catalog.data?.find((t) => t.id === a.id)?.popularity ?? 0)).slice(0, 10), [all, catalog.data])
  const categories = useMemo(() => Array.from(new Set((catalog.data ?? []).map((t) => t.category))), [catalog.data])
  const browse = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (catalog.data ?? [])
      .filter((t) => (!category || t.category === category) && (!q || `${t.name} ${t.keywords.join(' ')}`.toLowerCase().includes(q)))
      .map(fromClassic)
  }, [catalog.data, query, category])

  if (!party) return <EmptyState icon="🎨" title="No party yet" action={<LinkButton href="/start" block>Plan a party</LinkButton>} />
  const child = party.child_name.split(' ')[0]

  function open(t: PreviewTheme) {
    setPreview(t)
    track('theme_viewed', { theme: t.ai ? 'ai' : t.custom ? 'custom' : t.id })
  }

  async function choose(t: PreviewTheme) {
    setSaving(true)
    try {
      const details = t.ai ? { name: t.name, emoji: t.emoji, description: t.description, colors: t.palette, activities: t.activities, decorations: t.decorations } : t.custom ? { name: t.name, emoji: t.emoji, description: '' } : null
      const updated = await updateParty(party!.id, { theme: t.id, theme_details: details as Json })
      replaceParty(updated)
      await completeTaskByKey(party!.id, 'pick-theme').catch(() => undefined)
      await mutate(['checklist', party!.id])
      track('theme_selected', { theme: t.ai ? 'ai' : t.custom ? 'custom' : t.id, source: t.ai ? 'ai' : t.custom ? 'custom' : 'catalogue' })
      toast.success(`${t.emoji} ${t.name} it is!`)
      setPreview(null)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  async function generate() {
    setAi({ state: 'loading', themes: [] })
    try {
      const res = await apiFetch<{ themes: AiTheme[] }>('/api/themes/ai', { method: 'POST', body: JSON.stringify({ partyId: party!.id }) })
      setAi({ state: 'done', themes: res.themes })
    } catch (e) {
      setAi({ state: 'error', themes: [], message: e instanceof ApiError ? e.message : friendlyError(e) })
    }
  }

  return (
    <div className="pb-6">
      <PageHeader back="/plan" title="Theme" subtitle={current ? `Current: ${current.emoji} ${current.name}` : `Ideas matched to ${child}`} />

      <Section title={`Recommended for ${child}`}>
        {catalog.isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-3xl" />
            ))}
          </div>
        ) : recommended.length ? (
          <div className="grid grid-cols-2 gap-3">
            {recommended.map((t) => (
              <ThemeCard key={t.id} theme={t} selected={current?.id === t.id} onClick={() => open(t)} badge={t.matched.length ? `Loves ${t.matched[0]}` : undefined} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No recommendations yet — try browsing below.</p>
        )}
      </Section>

      <Section title="Popular">
        <div className="no-scrollbar relative -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
          {popular.map((t) => (
            <div key={t.id} className="w-40 shrink-0 snap-start">
              <ThemeCard theme={t} selected={current?.id === t.id} onClick={() => open(t)} />
            </div>
          ))}
        </div>
      </Section>

      {party ? <ThemeIdeasSection partyId={party.id} /> : null}

      <Section title="AI ideas" action={<span className="text-xs text-muted-foreground">Optional</span>}>
        {ai.state === 'idle' ? (
          <button type="button" onClick={generate} className="tap flex w-full items-center gap-3 rounded-3xl border border-dashed border-primary/40 bg-secondary/60 p-4 text-left">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-hero text-white">
              <Wand2 className="h-6 w-6" />
            </span>
            <span>
              <span className="block font-semibold">Dream up original themes</span>
              <span className="block text-sm text-muted-foreground">Based on {child}’s age and interests</span>
            </span>
          </button>
        ) : ai.state === 'loading' ? (
          <div className="grid grid-cols-2 gap-3" aria-busy="true" aria-label="Generating themes">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-3xl" />
            ))}
          </div>
        ) : ai.state === 'error' ? (
          <div className="rounded-2xl bg-accent p-4 text-sm text-accent-foreground">
            {ai.message}{' '}
            <button type="button" className="font-semibold underline" onClick={generate}>
              Try again
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {ai.themes.map((t) => (
              <ThemeCard key={t.id} theme={fromAi(t)} selected={current?.id === t.id} onClick={() => open(fromAi(t))} badge="AI" />
            ))}
          </div>
        )}
      </Section>

      <Section title="Browse all">
        <label className="relative block">
          <span className="sr-only">Search themes</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search themes" className="h-12 w-full rounded-full border border-input bg-card pl-11 pr-4 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15" />
        </label>
        <div className="no-scrollbar relative -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip active={!category} onClick={() => setCategory(null)}>
            All
          </Chip>
          {categories.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)} className="capitalize">
              {c}
            </Chip>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {browse.slice(0, 40).map((t) => (
            <ThemeCard key={t.id} theme={t} selected={current?.id === t.id} onClick={() => open(t)} />
          ))}
        </div>
        {browse.length === 0 && catalog.data ? <p className="py-6 text-center text-sm text-muted-foreground">No themes match “{query}”.</p> : null}
      </Section>

      <Section title="Custom">
        <AppButton variant="outline" block onClick={() => setCustomOpen(true)}>
          <Sparkles className="h-4 w-4" /> Create your own theme
        </AppButton>
      </Section>

      <BottomSheet
        open={!!preview}
        onOpenChange={(o) => !o && setPreview(null)}
        title={preview ? `${preview.emoji} ${preview.name}` : ''}
        description={preview?.ai ? 'AI-generated idea' : preview?.ageRange ? `Ages ${preview.ageRange}` : undefined}
        footer={
          preview ? (
            <AppButton block size="lg" loading={saving} onClick={() => choose(preview)} disabled={current?.id === preview.id}>
              {current?.id === preview.id ? 'Your current theme' : 'Choose this theme'}
            </AppButton>
          ) : null
        }
      >
        {preview ? (
          <div className="space-y-5 pb-2">
            {preview.description ? <p className="text-[15px] leading-relaxed text-muted-foreground">{preview.description}</p> : null}
            {preview.palette.length ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Color palette</h3>
                <div className="flex gap-2">
                  {preview.palette.map((c) => (
                    <span key={c} className="h-10 w-10 rounded-full border border-border shadow-inner" style={{ background: c }} aria-label={c} role="img" />
                  ))}
                </div>
              </div>
            ) : null}
            {preview.decorations.length ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Decoration ideas</h3>
                <ul className="list-inside list-disc space-y-1 text-[15px]">
                  {preview.decorations.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {preview.activities.length ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Activity ideas</h3>
                <ul className="list-inside list-disc space-y-1 text-[15px]">
                  {preview.activities.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={customOpen}
        onOpenChange={setCustomOpen}
        title="Your own theme"
        footer={
          <AppButton
            block
            size="lg"
            disabled={customName.trim().length < 2}
            loading={saving}
            onClick={async () => {
              await choose({ id: `custom-${slugify(customName)}`, name: customName.trim().slice(0, 60), emoji: '🎈', description: '', color: 'bg-hero', palette: [], decorations: [], activities: [], custom: true })
              setCustomOpen(false)
            }}
          >
            Use this theme
          </AppButton>
        }
      >
        <TextField label="Theme name" autoFocus value={customName} onChange={(e) => setCustomName(e.target.value)} maxLength={60} placeholder="e.g. Rainbow Science Lab" />
      </BottomSheet>
    </div>
  )
}
