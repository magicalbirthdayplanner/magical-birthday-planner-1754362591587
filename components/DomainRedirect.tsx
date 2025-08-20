"use client"

import { useEffect } from 'react'

export default function DomainRedirect() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentUrl = window.location.href
      const currentDomain = window.location.hostname
      
      // Define the canonical production domain
      const canonicalDomain = 'www.magicalbirthdayplanner.com'
      const devDomain = 'cmdqv4mun01sdmp0fv1p76s5z-app.server.ideavo.ai'
      
      // If we're in production and not on the canonical domain, redirect
      if (process.env.NODE_ENV === 'production') {
        if (currentDomain !== canonicalDomain && !currentDomain.includes('localhost') && !currentDomain.includes(devDomain)) {
          // Redirect to canonical domain while preserving path and query params
          const canonicalUrl = currentUrl.replace(currentDomain, canonicalDomain)
          window.location.replace(canonicalUrl)
        }
      }
      
      // If we're on development preview domain in production, show a notice
      if (currentDomain === devDomain && process.env.NODE_ENV === 'production') {
        console.warn('You are on the development preview domain. For the best experience, please visit https://www.magicalbirthdayplanner.com')
      }
    }
  }, [])

  return null
}