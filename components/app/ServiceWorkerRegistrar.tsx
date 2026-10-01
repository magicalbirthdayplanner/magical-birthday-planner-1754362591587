'use client'
import { useEffect } from 'react'

/** Registers /sw.js in production builds (offline shell + static asset cache). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DISABLE_SW === 'true') return
    if (!('serviceWorker' in navigator)) return
    const register = () => navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined)
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])
  return null
}
