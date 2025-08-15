import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import ErrorBoundary from '@/components/ErrorBoundary';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Magical Birthday Planner - AI-Powered Kids Birthday Planner',
  description: 'Create magical birthday parties for kids aged 0-12 with AI-generated suggestions, checklists, and themed inspiration boards.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <ThemeProvider>
            <AuthProvider>
              <SubscriptionProvider>
                <Header />
                <main className="pt-14 sm:pt-16 min-h-screen">
                  <ErrorBoundary>
                    {children}
                  </ErrorBoundary>
                </main>
                <Footer />
              </SubscriptionProvider>
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
        {/* TODO: Remove iframe-navigation.js in production, should never be removed by AI */}
        <script src="/scripts/iframe-navigation.js"></script>
      </body>
    </html>
  );
}
