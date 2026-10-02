import { builderScriptsEnabled } from '@/lib/builder-scripts'
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import DomainRedirect from '@/components/DomainRedirect';
import { ServiceWorkerRegistrar } from '@/components/app/ServiceWorkerRegistrar';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-display', display: 'swap', axes: ['SOFT', 'opsz'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3100')),
  title: {
    default: 'Magical Birthday Planner — plan your child’s party in minutes',
    template: '%s · Magical Birthday Planner',
  },
  description:
    'Plan your child’s birthday without spending hours searching. Find party venues, vendors and ideas near you, then build the whole party from your phone.',
  applicationName: 'Magical Birthday Planner',
  appleWebApp: { capable: true, title: 'Party Planner', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    type: 'website',
    siteName: 'Magical Birthday Planner',
    title: 'Plan your child’s birthday in minutes',
    description: 'Local party venues, vendors and ideas — matched to your child, your budget and your ZIP code.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf8f3' },
    { media: '(prefers-color-scheme: dark)', color: '#1d1631' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const loadBuilderScripts = builderScriptsEnabled()
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className={inter.className}>
        <ErrorBoundary>
          <AuthProvider>
            <DomainRedirect />
            {children}
          </AuthProvider>
        </ErrorBoundary>
        <ServiceWorkerRegistrar />
        {/* TODO: Remove iframe-navigation.js in production, should never be removed by AI */}
        {/* Builder (Ideavo) helpers only outside Vercel deployments: an unpinned third-party
            script must not run next to user sessions in Preview/Production. */}
        {loadBuilderScripts ? (
          <>
            {/* eslint-disable-next-line @next/next/no-sync-scripts */}
            <script src="/scripts/iframe-navigation.js"></script>
            {/* eslint-disable-next-line @next/next/no-sync-scripts */}
            <script src="https://cdn.jsdelivr.net/gh/IdeavoAI/ideavo-scripts@1.0.1/scripts/ideavo.min.js"></script>
          </>
        ) : null}
      </body>
    </html>
  );
}
