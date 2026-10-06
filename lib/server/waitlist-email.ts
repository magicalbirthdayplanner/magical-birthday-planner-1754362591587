/**
 * Launch-waitlist emails (Resend, via the existing sendTransactional/getResend setup). SERVER ONLY.
 *
 *  - Confirmation: once per waitlist row, right after the sign-up (idempotency key = row id; confirmation_sent_at
 *    is recorded only when Resend accepted it). A repeat sign-up only sends if no confirmation went out yet.
 *  - Launch reminder: once per subscribed row, from Oct 12 00:00 ET until launch (lib/launch.ts REMINDER_AT), in
 *    Resend batches of up to 100. launch_reminder_sent_at is recorded per row after Resend accepted the batch, and
 *    each batch carries an idempotency key derived from its row ids, so a re-run never sends twice.
 *
 * Telemetry carries counts and error codes only — never an email address or name.
 */
import 'server-only'
import { createHash } from 'node:crypto'
import { getResend } from '@/lib/email'
import { LAUNCH_AT, REMINDER_AT } from '@/lib/launch'
import { appBaseUrl, emailConfigured, emailFrom, emailReplyTo, escapeHtml, sendTransactional } from './notifications'
import { getSupabaseAdmin, hasServiceRole } from './supabase-admin'
import { reportError, track } from '@/lib/observability/telemetry'
import { trackServer } from '@/lib/analytics/server'

// ------------------------------------------------------------------ templates
interface Recipient {
  firstName?: string | null
  unsubscribeToken: string
}

export const unsubscribeUrl = (token: string) => `${appBaseUrl()}/api/waitlist/unsubscribe?t=${encodeURIComponent(token)}`
/** RFC 8058 one-click unsubscribe (Gmail/Yahoo) + the classic mailto-less link. */
export const unsubscribeHeaders = (token: string): Record<string, string> => ({ 'List-Unsubscribe': `<${unsubscribeUrl(token)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' })

const LAUNCH_DAY = 'Tuesday, October 13'

function layout(preheader: string, body: string, r: Recipient): string {
  const base = appBaseUrl()
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;background:#fbf8f3;font-family:Nunito,'Segoe UI',Arial,sans-serif;color:#221b3a">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr>
<td style="vertical-align:middle"><img src="${escapeHtml(base)}/icons/icon-192.png" width="36" height="36" alt="" style="display:block;border-radius:10px"></td>
<td style="vertical-align:middle;padding-left:10px;font-size:18px;font-weight:700">Magical Birthday <span style="color:#5b2fb8">Planner</span></td>
</tr></table>
<div style="background:#ffffff;border:1px solid #ebe4d8;border-radius:24px;padding:28px 24px">
${body}
</div>
<p style="font-size:12px;line-height:1.6;color:#6b6480;margin:24px 4px 0">You’re receiving this because you joined the Magical Birthday Planner launch waitlist at magicalbirthdayplanner.app.
<a href="${escapeHtml(unsubscribeUrl(r.unsubscribeToken))}" style="color:#6b6480">Unsubscribe</a> · <a href="${escapeHtml(base)}/privacy" style="color:#6b6480">Privacy policy</a></p>
</div></body></html>`
}

const hello = (r: Recipient) => (r.firstName ? `, ${escapeHtml(r.firstName)}` : '')

export function confirmationEmail(r: Recipient) {
  const subject = 'You’re on the list 🎂 Magical Birthday Planner launches October 13'
  const html = layout(
    'We’ll email you when Magical Birthday Planner opens on October 13.',
    `<p style="margin:0;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#5b2fb8">Launch waitlist</p>
<h1 style="margin:8px 0 16px;font-size:28px;line-height:1.15">You’re in${hello(r)}! 🎂</h1>
<p style="margin:0 0 14px;font-size:16px;line-height:1.6">Magical Birthday Planner launches on <strong>${LAUNCH_DAY}</strong>. You’re on the list, so you’ll be among the first we email when the doors open.</p>
<p style="margin:0 0 20px;font-size:16px;line-height:1.6">We’re building a simpler way to plan your child’s birthday — ideas and local venues, food, invitations and RSVPs, the budget and all the little details in between, in one place on your phone.</p>
<p style="margin:0 0 20px"><span style="display:inline-block;background:#5b2fb8;color:#ffffff;padding:12px 20px;border-radius:999px;font-weight:700;font-size:15px">We’ll see you on October 13</span></p>
<p style="margin:0;font-size:15px;line-height:1.6;color:#4a4360">Until then, keep the cake plans secret. 🤫</p>`,
    r,
  )
  const text = `You’re in${r.firstName ? `, ${r.firstName}` : ''}! 🎂

Magical Birthday Planner launches on ${LAUNCH_DAY}. You’re on the list, so you’ll be among the first we email when the doors open.

We’re building a simpler way to plan your child’s birthday — ideas and local venues, food, invitations and RSVPs, the budget and all the little details in between, in one place on your phone.

We’ll see you on October 13. Until then, keep the cake plans secret.

You’re receiving this because you joined the Magical Birthday Planner launch waitlist.
Unsubscribe: ${unsubscribeUrl(r.unsubscribeToken)}
Privacy policy: ${appBaseUrl()}/privacy`
  return { subject, html, text }
}

export function reminderEmail(r: Recipient) {
  const subject = 'Tomorrow: Magical Birthday Planner opens 🎂'
  const html = layout(
    'Magical Birthday Planner opens tomorrow, October 13.',
    `<p style="margin:0;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#5b2fb8">Opening tomorrow</p>
<h1 style="margin:8px 0 16px;font-size:28px;line-height:1.15">Tomorrow’s the day${hello(r)}. 🎂</h1>
<p style="margin:0 0 14px;font-size:16px;line-height:1.6">Magical Birthday Planner opens on <strong>${LAUNCH_DAY}</strong>.</p>
<p style="margin:0 0 20px;font-size:16px;line-height:1.6">If you’ve been waiting to plan the next birthday a little differently — the venue, the plan, the guest list and the little details, all in one place — tomorrow you can.</p>
<p style="margin:0 0 20px"><span style="display:inline-block;background:#5b2fb8;color:#ffffff;padding:12px 20px;border-radius:999px;font-weight:700;font-size:15px">See you tomorrow 🎈</span></p>
<p style="margin:0;font-size:15px;line-height:1.6;color:#4a4360">We’ll email you as soon as the doors open.</p>`,
    r,
  )
  const text = `Tomorrow’s the day${r.firstName ? `, ${r.firstName}` : ''}. 🎂

Magical Birthday Planner opens on ${LAUNCH_DAY}.

If you’ve been waiting to plan the next birthday a little differently — the venue, the plan, the guest list and the little details, all in one place — tomorrow you can.

We’ll email you as soon as the doors open. See you tomorrow.

You’re receiving this because you joined the Magical Birthday Planner launch waitlist.
Unsubscribe: ${unsubscribeUrl(r.unsubscribeToken)}
Privacy policy: ${appBaseUrl()}/privacy`
  return { subject, html, text }
}

// ------------------------------------------------------------------ telemetry
function event(name: string, dims: Record<string, string | number | undefined>, level: 'info' | 'warn' = 'info') {
  track(name, dims, undefined, level)
  trackServer(name, Object.fromEntries(Object.entries(dims).filter(([, v]) => v !== undefined)), { path: '/api/waitlist' })
}

function failed(kind: 'confirmation' | 'reminder', code: string, extra: Record<string, string | number | undefined> = {}) {
  event(kind === 'confirmation' ? 'waitlist_confirmation_failed' : 'launch_reminder_failed', { ...extra, code }, 'warn')
  reportError(`Waitlist ${kind} email failed: ${code}`, { area: 'api', op: `waitlist_${kind}_email`, tags: { code }, fingerprint: [`waitlist-${kind}-email`, code] })
}

// ------------------------------------------------------------------ confirmation
export type ConfirmationOutcome = 'sent' | 'skipped' | 'failed'

/** Send the confirmation for an (already normalized) waitlist email unless one was already delivered. Never throws. */
export async function sendWaitlistConfirmation(email: string): Promise<ConfirmationOutcome> {
  try {
    if (!hasServiceRole()) return failed('confirmation', 'no_service_role'), 'failed'
    const db = getSupabaseAdmin()
    const { data: row, error } = await db.from('launch_waitlist').select('id, first_name, unsubscribe_token, status, confirmation_sent_at').eq('email', email).maybeSingle()
    if (error || !row) return failed('confirmation', error?.code || 'row_missing'), 'failed'
    if (row.confirmation_sent_at || row.status !== 'subscribed') return 'skipped'
    const msg = confirmationEmail({ firstName: row.first_name, unsubscribeToken: row.unsubscribe_token })
    const sent = await sendTransactional({ to: email, ...msg, idempotencyKey: `waitlist-confirm:${row.id}`, headers: unsubscribeHeaders(row.unsubscribe_token), log: { type: 'WAITLIST_CONFIRMATION' } })
    if (!sent.ok) return failed('confirmation', sent.error || 'send_failed'), 'failed'
    const { error: markError } = await db.from('launch_waitlist').update({ confirmation_sent_at: new Date().toISOString() }).eq('id', row.id).is('confirmation_sent_at', null)
    if (markError) failed('confirmation', `mark_${markError.code || 'unknown'}`) // delivered; a later repeat sign-up would re-send with the same idempotency key
    event('waitlist_confirmation_sent', {})
    return 'sent'
  } catch (e) {
    failed('confirmation', (e as Error)?.name || 'exception')
    return 'failed'
  }
}

// ------------------------------------------------------------------ launch reminder
export interface ReminderRun {
  status: 'done' | 'partial' | 'failed' | 'too_early' | 'after_launch' | 'not_configured'
  sent: number
  batches: number
  remaining?: number
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Send the launch reminder to every subscribed waitlist row that hasn't had it. Safe to run any number of times.
 * `onlyEmail` restricts the run to that one (existing) waitlist row and ignores the time window — the test path.
 */
export async function sendLaunchReminders(opts: { now?: number; onlyEmail?: string; budgetMs?: number; batchSize?: number; pauseMs?: number } = {}): Promise<ReminderRun> {
  const now = opts.now ?? Date.now()
  const started = Date.now()
  const budget = opts.budgetMs ?? 22_000
  const size = Math.min(100, Math.max(1, opts.batchSize ?? 100))
  let sent = 0
  let batches = 0
  const finish = (run: ReminderRun) => {
    event('launch_reminder_run', { status: run.status, sent: run.sent, batches: run.batches, remaining: run.remaining, test: opts.onlyEmail ? 1 : 0 }, run.status === 'failed' ? 'warn' : 'info')
    return run
  }
  if (!opts.onlyEmail && now < REMINDER_AT.getTime()) return finish({ status: 'too_early', sent, batches })
  if (!opts.onlyEmail && now >= LAUNCH_AT.getTime()) return finish({ status: 'after_launch', sent, batches })
  if (!emailConfigured() || !hasServiceRole()) {
    failed('reminder', 'not_configured')
    return finish({ status: 'not_configured', sent, batches })
  }
  const db = getSupabaseAdmin()
  const due = () => {
    let q = db.from('launch_waitlist').select('id, email, first_name, unsubscribe_token').eq('status', 'subscribed').is('launch_reminder_sent_at', null)
    if (opts.onlyEmail) q = q.eq('email', opts.onlyEmail)
    return q.order('created_at', { ascending: true }).order('id', { ascending: true }).limit(size)
  }

  while (true) {
    const { data: rows, error } = await due()
    if (error) {
      failed('reminder', error.code || 'select_failed')
      return finish({ status: 'failed', sent, batches })
    }
    if (!rows?.length) return finish({ status: 'done', sent, batches, remaining: 0 })
    if (Date.now() - started > budget) return finish({ status: 'partial', sent, batches, remaining: rows.length })

    const ids = rows.map((r) => r.id)
    const items = rows.map((r) => {
      const msg = reminderEmail({ firstName: r.first_name, unsubscribeToken: r.unsubscribe_token })
      return { from: emailFrom(), to: [r.email], replyTo: emailReplyTo(), headers: unsubscribeHeaders(r.unsubscribe_token), ...msg }
    })
    const idempotencyKey = createHash('sha256').update(`launch-reminder:${ids.join(',')}`).digest('hex').slice(0, 64)
    let errorCode: string | null = null
    try {
      const { error: sendError } = await getResend().batch.send(items, { idempotencyKey })
      if (sendError) errorCode = sendError.name || 'send_failed'
    } catch (e) {
      errorCode = (e as Error)?.name || 'exception'
    }
    if (errorCode) {
      failed('reminder', errorCode, { batch: ids.length })
      return finish({ status: sent ? 'partial' : 'failed', sent, batches, remaining: rows.length })
    }
    const at = new Date().toISOString()
    const { error: markError } = await db.from('launch_waitlist').update({ launch_reminder_sent_at: at }).in('id', ids).is('launch_reminder_sent_at', null)
    // Delivered but not recorded: stop rather than loop; a re-run sends the same batch with the same idempotency key.
    if (markError) {
      failed('reminder', `mark_${markError.code || 'unknown'}`, { batch: ids.length })
      return finish({ status: 'partial', sent: sent + ids.length, batches: batches + 1 })
    }
    await db.from('email_logs').insert(rows.map((r) => ({ email_type: 'LAUNCH_REMINDER', recipient_email: r.email, subject: items[0].subject, status: 'SENT' }))).then(() => undefined, () => undefined)
    sent += ids.length
    batches++
    event('launch_reminder_sent', { batch: ids.length })
    if (opts.onlyEmail) return finish({ status: 'done', sent, batches, remaining: 0 })
    await sleep(opts.pauseMs ?? 600) // Resend's default limit is a few requests per second
  }
}
