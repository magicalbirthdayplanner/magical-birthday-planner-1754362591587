"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, Sparkles, User, PartyPopper } from 'lucide-react'
import { supabase } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

interface WelcomeSplashScreenProps {
  isOpen: boolean
  onClose: () => void
}

export default function WelcomeSplashScreen({ isOpen, onClose }: WelcomeSplashScreenProps) {
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'welcome' | 'name'>('welcome')
  const { user } = useAuth()
  const router = useRouter()

  const handleWelcomeNext = () => {
    setStep('name')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) {
      setError('Please enter your full name')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Update the user's profile with the full name
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          full_name: fullName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id)

      if (updateError) {
        throw updateError
      }

      // Close modal and redirect to dashboard
      onClose()
      router.push('/dashboard')
    } catch (err) {
      console.error('Error updating full name:', err)
      setError('Failed to update name. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    onClose()
    router.push('/dashboard')
  }

  if (step === 'welcome') {
    return (
      <Dialog open={isOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
          <div className="text-center space-y-6 py-4">
            {/* Animated Welcome Header */}
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="relative">
                  <PartyPopper className="w-16 h-16 text-purple-600 animate-bounce" />
                  <Sparkles className="w-6 h-6 text-yellow-500 absolute -top-1 -right-1 animate-pulse" />
                </div>
              </div>
              
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Welcome to Magical Birthday Planner!
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-300 mt-2">
                  Your journey to creating unforgettable celebrations starts here
                </p>
              </div>
            </div>

            {/* Features Preview */}
            <div className="space-y-4 text-left">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-lg">
                <h3 className="font-semibold text-purple-700 dark:text-purple-300 mb-2">
                  🎉 What you can do:
                </h3>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                  <li>• Plan amazing birthday parties with AI assistance</li>
                  <li>• Manage guest lists and send invitations</li>
                  <li>• Track budgets and shopping lists</li>
                  <li>• Discover perfect venues and activities</li>
                </ul>
              </div>
            </div>

            {/* Welcome Message */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
              <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                ✨ Ready to make some birthday magic? Let's get you set up!
              </p>
            </div>

            {/* Action Button */}
            <Button
              onClick={handleWelcomeNext}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium py-3"
              size="lg"
            >
              Get Started
              <Sparkles className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Tell us your name
          </DialogTitle>
          <DialogDescription>
            Help us personalize your Magical Birthday Planner experience.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={100}
              className="w-full"
            />
            {fullName && (
              <p className="text-sm text-gray-500">
                We'll call you: <span className="font-medium">{fullName.trim()}</span>
              </p>
            )}
          </div>

          {error && (
            <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/30 p-2 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSkip}
              disabled={loading}
              className="flex-1"
            >
              Skip for now
            </Button>
            <Button
              type="submit"
              disabled={loading || !fullName.trim()}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}