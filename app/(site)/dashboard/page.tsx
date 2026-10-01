"use client"

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Dashboard from '@/components/dashboard/Dashboard'
import { Loader2 } from 'lucide-react'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [checkingParties, setCheckingParties] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin')
    }
  }, [user, loading, router])

  // Check if user has any parties, redirect new users to wizard
  useEffect(() => {
    const checkUserParties = async () => {
      if (!loading && user) {
        try {
          const response = await fetch('/api/user/parties')
          if (response.ok) {
            const data = await response.json()
            if (data.parties && data.parties.length === 0) {
              // New user with no parties - redirect to wizard
              console.log('New user detected with no parties, redirecting to wizard')
              router.push('/create-party')
              return
            }
          }
        } catch (err) {
          console.warn('Failed to check user parties:', err)
        }
        setCheckingParties(false)
      }
    }

    checkUserParties()
  }, [user, loading, router])

  if (loading || checkingParties) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <Dashboard />
}