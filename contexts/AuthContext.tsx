"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase-client'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isSigningOut: boolean
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signInWithGoogle: (next?: string) => Promise<{ error: any }>
  signOut: () => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSigningOut, setIsSigningOut] = useState(false)
  // Use the single Supabase client instance

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Error getting session:', error)
          // Don't throw error, just clear state
          setSession(null)
          setUser(null)
        } else {
          console.log('Session loaded:', session ? 'authenticated' : 'not authenticated')
          setSession(session)
          setUser(session?.user ?? null)
        }
      } catch (err) {
        console.error('Failed to get session:', err)
        setSession(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session ? 'authenticated' : 'not authenticated')
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setSession(session)
          setUser(session?.user ?? null)
          
          // Clear localStorage when user signs in to prevent fallback data conflicts
          if (event === 'SIGNED_IN' && typeof window !== 'undefined') {
            try {
              localStorage.removeItem('partyData')
              localStorage.removeItem('partyChecklist')
              localStorage.removeItem('partyGuests')
              localStorage.removeItem('partyGuests_timestamp')
              localStorage.removeItem('partyInvitations')
              localStorage.removeItem('partyInvitations_timestamp')
              localStorage.removeItem('partyBudget')
              localStorage.removeItem('partyShoppingList')
              localStorage.removeItem('demoPartyData')
              console.log('Cleared localStorage on sign-in to prevent data conflicts')
            } catch (error) {
              console.warn('Failed to clear localStorage on sign-in:', error)
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null)
          setUser(null)
        } else {
          setSession(session)
          setUser(session?.user ?? null)
        }
        
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const signUp = async (email: string, password: string, displayName?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${(typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_BASE_URL || '').trim().replace(/\/$/, '')}/auth/callback?next=/home`,
          data: {
            display_name: displayName,
          },
        },
      })
      
      if (error) {
        return { error }
      }
      
      // If signup successful and user is confirmed, update local state
      if (data.user && data.session) {
        setUser(data.user)
        setSession(data.session)
        
        // Clear localStorage to prevent fallback data conflicts
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('partyData')
            localStorage.removeItem('partyChecklist')
            localStorage.removeItem('partyGuests')
            localStorage.removeItem('partyGuests_timestamp')
            localStorage.removeItem('partyInvitations')
            localStorage.removeItem('partyInvitations_timestamp')
            localStorage.removeItem('partyBudget')
            localStorage.removeItem('partyShoppingList')
            localStorage.removeItem('demoPartyData')
            // Clear subscription-related localStorage items
            localStorage.removeItem('hasPurchasedPlan')
            localStorage.removeItem('userSubscriptionPlan')
            localStorage.removeItem('userPlanPurchased')
            localStorage.removeItem('hasValidSubscription')
            localStorage.removeItem('subscriptionPurchaseDate')
          } catch (error) {
            console.warn('Failed to clear localStorage on signup:', error)
          }
        }
      }
      
      return { error: null }
    } catch (error) {
      console.error('Signup failed:', error)
      return { error }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        return { error }
      }
      
      // If signin successful, update local state
      if (data.user && data.session) {
        setUser(data.user)
        setSession(data.session)
        
        // Clear localStorage to prevent fallback data conflicts
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('partyData')
            localStorage.removeItem('partyChecklist')
            localStorage.removeItem('partyGuests')
            localStorage.removeItem('partyGuests_timestamp')
            localStorage.removeItem('partyInvitations')
            localStorage.removeItem('partyInvitations_timestamp')
            localStorage.removeItem('partyBudget')
            localStorage.removeItem('partyShoppingList')
            localStorage.removeItem('demoPartyData')
            // Clear subscription-related localStorage items
            localStorage.removeItem('hasPurchasedPlan')
            localStorage.removeItem('userSubscriptionPlan')
            localStorage.removeItem('userPlanPurchased')
            localStorage.removeItem('hasValidSubscription')
            localStorage.removeItem('subscriptionPurchaseDate')
          } catch (error) {
            console.warn('Failed to clear localStorage on signin:', error)
          }
        }
      }
      
      return { error: null }
    } catch (error) {
      console.error('Signin failed:', error)
      return { error }
    }
  }

  const signInWithGoogle = async (next?: string) => {
    try {
      // Get the current domain for redirect - ensure proper URL formatting
      const baseUrl = typeof window !== 'undefined' 
        ? `${window.location.protocol}//${window.location.host}`
        : (process.env.NEXT_PUBLIC_BASE_URL || '').trim()
      
      // Ensure baseUrl doesn't end with slash and construct proper callback URL
      const cleanBaseUrl = baseUrl.replace(/\/$/, '').trim()
      const redirectTo = `${cleanBaseUrl}/auth/callback${next && next.startsWith('/') && !next.startsWith('//') ? `?next=${encodeURIComponent(next)}` : ''}`
      
      // Validate the redirect URL format
      try {
        new URL(redirectTo)
      } catch (urlError) {
        console.error('❌ Invalid redirect URL format:', redirectTo)
        throw new Error('Invalid redirect URL format')
      }
      
      console.log('🔐 Google OAuth Configuration:')
      console.log('- Current window location:', typeof window !== 'undefined' ? window.location.href : 'SSR')
      console.log('- Base URL:', baseUrl)
      console.log('- Clean Base URL:', cleanBaseUrl)
      console.log('- Redirect URL:', redirectTo)
      console.log('- Environment NEXT_PUBLIC_BASE_URL:', process.env.NEXT_PUBLIC_BASE_URL)
      console.log('- Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
      console.log('⚠️ IMPORTANT: Google should redirect to YOUR app, not directly to Supabase!')
      console.log('⚠️ Expected: <your site origin>/auth/callback')
      console.log('⚠️ NOT: https://hgczncztmdqtfhqimfar.supabase.co/auth/v1/callback')
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          },
          scopes: 'openid email profile'
        }
      })
      
      if (error) {
        console.error('❌ Google OAuth error:', error)
        if (error.message && error.message.includes('site url is improperly formatted')) {
          console.error('Site URL formatting error - this usually means:')
          console.error('1. Redirect URL contains invalid characters')
          console.error('2. Base URL environment variable is malformed')
          console.error('3. Supabase site URL configuration issue')
          console.error('Current redirect URL:', redirectTo)
        }
      } else {
        console.log('✅ Google OAuth initiated successfully', data)
      }
      
      return { error }
    } catch (err) {
      console.error('❌ Google OAuth exception:', err)
      return { error: err }
    }
  }



  const signOut = async () => {
    if (isSigningOut) return { error: new Error('Signout already in progress') }
    
    try {
      setIsSigningOut(true)
      
      // Tell the app shell this sign-out is intentional (not an expired session).
      try {
        sessionStorage.setItem('mbp.signedOut', '1')
      } catch {
        /* storage unavailable */
      }

      // Sign out from Supabase first and wait for completion
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Supabase signout error:', error)
        setIsSigningOut(false)
        return { error }
      }

      // Shared-device hygiene: drop mobile-app state (party draft holds the child's
      // name and ZIP) and the service worker's cached app shell.
      if (typeof window !== 'undefined') {
        try {
          Object.keys(localStorage)
            .filter((k) => k.startsWith('mbp.') && k !== 'mbp.aid')
            .forEach((k) => localStorage.removeItem(k))
        } catch {
          /* storage unavailable */
        }
        if ('caches' in window) {
          caches.keys().then((keys) => keys.filter((k) => k.startsWith('mbp-pages-')).forEach((k) => caches.delete(k))).catch(() => undefined)
        }
      }
      
      // Clear localStorage after successful signout (only on client side)
      // Note: In a future update, we should sync unsaved data to database before clearing
      if (typeof window !== 'undefined') {
        try {
          // Check for unsaved guest data and warn user
          const hasUnsavedGuests = localStorage.getItem('partyGuests');
          const hasUnsavedInvitations = localStorage.getItem('partyInvitations');
          
          if (hasUnsavedGuests || hasUnsavedInvitations) {
            console.warn('SignOut: Clearing localStorage with potential unsaved guest data');
            // TODO: Implement pre-signout sync to database
          }
          
          localStorage.removeItem('partyData')
          localStorage.removeItem('partyChecklist')
          localStorage.removeItem('partyGuests')
          localStorage.removeItem('partyGuests_timestamp')
          localStorage.removeItem('partyInvitations')
          localStorage.removeItem('partyInvitations_timestamp')
          localStorage.removeItem('partyBudget')
          localStorage.removeItem('partyShoppingList')
          // Clear subscription-related localStorage items
          localStorage.removeItem('hasPurchasedPlan')
          localStorage.removeItem('userSubscriptionPlan')
          localStorage.removeItem('userPlanPurchased')
          localStorage.removeItem('hasValidSubscription')
          localStorage.removeItem('subscriptionPurchaseDate')
          // Clear any auth-related localStorage
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('supabase.auth.')) {
              localStorage.removeItem(key)
            }
          })
        } catch (localStorageError) {
          console.warn('Failed to clear localStorage:', localStorageError)
        }
      }
      
      // Clear local state after successful signout
      setUser(null)
      setSession(null)
      setIsSigningOut(false)
      
      return { error: null }
    } catch (error) {
      console.error('Signout failed:', error)
      setIsSigningOut(false)
      return { error }
    }
  }

  const value = {
    user,
    session,
    loading,
    isSigningOut,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}