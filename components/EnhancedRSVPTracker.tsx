"use client"

import { useState, useEffect } from 'react'
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
import { Alert, AlertDescription } from './ui/alert'
import { Separator } from './ui/separator'
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
  Search,
  BarChart3,
  PieChart,
  Activity,
  Link,
  Copy,
  Send,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  Eye,
  EyeOff,
  Globe,
  Smartphone,
  Star,
  Tag,
  FileText,
  ExternalLink,
  QrCode,
  Share2,
  Bell,
  BellOff,
  Timer,
  Target,
  Percent,
  Info
} from 'lucide-react'
import { Guest, Invitation } from './EnhancedGuestList'

interface RSVPStats {
  total: number
  sent: number
  delivered: number
  opened: number
  accepted: number
  declined: number
  maybe: number
  pending: number
  bounced: number
  failed: number
  responseRate: number
  openRate: number
  deliveryRate: number
  avgResponseTime: number
}

interface RSVPAnalytics {
  totalViews: number
  uniqueViews: number
  clickThroughs: number
  conversionRate: number
  popularTimes: { hour: number; count: number }[]
  deviceBreakdown: { device: string; count: number }[]
  locationData: { country: string; count: number }[]
  timeToResponse: number[]
}

interface EnhancedRSVPTrackerProps {
  partyId: string
  childName: string
  partyDate: string
  guests: Guest[]
  invitations: Invitation[]
  currentPlan: string
  analytics?: RSVPAnalytics
  onUpdateRSVP?: (invitationId: string, status: Invitation['status'], notes?: string) => void
  onSendReminder?: (guestIds: string[], message: string) => void
  onGenerateQR?: (invitationId: string) => Promise<string>
  onToggleNotifications?: (invitationId: string, enabled: boolean) => void
  onExportAnalytics?: () => void
  onBulkUpdateStatus?: (invitationIds: string[], status: Invitation['status']) => void
}

const STATUS_CONFIG = {
  ACCEPTED: {
    label: 'Accepted',
    icon: UserCheck,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    variant: 'default' as const,
    priority: 1
  },
  DECLINED: {
    label: 'Declined',
    icon: UserX,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    variant: 'destructive' as const,
    priority: 2
  },
  MAYBE: {
    label: 'Maybe',
    icon: HelpCircle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    variant: 'secondary' as const,
    priority: 3
  },
  OPENED: {
    label: 'Opened',
    icon: Eye,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    variant: 'outline' as const,
    priority: 4
  },
  DELIVERED: {
    label: 'Delivered',
    icon: CheckCircle2,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    variant: 'outline' as const,
    priority: 5
  },
  SENT: {
    label: 'Sent',
    icon: Mail,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    variant: 'outline' as const,
    priority: 6
  },
  BOUNCED: {
    label: 'Bounced',
    icon: AlertTriangle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    variant: 'destructive' as const,
    priority: 7
  },
  FAILED: {
    label: 'Failed',
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    variant: 'destructive' as const,
    priority: 8
  },
  PENDING: {
    label: 'Not Sent',
    icon: Clock,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    variant: 'secondary' as const,
    priority: 9
  }
}

const PLAN_FEATURES = {
  FREE: { 
    analytics: false, 
    reminders: 1, 
    qrCodes: false, 
    customLinks: false,
    bulkActions: false,
    notifications: false
  },
  STARTER: { 
    analytics: true, 
    reminders: 5, 
    qrCodes: false, 
    customLinks: true,
    bulkActions: true,
    notifications: true
  },
  PROFESSIONAL: { 
    analytics: true, 
    reminders: -1, 
    qrCodes: true, 
    customLinks: true,
    bulkActions: true,
    notifications: true
  }
}

export default function EnhancedRSVPTracker({
  partyId,
  childName,
  partyDate,
  guests,
  invitations,
  currentPlan = 'FREE',
  analytics,
  onUpdateRSVP,
  onSendReminder,
  onGenerateQR,
  onToggleNotifications,
  onExportAnalytics,
  onBulkUpdateStatus
}: EnhancedRSVPTrackerProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedInvitations, setSelectedInvitations] = useState<string[]>([])
  const [updatingRSVP, setUpdatingRSVP] = useState<string | null>(null)
  const [rsvpNotes, setRsvpNotes] = useState('')
  const [reminderGuests, setReminderGuests] = useState<Guest[]>([])
  const [reminderMessage, setReminderMessage] = useState('')
  const [qrCodes, setQrCodes] = useState<{ [invitationId: string]: string }>({})
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'analytics'>('list')
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'date' | 'priority'>('priority')
  
  const planFeatures = PLAN_FEATURES[currentPlan as keyof typeof PLAN_FEATURES]

  const getInvitationForGuest = (guestId: string) => {
    return invitations.find(inv => inv.guestId === guestId)
  }

  const calculateStats = (): RSVPStats => {
    const total = invitations.length
    const sent = invitations.filter(inv => inv.status !== 'PENDING').length
    const delivered = invitations.filter(inv => inv.status === 'DELIVERED' || inv.status === 'OPENED' || inv.status === 'ACCEPTED' || inv.status === 'DECLINED' || inv.status === 'MAYBE').length
    const opened = invitations.filter(inv => inv.status === 'OPENED' || inv.status === 'ACCEPTED' || inv.status === 'DECLINED' || inv.status === 'MAYBE').length
    const accepted = invitations.filter(inv => inv.status === 'ACCEPTED').length
    const declined = invitations.filter(inv => inv.status === 'DECLINED').length
    const maybe = invitations.filter(inv => inv.status === 'MAYBE').length
    const pending = invitations.filter(inv => inv.status === 'PENDING').length
    const bounced = invitations.filter(inv => inv.status === 'BOUNCED').length
    const failed = invitations.filter(inv => inv.status === 'FAILED').length
    
    const responded = accepted + declined + maybe
    const responseRate = total > 0 ? (responded / total) * 100 : 0
    const openRate = sent > 0 ? (opened / sent) * 100 : 0
    const deliveryRate = sent > 0 ? (delivered / sent) * 100 : 0
    
    // Calculate average response time
    const responseTimes = invitations
      .filter(inv => inv.respondedAt && inv.sentAt)
      .map(inv => {
        const sent = new Date(inv.sentAt!).getTime()
        const responded = new Date(inv.respondedAt!).getTime()
        return (responded - sent) / (1000 * 60 * 60) // hours
      })
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0

    return {
      total,
      sent,
      delivered,
      opened,
      accepted,
      declined,
      maybe,
      pending,
      bounced,
      failed,
      responseRate,
      openRate,
      deliveryRate,
      avgResponseTime
    }
  }

  const filterAndSortInvitations = () => {
    let filtered = invitations

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(inv => {
        const guest = guests.find(g => g.id === inv.guestId)
        return guest && (
          guest.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          guest.email?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      })
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(inv => inv.status === selectedStatus)
    }

    // Sort invitations
    filtered.sort((a, b) => {
      const guestA = guests.find(g => g.id === a.guestId)
      const guestB = guests.find(g => g.id === b.guestId)
      
      switch (sortBy) {
        case 'name':
          return (guestA?.name || '').localeCompare(guestB?.name || '')
        case 'status':
          const priorityA = STATUS_CONFIG[a.status]?.priority || 10
          const priorityB = STATUS_CONFIG[b.status]?.priority || 10
          return priorityA - priorityB
        case 'date':
          const dateA = a.respondedAt || a.sentAt || new Date(0)
          const dateB = b.respondedAt || b.sentAt || new Date(0)
          return (new Date(dateB).getTime()) - (new Date(dateA).getTime())
        case 'priority':
          // VIP first, then by status priority
          const isVipA = guestA?.isVip ? 0 : 1
          const isVipB = guestB?.isVip ? 0 : 1
          if (isVipA !== isVipB) return isVipA - isVipB
          return (STATUS_CONFIG[a.status]?.priority || 10) - (STATUS_CONFIG[b.status]?.priority || 10)
        default:
          return 0
      }
    })

    return filtered
  }

  const handleUpdateRSVP = (invitationId: string, newStatus: Invitation['status']) => {
    onUpdateRSVP?.(invitationId, newStatus, rsvpNotes)
    setUpdatingRSVP(null)
    setRsvpNotes('')
  }

  const handleBulkReminder = () => {
    if (reminderGuests.length === 0) return
    
    onSendReminder?.(reminderGuests.map(g => g.id), reminderMessage)
    setReminderGuests([])
    setReminderMessage('')
  }

  const handleBulkStatusUpdate = (status: Invitation['status']) => {
    if (selectedInvitations.length === 0) return
    
    onBulkUpdateStatus?.(selectedInvitations, status)
    setSelectedInvitations([])
  }

  const handleGenerateQR = async (invitationId: string) => {
    if (!onGenerateQR) return
    
    try {
      const qrCode = await onGenerateQR(invitationId)
      setQrCodes(prev => ({ ...prev, [invitationId]: qrCode }))
    } catch (error) {
      console.error('Failed to generate QR code:', error)
    }
  }

  const exportRSVPData = () => {
    const stats = calculateStats()
    const data = {
      party: `${childName}'s Birthday Party`,
      date: partyDate,
      stats,
      analytics,
      invitations: invitations.map(inv => {
        const guest = guests.find(g => g.id === inv.guestId)
        return {
          guestName: guest?.name,
          email: guest?.email,
          phone: guest?.phone,
          type: guest?.type,
          isVip: guest?.isVip,
          status: inv.status,
          sentAt: inv.sentAt,
          respondedAt: inv.respondedAt,
          reminderCount: inv.reminderCount,
          notes: inv.notes
        }
      })
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${childName}-party-rsvp-analytics-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getPendingReminders = () => {
    return invitations.filter(inv => 
      inv.status === 'SENT' || inv.status === 'DELIVERED' || inv.status === 'OPENED'
    )
  }

  const getOverdueInvitations = () => {
    const today = new Date()
    const partyDateObj = new Date(partyDate)
    const daysToParty = Math.ceil((partyDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    return invitations.filter(inv => {
      if (inv.status !== 'SENT' && inv.status !== 'DELIVERED' && inv.status !== 'OPENED') return false
      
      const sentDate = inv.sentAt ? new Date(inv.sentAt) : null
      if (!sentDate) return false
      
      const daysSinceSent = Math.ceil((today.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24))
      
      // Consider overdue if sent more than 7 days ago and party is more than 3 days away
      return daysSinceSent > 7 && daysToParty > 3
    })
  }

  const stats = calculateStats()
  const filteredInvitations = filterAndSortInvitations()
  const pendingReminders = getPendingReminders()
  const overdueInvitations = getOverdueInvitations()

  return (
    <div className="space-y-6">
      {/* Enhanced Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Total Invited</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-100 rounded-full -mr-8 -mt-8 opacity-20" />
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-sm font-medium">Accepted</p>
                <p className="text-2xl font-bold text-green-600">{stats.accepted}</p>
                <p className="text-xs text-gray-500">
                  {stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0}%
                </p>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-16 h-16 bg-green-100 rounded-full -mr-8 -mt-8 opacity-20" />
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <UserX className="w-4 h-4 text-red-600" />
              <div>
                <p className="text-sm font-medium">Declined</p>
                <p className="text-2xl font-bold text-red-600">{stats.declined}</p>
                <p className="text-xs text-gray-500">
                  {stats.total > 0 ? Math.round((stats.declined / stats.total) * 100) : 0}%
                </p>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-16 h-16 bg-red-100 rounded-full -mr-8 -mt-8 opacity-20" />
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="w-4 h-4 text-purple-600" />
              <div>
                <p className="text-sm font-medium">Response Rate</p>
                <p className="text-2xl font-bold text-purple-600">{stats.responseRate.toFixed(1)}%</p>
                <p className="text-xs text-gray-500">
                  {stats.accepted + stats.declined + stats.maybe} responded
                </p>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-16 h-16 bg-purple-100 rounded-full -mr-8 -mt-8 opacity-20" />
          </CardContent>
        </Card>

        {planFeatures.analytics && (
          <>
            <Card className="relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Eye className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">Open Rate</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.openRate.toFixed(1)}%</p>
                    <p className="text-xs text-gray-500">{stats.opened} opened</p>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-100 rounded-full -mr-8 -mt-8 opacity-20" />
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Timer className="w-4 h-4 text-indigo-600" />
                  <div>
                    <p className="text-sm font-medium">Avg Response</p>
                    <p className="text-2xl font-bold text-indigo-600">
                      {stats.avgResponseTime > 0 ? `${stats.avgResponseTime.toFixed(1)}h` : '—'}
                    </p>
                    <p className="text-xs text-gray-500">response time</p>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-100 rounded-full -mr-8 -mt-8 opacity-20" />
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Response Progress and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Activity className="w-4 h-4 mr-2" />
              Response Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Responses received</span>
                <span>{stats.accepted + stats.declined + stats.maybe} of {stats.total}</span>
              </div>
              <Progress value={stats.responseRate} className="h-3" />
              
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <div className="w-3 h-3 bg-green-500 rounded mx-auto mb-1" />
                  <span>Accepted: {stats.accepted}</span>
                </div>
                <div className="text-center">
                  <div className="w-3 h-3 bg-yellow-500 rounded mx-auto mb-1" />
                  <span>Maybe: {stats.maybe}</span>
                </div>
                <div className="text-center">
                  <div className="w-3 h-3 bg-red-500 rounded mx-auto mb-1" />
                  <span>Declined: {stats.declined}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Bell className="w-4 h-4 mr-2" />
              Action Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueInvitations.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {overdueInvitations.length} invitations need follow-up
                  </AlertDescription>
                </Alert>
              )}
              
              {stats.pending > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center">
                    <Clock className="w-3 h-3 mr-1 text-gray-500" />
                    {stats.pending} not sent yet
                  </span>
                  <Badge variant="outline">{stats.pending}</Badge>
                </div>
              )}
              
              {pendingReminders.length > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center">
                    <RefreshCw className="w-3 h-3 mr-1 text-blue-500" />
                    {pendingReminders.length} awaiting response
                  </span>
                  <Badge variant="outline">{pendingReminders.length}</Badge>
                </div>
              )}
              
              {stats.bounced + stats.failed > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center">
                    <AlertTriangle className="w-3 h-3 mr-1 text-red-500" />
                    {stats.bounced + stats.failed} delivery issues
                  </span>
                  <Badge variant="destructive">{stats.bounced + stats.failed}</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex flex-wrap gap-2">
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
              <SelectItem value="OPENED">Opened</SelectItem>
              <SelectItem value="DELIVERED">Delivered</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="BOUNCED">Bounced</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="PENDING">Not Sent</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="date">Date</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <FileText className="w-3 h-3" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <BarChart3 className="w-3 h-3" />
            </Button>
            {planFeatures.analytics && (
              <Button
                variant={viewMode === 'analytics' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('analytics')}
              >
                <PieChart className="w-3 h-3" />
              </Button>
            )}
          </div>
          
          <Button variant="outline" onClick={exportRSVPData}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {planFeatures.bulkActions && selectedInvitations.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Badge variant="outline">{selectedInvitations.length} selected</Badge>
                <div className="flex space-x-2">
                  <Button size="sm" onClick={() => handleBulkStatusUpdate('ACCEPTED')}>
                    <UserCheck className="w-3 h-3 mr-1" />
                    Mark Accepted
                  </Button>
                  <Button size="sm" onClick={() => handleBulkStatusUpdate('DECLINED')}>
                    <UserX className="w-3 h-3 mr-1" />
                    Mark Declined
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Send className="w-3 h-3 mr-1" />
                        Send Reminder
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Send Bulk Reminder</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Reminder Message</Label>
                          <Textarea
                            value={reminderMessage}
                            onChange={(e) => setReminderMessage(e.target.value)}
                            placeholder="Hi! Just a friendly reminder about the party..."
                            rows={4}
                          />
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button variant="outline">Cancel</Button>
                          <Button onClick={handleBulkReminder}>
                            Send to {selectedInvitations.length} guests
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedInvitations([])}
              >
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {viewMode === 'analytics' && planFeatures.analytics && analytics ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" />
              Advanced Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{analytics.totalViews}</p>
                <p className="text-sm text-gray-600">Total Views</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{analytics.uniqueViews}</p>
                <p className="text-sm text-gray-600">Unique Views</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{analytics.clickThroughs}</p>
                <p className="text-sm text-gray-600">Click Throughs</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{analytics.conversionRate.toFixed(1)}%</p>
                <p className="text-sm text-gray-600">Conversion Rate</p>
              </div>
            </div>
            
            <Separator className="my-6" />
            
            <div className="space-y-4">
              <h4 className="font-medium">Device Breakdown</h4>
              {analytics.deviceBreakdown.map(device => (
                <div key={device.device} className="flex items-center justify-between">
                  <span className="text-sm">{device.device}</span>
                  <Badge variant="outline">{device.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredInvitations.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No invitations match the current filters</p>
                <p className="text-sm text-gray-500 mt-1">
                  Try adjusting your search or filter criteria
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredInvitations.map((invitation) => {
              const guest = guests.find(g => g.id === invitation.guestId)
              if (!guest) return null
              
              const statusConfig = STATUS_CONFIG[invitation.status] || STATUS_CONFIG.PENDING
              const StatusIcon = statusConfig.icon
              const isSelected = selectedInvitations.includes(invitation.id)
              const qrCode = qrCodes[invitation.id]

              return (
                <Card 
                  key={invitation.id} 
                  className={`${statusConfig.bgColor} ${statusConfig.borderColor} ${
                    isSelected ? 'ring-2 ring-blue-500' : ''
                  } ${guest.isVip ? 'shadow-md border-l-4 border-l-yellow-500' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {planFeatures.bulkActions && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedInvitations(prev => [...prev, invitation.id])
                              } else {
                                setSelectedInvitations(prev => prev.filter(id => id !== invitation.id))
                              }
                            }}
                            className="rounded"
                          />
                        )}
                        
                        <div className={`p-3 rounded-full ${statusConfig.bgColor} ${statusConfig.borderColor} border-2`}>
                          <StatusIcon className={`w-5 h-5 ${statusConfig.color}`} />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium">{guest.name}</h4>
                            {guest.isVip && (
                              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            )}
                            {guest.tags && guest.tags.map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                <Tag className="w-2 h-2 mr-1" />
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          
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
                          
                          <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                            {invitation.sentAt && (
                              <span className="flex items-center">
                                <Send className="w-3 h-3 mr-1" />
                                Sent: {new Date(invitation.sentAt).toLocaleDateString()}
                              </span>
                            )}
                            {invitation.respondedAt && (
                              <span className="flex items-center">
                                <Calendar className="w-3 h-3 mr-1" />
                                Responded: {new Date(invitation.respondedAt).toLocaleDateString()}
                              </span>
                            )}
                            {invitation.reminderCount && invitation.reminderCount > 0 && (
                              <span className="flex items-center">
                                <Bell className="w-3 h-3 mr-1" />
                                {invitation.reminderCount} reminders
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Badge variant={statusConfig.variant} className="text-xs">
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConfig.label}
                        </Badge>

                        {planFeatures.qrCodes && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => !qrCode && handleGenerateQR(invitation.id)}
                              >
                                <QrCode className="w-3 h-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>QR Code - {guest.name}</DialogTitle>
                              </DialogHeader>
                              <div className="text-center space-y-4">
                                {qrCode ? (
                                  <>
                                    <img src={qrCode} alt="RSVP QR Code" className="mx-auto" />
                                    <p className="text-sm text-gray-600">
                                      Guests can scan this QR code to RSVP instantly
                                    </p>
                                  </>
                                ) : (
                                  <p>Generating QR code...</p>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
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
                                    <SelectItem value="SENT">Sent</SelectItem>
                                    <SelectItem value="DELIVERED">Delivered</SelectItem>
                                    <SelectItem value="OPENED">Opened</SelectItem>
                                    <SelectItem value="BOUNCED">Bounced</SelectItem>
                                    <SelectItem value="FAILED">Failed</SelectItem>
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

                        {(invitation.status === 'SENT' || invitation.status === 'DELIVERED' || invitation.status === 'OPENED') && guest.email && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="outline"
                                disabled={planFeatures.reminders > 0 && (invitation.reminderCount || 0) >= planFeatures.reminders}
                              >
                                <RefreshCw className="w-3 h-3" />
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
                                    placeholder="Hi! Just a friendly reminder about the party..."
                                    rows={4}
                                  />
                                </div>
                                
                                {planFeatures.reminders > 0 && (
                                  <Alert>
                                    <Info className="h-4 w-4" />
                                    <AlertDescription>
                                      {invitation.reminderCount || 0} of {planFeatures.reminders} reminders used
                                    </AlertDescription>
                                  </Alert>
                                )}
                                
                                <div className="flex justify-end space-x-2">
                                  <Button variant="outline">Cancel</Button>
                                  <Button 
                                    onClick={() => {
                                      onSendReminder?.([guest.id], reminderMessage)
                                      setReminderMessage('')
                                    }}
                                  >
                                    Send Reminder
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </div>

                    {invitation.notes && (
                      <div className="mt-3 ml-16">
                        <div className="bg-white p-3 rounded border border-gray-200">
                          <div className="flex items-start space-x-2">
                            <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-gray-600">{invitation.notes}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      )}

      {/* Quick Actions Footer */}
      {(pendingReminders.length > 0 || overdueInvitations.length > 0) && (
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium flex items-center">
                  <Zap className="w-4 h-4 mr-2 text-blue-500" />
                  Quick Actions
                </h4>
                <p className="text-sm text-gray-600">
                  {overdueInvitations.length > 0 && `${overdueInvitations.length} overdue · `}
                  {pendingReminders.length} awaiting response
                </p>
              </div>
              
              <div className="flex space-x-2">
                {overdueInvitations.length > 0 && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      const overdueGuests = overdueInvitations
                        .map(inv => guests.find(g => g.id === inv.guestId))
                        .filter(Boolean) as Guest[]
                      setReminderGuests(overdueGuests)
                    }}
                  >
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Follow Up Overdue
                  </Button>
                )}
                
                <Button 
                  size="sm"
                  onClick={() => {
                    const pendingGuests = pendingReminders
                      .map(inv => guests.find(g => g.id === inv.guestId))
                      .filter(Boolean) as Guest[]
                    setReminderGuests(pendingGuests)
                  }}
                >
                  <Send className="w-3 h-3 mr-1" />
                  Send Bulk Reminder
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}