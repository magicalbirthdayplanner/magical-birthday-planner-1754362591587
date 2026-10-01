import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/home',
    name: 'Magical Birthday Planner',
    short_name: 'Party Planner',
    description: 'Plan your child’s birthday in minutes — local party places, guests, invitations and a countdown checklist.',
    start_url: '/home?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fbf8f3',
    theme_color: '#fbf8f3',
    categories: ['lifestyle', 'productivity', 'kids'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Discover places', short_name: 'Discover', url: '/discover', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Guests', url: '/guests', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Checklist', url: '/plan/checklist', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
