import type { Metadata, Viewport } from 'next'
import { santaUrl } from '@/lib/site-url'

const title = 'Magical Santa — a video call with Santa, made just for your child'
const description = 'Santa knows your child’s name, what they love and what they’re proud of — and talks back, live. No app needed: works on any phone or tablet. From $4.99, no subscription.'

export const metadata: Metadata = {
  metadataBase: new URL(santaUrl()),
  manifest: '/brands/holidays/manifest.webmanifest',
  title: { default: title, template: '%s · Magical Santa' },
  description,
  applicationName: 'Magical Santa',
  appleWebApp: { capable: true, title: 'Magical Santa', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/brands/holidays/favicon.ico', sizes: 'any' }, { url: '/brands/holidays/icons/icon-192.png', type: 'image/png', sizes: '192x192' }],
    apple: [{ url: '/brands/holidays/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: { type: 'website', siteName: 'Magical Santa', title, description, images: [{ url: '/brands/holidays/art/og-santa.jpg', width: 1200, height: 630, alt: 'Santa waving hello from the North Pole' }] },
  twitter: { card: 'summary_large_image', title, description, images: ['/brands/holidays/art/og-santa.jpg'] },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#fbf6ec' }

/** Magical Santa pages: mobile-first, one centred phone-width column on larger screens. */
export default function SantaLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-[#efe6d6]">{children}</div>
}
