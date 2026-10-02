'use client'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Check, Plus, Trash2 } from 'lucide-react'
import { useParty } from '@/components/app/PartyProvider'
import { BottomSheet } from '@/components/app/BottomSheet'
import { AppButton, Card, EmptyState, LinkButton, PageHeader, Skeleton } from '@/components/app/ui'
import { TextField } from '@/components/app/fields'
import { useChecklist, useChosenVenue } from '@/lib/data/hooks'
import { addCustomTask, deleteTask, setTaskDone, type ChecklistItem } from '@/lib/data/checklist'
import { friendlyError } from '@/lib/data/api'
import { bucketFor, daysBetween, groupTasks, localToday } from '@/lib/planning/checklist'
import { countdownLabel } from '@/lib/planning/progress'
import { track } from '@/lib/analytics/client'
import { cn } from '@/lib/utils'

const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

function TaskRow({ task, today, onToggle, onDelete }: { task: ChecklistItem; today: string; onToggle: (t: ChecklistItem, done: boolean) => void; onDelete: (t: ChecklistItem) => void }) {
  const done = !!task.completed_at
  const overdue = bucketFor(task, today) === 'overdue'
  return (
    <li className="flex min-h-[64px] items-center gap-3 px-4 py-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${done ? 'Mark not done' : 'Mark done'}: ${task.title}`}
        onClick={() => onToggle(task, !done)}
        // 44 px touch target around the 32 px visual circle.
        className="tap -m-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
      >
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-full border-2 transition active:scale-90', done ? 'border-success bg-success text-white' : 'border-input')}>
          {done ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('font-medium', done && 'text-muted-foreground line-through')}>{task.title}</p>
        {task.detail && !done ? <p className="text-sm text-muted-foreground">{task.detail}</p> : null}
        {task.due_date && !done ? (
          <p className={cn('text-xs', overdue ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
            {overdue ? `Overdue · was due ${fmt(task.due_date)}` : daysBetween(today, task.due_date) === 0 ? 'Due today' : `Due ${fmt(task.due_date)}`}
          </p>
        ) : null}
      </div>
      {task.is_custom ? (
        <button type="button" aria-label={`Delete ${task.title}`} onClick={() => onDelete(task)} className="tap flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground active:bg-muted">
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
    </li>
  )
}

export function ChecklistScreen() {
  const { party } = useParty()
  const chosen = useChosenVenue(party?.id)
  const { data, isLoading, mutate, error } = useChecklist(party, !!chosen.data)
  const [addOpen, setAddOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const today = localToday()
  const groups = useMemo(() => groupTasks(data ?? [], today), [data, today])

  if (!party) return <EmptyState icon="✅" title="No party yet" action={<LinkButton href="/start" block>Plan a party</LinkButton>} />

  async function toggle(t: ChecklistItem, done: boolean) {
    const next = (data ?? []).map((x) => (x.id === t.id ? { ...x, completed_at: done ? new Date().toISOString() : null } : x))
    try {
      await mutate(async () => {
        await setTaskDone(t.id, done)
        return next
      }, { optimisticData: next, rollbackOnError: true, revalidate: false })
      if (done) track('checklist_completed', { task: t.is_custom ? 'custom' : t.task_key })
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  async function remove(t: ChecklistItem) {
    try {
      await mutate(async () => {
        await deleteTask(t.id)
        return (data ?? []).filter((x) => x.id !== t.id)
      }, { optimisticData: (data ?? []).filter((x) => x.id !== t.id), rollbackOnError: true, revalidate: false })
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  async function add() {
    if (!title.trim()) return
    setBusy(true)
    try {
      await addCustomTask(party!.id, title, due || null)
      await mutate()
      setTitle('')
      setDue('')
      setAddOpen(false)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const days = daysBetween(today, party.party_date)
  const total = data?.length ?? 0
  const done = groups.done.length
  const sections: [string, ChecklistItem[]][] = [
    ['Today', groups.today],
    ['This week', groups.week],
    ['Later', groups.later],
  ]

  return (
    <div className="pb-4">
      <PageHeader
        back="/plan"
        title="Checklist"
        subtitle={`${countdownLabel(days)} to go · ${done} of ${total} done`}
        action={
          <button type="button" onClick={() => setAddOpen(true)} aria-label="Add a task" className="tap flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Plus className="h-5 w-5" />
          </button>
        }
      />
      <div className="px-4">
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={total ? Math.round((done / total) * 100) : 0} aria-valuemin={0} aria-valuemax={100} aria-label="Checklist progress">
          <div className="h-full rounded-full bg-success transition-[width] duration-500" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      </div>

      {isLoading && !data ? (
        <div className="space-y-3 p-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : error ? (
        <EmptyState icon="⚠️" title="Couldn’t load your checklist" body={friendlyError(error)} action={<AppButton block variant="outline" onClick={() => mutate()}>Try again</AppButton>} />
      ) : (
        <div className="space-y-5 pt-4">
          {sections.map(([label, list]) =>
            list.length ? (
              <section key={label} className="px-4" aria-label={label}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {label} <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{list.length}</span>
                </h2>
                <Card>
                  <ul className="divide-y divide-border">
                    {list.map((t) => (
                      <TaskRow key={t.id} task={t} today={today} onToggle={toggle} onDelete={remove} />
                    ))}
                  </ul>
                </Card>
              </section>
            ) : null,
          )}
          {groups.today.length + groups.week.length + groups.later.length === 0 ? (
            <EmptyState icon="🎉" title="All done!" body="Every task is checked off. Enjoy the party." />
          ) : null}
          {groups.done.length ? (
            <section className="px-4" aria-label="Completed">
              <button type="button" onClick={() => setShowDone((s) => !s)} aria-expanded={showDone} className="tap mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Completed <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{groups.done.length}</span>
              </button>
              {showDone ? (
                <Card>
                  <ul className="divide-y divide-border">
                    {groups.done.map((t) => (
                      <TaskRow key={t.id} task={t} today={today} onToggle={toggle} onDelete={remove} />
                    ))}
                  </ul>
                </Card>
              ) : null}
            </section>
          ) : null}
        </div>
      )}

      <BottomSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add a task"
        footer={
          <AppButton block size="lg" loading={busy} disabled={!title.trim()} onClick={add}>
            Add task
          </AppButton>
        }
      >
        <div className="space-y-4">
          <TextField label="Task" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="e.g. Pick up balloons" />
          <TextField label="Due date (optional)" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
      </BottomSheet>
    </div>
  )
}
