"use client"

import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Progress } from './ui/progress'
import { 
  UserPlus, 
  Mail, 
  Send, 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  MessageSquare,
  Baby,
  User,
  Heart,
  Star,
  PartyPopper,
  Gift,
  Phone,
  Copy,
  Share2,
  QrCode,
  Calendar,
  MapPin,
  Sparkles,
  CheckCircle2,
  X,
  Eye,
  Plus
} from 'lucide-react'

export interface ModernGuest {
  id: string
  name: string
  email?: string
  phone?: string
  type: 'ADULT' | 'CHILD' | 'FAMILY' | 'COUPLE'
  rsvpStatus: 'NOT_SENT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'MAYBE'
  sentAt?: Date
  respondedAt?: Date
  notes?: string
  plusOnes?: number
  dietaryRestrictions?: string
}

interface ModernGuestRSVPProps {
  partyId: string
  childName: string
  partyDate: string
  partyTime: string
  partyLocation: string
  guests?: ModernGuest[]
  onAddGuest?: (guest: Omit<ModernGuest, 'id' | 'rsvpStatus'>) => void
  onSendInvitation?: (guestId: string) => void
  onUpdateRSVP?: (guestId: string, status: ModernGuest['rsvpStatus'], notes?: string) => void
  onDeleteGuest?: (guestId: string) => void
}

export default function ModernGuestRSVP({
  partyId,
  childName,
  partyDate,
  partyTime,
  partyLocation,
  guests = [],
  onAddGuest,
  onSendInvitation,
  onUpdateRSVP,
  onDeleteGuest
}: ModernGuestRSVPProps) {
  const [quickAddName, setQuickAddName] = useState('')
  const [quickAddEmail, setQuickAddEmail] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'declined' | 'maybe'>('all')

  // Calculate statistics
  const totalGuests = guests.length
  const acceptedCount = guests.filter(g => g.rsvpStatus === 'ACCEPTED').length
  const declinedCount = guests.filter(g => g.rsvpStatus === 'DECLINED').length
  const maybeCount = guests.filter(g => g.rsvpStatus === 'MAYBE').length
  const pendingCount = guests.filter(g => ['NOT_SENT', 'SENT'].includes(g.rsvpStatus)).length
  const responseRate = totalGuests > 0 ? ((acceptedCount + declinedCount + maybeCount) / totalGuests * 100) : 0

  // Filter guests based on current filter
  const filteredGuests = guests.filter(guest => {
    switch (filter) {
      case 'pending': return ['NOT_SENT', 'SENT'].includes(guest.rsvpStatus)
      case 'accepted': return guest.rsvpStatus === 'ACCEPTED'
      case 'declined': return guest.rsvpStatus === 'DECLINED'
      case 'maybe': return guest.rsvpStatus === 'MAYBE'
      default: return true
    }
  })

  const handleQuickAdd = () => {
    if (!quickAddName.trim()) return
    
    onAddGuest?.({
      name: quickAddName.trim(),
      email: quickAddEmail.trim() || undefined,
      type: 'ADULT'
    })
    
    setQuickAddName('')
    setQuickAddEmail('')
  }

  const getStatusColor = (status: ModernGuest['rsvpStatus']) => {
    switch (status) {
      case 'ACCEPTED': return 'bg-green-500'
      case 'DECLINED': return 'bg-red-500'
      case 'MAYBE': return 'bg-yellow-500'
      case 'SENT': return 'bg-blue-500'
      default: return 'bg-gray-300'
    }
  }

  const getStatusIcon = (status: ModernGuest['rsvpStatus']) => {
    switch (status) {
      case 'ACCEPTED': return <UserCheck className="w-4 h-4 text-green-600" />
      case 'DECLINED': return <UserX className="w-4 h-4 text-red-600" />
      case 'MAYBE': return <Clock className="w-4 h-4 text-yellow-600" />
      case 'SENT': return <Mail className="w-4 h-4 text-blue-600" />
      default: return <Send className="w-4 h-4 text-gray-500" />
    }
  }

  const getGuestIcon = (type: ModernGuest['type']) => {
    switch (type) {
      case 'CHILD': return <Baby className="w-4 h-4" />
      case 'FAMILY': return <Users className="w-4 h-4" />
      case 'COUPLE': return <Heart className="w-4 h-4" />
      default: return <User className="w-4 h-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero Section with Party Info */}
      <Card className="bg-gradient-to-r from-purple-50 via-pink-50 to-blue-50 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-blue-900/20 border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <PartyPopper className="w-6 h-6 text-purple-600" />
                <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {childName}'s Birthday Party
                </h2>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(partyDate).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{partyTime}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>{partyLocation}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" size="sm">
                <QrCode className="w-4 h-4 mr-2" />
                QR Code
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RSVP Statistics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Guests */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-blue-200 dark:border-blue-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Invited</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{totalGuests}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600 opacity-80" />
            </div>
          </CardContent>
        </Card>

        {/* Accepted */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 border-green-200 dark:border-green-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">Coming</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">{acceptedCount}</p>
              </div>
              <UserCheck className="w-8 h-8 text-green-600 opacity-80" />
            </div>
          </CardContent>
        </Card>

        {/* Declined */}
        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 border-red-200 dark:border-red-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300">Can't Come</p>
                <p className="text-2xl font-bold text-red-900 dark:text-red-100">{declinedCount}</p>
              </div>
              <UserX className="w-8 h-8 text-red-600 opacity-80" />
            </div>
          </CardContent>
        </Card>

        {/* Maybe */}
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-800/30 border-yellow-200 dark:border-yellow-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Maybe</p>
                <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{maybeCount}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600 opacity-80" />
            </div>
          </CardContent>
        </Card>

        {/* Response Rate */}
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border-purple-200 dark:border-purple-700">
          <CardContent className="p-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Response Rate</p>
              <p className="text-xl font-bold text-purple-900 dark:text-purple-100">{Math.round(responseRate)}%</p>
              <Progress value={responseRate} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Add Guest Section */}
      <Card className="border-dashed border-2 border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-600" />
                <span className="font-medium">Quick Add Guest</span>
              </div>
              <div className="flex gap-2 flex-1 max-w-md">
                <Input
                  placeholder="Guest name"
                  value={quickAddName}
                  onChange={(e) => setQuickAddName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
                />
                <Input
                  placeholder="Email (optional)"
                  type="email"
                  value={quickAddEmail}
                  onChange={(e) => setQuickAddEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
                />
                <Button 
                  onClick={handleQuickAdd} 
                  disabled={!quickAddName.trim()}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add with Details
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Guest with Details</DialogTitle>
                </DialogHeader>
                {/* Detailed add form would go here */}
                <div className="space-y-4">
                  <Input placeholder="Full name" />
                  <Input placeholder="Email address" type="email" />
                  <Input placeholder="Phone number" />
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Guest type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADULT">Adult</SelectItem>
                      <SelectItem value="CHILD">Child</SelectItem>
                      <SelectItem value="FAMILY">Family</SelectItem>
                      <SelectItem value="COUPLE">Couple</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={() => setShowAddDialog(false)}>
                      Add Guest
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Filter and View Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({totalGuests})
          </Button>
          <Button
            variant={filter === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('pending')}
          >
            Pending ({pendingCount})
          </Button>
          <Button
            variant={filter === 'accepted' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('accepted')}
          >
            Coming ({acceptedCount})
          </Button>
          <Button
            variant={filter === 'declined' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('declined')}
          >
            Can't Come ({declinedCount})
          </Button>
          {maybeCount > 0 && (
            <Button
              variant={filter === 'maybe' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('maybe')}
            >
              Maybe ({maybeCount})
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            Grid
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            List
          </Button>
        </div>
      </div>

      {/* Guest List */}
      {filteredGuests.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              {filter === 'all' ? 'No guests added yet' : `No ${filter} guests`}
            </h3>
            <p className="text-gray-500 mb-4">
              {filter === 'all' 
                ? 'Add your first guest to start building your party list'
                : `Switch to "All" to see your complete guest list`
              }
            </p>
            {filter === 'all' && (
              <Button 
                onClick={() => setQuickAddName('')} 
                className="bg-purple-600 hover:bg-purple-700"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Your First Guest
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className={`grid gap-4 ${
          viewMode === 'grid' 
            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
            : 'grid-cols-1'
        }`}>
          {filteredGuests.map((guest) => (
            <Card 
              key={guest.id} 
              className={`transition-all duration-200 hover:shadow-lg ${
                guest.rsvpStatus === 'ACCEPTED' ? 'ring-2 ring-green-200 dark:ring-green-800' :
                guest.rsvpStatus === 'DECLINED' ? 'ring-2 ring-red-200 dark:ring-red-800' :
                ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold truncate">{guest.name}</h4>
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        <span>{guest.type === 'ADULT' ? 'Adult' : guest.type === 'CHILD' ? 'Child' : guest.type}</span>
                      </Badge>
                    </div>
                    
                    {guest.email && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate mb-2">{guest.email}</p>
                    )}
                    
                    <div className="flex items-center gap-2">
                      {getStatusIcon(guest.rsvpStatus)}
                      <span className="text-sm font-medium">
                        {guest.rsvpStatus === 'ACCEPTED' ? 'Coming!' :
                         guest.rsvpStatus === 'DECLINED' ? "Can't make it" :
                         guest.rsvpStatus === 'MAYBE' ? 'Maybe' :
                         guest.rsvpStatus === 'SENT' ? 'Invited' :
                         'Not invited yet'}
                      </span>
                    </div>

                    {guest.respondedAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        Responded {new Date(guest.respondedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {guest.rsvpStatus === 'NOT_SENT' && guest.email && (
                      <Button 
                        size="sm" 
                        onClick={() => onSendInvitation?.(guest.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-xs px-3"
                      >
                        <Send className="w-3 h-3 mr-1" />
                        Send Invite
                      </Button>
                    )}
                    
                    {guest.rsvpStatus === 'SENT' && (
                      <Badge variant="outline" className="text-xs">
                        <Mail className="w-3 h-3 mr-1" />
                        Sent
                      </Badge>
                    )}

                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => onDeleteGuest?.(guest.id)}
                      className="p-1 h-8 w-8"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {guest.notes && (
                  <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                    <MessageSquare className="w-3 h-3 inline mr-1" />
                    {guest.notes}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Bulk Actions */}
      {guests.length > 0 && (
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <span className="font-medium">Bulk Actions</span>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={guests.filter(g => g.email && g.rsvpStatus === 'NOT_SENT').length === 0}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send All Invites ({guests.filter(g => g.email && g.rsvpStatus === 'NOT_SENT').length})
                </Button>
                <Button variant="outline" size="sm">
                  <Copy className="w-4 h-4 mr-2" />
                  Export List
                </Button>
                <Button variant="outline" size="sm">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Send Reminder
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}