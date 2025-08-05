"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createClientComponentClient } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isSigningOut: boolean
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signInWithGoogle: () => Promise<{ error: any }>
  signInWithFacebook: () => Promise<{ error: any }>
  signInWithApple: () => Promise<{ error: any }>
  signOut: () => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const supabase = createClientComponentClient()

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Error getting session:', error)
      } else {
        setSession(session)
        setUser(session?.user ?? null)
      }
      setLoading(false)
    }

    getSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const signUp = async (email: string, password: string, displayName?: string) => {
    try {
      // First ensure no existing session
      await supabase.auth.signOut()
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
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
      }
      
      return { error: null }
    } catch (error) {
      console.error('Signup failed:', error)
      return { error }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      // First ensure no existing session
      await supabase.auth.signOut()
      
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
      }
      
      return { error: null }
    } catch (error) {
      console.error('Signin failed:', error)
      return { error }
    }
  }

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://cmdqv4mun01sdmp0fv1p76s5z-app.server.ideavo.ai'}/dashboard`
      }
    })
    return { error }
  }

  const signInWithFacebook = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://cmdqv4mun01sdmp0fv1p76s5z-app.server.ideavo.ai'}/dashboard`
      }
    })
    return { error }
  }

  const signInWithApple = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://cmdqv4mun01sdmp0fv1p76s5z-app.server.ideavo.ai'}/dashboard`
      }
    })
    return { error }
  }

  const signOut = async () => {
    if (isSigningOut) return { error: new Error('Signout already in progress') }
    
    try {
      setIsSigningOut(true)
      
      // Clear local state immediately for instant UI update
      setUser(null)
      setSession(null)
      setLoading(false)
      
      // Clear localStorage immediately (synchronously)
      try {
        localStorage.removeItem('partyData')
        localStorage.removeItem('partyChecklist')
        localStorage.removeItem('partyGuests')
        localStorage.removeItem('partyBudget')
        localStorage.removeItem('partyShoppingList')
        // Clear any auth-related localStorage
        localStorage.removeItem('supabase.auth.token')
        localStorage.clear() // Clear all localStorage to ensure clean state
      } catch (localStorageError) {
        console.warn('Failed to clear localStorage:', localStorageError)
      }
      
      // Sign out from Supabase (fire-and-forget for speed)
      supabase.auth.signOut().catch(error => {
        console.warn('Supabase signout warning (non-blocking):', error)
      })
      
      // Force a complete page reload to ensure clean state
      // Using href instead of replace to ensure browser history is correct
      window.location.href = '/'
      
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
    signInWithFacebook,
    signInWithApple,
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