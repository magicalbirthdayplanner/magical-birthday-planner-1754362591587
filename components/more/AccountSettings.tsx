'use client'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { AppButton, Card } from '@/components/app/ui'
import { TextField } from '@/components/app/fields'
import { db } from '@/lib/db/browser'
import { friendlyError } from '@/lib/data/api'

/**
 * Name + RSVP email preference. Writes the caller's own `users` row (RLS); the
 * entitlement trigger keeps plan/trial columns server-only. The host RSVP email
 * honours `email_notifications` (lib/server/notifications.ts → hostContact).
 */
export function AccountSettings() {
  const { user } = useAuth()
  const profile = useSWR(user ? ['profile', user.id] : null, async () => {
    const { data, error } = await db.from('users').select('display_name, email_notifications').eq('id', user!.id).maybeSingle()
    if (error) throw error
    return data
  })
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const current = (profile.data?.display_name ?? user?.user_metadata?.display_name ?? '').toString()
  useEffect(() => setName(current), [current])
  const notify = profile.data?.email_notifications !== false

  async function saveName() {
    const next = name.trim().slice(0, 60)
    if (!next || next === current) return
    setSaving(true)
    try {
      const { error } = await db.from('users').update({ display_name: next }).eq('id', user!.id)
      if (error) throw error
      await db.auth.updateUser({ data: { display_name: next } })
      await profile.mutate()
      toast.success('Name saved')
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  async function toggleNotify() {
    const next = !notify
    try {
      await profile.mutate(async () => {
        const { error } = await db.from('users').update({ email_notifications: next }).eq('id', user!.id)
        if (error) throw error
        return { display_name: profile.data?.display_name ?? null, email_notifications: next }
      }, { optimisticData: { display_name: profile.data?.display_name ?? null, email_notifications: next }, rollbackOnError: true, revalidate: false })
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <TextField label="Your name" value={name} maxLength={60} autoComplete="given-name" onChange={(e) => setName(e.target.value)} />
        </div>
        <AppButton variant="outline" loading={saving} disabled={!name.trim() || name.trim() === current} onClick={saveName}>
          Save
        </AppButton>
      </div>
      <button type="button" role="switch" aria-checked={notify} onClick={toggleNotify} disabled={profile.isLoading} className="tap flex min-h-[56px] w-full items-center gap-3 text-left" data-testid="rsvp-email-toggle">
        <span className="flex-1">
          <span className="block font-medium">Email me when guests RSVP</span>
          <span className="block text-sm text-muted-foreground">{user?.email}</span>
        </span>
        <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${notify ? 'bg-primary' : 'bg-muted'}`}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${notify ? 'left-6' : 'left-1'}`} />
        </span>
      </button>
    </Card>
  )
}
