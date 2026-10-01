import { ThemeProvider } from '@/contexts/ThemeContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import ErrorBoundary from '@/components/ErrorBoundary';
import SessionSync from '@/components/SessionSync';

/** Marketing site + legacy desktop planner. URLs unchanged from before the route-group split. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SubscriptionProvider>
        <SessionSync />
        <Header />
        <main className="pt-14 sm:pt-16 min-h-screen">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
        <Footer />
      </SubscriptionProvider>
    </ThemeProvider>
  );
}
