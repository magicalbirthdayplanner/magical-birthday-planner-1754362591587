"use client"

import { useEffect } from 'react'

export default function DomainRedirect() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentUrl = window.location.href
      const currentDomain = window.location.hostname
      
      // Define the canonical production domain
      // Only redirect to a canonical host when one is explicitly configured. The former
      // hard-coded domain is no longer owned, so there is NO default.
      const canonicalDomain = (process.env.NEXT_PUBLIC_CANONICAL_HOST || '').trim()
      if (!canonicalDomain) return
      const devDomain = 'cmdqv4mun01sdmp0fv1p76s5z-app.server.ideavo.ai'
      
      const isLocalOrPreview =
        currentDomain.includes('localhost') ||
        currentDomain === '127.0.0.1' ||
        currentDomain.endsWith('.vercel.app') ||
        currentDomain.includes(devDomain)

      // If we're in production and not on the canonical domain, redirect
      if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_DISABLE_DOMAIN_REDIRECT !== 'true') {
        if (currentDomain !== canonicalDomain && !isLocalOrPreview) {
          // Redirect to canonical domain while preserving path and query params
          const canonicalUrl = currentUrl.replace(currentDomain, canonicalDomain)
          window.location.replace(canonicalUrl)
        }
      }
      
      // If we're on development preview domain in production, show a notice
      if (currentDomain === devDomain && process.env.NODE_ENV === 'production') {
        console.warn(`You are on the development preview domain. For the best experience, please visit https://${canonicalDomain}`)
      }
    }
  }, [])

  return null
}