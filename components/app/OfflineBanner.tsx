'use client'
import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function OfflineBanner() {
  const [offline, setOffline] = useState(false)
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  if (!offline) return null
  return (
    <div role="status" className="sticky top-[calc(var(--app-header-h)+env(safe-area-inset-top))] z-30 flex items-center justify-center gap-2 bg-foreground px-4 py-2 text-sm font-medium text-background">
      <WifiOff className="h-4 w-4" /> You’re offline — changes will fail until you reconnect.
    </div>
  )
}
