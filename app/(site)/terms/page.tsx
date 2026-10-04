export default function TermsConditionsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">Terms & Conditions</h1>
          
          <div className="prose prose-gray dark:prose-invert max-w-none">
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              <strong>Last updated:</strong> {new Date().toLocaleDateString()}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-600 dark:text-gray-300">
                By accessing and using Magical Birthday Planner, you accept and agree to be bound by the terms and 
                provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">2. Description of Service</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Magical Birthday Planner is an AI-powered platform that helps parents plan birthday parties for children. 
                Our services include:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>AI-generated theme recommendations and party planning suggestions</li>
                <li>Guest management and invitation systems</li>
                <li>Activity planning and timeline management</li>
                <li>Shopping recommendations and vendor suggestions</li>
                <li>Budget tracking and planning tools</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">3. User Accounts</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                To use our service, you must:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>Provide accurate and complete registration information</li>
                <li>Maintain the security of your password and account</li>
                <li>Be responsible for all activities that occur under your account</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">4. Plans and Billing</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Our service offers a free plan and three paid plans:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>Free: create a party, discover and save venues, checklist, curated themes and your party plan</li>
                <li>Starter ($4.99): adds guests &amp; RSVP and AI planning features</li>
                <li>Plus ($9.99): adds AI organization features</li>
                <li>Pro ($14.99): adds AI party-day features</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-300 mt-4">
                Paid plans are a one-time payment, not a subscription, and unlock the plan&apos;s features on your account. AI features are subject
                to the per-party and fair-use limits shown on the pricing page. All fees are non-refundable except as required by law.
                We reserve the right to change our pricing with 30 days' notice.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">5. Acceptable Use</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                You agree not to use the service to:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>Upload or share illegal, harmful, or inappropriate content</li>
                <li>Violate any applicable laws or regulations</li>
                <li>Interfere with or disrupt the service or servers</li>
                <li>Attempt to gain unauthorized access to the platform</li>
                <li>Use the service for commercial purposes without permission</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">6. Intellectual Property</h2>
              <p className="text-gray-600 dark:text-gray-300">
                The service and its original content, features, and functionality are owned by Magical Birthday Planner 
                and are protected by international copyright, trademark, patent, trade secret, and other intellectual 
                property laws.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">7. User Content</h2>
              <p className="text-gray-600 dark:text-gray-300">
                You retain ownership of any content you submit to our service. By submitting content, you grant us a 
                non-exclusive, worldwide license to use, display, and distribute your content solely for the purpose 
                of providing our services.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">8. AI-Generated Content</h2>
              <p className="text-gray-600 dark:text-gray-300">
                Our platform uses AI to generate party recommendations and suggestions. While we strive for accuracy, 
                AI-generated content is provided "as is" and you should use your own judgment when implementing suggestions.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">9. Limitation of Liability</h2>
              <p className="text-gray-600 dark:text-gray-300">
                In no event shall Magical Birthday Planner be liable for any indirect, incidental, special, consequential, 
                or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible 
                losses resulting from your use of the service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">10. Termination</h2>
              <p className="text-gray-600 dark:text-gray-300">
                We may terminate or suspend your account and access to the service immediately, without prior notice or 
                liability, under our sole discretion, for any reason whatsoever, including breach of these Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">11. Changes to Terms</h2>
              <p className="text-gray-600 dark:text-gray-300">
                We reserve the right to modify or replace these Terms at any time. If a revision is material, we will 
                provide at least 30 days' notice prior to any new terms taking effect.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">12. Governing Law</h2>
              <p className="text-gray-600 dark:text-gray-300">
                These Terms shall be interpreted and governed by the laws of [Your Jurisdiction], without regard to its 
                conflict of law provisions.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">13. Contact Information</h2>
              <p className="text-gray-600 dark:text-gray-300">
                If you have any questions about these Terms & Conditions, please contact us at:
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