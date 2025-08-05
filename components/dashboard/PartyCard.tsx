"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Calendar, Users, CheckCircle, Clock, Edit, X } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

interface Party {
  id: string
  childName: string
  age: number
  date: Date
  theme: string
  guestCount: number
  checkedTasks: number
  totalTasks: number
  status: 'upcoming' | 'completed' | 'cancelled'
}

interface PartyCardProps {
  party: Party
  onEdit?: (partyId: string) => void
  onDelete?: (partyId: string) => void
}

const getThemeColors = (theme: string) => {
  const themeMap: Record<string, string> = {
    superhero: 'from-red-500 to-blue-500',
    princess: 'from-pink-500 to-purple-500',
    dinosaur: 'from-green-500 to-emerald-500',
    space: 'from-purple-500 to-indigo-500',
    safari: 'from-yellow-500 to-orange-500',
    ocean: 'from-blue-500 to-cyan-500',
    pirate: 'from-amber-500 to-red-500',
    unicorn: 'from-pink-500 to-violet-500'
  }
  return themeMap[theme.toLowerCase()] || 'from-gray-400 to-gray-600'
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'upcoming':
      return 'bg-green-100 text-green-800'
    case 'completed':
      return 'bg-blue-100 text-blue-800'
    case 'cancelled':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getDaysUntilParty = (date: Date) => {
  // Validate date object
  if (!date || isNaN(date.getTime())) {
    return 'Invalid date';
  }
  
  try {
    const today = new Date();
    const timeDiff = date.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    if (daysDiff < 0) return 'Past due';
    if (daysDiff === 0) return 'Today!';
    if (daysDiff === 1) return 'Tomorrow';
    return `${daysDiff} days`;
  } catch (error) {
    console.warn('Error calculating days until party:', error);
    return 'Invalid date';
  }
}

export default function PartyCard({ party, onEdit, onDelete }: PartyCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  
  const progressPercentage = party.totalTasks > 0 ? (party.checkedTasks / party.totalTasks) * 100 : 0
  const themeGradient = getThemeColors(party.theme)
  const statusColor = getStatusColor(party.status)
  const daysUntil = getDaysUntilParty(party.date)

  const handleDeleteConfirm = () => {
    if (deleteConfirmation === 'DELETE' && onDelete) {
      onDelete(party.id)
      setIsDeleteDialogOpen(false)
      setDeleteConfirmation('')
    }
  }

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 overflow-hidden dark:bg-slate-800 dark:border-slate-700">
      {/* Theme Header */}
      <div className={`h-3 bg-gradient-to-r ${themeGradient}`} />
      
      <CardHeader className="pb-2 sm:pb-3 px-4 sm:px-6">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">
              {party.childName}'s {party.age}th Birthday
            </CardTitle>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 capitalize mt-1">
              {party.theme} Theme
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${statusColor} text-xs flex-shrink-0`}>
              {party.status}
            </Badge>
            {onDelete && (
              <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-red-600">Delete Party</DialogTitle>
                    <DialogDescription className="space-y-2">
                      <p>You are about to delete {party.childName}'s {party.age}th Birthday party.</p>
                      <p className="font-semibold text-red-600">⚠️ WARNING: This action is irreversible!</p>
                      <p>All party data, guests, invitations, and planning progress will be permanently deleted.</p>
                      <p>To confirm deletion, type <span className="font-mono bg-gray-100 px-1 rounded">DELETE</span> below:</p>
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <input
                      type="text"
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      placeholder="Type DELETE to confirm"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsDeleteDialogOpen(false)
                        setDeleteConfirmation('')
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteConfirm}
                      disabled={deleteConfirmation !== 'DELETE'}
                    >
                      DELETE Party
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6">
        {/* Party Date */}
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-purple-600 flex-shrink-0" />
          <span className="font-medium">{format(party.date, 'MMM dd, yyyy')}</span>
          <span className="text-gray-500 dark:text-gray-400 truncate">• {daysUntil}</span>
        </div>
        
        {/* Guests */}
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <Users className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
          <span className="dark:text-gray-300">{party.guestCount} guests invited</span>
        </div>
        
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <div className="flex items-center gap-1 sm:gap-2">
              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
              <span className="dark:text-gray-300">Planning Progress</span>
            </div>
            <span className="font-medium dark:text-gray-200 text-xs sm:text-sm">
              {party.checkedTasks}/{party.totalTasks} tasks
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {Math.round(progressPercentage)}% complete
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            asChild
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-sm sm:text-base px-3 sm:px-4"
          >
            <Link href={`/party-plan?id=${party.id}`}>
              <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Continue Planning</span>
              <span className="sm:hidden">Continue</span>
            </Link>
          </Button>
          
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(party.id)}
              className="px-2 sm:px-3"
            >
              <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}