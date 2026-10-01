"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import WelcomeSplashScreen from '@/components/auth/WelcomeSplashScreen'
import { Loader2 } from 'lucide-react'

export default function SignupSuccessPage() {
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false)
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (user) {
        // User is authenticated, show welcome screen
        setShowWelcomeScreen(true)
      } else {
        // No user, redirect to signin
        router.push('/signin')
      }
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600 dark:text-gray-300">Setting up your account...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <WelcomeSplashScreen 
        isOpen={showWelcomeScreen} 
        onClose={() => {
          setShowWelcomeScreen(false)
          router.push('/create-party')
        }} 
      />
    </div>
  )
}