"use client"

import { useState, useRef } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Textarea } from './ui/textarea'
import { Checkbox } from './ui/checkbox'
import { Alert, AlertDescription } from './ui/alert'
import { Separator } from './ui/separator'
import { Progress } from './ui/progress'
import { 
  UserPlus, 
  Mail, 
  Phone, 
  Edit, 
  Trash2, 
  Send, 
  Users, 
  UserCheck, 
  UserX, 
  Clock,
  Upload,
  Download,
  Filter,
  Search,
  MoreHorizontal,
  FileText,
  Tag,
  Star,
  Copy,
  CheckCircle2,
  AlertTriangle,
  X,
  Plus
} from 'lucide-react'

export interface Guest {
  id: string
  name: string
  email?: string
  phone?: string
  type: 'ADULT' | 'CHILD' | 'FAMILY' | 'COUPLE'
  age?: number
  notes?: string
  tags?: string[]
  category?: string
  dietaryReqs?: string
  emergencyContact?: string
  importedFrom?: string
  isVip?: boolean
}

export interface Invitation {
  id: string
  guestId: string
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'OPENED' | 'ACCEPTED' | 'DECLINED' | 'MAYBE' | 'BOUNCED' | 'FAILED'
  sentAt?: Date
  respondedAt?: Date
  message?: string
  notes?: string
  templateId?: string
  customMessage?: string
  rsvpToken?: string
  emailSent?: boolean
  smsSent?: boolean
  reminderCount?: number
  lastReminderAt?: Date
}

interface EnhancedGuestListProps {
  partyId: string
  guests?: Guest[]
  invitations?: Invitation[]
  maxGuests?: number
  currentPlan: string
  onAddGuest?: (guest: Omit<Guest, 'id'>) => void
  onEditGuest?: (id: string, guest: Partial<Guest>) => void
  onDeleteGuest?: (id: string) => void
  onBulkAddGuests?: (guests: Omit<Guest, 'id'>[]) => void
  onSendInvitation?: (guestId: string, message: string) => void
  onUpdateRSVP?: (invitationId: string, status: Invitation['status'], notes?: string) => void
  onExportGuests?: () => void
}

const PLAN_LIMITS = {
  FREE: { maxGuests: 25, canImport: false, canTag: false, canExport: false },
  STARTER: { maxGuests: 50, canImport: true, canTag: true, canExport: false },
  PROFESSIONAL: { maxGuests: 200, canImport: true, canTag: true, canExport: true }
}

export default function EnhancedGuestList({
  partyId,
  guests = [],
  invitations = [],
  maxGuests,
  currentPlan = 'FREE',
  onAddGuest,
  onEditGuest,
  onDeleteGuest,
  onBulkAddGuests,
  onSendInvitation,
  onUpdateRSVP,
  onExportGuests
}: EnhancedGuestListProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)
  const [selectedGuests, setSelectedGuests] = useState<string[]>([])
  
  const [newGuest, setNewGuest] = useState({
    name: '',
    email: '',
    phone: '',
    type: 'ADULT' as Guest['type'],
    age: '',
    notes: '',
    tags: [] as string[],
    category: '',
    dietaryReqs: '',
    emergencyContact: '',
    isVip: false
  })
  
  const [bulkImportText, setBulkImportText] = useState('')
  const [importFormat, setImportFormat] = useState<'csv' | 'text'>('csv')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'ADULT' | 'CHILD' | 'FAMILY' | 'COUPLE'>('all')
  const [filterTag, setFilterTag] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [newTag, setNewTag] = useState('')
  const [currentTag, setCurrentTag] = useState('')
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const planLimits = PLAN_LIMITS[currentPlan as keyof typeof PLAN_LIMITS]

  const getInvitationForGuest = (guestId: string) => {
    return invitations.find(inv => inv.guestId === guestId)
  }

  const getStatusBadgeVariant = (status: Invitation['status']) => {
    switch (status) {
      case 'ACCEPTED': return 'default'
      case 'DECLINED': return 'destructive'
      case 'MAYBE': return 'secondary'
      case 'SENT':
      case 'DELIVERED':
      case 'OPENED': return 'outline'
      case 'BOUNCED':
      case 'FAILED': return 'destructive'
      default: return 'secondary'
    }
  }

  const getStatusIcon = (status: Invitation['status']) => {
    switch (status) {
      case 'ACCEPTED': return <UserCheck className="w-3 h-3" />
      case 'DECLINED': return <UserX className="w-3 h-3" />
      case 'SENT':
      case 'DELIVERED':
      case 'OPENED': return <Mail className="w-3 h-3" />
      case 'BOUNCED':
      case 'FAILED': return <AlertTriangle className="w-3 h-3" />
      default: return <Clock className="w-3 h-3" />
    }
  }

  const handleAddGuest = () => {
    if (!newGuest.name.trim()) return
    
    const guestData = {
      name: newGuest.name.trim(),
      email: newGuest.email.trim() || undefined,
      phone: newGuest.phone.trim() || undefined,
      type: newGuest.type,
      age: newGuest.type === 'CHILD' && newGuest.age ? parseInt(newGuest.age) : undefined,
      notes: newGuest.notes.trim() || undefined,
      tags: newGuest.tags,
      category: newGuest.category.trim() || undefined,
      dietaryReqs: newGuest.dietaryReqs.trim() || undefined,
      emergencyContact: newGuest.emergencyContact.trim() || undefined,
      isVip: newGuest.isVip,
      importedFrom: 'manual'
    }
    
    onAddGuest?.(guestData)
    setNewGuest({ name: '', email: '', phone: '', type: 'ADULT', age: '', notes: '', tags: [], category: '', dietaryReqs: '', emergencyContact: '', isVip: false })
    setIsAddDialogOpen(false)
  }

  const handleBulkImport = () => {
    if (!bulkImportText.trim()) return
    
    const guestsToImport: Omit<Guest, 'id'>[] = []
    
    if (importFormat === 'csv') {
      const lines = bulkImportText.trim().split('\n')
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim())
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())
        if (values.length >= 2 && values[0]) {
          const guest: Omit<Guest, 'id'> = {
            name: values[0],
            email: values[1] || undefined,
            phone: values[2] || undefined,
            type: (values[3]?.toUpperCase() as Guest['type']) || 'ADULT',
            age: values[4] ? parseInt(values[4]) : undefined,
            notes: values[5] || undefined,
            tags: values[6] ? values[6].split(';').map(t => t.trim()) : [],
            category: values[7] || undefined,
            dietaryReqs: values[8] || undefined,
            emergencyContact: values[9] || undefined,
            importedFrom: 'csv'
          }
          guestsToImport.push(guest)
        }
      }
    } else {
      // Text format: each line is a name, optionally with email
      const lines = bulkImportText.trim().split('\n')
      lines.forEach(line => {
        const trimmed = line.trim()
        if (trimmed) {
          const emailMatch = trimmed.match(/(.+?)\s*<(.+?)>/)
          if (emailMatch) {
            guestsToImport.push({
              name: emailMatch[1].trim(),
              email: emailMatch[2].trim(),
              type: 'ADULT',
              importedFrom: 'text'
            })
          } else {
            guestsToImport.push({
              name: trimmed,
              type: 'ADULT',
              importedFrom: 'text'
            })
          }
        }
      })
    }
    
    onBulkAddGuests?.(guestsToImport)
    setBulkImportText('')
    setIsBulkImportOpen(false)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setBulkImportText(content)
      setImportFormat('csv')
    }
    reader.readAsText(file)
  }

  const handleAddTag = (guestId: string) => {
    if (!currentTag.trim()) return
    
    const guest = guests.find(g => g.id === guestId)
    if (!guest) return
    
    const updatedTags = [...(guest.tags || []), currentTag.trim()]
    onEditGuest?.(guestId, { tags: updatedTags })
    setCurrentTag('')
  }

  const handleRemoveTag = (guestId: string, tagToRemove: string) => {
    const guest = guests.find(g => g.id === guestId)
    if (!guest) return
    
    const updatedTags = (guest.tags || []).filter(tag => tag !== tagToRemove)
    onEditGuest?.(guestId, { tags: updatedTags })
  }

  const handleBulkAction = (action: 'delete' | 'tag' | 'category' | 'vip') => {
    if (selectedGuests.length === 0) return
    
    switch (action) {
      case 'delete':
        selectedGuests.forEach(guestId => onDeleteGuest?.(guestId))
        setSelectedGuests([])
        break
      case 'vip':
        selectedGuests.forEach(guestId => onEditGuest?.(guestId, { isVip: true }))
        setSelectedGuests([])
        break
    }
  }

  const filterGuests = () => {
    return guests.filter(guest => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        if (!guest.name.toLowerCase().includes(searchLower) &&
            !guest.email?.toLowerCase().includes(searchLower) &&
            !guest.phone?.includes(searchTerm)) {
          return false
        }
      }
      
      // Type filter
      if (filterType !== 'all' && guest.type !== filterType) {
        return false
      }
      
      // Tag filter
      if (filterTag && !(guest.tags || []).includes(filterTag)) {
        return false
      }
      
      // Category filter
      if (filterCategory && guest.category !== filterCategory) {
        return false
      }
      
      return true
    })
  }

  const getAllTags = () => {
    const tags = new Set<string>()
    guests.forEach(guest => {
      (guest.tags || []).forEach(tag => tags.add(tag))
    })
    return Array.from(tags).sort()
  }

  const getAllCategories = () => {
    const categories = new Set<string>()
    guests.forEach(guest => {
      if (guest.category) categories.add(guest.category)
    })
    return Array.from(categories).sort()
  }

  const filteredGuests = filterGuests()
  const adultGuests = filteredGuests.filter(g => g.type === 'ADULT')
  const childGuests = filteredGuests.filter(g => g.type === 'CHILD')
  const familyGuests = filteredGuests.filter(g => g.type === 'FAMILY')
  const coupleGuests = filteredGuests.filter(g => g.type === 'COUPLE')
  
  const totalGuests = guests.length
  const acceptedCount = invitations.filter(inv => inv.status === 'ACCEPTED').length
  const declinedCount = invitations.filter(inv => inv.status === 'DECLINED').length
  const pendingCount = invitations.filter(inv => inv.status === 'PENDING' || inv.status === 'SENT').length

  const canAddMoreGuests = !maxGuests || totalGuests < maxGuests
  const isAtLimit = maxGuests && totalGuests >= maxGuests

  return (
    <div className="space-y-6">
      {/* Plan Limit Warning */}
      {isAtLimit && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You've reached your guest limit of {maxGuests} for the {currentPlan} plan. Upgrade to add more guests.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Total Guests</p>
                <p className="text-2xl font-bold">
                  {totalGuests}
                  {maxGuests && <span className="text-sm text-gray-500">/{maxGuests}</span>}
                </p>
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
                <p className="text-2xl font-bold text-green-600">{acceptedCount}</p>
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
                <p className="text-2xl font-bold text-red-600">{declinedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-yellow-600" />
              <div>
                <p className="text-sm font-medium">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="flex flex-wrap gap-2">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-gradient-to-r from-pink-500 to-purple-600 text-white"
                disabled={!!isAtLimit}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Guest
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Guest</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={newGuest.name}
                      onChange={(e) => setNewGuest({ ...newGuest, name: e.target.value })}
                      placeholder="Guest name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="type">Type</Label>
                    <Select
                      value={newGuest.type}
                      onValueChange={(value: Guest['type']) => setNewGuest({ ...newGuest, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADULT">Adult</SelectItem>
                        <SelectItem value="CHILD">Child</SelectItem>
                        <SelectItem value="FAMILY">Family</SelectItem>
                        <SelectItem value="COUPLE">Couple</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newGuest.email}
                      onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })}
                      placeholder="guest@email.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={newGuest.phone}
                      onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })}
                      placeholder="Phone number"
                    />
                  </div>
                </div>
                
                {newGuest.type === 'CHILD' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="age">Age</Label>
                      <Input
                        id="age"
                        type="number"
                        value={newGuest.age}
                        onChange={(e) => setNewGuest({ ...newGuest, age: e.target.value })}
                        placeholder="Age"
                        min="0"
                        max="18"
                      />
                    </div>
                    <div>
                      <Label htmlFor="emergency">Emergency Contact</Label>
                      <Input
                        id="emergency"
                        value={newGuest.emergencyContact}
                        onChange={(e) => setNewGuest({ ...newGuest, emergencyContact: e.target.value })}
                        placeholder="Parent/Guardian phone"
                      />
                    </div>
                  </div>
                )}
                
                {planLimits.canTag && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Input
                        id="category"
                        value={newGuest.category}
                        onChange={(e) => setNewGuest({ ...newGuest, category: e.target.value })}
                        placeholder="e.g., School Friends, Family"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="vip"
                        checked={newGuest.isVip}
                        onCheckedChange={(checked) => setNewGuest({ ...newGuest, isVip: !!checked })}
                      />
                      <Label htmlFor="vip" className="flex items-center">
                        <Star className="w-3 h-3 mr-1" />
                        VIP Guest
                      </Label>
                    </div>
                  </div>
                )}
                
                <div>
                  <Label htmlFor="dietary">Dietary Requirements</Label>
                  <Input
                    id="dietary"
                    value={newGuest.dietaryReqs}
                    onChange={(e) => setNewGuest({ ...newGuest, dietaryReqs: e.target.value })}
                    placeholder="Vegetarian, Allergies, etc."
                  />
                </div>
                
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={newGuest.notes}
                    onChange={(e) => setNewGuest({ ...newGuest, notes: e.target.value })}
                    placeholder="Any special notes about this guest"
                  />
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddGuest} disabled={!newGuest.name.trim()}>
                    Add Guest
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {planLimits.canImport && (
            <Dialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={!!isAtLimit}>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Guests
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Bulk Import Guests</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <Label>Import Format:</Label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="csv"
                        name="format"
                        checked={importFormat === 'csv'}
                        onChange={() => setImportFormat('csv')}
                      />
                      <Label htmlFor="csv">CSV</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="text"
                        name="format"
                        checked={importFormat === 'text'}
                        onChange={() => setImportFormat('text')}
                      />
                      <Label htmlFor="text">Simple Text</Label>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload File
                    </Button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".csv,.txt"
                      className="hidden"
                    />
                  </div>

                  <div>
                    <Label>
                      {importFormat === 'csv' ? 'CSV Data:' : 'Guest List (one per line):'}
                    </Label>
                    <Textarea
                      value={bulkImportText}
                      onChange={(e) => setBulkImportText(e.target.value)}
                      placeholder={
                        importFormat === 'csv' 
                          ? 'Name,Email,Phone,Type,Age,Notes,Tags,Category,Dietary,Emergency\nJohn Doe,john@email.com,555-1234,ADULT,,,,Family,,\nJane Smith <jane@email.com>'
                          : 'John Doe\nJane Smith <jane@email.com>\nBob Johnson'
                      }
                      rows={8}
                    />
                  </div>

                  {importFormat === 'csv' && (
                    <div className="text-sm text-gray-600">
                      <p className="font-medium">CSV Format:</p>
                      <p>Name,Email,Phone,Type,Age,Notes,Tags,Category,Dietary,Emergency</p>
                      <p className="mt-1">• Tags should be separated by semicolons (;)</p>
                      <p>• Type can be: ADULT, CHILD, FAMILY, COUPLE</p>
                    </div>
                  )}

                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsBulkImportOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleBulkImport} 
                      disabled={!bulkImportText.trim()}
                    >
                      Import Guests
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {planLimits.canExport && (
            <Button variant="outline" onClick={onExportGuests}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          {selectedGuests.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="outline">{selectedGuests.length} selected</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction('delete')}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </Button>
              {planLimits.canTag && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('vip')}
                >
                  <Star className="w-3 h-3 mr-1" />
                  Mark VIP
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search guests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="ADULT">Adults</SelectItem>
            <SelectItem value="CHILD">Children</SelectItem>
            <SelectItem value="FAMILY">Families</SelectItem>
            <SelectItem value="COUPLE">Couples</SelectItem>
          </SelectContent>
        </Select>

        {planLimits.canTag && getAllTags().length > 0 && (
          <Select value={filterTag} onValueChange={setFilterTag}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Tags</SelectItem>
              {getAllTags().map(tag => (
                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {planLimits.canTag && getAllCategories().length > 0 && (
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Categories</SelectItem>
              {getAllCategories().map(category => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Guest List */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All ({filteredGuests.length})</TabsTrigger>
          <TabsTrigger value="adults">Adults ({adultGuests.length})</TabsTrigger>
          <TabsTrigger value="children">Children ({childGuests.length})</TabsTrigger>
          <TabsTrigger value="families">Families ({familyGuests.length})</TabsTrigger>
          <TabsTrigger value="couples">Couples ({coupleGuests.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-3">
          {filteredGuests.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No guests found</p>
                <p className="text-sm text-gray-500 mt-1">
                  {searchTerm || filterType !== 'all' || filterTag || filterCategory 
                    ? 'Try adjusting your search or filters'
                    : 'Add your first guest to get started'
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredGuests.map((guest) => {
              const invitation = getInvitationForGuest(guest.id)
              const isSelected = selectedGuests.includes(guest.id)
              
              return (
                <Card key={guest.id} className={isSelected ? 'ring-2 ring-blue-500' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedGuests(prev => [...prev, guest.id])
                          } else {
                            setSelectedGuests(prev => prev.filter(id => id !== guest.id))
                          }
                        }}
                        className="mt-1"
                      />
                      
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="font-medium">{guest.name}</h4>
                              {guest.isVip && (
                                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                              )}
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
                            
                            {guest.type === 'CHILD' && guest.age && (
                              <p className="text-xs text-gray-500">Age: {guest.age}</p>
                            )}
                            
                            {guest.dietaryReqs && (
                              <p className="text-xs text-orange-600">
                                Dietary: {guest.dietaryReqs}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {guest.type}
                            </Badge>
                            
                            {guest.category && (
                              <Badge variant="secondary" className="text-xs">
                                {guest.category}
                              </Badge>
                            )}
                            
                            {invitation && (
                              <Badge variant={getStatusBadgeVariant(invitation.status)} className="text-xs">
                                {getStatusIcon(invitation.status)}
                                <span className="ml-1">{invitation.status}</span>
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {guest.tags && guest.tags.length > 0 && planLimits.canTag && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {guest.tags.map((tag) => (
                              <div key={tag} className="flex items-center">
                                <Badge variant="outline" className="text-xs">
                                  <Tag className="w-2 h-2 mr-1" />
                                  {tag}
                                  <button
                                    onClick={() => handleRemoveTag(guest.id, tag)}
                                    className="ml-1 hover:text-red-500"
                                  >
                                    <X className="w-2 h-2" />
                                  </button>
                                </Badge>
                              </div>
                            ))}
                            <div className="flex items-center space-x-1">
                              <Input
                                value={currentTag}
                                onChange={(e) => setCurrentTag(e.target.value)}
                                placeholder="Add tag"
                                className="h-6 text-xs w-20"
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    handleAddTag(guest.id)
                                  }
                                }}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleAddTag(guest.id)}
                                className="h-6 px-2"
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        {guest.notes && (
                          <p className="text-sm text-gray-600 mt-2 pl-3 border-l-2 border-gray-200">
                            {guest.notes}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingGuest(guest)}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDeleteGuest?.(guest.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        {/* Similar tab contents for adults, children, families, couples */}
        <TabsContent value="adults" className="space-y-3">
          {adultGuests.map((guest) => {
            const invitation = getInvitationForGuest(guest.id)
            return (
              <Card key={guest.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium">{guest.name}</h4>
                        {guest.isVip && (
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        )}
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
                    </div>
                    
                    {invitation && (
                      <Badge variant={getStatusBadgeVariant(invitation.status)} className="text-xs">
                        {getStatusIcon(invitation.status)}
                        <span className="ml-1">{invitation.status}</span>
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        <TabsContent value="children" className="space-y-3">
          {childGuests.map((guest) => {
            const invitation = getInvitationForGuest(guest.id)
            return (
              <Card key={guest.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium">{guest.name}</h4>
                        {guest.isVip && (
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                      {guest.age && (
                        <p className="text-xs text-gray-500">Age: {guest.age}</p>
                      )}
                      {guest.emergencyContact && (
                        <p className="text-xs text-gray-500">Emergency: {guest.emergencyContact}</p>
                      )}
                    </div>
                    
                    {invitation && (
                      <Badge variant={getStatusBadgeVariant(invitation.status)} className="text-xs">
                        {getStatusIcon(invitation.status)}
                        <span className="ml-1">{invitation.status}</span>
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        <TabsContent value="families" className="space-y-3">
          {familyGuests.map((guest) => {
            const invitation = getInvitationForGuest(guest.id)
            return (
              <Card key={guest.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium">{guest.name}</h4>
                        {guest.isVip && (
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        )}
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
                    </div>
                    
                    {invitation && (
                      <Badge variant={getStatusBadgeVariant(invitation.status)} className="text-xs">
                        {getStatusIcon(invitation.status)}
                        <span className="ml-1">{invitation.status}</span>
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        <TabsContent value="couples" className="space-y-3">
          {coupleGuests.map((guest) => {
            const invitation = getInvitationForGuest(guest.id)
            return (
              <Card key={guest.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium">{guest.name}</h4>
                        {guest.isVip && (
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        )}
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
                    </div>
                    
                    {invitation && (
                      <Badge variant={getStatusBadgeVariant(invitation.status)} className="text-xs">
                        {getStatusIcon(invitation.status)}
                        <span className="ml-1">{invitation.status}</span>
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>
      </Tabs>

      {/* Edit Guest Dialog - Same structure as Add Guest but with editing capabilities */}
      {editingGuest && (
        <Dialog open={!!editingGuest} onOpenChange={() => setEditingGuest(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Guest</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    value={editingGuest.name}
                    onChange={(e) => setEditingGuest({ ...editingGuest, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-type">Type</Label>
                  <Select
                    value={editingGuest.type}
                    onValueChange={(value: Guest['type']) => setEditingGuest({ ...editingGuest, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADULT">Adult</SelectItem>
                      <SelectItem value="CHILD">Child</SelectItem>
                      <SelectItem value="FAMILY">Family</SelectItem>
                      <SelectItem value="COUPLE">Couple</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingGuest.email || ''}
                    onChange={(e) => setEditingGuest({ ...editingGuest, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    value={editingGuest.phone || ''}
                    onChange={(e) => setEditingGuest({ ...editingGuest, phone: e.target.value })}
                  />
                </div>
              </div>
              
              {editingGuest.type === 'CHILD' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-age">Age</Label>
                    <Input
                      id="edit-age"
                      type="number"
                      value={editingGuest.age || ''}
                      onChange={(e) => setEditingGuest({ ...editingGuest, age: parseInt(e.target.value) || undefined })}
                      min="0"
                      max="18"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-emergency">Emergency Contact</Label>
                    <Input
                      id="edit-emergency"
                      value={editingGuest.emergencyContact || ''}
                      onChange={(e) => setEditingGuest({ ...editingGuest, emergencyContact: e.target.value })}
                    />
                  </div>
                </div>
              )}
              
              {planLimits.canTag && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-category">Category</Label>
                    <Input
                      id="edit-category"
                      value={editingGuest.category || ''}
                      onChange={(e) => setEditingGuest({ ...editingGuest, category: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-vip"
                      checked={editingGuest.isVip || false}
                      onCheckedChange={(checked) => setEditingGuest({ ...editingGuest, isVip: !!checked })}
                    />
                    <Label htmlFor="edit-vip" className="flex items-center">
                      <Star className="w-3 h-3 mr-1" />
                      VIP Guest
                    </Label>
                  </div>
                </div>
              )}
              
              <div>
                <Label htmlFor="edit-dietary">Dietary Requirements</Label>
                <Input
                  id="edit-dietary"
                  value={editingGuest.dietaryReqs || ''}
                  onChange={(e) => setEditingGuest({ ...editingGuest, dietaryReqs: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={editingGuest.notes || ''}
                  onChange={(e) => setEditingGuest({ ...editingGuest, notes: e.target.value })}
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditingGuest(null)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => {
                    onEditGuest?.(editingGuest.id, editingGuest)
                    setEditingGuest(null)
                  }}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}