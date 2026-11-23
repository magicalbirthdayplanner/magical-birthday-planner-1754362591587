'use client'

/**
 * Parent setup — 4 short steps, one decision per screen, everything optional except name + age:
 *   1. Who is Santa calling?   (first name, age, optional pronunciation)
 *   2. What makes them special? (tap suggestions or add your own: loves · celebrate · encourage · wish · avoid)
 *   3. Santa's style            (traditional · gentle · funny · playful)
 *   4. Check & approve          (Santa's exact first line, what he knows, one parent confirmation) → sign in → save
 * The draft lives in localStorage, so nothing is lost if the parent signs in, switches apps or reloads.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, Gift, Heart, PawPrint, Pencil, Plus, Sprout, Star, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch, friendlyError } from '@/lib/data/api'
import { track } from '@/lib/analytics/client'
import { MAX_AGE, MIN_AGE, SANTA_STYLE_GUIDE, SANTA_STYLES, SantaChildProfileSchema, santaGreeting, type SantaChildProfile, type SantaStyle } from '@/lib/santa/persona'
import { ALL_AFFIRMATIONS, SANTA_AFFIRMATIONS } from '@/lib/santa/consent'
import { BottomBar, Pill, SantaButton, SantaCard, SantaShell, StepHeader } from './ui'
import { SantaSignIn } from './SantaSignIn'

interface Draft {
  firstName: string
  pronunciation: string
  age: number | null
  style: SantaStyle
  loves: string[]
  celebrate: string[]
  encourage: string[]
  family: string[]
  wishes: string[]
  avoid: string
}
const EMPTY: Draft = { firstName: '', pronunciation: '', age: null, style: 'traditional', loves: [], celebrate: [], encourage: [], family: [], wishes: [], avoid: '' }
// 'mbp.' prefix: cleared with the rest of the app's local data on sign-out / account switch (shared devices).
const KEY = 'mbp.santa.draft'
const TOTAL = 4

const SUGGEST = {
  loves: ['Dinosaurs', 'Unicorns', 'Drawing', 'Soccer', 'Dancing', 'Space', 'Animals', 'Reading', 'Building blocks', 'Cars & trucks', 'Music', 'Swimming', 'Baking', 'Superheroes'],
  celebrate: ['Learned to ride a bike', 'Started school', 'Lost a first tooth', 'Learned to swim', 'Became a big sister', 'Became a big brother', 'Learned to read', 'Was a kind friend'],
  encourage: ['Reading', 'Being brave', 'Sharing', 'Trying new foods', 'Bedtime routine', 'Tidying up', 'Being kind to siblings', 'Practising an instrument'],
}
const STYLE_EMOJI: Record<SantaStyle, string> = { traditional: '🎅', gentle: '🤍', funny: '😄', playful: '✨' }

const clean = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 60)

function toProfile(d: Draft): SantaChildProfile | null {
  const r = SantaChildProfileSchema.safeParse({ ...d, firstName: d.firstName.trim(), age: d.age ?? undefined })
  return r.success ? r.data : null
}

/** Suggestion pills + "add your own". */
function ChipPicker({ value, onChange, suggestions, placeholder, max = 6 }: { value: string[]; onChange: (v: string[]) => void; suggestions: string[]; placeholder: string; max?: number }) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const has = (s: string) => value.some((v) => v.toLowerCase() === s.toLowerCase())
  const toggle = (s: string) => onChange(has(s) ? value.filter((v) => v.toLowerCase() !== s.toLowerCase()) : value.length >= max ? value : [...value, s])
  const custom = value.filter((v) => !suggestions.some((s) => s.toLowerCase() === v.toLowerCase()))
  const add = () => {
    const t = clean(text)
    if (t && !has(t) && value.length < max) onChange([...value, t])
    setText('')
    setAdding(false)
  }
  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])
  return (
    <div className="flex flex-wrap gap-2">
      {[...suggestions, ...custom].map((s) => (
        <Pill key={s} active={has(s)} onClick={() => toggle(s)}>{s}</Pill>
      ))}
      {adding ? (
        <form className="flex w-full gap-2" onSubmit={(e) => { e.preventDefault(); add() }}>
          <input ref={inputRef} value={text} maxLength={60} onChange={(e) => setText(e.target.value)} onBlur={add} placeholder={placeholder} className="h-12 flex-1 rounded-full border-2 border-[#c8202e] bg-white px-4 text-[16px] outline-none" />
        </form>
      ) : (
        value.length < max && (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex min-h-[44px] items-center gap-1 rounded-full border-2 border-dashed border-[#2b1d14]/25 px-4 text-[15px] font-bold text-[#2b1d14]/70">
            <Plus className="h-4 w-4" /> Add your own
          </button>
        )
      )}
    </div>
  )
}

function Section({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">{icon}</span>
        <h2 className="text-[18px] font-extrabold">{title}</h2>
      </div>
      {hint && <p className="mb-3 mt-1 text-[14px] text-[#2b1d14]/60">{hint}</p>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </section>
  )
}

export function SantaSetup() {
  const router = useRouter()
  const params = useSearchParams()
  const editId = params.get('child')
  const { user, loading: authLoading } = useAuth()
  const [d, setD] = useState<Draft>(EMPTY)
  const [step, setStep] = useState(1)
  const [loaded, setLoaded] = useState(false)
  const [showSay, setShowSay] = useState(false)
  const [showAvoid, setShowAvoid] = useState(false)
  const [agree, setAgree] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [needSignIn, setNeedSignIn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const topRef = useRef<HTMLDivElement>(null)

  // Restore: an existing child (edit) or the local draft.
  useEffect(() => {
    let off = false
    const restore = async () => {
      if (editId && user) {
        try {
          const me = await apiFetch<{ children: { id: string; profile: SantaChildProfile | null }[] }>('/api/santa/me')
          const c = me.children.find((x) => x.id === editId)?.profile
          if (c && !off) {
            setD({ ...EMPTY, ...c })
            setShowSay(!!c.pronunciation)
            setShowAvoid(!!c.avoid)
            setStep(4)
          }
        } catch {
          /* fall back to draft */
        }
      } else {
        try {
          const raw = localStorage.getItem(KEY)
          if (raw) {
            const saved = JSON.parse(raw) as { d: Draft; step: number }
            setD({ ...EMPTY, ...saved.d })
            setStep(Math.min(TOTAL, Math.max(1, saved.step || 1)))
            setShowSay(!!saved.d.pronunciation)
            setShowAvoid(!!saved.d.avoid)
          }
        } catch {
          /* ignore */
        }
      }
      if (!off) setLoaded(true)
    }
    if (!authLoading) void restore()
    return () => {
      off = true
    }
  }, [editId, user, authLoading])

  useEffect(() => {
    if (loaded && !editId) localStorage.setItem(KEY, JSON.stringify({ d, step }))
  }, [d, step, loaded, editId])

  const go = (n: number) => {
    setStep(n)
    setError(null)
    track('santa_setup_step', { step: n })
    topRef.current?.scrollIntoView({ behavior: 'smooth' })
    window.scrollTo({ top: 0 })
  }

  const name = d.firstName.trim() || 'your child'
  const nameOk = /^[\p{L}\p{M}' .-]{1,40}$/u.test(d.firstName.trim())
  const profile = useMemo(() => toProfile(d), [d])
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))

  const save = useCallback(async () => {
    if (!profile) return setError('Please check the details.')
    setSaving(true)
    setError(null)
    try {
      const { id } = await apiFetch<{ id: string }>('/api/santa/children', { method: 'POST', body: JSON.stringify({ id: editId ?? undefined, profile }) })
      await apiFetch('/api/santa/approve', { method: 'POST', body: JSON.stringify({ childId: id, affirmations: ALL_AFFIRMATIONS }) })
      track('santa_setup_completed', { age: profile.age, style: profile.style, loves: profile.loves.length, celebrate: profile.celebrate.length })
      localStorage.removeItem(KEY)
      router.push(`/santa/ready?child=${id}`)
    } catch (e) {
      setSaving(false)
      setError(friendlyError(e))
    }
  }, [profile, editId, router])

  const approve = () => {
    if (!agree) return setError('Please tick the box to continue.')
    if (!user) return setNeedSignIn(true)
    void save()
  }

  if (!loaded) return <SantaShell><div className="pt-24 text-center text-[#2b1d14]/50">Loading…</div></SantaShell>

  return (
    <SantaShell>
      <div ref={topRef} />
      {step === 1 && (
        <>
          <StepHeader step={1} total={TOTAL} onBack={() => router.push('/santa')} title="Who is Santa calling?" subtitle="Just their first name — Santa will say it at the start of the call." />
          <label className="block">
            <span className="text-[15px] font-extrabold">First name</span>
            <input value={d.firstName} onChange={(e) => set('firstName', e.target.value.slice(0, 40))} autoComplete="off" autoCapitalize="words" placeholder="e.g. Emma" className="mt-2 h-14 w-full rounded-2xl border-2 border-[#2b1d14]/12 bg-white px-4 text-[20px] font-bold outline-none focus:border-[#c8202e]" />
          </label>
          {d.firstName && !nameOk && <p className="mt-2 text-sm font-semibold text-[#c8202e]">Letters only, please.</p>}
          {!showSay ? (
            <button type="button" onClick={() => setShowSay(true)} className="mt-3 text-[15px] font-bold text-[#c8202e]">Tricky name? Show Santa how to say it</button>
          ) : (
            <label className="mt-4 block">
              <span className="text-[15px] font-extrabold">How do you say it? <span className="font-semibold text-[#2b1d14]/50">(optional)</span></span>
              <input value={d.pronunciation} onChange={(e) => set('pronunciation', e.target.value.slice(0, 60))} placeholder="e.g. EM-uh, or Zo-ee" className="mt-2 h-12 w-full rounded-2xl border-2 border-[#2b1d14]/12 bg-white px-4 text-[17px] outline-none focus:border-[#c8202e]" />
            </label>
          )}
          <p className="mt-7 text-[15px] font-extrabold">How old is {d.firstName.trim() || 'your child'}?</p>
          <div className="mt-3 grid grid-cols-6 gap-2">
            {Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => i + MIN_AGE).map((a) => (
              <button key={a} type="button" aria-pressed={d.age === a} onClick={() => set('age', a)} className={`h-12 rounded-2xl border-2 text-[18px] font-extrabold transition active:scale-95 ${d.age === a ? 'border-[#c8202e] bg-[#c8202e] text-white' : 'border-[#2b1d14]/12 bg-white'}`}>
                {a}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-[#2b1d14]/55">Santa talks a little differently to a 3-year-old than to a 10-year-old.</p>
          <BottomBar>
            <SantaButton disabled={!nameOk || d.age == null} onClick={() => go(2)}>Continue</SantaButton>
          </BottomBar>
        </>
      )}

      {step === 2 && (
        <>
          <StepHeader step={2} total={TOTAL} onBack={() => go(1)} title={<>What makes {name} special?</>} subtitle="Tap what fits or add your own. Everything is optional — even one thing makes the call feel personal." />
          <Section icon={<Heart className="h-4 w-4 text-[#c8202e]" />} title={`${name} loves…`}>
            <ChipPicker value={d.loves} onChange={(v) => set('loves', v)} suggestions={SUGGEST.loves} placeholder="e.g. our dog Biscuit" />
          </Section>
          <Section icon={<Star className="h-4 w-4 text-[#e9ac26]" />} title="Something to celebrate" hint="A proud moment from this year — Santa will make a fuss of it.">
            <ChipPicker value={d.celebrate} onChange={(v) => set('celebrate', v)} suggestions={SUGGEST.celebrate} placeholder="e.g. scored a goal" />
          </Section>
          <Section icon={<Sprout className="h-4 w-4 text-emerald-700" />} title="Something to encourage" hint="Santa cheers them on — he never scolds.">
            <ChipPicker value={d.encourage} onChange={(v) => set('encourage', v)} suggestions={SUGGEST.encourage} placeholder="e.g. learning to tie shoes" />
          </Section>
          <Section icon={<PawPrint className="h-4 w-4 text-[#8a5a2b]" />} title="Pets, family & your elf" hint="Little details make the magic: Santa can say hello to them. First names only.">
            <ChipPicker value={d.family} onChange={(v) => set('family', v)} suggestions={[]} placeholder="e.g. our dog Biscuit · our elf Jingle · big brother Sam" />
          </Section>
          <Section icon={<Gift className="h-4 w-4 text-[#0f2a1d]" />} title="Christmas wish" hint="Santa will love hearing it — but he never promises a present.">
            <ChipPicker value={d.wishes} onChange={(v) => set('wishes', v)} suggestions={[]} placeholder="e.g. a red bike" max={3} />
          </Section>
          <section className="mt-7">
            {!showAvoid ? (
              <button type="button" onClick={() => setShowAvoid(true)} className="flex items-center gap-1 text-[15px] font-bold text-[#2b1d14]/70">
                <ChevronDown className="h-4 w-4" /> Anything Santa should avoid? <span className="font-semibold text-[#2b1d14]/45">(optional)</span>
              </button>
            ) : (
              <label className="block">
                <span className="text-[18px] font-extrabold">Anything Santa should avoid?</span>
                <span className="mt-1 block text-[14px] text-[#2b1d14]/60">Santa won’t bring these up. For example a pet that passed away, or a family change.</span>
                <textarea value={d.avoid} maxLength={300} onChange={(e) => set('avoid', e.target.value)} rows={3} className="mt-3 w-full rounded-2xl border-2 border-[#2b1d14]/12 bg-white p-4 text-[16px] outline-none focus:border-[#c8202e]" placeholder="Optional" />
              </label>
            )}
          </section>
          <BottomBar>
            <SantaButton onClick={() => go(3)}>{d.loves.length + d.celebrate.length + d.encourage.length + d.family.length + d.wishes.length === 0 ? 'Skip for now' : 'Continue'}</SantaButton>
          </BottomBar>
        </>
      )}

      {step === 3 && (
        <>
          <StepHeader step={3} total={TOTAL} onBack={() => go(2)} title="What kind of Santa?" subtitle={`Pick the style ${name} will love most. You can change it any time.`} />
          <div className="space-y-3" role="radiogroup" aria-label="Santa's style">
            {SANTA_STYLES.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={d.style === s} onClick={() => set('style', s)} className={`flex w-full items-center gap-4 rounded-3xl border-2 bg-white p-4 text-left transition active:scale-[0.99] ${d.style === s ? 'border-[#c8202e] shadow-[0_10px_24px_-14px_rgba(200,32,46,0.6)]' : 'border-transparent'}`}>
                <span className="text-[32px]" aria-hidden>{STYLE_EMOJI[s]}</span>
                <span className="flex-1">
                  <span className="block text-[18px] font-extrabold">{SANTA_STYLE_GUIDE[s].label}{s === 'traditional' && <span className="ml-2 rounded-full bg-[#fbf6ec] px-2 py-0.5 text-xs font-bold text-[#2b1d14]/60">Most popular</span>}</span>
                  <span className="block text-[15px] text-[#2b1d14]/65">{SANTA_STYLE_GUIDE[s].parentHint}</span>
                </span>
                <span className={`h-6 w-6 rounded-full border-2 ${d.style === s ? 'border-[#c8202e] bg-[#c8202e] shadow-[inset_0_0_0_4px_white]' : 'border-[#2b1d14]/25'}`} />
              </button>
            ))}
          </div>
          <BottomBar>
            <SantaButton onClick={() => go(4)}>Continue</SantaButton>
          </BottomBar>
        </>
      )}

      {step === 4 && (
        <>
          <StepHeader step={4} total={TOTAL} onBack={() => go(3)} title="Here’s how Santa will say hello" subtitle="Check everything looks right. You can change it any time before the call." />
          {profile && (
            <div className="flex items-end gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brands/holidays/art/santa-live.webp" alt="" className="h-14 w-14 shrink-0 rounded-full object-cover object-[50%_28%] ring-4 ring-white" />
              <p className="rounded-3xl rounded-bl-md bg-white p-4 text-[17px] leading-snug shadow-sm">“{santaGreeting(profile)}”</p>
            </div>
          )}
          <SantaCard className="mt-5">
            <p className="text-[13px] font-extrabold uppercase tracking-wide text-[#2b1d14]/50">Santa will know</p>
            <ul className="mt-2 divide-y divide-[#2b1d14]/8">
              {[
                { label: 'Name', value: `${d.firstName.trim()}${d.pronunciation ? ` (say “${d.pronunciation}”)` : ''}, age ${d.age}`, step: 1 },
                { label: 'Loves', value: d.loves.join(', '), step: 2 },
                { label: 'Celebrate', value: d.celebrate.join(', '), step: 2 },
                { label: 'Encourage', value: d.encourage.join(', '), step: 2 },
                { label: 'Pets & family', value: d.family.join(', '), step: 2 },
                { label: 'Wish', value: d.wishes.join(', '), step: 2 },
                { label: 'Avoid', value: d.avoid, step: 2 },
                { label: 'Style', value: SANTA_STYLE_GUIDE[d.style].label, step: 3 },
              ]
                .filter((r) => r.value)
                .map((r) => (
                  <li key={r.label} className="flex items-start gap-3 py-3">
                    <span className="w-20 shrink-0 text-[14px] font-bold text-[#2b1d14]/55">{r.label}</span>
                    <span className="flex-1 text-[15px] font-semibold">{r.value}</span>
                    <button type="button" onClick={() => go(r.step)} aria-label={`Edit ${r.label}`} className="-m-2 p-2 text-[#2b1d14]/45"><Pencil className="h-4 w-4" /></button>
                  </li>
                ))}
            </ul>
          </SantaCard>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-3xl bg-white p-4">
            <input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); setError(null) }} className="mt-0.5 h-6 w-6 shrink-0 accent-[#c8202e]" />
            <span className="text-[15px] leading-snug">
              I’m {name}’s parent or guardian, I understand Santa is an AI character, and I’ll stay nearby during the call.{' '}
              <button type="button" onClick={(e) => { e.preventDefault(); setShowDetails((x) => !x) }} className="font-bold text-[#c8202e] underline">Details</button>
            </span>
          </label>
          {showDetails && (
            <ul className="mt-2 space-y-2 rounded-2xl bg-[#fff8e8] p-4 text-[14px] leading-snug text-[#2b1d14]/80">
              {SANTA_AFFIRMATIONS.map((a) => <li key={a.id}>• {a.text}</li>)}
              <li>• You can delete your child’s details at any time from your Santa page.</li>
            </ul>
          )}

          {needSignIn && !user && (
            <SantaCard className="mt-5 border-2 border-[#e9ac26]">
              <SantaSignIn next="/santa/create" onSignedIn={() => { setNeedSignIn(false); void save() }} title="Last step: your email" subtitle="So you can come back to your Santa call — we’ll send a 6-digit code, no password." />
            </SantaCard>
          )}

          {error && <p role="alert" className="mt-4 text-[15px] font-semibold text-[#c8202e]">{error}</p>}
          {!(needSignIn && !user) && (
            <BottomBar>
              <SantaButton loading={saving} onClick={approve}>Looks perfect — continue</SantaButton>
            </BottomBar>
          )}
          {needSignIn && !user && (
            <button type="button" onClick={() => setNeedSignIn(false)} className="mt-3 flex w-full items-center justify-center gap-1 py-2 text-sm font-bold text-[#2b1d14]/55"><X className="h-4 w-4" /> Not now</button>
          )}
        </>
      )}
    </SantaShell>
  )
}
