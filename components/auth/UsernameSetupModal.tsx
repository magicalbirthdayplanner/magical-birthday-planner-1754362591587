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
import { Loader2, User } from 'lucide-react'
import { supabase } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

interface UsernameSetupModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function UsernameSetupModal({ isOpen, onClose }: UsernameSetupModalProps) {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { user } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) {
      setError('Please enter a username')
      return
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters long')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Update the user's profile with the username
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          full_name: username.trim(),
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
      console.error('Error updating username:', err)
      setError('Failed to update username. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    onClose()
    router.push('/dashboard')
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Set Your Username
          </DialogTitle>
          <DialogDescription>
            Choose a username to personalize your Magical Birthday Planner experience.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={50}
              className="w-full"
            />
            {username && (
              <p className="text-sm text-gray-500">
                Your username will be: <span className="font-medium">{username.trim()}</span>
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
              disabled={loading || !username.trim()}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Set Username'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}