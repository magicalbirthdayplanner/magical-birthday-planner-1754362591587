"use client"

import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Textarea } from './ui/textarea'
import { Progress } from './ui/progress'
import { 
  UserCheck, 
  UserX, 
  Clock, 
  HelpCircle, 
  Mail, 
  Phone, 
  Calendar,
  Users,
  TrendingUp,
  MessageSquare,
  Filter,
  Download,
  Search
} from 'lucide-react'
import { Guest, Invitation } from './GuestList'

interface RSVPStats {
  total: number
  accepted: number
  declined: number
  pending: number
  maybe: number
  responseRate: number
}

interface RSVPTrackerProps {
  partyId: string
  childName: string
  partyDate: string
  guests: Guest[]
  invitations: Invitation[]
  onUpdateRSVP?: (invitationId: string, status: Invitation['status'], notes?: string) => void
  onSendReminder?: (guestId: string, message: string) => void
}

const STATUS_CONFIG = {
  ACCEPTED: {
    label: 'Accepted',
    icon: UserCheck,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    variant: 'default' as const
  },
  DECLINED: {
    label: 'Declined',
    icon: UserX,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    variant: 'destructive' as const
  },
  MAYBE: {
    label: 'Maybe',
    icon: HelpCircle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    variant: 'secondary' as const
  },
  SENT: {
    label: 'Awaiting Response',
    icon: Mail,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    variant: 'outline' as const
  },
  PENDING: {
    label: 'Not Sent',
    icon: Clock,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    variant: 'secondary' as const
  }
}

export default function RSVPTracker({
  partyId,
  childName,
  partyDate,
  guests,
  invitations,
  onUpdateRSVP,
  onSendReminder
}: RSVPTrackerProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [updatingRSVP, setUpdatingRSVP] = useState<string | null>(null)
  const [rsvpNotes, setRsvpNotes] = useState('')
  const [reminderGuest, setReminderGuest] = useState<Guest | null>(null)
  const [reminderMessage, setReminderMessage] = useState('')

  const getInvitationForGuest = (guestId: string) => {
    return invitations.find(inv => inv.guestId === guestId)
  }

  const calculateStats = (): RSVPStats => {
    const total = invitations.length
    const accepted = invitations.filter(inv => inv.status === 'ACCEPTED').length
    const declined = invitations.filter(inv => inv.status === 'DECLINED').length
    const pending = invitations.filter(inv => inv.status === 'PENDING').length
    const maybe = invitations.filter(inv => inv.status === 'MAYBE').length
    const responded = accepted + declined + maybe
    const responseRate = total > 0 ? (responded / total) * 100 : 0

    return {
      total,
      accepted,
      declined,
      pending: pending + invitations.filter(inv => inv.status === 'SENT').length,
      maybe,
      responseRate
    }
  }

  const filterGuests = () => {
    let filtered = guests

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(guest =>
        guest.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        guest.email?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(guest => {
        const invitation = getInvitationForGuest(guest.id)
        return invitation?.status === selectedStatus
      })
    }

    return filtered
  }

  const handleUpdateRSVP = (invitationId: string, newStatus: Invitation['status']) => {
    onUpdateRSVP?.(invitationId, newStatus, rsvpNotes)
    setUpdatingRSVP(null)
    setRsvpNotes('')
  }

  const handleSendReminder = () => {
    if (!reminderGuest) return
    
    onSendReminder?.(reminderGuest.id, reminderMessage)
    setReminderGuest(null)
    setReminderMessage('')
  }

  const exportRSVPData = () => {
    const stats = calculateStats()
    const data = {
      party: `${childName}'s Birthday Party`,
      date: partyDate,
      stats,
      guests: guests.map(guest => {
        const invitation = getInvitationForGuest(guest.id)
        return {
          name: guest.name,
          email: guest.email,
          type: guest.type,
          status: invitation?.status || 'No invitation',
          respondedAt: invitation?.respondedAt,
          notes: invitation?.notes
        }
      })
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${childName}-party-rsvp-report.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const stats = calculateStats()
  const filteredGuests = filterGuests()

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Total Invited</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-sm font-medium">Accepted</p>
                <p className="text-2xl font-bold text-green-600">{stats.accepted}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <UserX className="w-4 h-4 text-red-600" />
              <div>
                <p className="text-sm font-medium">Declined</p>
                <p className="text-2xl font-bold text-red-600">{stats.declined}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <HelpCircle className="w-4 h-4 text-yellow-600" />
              <div>
                <p className="text-sm font-medium">Maybe</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.maybe}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <div>
                <p className="text-sm font-medium">Response Rate</p>
                <p className="text-2xl font-bold text-purple-600">{stats.responseRate.toFixed(0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Response Rate Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Response Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Responses received</span>
              <span>{stats.total - stats.pending} of {stats.total}</span>
            </div>
            <Progress value={stats.responseRate} className="h-2" />
            <p className="text-xs text-gray-600">
              {stats.pending > 0 && `${stats.pending} guests haven't responded yet`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search guests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
          </div>
          
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="ACCEPTED">Accepted</SelectItem>
              <SelectItem value="DECLINED">Declined</SelectItem>
              <SelectItem value="MAYBE">Maybe</SelectItem>
              <SelectItem value="SENT">Awaiting Response</SelectItem>
              <SelectItem value="PENDING">Not Sent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" onClick={exportRSVPData}>
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* RSVP List */}
      <div className="space-y-3">
        {filteredGuests.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No guests match the current filters</p>
            </CardContent>
          </Card>
        ) : (
          filteredGuests.map((guest) => {
            const invitation = getInvitationForGuest(guest.id)
            const statusConfig = invitation ? STATUS_CONFIG[invitation.status] : STATUS_CONFIG.PENDING
            const StatusIcon = statusConfig.icon

            return (
              <Card key={guest.id} className={`${statusConfig.bgColor} ${statusConfig.borderColor}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${statusConfig.bgColor} ${statusConfig.borderColor} border`}>
                          <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{guest.name}</h4>
                              <div className="flex items-center space-x-2 text-sm text-gray-600">
                                {guest.email && (
                                  <div className="flex items-center space-x-1">
                                    <Mail className="w-3 h-3" />
                                    <span>{guest.email}</span>
                                  </div>
                                )}
                                {guest.phone && (
                                  <div className="flex items-center space-x-1">
                                    <Phone className="w-3 h-3" />
                                    <span>{guest.phone}</span>
                                  </div>
                                )}
                              </div>
                              {guest.type === 'CHILD' && guest.age && (
                                <p className="text-xs text-gray-500">Age: {guest.age}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {invitation?.notes && (
                        <div className="mt-3 ml-14">
                          <div className="bg-white p-2 rounded border border-gray-200">
                            <div className="flex items-start space-x-2">
                              <MessageSquare className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-gray-600">{invitation.notes}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {invitation?.respondedAt && (
                        <p className="text-xs text-gray-500 mt-2 ml-14">
                          <Calendar className="w-3 h-3 inline mr-1" />
                          Responded: {(() => {
                            try {
                              const date = new Date(invitation.respondedAt);
                              return isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleDateString();
                            } catch {
                              return 'Invalid date';
                            }
                          })()}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <Badge variant={statusConfig.variant} className="text-xs">
                        {statusConfig.label}
                      </Badge>

                      {invitation && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setUpdatingRSVP(invitation.id)}
                            >
                              Update
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Update RSVP - {guest.name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>RSVP Status</Label>
                                <Select
                                  defaultValue={invitation.status}
                                  onValueChange={(value: Invitation['status']) => 
                                    handleUpdateRSVP(invitation.id, value)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ACCEPTED">Accepted</SelectItem>
                                    <SelectItem value="DECLINED">Declined</SelectItem>
                                    <SelectItem value="MAYBE">Maybe</SelectItem>
                                    <SelectItem value="SENT">Awaiting Response</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div>
                                <Label>Notes</Label>
                                <Textarea
                                  value={rsvpNotes}
                                  onChange={(e) => setRsvpNotes(e.target.value)}
                                  placeholder="Any additional notes from the guest..."
                                  rows={3}
                                />
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}

                      {invitation?.status === 'SENT' && guest.email && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setReminderGuest(guest)}
                            >
                              Remind
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Send Reminder - {guest.name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Reminder Message</Label>
                                <Textarea
                                  value={reminderMessage}
                                  onChange={(e) => setReminderMessage(e.target.value)}
                                  placeholder="Hi! Just a friendly reminder about [child's name]'s birthday party..."
                                  rows={4}
                                />
                              </div>
                              <div className="flex justify-end space-x-2">
                                <Button variant="outline" onClick={() => setReminderGuest(null)}>
                                  Cancel
                                </Button>
                                <Button onClick={handleSendReminder}>
                                  Send Reminder
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Quick Actions */}
      {stats.pending > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                {stats.pending} guests need follow-up
              </Badge>
              <Button size="sm" variant="outline">
                Send Bulk Reminder
              </Button>
              <Button size="sm" variant="outline">
                Mark All as Sent
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}