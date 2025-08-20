"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@/lib/supabase'

export default function SessionSync() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return

    const syncSession = async () => {
      try {
        // Check for session across domains
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Session sync error:', error)
          return
        }

        // If we have a session, ensure cookies are properly set for both domains
        if (session) {
          // Refresh the session to ensure proper cookie configuration
          await supabase.auth.refreshSession()
          
          console.log('Session synchronized across domains')
        }
        
        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            // Force a router refresh to update server-side session
            router.refresh()
          } else if (event === 'SIGNED_OUT') {
            router.refresh()
          }
        })

        return () => {
          subscription.unsubscribe()
        }
      } catch (error) {
        console.error('Session sync failed:', error)
      }
    }

    syncSession()
  }, [router, supabase])

  return null
}