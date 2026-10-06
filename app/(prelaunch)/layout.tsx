import ErrorBoundary from '@/components/ErrorBoundary'
import { PrelaunchFooter, PrelaunchHeader } from '@/components/prelaunch/PrelaunchChrome'

/**
 * Temporary pre-launch shell (Oct 6–12, 2026). The routing layer (middleware.ts + lib/launch.ts) serves `/`,
 * `/privacy` and `/terms` from here during PRE_LAUNCH; when LIVE these routes redirect to the normal site.
 * Uses the app's design tokens (`.mbp-app`).
 */
export default function PrelaunchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mbp-app min-h-screen bg-background text-foreground">
      <PrelaunchHeader />
      <main className="pt-14 sm:pt-16">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <PrelaunchFooter />
    </div>
  )
}
