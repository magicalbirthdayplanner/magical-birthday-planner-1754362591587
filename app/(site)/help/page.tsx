import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Help',
  description: 'Answers for guests replying to an invitation and for parents planning a party with Magical Birthday Planner.',
  alternates: { canonical: '/help' },
}

const SUPPORT_EMAIL = 'magicalbirthdayplanner@gmail.com'

/** Lightweight help page (linked from invitation emails). Answers describe what the app actually does. */
export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-slate-800 sm:p-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-gray-100">Help</h1>
          <p className="mb-8 text-gray-600 dark:text-gray-300">Quick answers for guests and parents. Still stuck? Email us.</p>

          <section className="mb-8" aria-labelledby="guests">
            <h2 id="guests" className="mb-3 text-2xl font-semibold text-gray-900 dark:text-gray-100">Replying to an invitation</h2>
            <ul className="list-disc space-y-2 pl-6 text-gray-600 dark:text-gray-300">
              <li>Open the invitation link and choose <strong>Yes</strong>, <strong>Maybe</strong> or <strong>Can’t go</strong>. You don’t need an account.</li>
              <li>To change your answer, open the same link on the same phone and send it again — your earlier reply is updated, not duplicated.</li>
              <li>Sharing a phone? Tap <strong>RSVP for someone else</strong> so each family gets its own reply.</li>
              <li>Questions about the party itself (time, place, food or allergies) are best sent to the host — add them in the note when you reply.</li>
              <li>If the link says the invitation wasn’t found, the host may have turned it off or made a new one. Ask them for the latest link.</li>
            </ul>
          </section>

          <section className="mb-8" aria-labelledby="parents">
            <h2 id="parents" className="mb-3 text-2xl font-semibold text-gray-900 dark:text-gray-100">Planning a party</h2>
            <ul className="list-disc space-y-2 pl-6 text-gray-600 dark:text-gray-300">
              <li>Plans and what each one includes are on the <Link href="/pricing" className="text-purple-700 underline dark:text-purple-300">pricing page</Link>. Paid plans are a one-time payment for your account, processed by Dodo Payments.</li>
              <li>Forgot your password? Use <strong>Forgot password?</strong> on the <Link href="/login" className="text-purple-700 underline dark:text-purple-300">sign-in page</Link>.</li>
              <li>Want your account and party data deleted, or a copy of it? Email us from the address you signed up with and we’ll take care of it.</li>
            </ul>
          </section>

          <section aria-labelledby="contact">
            <h2 id="contact" className="mb-3 text-2xl font-semibold text-gray-900 dark:text-gray-100">Contact us</h2>
            <p className="text-gray-600 dark:text-gray-300">
              Email <a href={`mailto:${SUPPORT_EMAIL}`} className="text-purple-700 underline dark:text-purple-300">{SUPPORT_EMAIL}</a>. For a payment
              question, include the email address you signed up with.
            </p>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              See also our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
