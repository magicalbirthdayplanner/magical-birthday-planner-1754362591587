import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What Magical Birthday Planner collects, why, which service providers process it, and your choices.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">Privacy Policy</h1>
          
          <div className="prose prose-gray dark:prose-invert max-w-none">
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              <strong>Last updated:</strong> October 6, 2026
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">1. Information We Collect</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                We collect information you provide directly to us when using Magical Birthday Planner:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>Account information (email address, display name)</li>
                <li>Party planning details (child's name, age, interests, party date, ZIP code or area, themes, budget)</li>
                <li>Guest information you add (names and, if you choose, email addresses or phone numbers) and the RSVP replies guests send through your invitation link</li>
                <li>Payment information (processed securely through our payment providers)</li>
                <li>Usage data and preferences to improve our service</li>
                <li>Launch waitlist sign-ups: your email address, an optional first name, and the link or campaign that brought you to us</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">2. How We Use Your Information</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>Provide and maintain our party planning services</li>
                <li>Generate AI planning suggestions when you use an AI feature</li>
                <li>Find party venues near the area you choose</li>
                <li>Send invitations, RSVP confirmations and notifications you or your guests ask for</li>
                <li>Process payments and manage your plan</li>
                <li>Send important service updates and notifications</li>
                <li>Tell you when Magical Birthday Planner launches, if you joined the waitlist (you can ask us to remove your email at any time)</li>
                <li>Improve our platform and develop new features</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">3. Information Sharing</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                We do not sell, trade, or otherwise transfer your personal information to third parties except:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>With your explicit consent</li>
                <li>To trusted service providers who help us operate our platform</li>
                <li>When required by law or to protect our rights</li>
                <li>In connection with a business transfer or acquisition</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">4. Service Providers We Use</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                These companies process data on our behalf, only to provide the parts of the service listed here:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li><strong>Supabase</strong> — account sign-in and the database where your account, parties, guests and plans are stored.</li>
                <li><strong>Vercel</strong> — hosts the website and app, so it handles the requests your browser makes.</li>
                <li><strong>Dodo Payments</strong> — processes payments for paid plans. We do not receive or store your full card details.</li>
                <li><strong>Resend</strong> — delivers the emails we send, such as invitations, RSVP confirmations and notifications.</li>
                <li><strong>Google Maps Platform</strong> — finds party venues near the ZIP code or area you search and shows them on a map. The map is loaded from Google in your browser.</li>
                <li><strong>Our AI provider (OpenCode)</strong> — when you use an AI feature, generates suggestions from party details such as age, interests, area, guest count, budget and anything you type for the AI. Wording features such as invitations and party-host messages may include your child&apos;s and guests&apos; first names. We never send passwords, payment details, email addresses or phone numbers.</li>
                <li><strong>Sentry</strong> — monitors errors and performance so we can fix problems. Reports carry only an anonymous account ID; we strip email addresses, phone numbers, sign-in tokens and form contents before anything is sent.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">5. Data Security</h2>
              <p className="text-gray-600 dark:text-gray-300">
                We implement appropriate security measures to protect your personal information against unauthorized access, 
                alteration, disclosure, or destruction. This includes encryption, secure servers, and regular security assessments.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">6. Your Rights</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                You have the right to:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>Access and update your personal information</li>
                <li>Delete your account and associated data</li>
                <li>Opt out of marketing communications</li>
                <li>Request a copy of your data</li>
                <li>Contact us with privacy concerns</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-300 mt-4">
                To make any of these requests, email us from the address you signed up with (see Contact Us below).
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">7. Cookies and Tracking</h2>
              <p className="text-gray-600 dark:text-gray-300">
                We use cookies and similar technologies to improve your experience, analyze usage patterns, and provide 
                personalized content. You can control cookie settings through your browser preferences.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">8. Children's Privacy</h2>
              <p className="text-gray-600 dark:text-gray-300">
                Our service is designed for parents and guardians to plan parties for children. We do not knowingly 
                collect personal information from children under 13 without parental consent.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">9. Changes to This Policy</h2>
              <p className="text-gray-600 dark:text-gray-300">
                We may update this privacy policy from time to time. We will notify you of any changes by posting the new 
                privacy policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">10. Contact Us</h2>
              <p className="text-gray-600 dark:text-gray-300">
                If you have any questions about this Privacy Policy, please contact us at:
              </p>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                Email: magicalbirthdayplanner@gmail.com
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}