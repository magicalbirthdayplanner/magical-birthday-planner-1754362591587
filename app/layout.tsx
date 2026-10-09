import './globals.css';
import { siteUrl } from '@/lib/site-url';
import type { Metadata, Viewport } from 'next';
import { Nunito } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ServiceWorkerRegistrar } from '@/components/app/ServiceWorkerRegistrar';
import { MetaPixel } from '@/components/analytics/MetaPixel';

// One typeface for the whole product. Display headings use the same family (heavier weights), see tailwind.config.ts.
const nunito = Nunito({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: 'Magical Birthday Planner — plan your child’s party in minutes',
    template: '%s · Magical Birthday Planner',
  },
  description:
    'Plan your child’s birthday without spending hours searching. Find party venues and ideas near you, then build the whole party from your phone.',
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
  // Social previews (Facebook, LinkedIn, X, messaging apps). Static image in /public — no runtime rendering.
  openGraph: {
    type: 'website',
    siteName: 'Magical Birthday Planner',
    title: 'Plan your child’s birthday in minutes',
    description: 'Local party venues and ideas, a party plan and RSVPs — matched to your child, your budget and your ZIP code.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Magical Birthday Planner — plan your child’s birthday party in minutes' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Plan your child’s birthday in minutes',
    description: 'Local party venues and ideas, a party plan and RSVPs — matched to your child, your budget and your ZIP code.',
    images: ['/og-image.png'],
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
  return (
    <html lang="en" className={nunito.variable}>
      <body className={nunito.className}>
        <ErrorBoundary>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ErrorBoundary>
        <ServiceWorkerRegistrar />
        <MetaPixel />
      </body>
    </html>
  );
}
