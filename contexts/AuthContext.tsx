"use client"

import { mutate as mutateAll } from 'swr'
import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase-client'
import { authFailed } from '@/lib/observability/auth'
import { track } from '@/lib/analytics/client'
import { attributionProps } from '@/lib/analytics/attribution'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isSigningOut: boolean
  /** Email a sign-in code. `create`: sign-up (makes the account). `next`: where the link in the same email returns to.
   *  `data`: extra sign-up metadata (e.g. the wizard's party draft, so the party survives opening the link in another
   *  browser). */
  sendEmailCode: (email: string, opts: { create: boolean; displayName?: string; next?: string; data?: Record<string, unknown> }) => Promise<{ error: any }>
  /** Check the emailed code and sign in. `isNewAccount`: this code finished a sign-up (count it once). */
  verifyEmailCode: (email: string, code: string) => Promise<{ error: any; isNewAccount: boolean }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signInWithGoogle: (next?: string) => Promise<{ error: any }>
  signOut: () => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)


/**
 * Shared-device hygiene: remove one user's local app state so the next person on
 * this device never sees it (the party draft holds a child's name and ZIP).
 * Keeps `mbp.aid` (anonymous analytics id), `mbp.attr` (ad campaign tags, no personal data) and, unless
 * `includeAuth`, the session.
 */
function clearLocalUserData(includeAuth: boolean) {
  if (typeof window === 'undefined') return
  try {
    const legacy = ['partyData', 'partyChecklist', 'partyGuests', 'partyGuests_timestamp', 'partyInvitations', 'partyInvitations_timestamp', 'partyBudget', 'partyShoppingList', 'demoPartyData', 'hasPurchasedPlan', 'userSubscriptionPlan', 'userPlanPurchased', 'hasValidSubscription', 'subscriptionPurchaseDate']
    Object.keys(localStorage)
      .filter((k) => (k.startsWith('mbp.') && k !== 'mbp.aid' && k !== 'mbp.attr') || legacy.includes(k) || (includeAuth && k.startsWith('supabase.auth.')))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    /* storage unavailable */
  }
  if ('caches' in window) {
    caches.keys().then((keys) => keys.filter((k) => k.startsWith('mbp-pages-')).forEach((k) => caches.delete(k))).catch(() => undefined)
  }
  // In-memory SWR data (parties, guests…) of the previous user.
  void mutateAll(() => true, undefined, { revalidate: false })
}

/** Old pre-account localStorage keys that must not leak into a signed-in session. */
function clearLegacyPartyStorage() {
  if (typeof window === 'undefined') return
  try {
    for (const k of ['partyData', 'partyChecklist', 'partyGuests', 'partyGuests_timestamp', 'partyInvitations', 'partyInvitations_timestamp', 'partyBudget', 'partyShoppingList', 'demoPartyData', 'hasPurchasedPlan', 'userSubscriptionPlan', 'userPlanPurchased', 'hasValidSubscription', 'subscriptionPurchaseDate']) {
      localStorage.removeItem(k)
    }
  } catch (error) {
    console.warn('Failed to clear localStorage on sign-in:', error)
  }
}

/** Where emailed links return to: /auth/callback, then a same-origin `next` (default /home). */
function callbackUrl(next?: string) {
  const origin = (typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_BASE_URL || '').trim().replace(/\/$/, '')
  const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '/home'
  return `${origin}/auth/callback?next=${encodeURIComponent(safe)}`
}

const LAST_USER_KEY = 'mbp.uid'
const SIGNUP_TRACKED_KEY = 'mbp.gsu'

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
          authFailed('session', error)
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
          
          // A different person signed in on this device (or a previous session expired
          // without sign-out): drop the previous user's local data, keep the new session.
          if (event === 'SIGNED_IN' && typeof window !== 'undefined' && session?.user) {
            try {
              const last = localStorage.getItem(LAST_USER_KEY)
              if (last && last !== session.user.id) clearLocalUserData(false)
              localStorage.setItem(LAST_USER_KEY, session.user.id)
              // A brand-new Google account: the sign-up happened at Google, so record it here (once per account).
              const u = session.user
              if (u.app_metadata?.provider === 'google' && Date.now() - new Date(u.created_at).getTime() < 10 * 60_000 && localStorage.getItem(SIGNUP_TRACKED_KEY) !== u.id) {
                localStorage.setItem(SIGNUP_TRACKED_KEY, u.id)
                track('sign_up', { method: 'google' })
                track('signup_completed', { method: 'google' })
              }
            } catch {
              /* storage unavailable */
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

  /**
   * Email a one-time sign-in code (and a fallback link). `create`: make the account if it doesn't exist yet (sign-up);
   * otherwise only existing accounts get a code. Supabase sends its "Confirm signup" email to a new account and its
   * "Magic Link" email to an existing one — both templates carry {{ .Token }} (supabase/templates/).
   */
  const sendEmailCode = async (email: string, opts: { create: boolean; displayName?: string; next?: string; data?: Record<string, unknown> }) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: opts.create,
          // The link in the same email (opened in another browser) confirms and returns here.
          emailRedirectTo: callbackUrl(opts.next),
          // Only stored when the account is created.
          data: opts.create
            ? {
                ...opts.data,
                display_name: opts.displayName,
                // The ad that brought this parent in (campaign tags only), kept with the account for acquisition reports.
                signup_attribution: attributionProps(),
              }
            : undefined,
        },
      })
      if (error) authFailed('email_code_send', error)
      return { error }
    } catch (error) {
      authFailed('email_code_send', error)
      return { error }
    }
  }

  /** Check the emailed code. Confirms a new account's email (which also claims a founding seat) and signs in. */
  const verifyEmailCode = async (email: string, code: string) => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
      if (error) {
        authFailed('email_code_verify', error)
        return { error, isNewAccount: false }
      }
      if (data.user && data.session) {
        setUser(data.user)
        setSession(data.session)
        clearLegacyPartyStorage()
      }
      // New = created within the code's lifetime (1 h) and not yet counted on this device; an existing account that
      // used the sign-up form is a sign-in.
      let isNewAccount = false
      const u = data.user
      if (u && Date.now() - new Date(u.created_at).getTime() < 2 * 3_600_000) {
        try {
          isNewAccount = localStorage.getItem(SIGNUP_TRACKED_KEY) !== u.id
          localStorage.setItem(SIGNUP_TRACKED_KEY, u.id)
        } catch {
          isNewAccount = true
        }
      }
      return { error: null, isNewAccount }
    } catch (error) {
      authFailed('email_code_verify', error)
      return { error, isNewAccount: false }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        authFailed('login', error)
        return { error }
      }
      
      // If signin successful, update local state
      if (data.user && data.session) {
        setUser(data.user)
        setSession(data.session)
        
        clearLegacyPartyStorage()
      }
      
      return { error: null }
    } catch (error) {
      console.error('Signin failed:', error)
      authFailed('login', error)
      return { error }
    }
  }

  const signInWithGoogle = async (next?: string) => {
    try {
      // Same-origin return path only; tokens come back to /auth/callback and on to `next`.
      const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '/home'
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safe)}`
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, queryParams: { access_type: 'offline', prompt: 'consent' }, scopes: 'openid email profile' },
      })
      if (error) {
        console.warn('Google sign-in failed to start', error.name)
        authFailed('google', error)
      }
      return { error }
    } catch (err) {
      authFailed('google', err)
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

      // Revoke the session server-side; if that fails (offline, flaky network) still end
      // the session on THIS device — a parent must never think they're signed out when not.
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.warn('Global sign-out failed; signing out locally', error.name)
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
      }
      clearLocalUserData(true)

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
    sendEmailCode,
    verifyEmailCode,
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