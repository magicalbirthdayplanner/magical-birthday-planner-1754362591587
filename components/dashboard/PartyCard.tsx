"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Users, CheckCircle, Clock, Edit, Trash2 } from 'lucide-react'
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
  const today = new Date()
  const timeDiff = date.getTime() - today.getTime()
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24))
  
  if (daysDiff < 0) return 'Past due'
  if (daysDiff === 0) return 'Today!'
  if (daysDiff === 1) return 'Tomorrow'
  return `${daysDiff} days`
}

export default function PartyCard({ party, onEdit, onDelete }: PartyCardProps) {
  const progressPercentage = party.totalTasks > 0 ? (party.checkedTasks / party.totalTasks) * 100 : 0
  const themeGradient = getThemeColors(party.theme)
  const statusColor = getStatusColor(party.status)
  const daysUntil = getDaysUntilParty(party.date)

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 overflow-hidden dark:bg-slate-800 dark:border-slate-700">
      {/* Theme Header */}
      <div className={`h-3 bg-gradient-to-r ${themeGradient}`} />
      
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {party.childName}'s {party.age}th Birthday
            </CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-300 capitalize mt-1">
              {party.theme} Theme
            </p>
          </div>
          <Badge className={statusColor}>
            {party.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Party Date */}
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-purple-600" />
          <span className="font-medium">{format(party.date, 'MMM dd, yyyy')}</span>
          <span className="text-gray-500 dark:text-gray-400">• {daysUntil}</span>
        </div>
        
        {/* Guests */}
        <div className="flex items-center gap-2 text-sm">
          <Users className="w-4 h-4 text-blue-600" />
          <span className="dark:text-gray-300">{party.guestCount} guests invited</span>
        </div>
        
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="dark:text-gray-300">Planning Progress</span>
            </div>
            <span className="font-medium dark:text-gray-200">
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
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <Link href={`/party-plan?id=${party.id}`}>
              <Clock className="w-4 h-4 mr-2" />
              Continue Planning
            </Link>
          </Button>
          
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(party.id)}
            >
              <Edit className="w-4 h-4" />
            </Button>
          )}
          
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(party.id)}
              className="text-red-600 hover:text-red-700 hover:border-red-300"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}