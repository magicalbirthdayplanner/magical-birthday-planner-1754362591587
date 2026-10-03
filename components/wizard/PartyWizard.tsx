'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSWRConfig } from 'swr'
import { Check, ChevronLeft, Loader2, MapPin, Minus, Plus, Sparkles, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useParty } from '@/components/app/PartyProvider'
import { AppButton, Chip, IconButton } from '@/components/app/ui'
import { TextField } from '@/components/app/fields'
import { AuthForm } from '@/components/app/AuthForm'
import { createParty, ensureProfile } from '@/lib/data/parties'
import { ensureChecklist } from '@/lib/data/checklist'
import { friendlyError } from '@/lib/data/api'
import { db } from '@/lib/db/browser'
import { INTERESTS, type InterestId } from '@/lib/discovery/taxonomy'
import { localToday } from '@/lib/planning/checklist'
import { recommendThemes, type ScoredTheme } from '@/lib/planning/themes'
import {
  BUDGET_PRESETS,
  EMPTY_DRAFT,
  GUEST_PRESETS,
  MAX_AGE,
  MIN_AGE,
  WIZARD_STEPS,
  dateSuggestions,
  parseDraft,
  validateStep,
  type WizardDraft,
  type WizardStep,
} from '@/lib/planning/wizard'
import { track } from '@/lib/analytics/client'
import { cn } from '@/lib/utils'
import type { ClassicTheme } from '@/data/themes-data'

const DRAFT_KEY = 'mbp.partyDraft'

const QUESTIONS: Record<WizardStep, { title: (d: WizardDraft) => string; sub?: (d: WizardDraft) => string }> = {
  name: { title: () => 'Who are we celebrating?', sub: () => 'Just a first name is perfect.' },
  age: { title: (d) => `How old is ${first(d)} turning?` },
  date: { title: () => 'When is the party?', sub: () => 'A rough date is fine — you can change it later.' },
  zip: { title: () => 'Where are you planning?', sub: () => 'We’ll find party places within 20 miles.' },
  guests: { title: () => 'How many guests?', sub: () => 'Kids and grown-ups. A best guess is fine.' },
  budget: { title: () => 'What’s your budget?', sub: () => 'We’ll favor places that fit it.' },
  vibe: { title: () => 'What’s the vibe?' },
  interests: { title: (d) => `What is ${first(d)} into?`, sub: () => 'Pick as many as you like.' },
  theme: { title: () => 'Want a theme?', sub: () => 'Optional — you can choose one later.' },
}

function first(d: WizardDraft) {
  return d.childName.trim().split(/\s+/)[0] || 'your child'
}

const fmtMoney = (n: number) => `$${n.toLocaleString('en-US')}${n >= 2500 ? '+' : ''}`

export function PartyWizard() {
  const router = useRouter()
  const params = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const { setActivePartyId } = useParty()
  const { mutate } = useSWRConfig()
  const today = useMemo(() => localToday(), [])

  const [draft, setDraft] = useState<WizardDraft>(EMPTY_DRAFT)
  const [stepIdx, setStepIdx] = useState(0)
  const [finale, setFinale] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [zipState, setZipState] = useState<'idle' | 'checking' | 'ok' | 'bad'>('idle')
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup')
  const [themes, setThemes] = useState<ScoredTheme<ClassicTheme>[] | null>(null)
  const started = useRef(false)

  const step = WIZARD_STEPS[stepIdx]

  // Restore draft (survives refresh and the Google sign-in round trip).
  useEffect(() => {
    try {
      const saved = parseDraft(localStorage.getItem(DRAFT_KEY))
      if (saved) {
        setDraft(saved)
        if (params?.get('resume') === '1') setFinale(true)
      }
    } catch {
      /* ignore */
    }
    if (!started.current) {
      started.current = true
      track('onboarding_started')
    }
  }, [params])

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      /* ignore */
    }
  }, [draft])

  const update = useCallback((patch: Partial<WizardDraft>) => {
    setError(null)
    setDraft((d) => ({ ...d, ...patch }))
  }, [])

  // Live ZIP lookup.
  useEffect(() => {
    if (step !== 'zip') return
    const zip = draft.zip.trim()
    if (!/^\d{5}$/.test(zip)) {
      setZipState('idle')
      return
    }
    if (draft.zipPlace) {
      setZipState('ok')
      return
    }
    setZipState('checking')
    const ctrl = new AbortController()
    fetch(`/api/discovery/zip?zip=${zip}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) {
          setZipState('bad')
          track('zip_entered', { valid: false })
          return
        }
        const z = (await r.json()) as { city: string | null; state: string | null; lat: number; lng: number }
        setDraft((d) => (d.zip.trim() === zip ? { ...d, zipPlace: z } : d))
        setZipState('ok')
        track('zip_entered', { valid: true, state: z.state ?? '' })
      })
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') setZipState('bad')
      })
    return () => ctrl.abort()
  }, [step, draft.zip, draft.zipPlace])

  // Theme recommendations (catalogue loaded lazily, only on this step).
  useEffect(() => {
    if (step !== 'theme' || themes) return
    import('@/data/themes-data').then(({ classicThemes }) => {
      setThemes(recommendThemes(classicThemes, { age: draft.childAge, interests: draft.interests }, 6))
    })
  }, [step, themes, draft.childAge, draft.interests])

  function next() {
    const err = validateStep(step, draft, today)
    if (err) {
      setError(err)
      return
    }
    track('onboarding_step_completed', { step, index: stepIdx + 1 })
    if (stepIdx < WIZARD_STEPS.length - 1) setStepIdx(stepIdx + 1)
    else setFinale(true)
  }

  function back() {
    setError(null)
    if (finale) return setFinale(false)
    if (stepIdx === 0) return router.push('/home')
    setStepIdx(stepIdx - 1)
  }

  async function create() {
    // Right after inline sign-up, AuthContext may not have re-rendered yet.
    const currentUser = user ?? (await db.auth.getUser()).data.user
    if (!currentUser) return
    for (const s of WIZARD_STEPS) {
      const err = validateStep(s, draft, today)
      if (err) {
        setFinale(false)
        setStepIdx(WIZARD_STEPS.indexOf(s))
        setError(err)
        return
      }
    }
    setCreating(true)
    try {
      await ensureProfile(currentUser)
      const party = await createParty(currentUser.id, {
        childName: draft.childName,
        childAge: draft.childAge!,
        partyDate: draft.partyDate,
        zip: draft.zip.trim(),
        guestCount: draft.guestCount,
        budget: draft.budgetUnsure ? null : draft.budget,
        setting: draft.setting,
        interests: draft.interests,
        theme: draft.theme,
        location: draft.zipPlace ? { lat: draft.zipPlace.lat, lng: draft.zipPlace.lng, city: draft.zipPlace.city, state: draft.zipPlace.state } : null,
      })
      track('party_created', {
        age: draft.childAge ?? 0,
        guests: draft.guestCount,
        budget: draft.budgetUnsure ? 'unsure' : String(draft.budget),
        setting: draft.setting,
        interests: draft.interests,
        theme: !!draft.theme,
      })
      // Create the countdown checklist now, so milestones completed before the
      // parent ever opens Plan (e.g. choosing a theme) are tracked.
      await ensureChecklist(party.id, {
        partyDate: party.party_date,
        guestCount: party.guest_count,
        hasVenue: false,
        setting: draft.setting,
        theme: draft.theme,
        childName: party.child_name,
      }).catch(() => undefined)
      setActivePartyId(party.id)
      await mutate(['parties', currentUser.id])
      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {
        /* ignore */
      }
      router.replace('/discover?fresh=1')
    } catch (e) {
      setError(friendlyError(e, 'We couldn’t save your party. Please try again.'))
      setCreating(false)
    }
  }

  const progress = finale ? 100 : Math.round((stepIdx / WIZARD_STEPS.length) * 100)
  const q = QUESTIONS[step]

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-magic pt-safe">
      {/* top bar */}
      <div className="flex items-center gap-2 px-2 pt-2">
        <IconButton label={stepIdx === 0 && !finale ? 'Close' : 'Back'} onClick={back}>
          {stepIdx === 0 && !finale ? <X className="h-6 w-6" /> : <ChevronLeft className="h-6 w-6" />}
        </IconButton>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Party setup progress">
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.max(progress, 4)}%` }} />
        </div>
        <span className="w-14 text-right text-xs font-medium text-muted-foreground">{finale ? 'Done' : `${stepIdx + 1} / ${WIZARD_STEPS.length}`}</span>
      </div>

      {finale ? (
        <Finale
          draft={draft}
          signedIn={!!user}
          authLoading={authLoading}
          authMode={authMode}
          setAuthMode={setAuthMode}
          creating={creating}
          error={error}
          onCreate={create}
          onEdit={(i) => {
            setFinale(false)
            setStepIdx(i)
          }}
        />
      ) : (
        <form
          className="flex flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault()
            next()
          }}
        >
          <div key={step} className="mbp-rise flex-1 px-5 pt-8">
            <h1 className="font-display text-[30px] font-extrabold leading-tight tracking-tight text-balance">{q.title(draft)}</h1>
            {q.sub ? <p className="mt-2 text-muted-foreground">{q.sub(draft)}</p> : null}
            <div className="mt-8">
              <StepBody step={step} draft={draft} update={update} today={today} zipState={zipState} themes={themes} />
            </div>
            {error ? (
              <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <div className="sticky bottom-0 bg-gradient-to-t from-background via-background to-background/0 px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4">
            <AppButton type="submit" size="lg" block disabled={step === 'zip' && zipState === 'checking'}>
              {step === 'theme' ? (draft.theme ? 'Continue' : 'Skip for now') : step === 'interests' && draft.interests.length === 0 ? 'Skip' : 'Continue'}
            </AppButton>
          </div>
        </form>
      )}
    </div>
  )
}

function StepBody({
  step,
  draft,
  update,
  today,
  zipState,
  themes,
}: {
  step: WizardStep
  draft: WizardDraft
  update: (p: Partial<WizardDraft>) => void
  today: string
  zipState: 'idle' | 'checking' | 'ok' | 'bad'
  themes: ScoredTheme<ClassicTheme>[] | null
}) {
  switch (step) {
    case 'name':
      return (
        <TextField
          label="Child’s name"
          hideLabel
          autoFocus
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="next"
          placeholder="e.g. Ava"
          value={draft.childName}
          maxLength={40}
          onChange={(e) => update({ childName: e.target.value })}
        />
      )
    case 'age':
      return (
        <div className="grid grid-cols-4 gap-3" role="radiogroup" aria-label="Age">
          {Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => i + MIN_AGE).map((age) => (
            <button
              key={age}
              type="button"
              role="radio"
              aria-checked={draft.childAge === age}
              onClick={() => update({ childAge: age })}
              className={cn(
                'tap flex h-16 items-center justify-center rounded-2xl border text-2xl font-semibold transition active:scale-95',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                draft.childAge === age ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'border-border bg-card',
              )}
            >
              {age}
            </button>
          ))}
        </div>
      )
    case 'date':
      return (
        <div className="space-y-4">
          <TextField label="Party date" hideLabel type="date" min={today} value={draft.partyDate} onChange={(e) => update({ partyDate: e.target.value })} />
          <div className="flex flex-wrap gap-2">
            {dateSuggestions(today).map((s) => (
              <Chip key={s.label} active={draft.partyDate === s.date} onClick={() => update({ partyDate: s.date })}>
                {s.label}
              </Chip>
            ))}
          </div>
          {draft.partyDate ? (
            <p className="text-sm text-muted-foreground">
              {new Date(`${draft.partyDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          ) : null}
        </div>
      )
    case 'zip':
      return (
        <div>
          <TextField
            label="ZIP code"
            hideLabel
            autoFocus
            inputMode="numeric"
            autoComplete="postal-code"
            enterKeyHint="next"
            pattern="[0-9]*"
            maxLength={10}
            placeholder="e.g. 48084"
            value={draft.zip}
            onChange={(e) => update({ zip: e.target.value.replace(/[^\d-]/g, ''), zipPlace: null })}
            error={zipState === 'bad' ? 'We couldn’t find that ZIP code. Double-check it?' : null}
            trailing={
              zipState === 'checking' ? (
                <Loader2 className="mr-4 h-5 w-5 animate-spin text-muted-foreground" aria-label="Checking ZIP" />
              ) : zipState === 'ok' ? (
                <Check className="mr-4 h-5 w-5 text-success" aria-label="ZIP found" />
              ) : null
            }
          />
          {zipState === 'ok' && draft.zipPlace ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground">
              <MapPin className="h-4 w-4" /> {[draft.zipPlace.city, draft.zipPlace.state].filter(Boolean).join(', ') || draft.zip}
            </p>
          ) : null}
        </div>
      )
    case 'guests':
      return (
        <div>
          <div className="flex items-center justify-center gap-6">
            <IconButton label="Fewer guests" className="h-14 w-14 border border-border bg-card" onClick={() => update({ guestCount: Math.max(1, draft.guestCount - 1) })}>
              <Minus className="h-6 w-6" />
            </IconButton>
            <output aria-live="polite" className="w-28 text-center font-display text-6xl font-extrabold tabular-nums">
              {draft.guestCount}
            </output>
            <IconButton label="More guests" className="h-14 w-14 border border-border bg-card" onClick={() => update({ guestCount: Math.min(200, draft.guestCount + 1) })}>
              <Plus className="h-6 w-6" />
            </IconButton>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {GUEST_PRESETS.map((n) => (
              <Chip key={n} active={draft.guestCount === n} onClick={() => update({ guestCount: n })}>
                {n}
              </Chip>
            ))}
          </div>
        </div>
      )
    case 'budget':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {BUDGET_PRESETS.map((b) => (
              <button
                key={b}
                type="button"
                aria-pressed={!draft.budgetUnsure && draft.budget === b}
                onClick={() => update({ budget: b, budgetUnsure: false })}
                className={cn(
                  'tap h-14 rounded-2xl border text-lg font-semibold transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  !draft.budgetUnsure && draft.budget === b ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card',
                )}
              >
                {fmtMoney(b)}
              </button>
            ))}
          </div>
          <TextField
            label="Or enter an amount"
            inputMode="numeric"
            placeholder="$"
            value={draft.budget != null && !BUDGET_PRESETS.includes(draft.budget) && !draft.budgetUnsure ? String(draft.budget) : ''}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[^\d]/g, ''))
              update({ budget: e.target.value ? n : null, budgetUnsure: false })
            }}
          />
          <Chip active={draft.budgetUnsure} onClick={() => update({ budgetUnsure: !draft.budgetUnsure, budget: null })}>
            Not sure yet
          </Chip>
          {!draft.budgetUnsure && draft.budget ? (
            <p className="text-sm text-muted-foreground">About ${Math.round(draft.budget / Math.max(1, draft.guestCount))} per guest.</p>
          ) : null}
        </div>
      )
    case 'vibe':
      return (
        <div className="grid gap-3" role="radiogroup" aria-label="Indoor or outdoor">
          {(
            [
              ['indoor', '🏠', 'Indoor', 'Play centers, studios, museums'],
              ['outdoor', '🌳', 'Outdoor', 'Parks, farms, splash pads'],
              ['either', '✨', 'Either', 'Show me everything'],
            ] as const
          ).map(([id, emoji, label, sub]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={draft.setting === id}
              onClick={() => update({ setting: id })}
              className={cn(
                'tap flex items-center gap-4 rounded-3xl border p-4 text-left transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                draft.setting === id ? 'border-primary bg-secondary ring-2 ring-primary' : 'border-border bg-card',
              )}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background text-3xl">{emoji}</span>
              <span>
                <span className="block text-lg font-semibold">{label}</span>
                <span className="block text-sm text-muted-foreground">{sub}</span>
              </span>
            </button>
          ))}
        </div>
      )
    case 'interests':
      return (
        <div className="grid grid-cols-3 gap-3">
          {INTERESTS.map((i) => {
            const on = draft.interests.includes(i.id)
            return (
              <button
                key={i.id}
                type="button"
                aria-pressed={on}
                onClick={() => update({ interests: on ? draft.interests.filter((x) => x !== i.id) : [...draft.interests, i.id as InterestId] })}
                className={cn(
                  'tap flex h-24 flex-col items-center justify-center gap-1 rounded-2xl border text-sm font-medium transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  on ? 'border-primary bg-secondary text-secondary-foreground ring-2 ring-primary' : 'border-border bg-card',
                )}
              >
                <span className="text-3xl" aria-hidden>
                  {i.emoji}
                </span>
                {i.label}
              </button>
            )
          })}
        </div>
      )
    case 'theme':
      if (!themes) {
        return (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="mbp-skeleton h-40 rounded-3xl" />
            ))}
          </div>
        )
      }
      return (
        <div className="grid grid-cols-2 gap-3">
          {themes.map(({ theme, matched }) => {
            const on = draft.theme === theme.id
            return (
              <button
                key={theme.id}
                type="button"
                aria-pressed={on}
                onClick={() => update({ theme: on ? null : theme.id })}
                className={cn(
                  'tap relative flex h-40 flex-col justify-end overflow-hidden rounded-3xl bg-gradient-to-br p-3 text-left text-white transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
                  theme.color,
                  on && 'ring-4 ring-primary ring-offset-2 ring-offset-background',
                )}
              >
                <span className="absolute right-3 top-2 text-5xl drop-shadow" aria-hidden>
                  {theme.emoji}
                </span>
                {on ? (
                  <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white text-primary">
                    <Check className="h-4 w-4" />
                  </span>
                ) : null}
                <span className="text-base font-semibold leading-tight drop-shadow">{theme.name}</span>
                <span className="text-xs opacity-90">{matched.length ? `Loves ${matched.join(' & ')}` : `Ages ${theme.ageRange}`}</span>
              </button>
            )
          })}
        </div>
      )
  }
}

function Finale({
  draft,
  signedIn,
  authLoading,
  authMode,
  setAuthMode,
  creating,
  error,
  onCreate,
  onEdit,
}: {
  draft: WizardDraft
  signedIn: boolean
  authLoading: boolean
  authMode: 'signup' | 'signin'
  setAuthMode: (m: 'signup' | 'signin') => void
  creating: boolean
  error: string | null
  onCreate: () => void
  onEdit: (stepIndex: number) => void
}) {
  const place = draft.zipPlace ? [draft.zipPlace.city, draft.zipPlace.state].filter(Boolean).join(', ') : draft.zip
  const items: [string, string, number][] = [
    ['🎂', `${first(draft)} turns ${draft.childAge}`, 1],
    ['📅', draft.partyDate ? new Date(`${draft.partyDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '', 2],
    ['📍', `${place} · 20 mi`, 3],
    ['👥', `${draft.guestCount} guests`, 4],
    ['💰', draft.budgetUnsure || draft.budget == null ? 'Budget TBD' : fmtMoney(draft.budget), 5],
    ['✨', draft.setting === 'either' ? 'Indoor or outdoor' : draft.setting === 'indoor' ? 'Indoor' : 'Outdoor', 6],
  ]
  return (
    <div className="mbp-rise flex flex-1 flex-col px-5 pt-8">
      <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-hero text-white shadow-lg shadow-primary/30">
        <Sparkles className="h-6 w-6" />
      </div>
      <h1 className="font-display text-[32px] font-extrabold leading-tight tracking-tight">Let’s find your perfect party.</h1>
      <div className="mt-5 flex flex-wrap gap-2">
        {items.map(([emoji, label, idx]) => (
          <button key={emoji} type="button" onClick={() => onEdit(idx)} className="tap inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm">
            <span aria-hidden>{emoji}</span> {label}
          </button>
        ))}
        {draft.interests.length ? (
          <button type="button" onClick={() => onEdit(7)} className="tap inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm">
            <span aria-hidden>💜</span> {draft.interests.map((i) => INTERESTS.find((x) => x.id === i)?.label).join(', ')}
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {signedIn ? (
        <div className="mt-auto pb-[calc(env(safe-area-inset-bottom)+16px)] pt-6">
          <AppButton size="lg" variant="magic" block loading={creating} onClick={onCreate}>
            {creating ? 'Creating your party…' : 'Find party places near me'}
          </AppButton>
        </div>
      ) : authLoading ? null : (
        <div className="mt-8 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <h2 className="text-lg font-semibold">{authMode === 'signup' ? 'Save your party' : 'Sign in to save your party'}</h2>
          <p className="mb-4 text-sm text-muted-foreground">So you can come back to it from any device.</p>
          <AuthForm mode={authMode} compact onDone={onCreate} next="/start?resume=1" />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {authMode === 'signup' ? 'Already have an account? ' : 'New here? '}
            <button type="button" className="font-semibold text-primary" onClick={() => setAuthMode(authMode === 'signup' ? 'signin' : 'signup')}>
              {authMode === 'signup' ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </div>
      )}
    </div>
  )
}
