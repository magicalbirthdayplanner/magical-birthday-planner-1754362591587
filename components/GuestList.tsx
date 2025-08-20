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
import { UserPlus, Mail, Phone, Edit, Trash2, Send, Users, UserCheck, UserX, Clock } from 'lucide-react'

export interface Guest {
  id: string
  name: string
  email?: string
  phone?: string
  type: 'ADULT' | 'CHILD' | 'FAMILY' | 'COUPLE'
  age?: number
  notes?: string
}

export interface Invitation {
  id: string
  guestId: string
  status: 'PENDING' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'MAYBE'
  sentAt?: Date
  respondedAt?: Date
  message?: string
  notes?: string
}

interface GuestListProps {
  partyId: string
  guests?: Guest[]
  invitations?: Invitation[]
  onAddGuest?: (guest: Omit<Guest, 'id'>) => void
  onEditGuest?: (id: string, guest: Partial<Guest>) => void
  onDeleteGuest?: (id: string) => void
  onSendInvitation?: (guestId: string, message: string) => void
  onUpdateRSVP?: (invitationId: string, status: Invitation['status'], notes?: string) => void
}

export default function GuestList({
  partyId,
  guests = [],
  invitations = [],
  onAddGuest,
  onEditGuest,
  onDeleteGuest,
  onSendInvitation,
  onUpdateRSVP
}: GuestListProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)
  const [inviteDialogGuest, setInviteDialogGuest] = useState<Guest | null>(null)
  const [newGuest, setNewGuest] = useState({
    name: '',
    email: '',
    phone: '',
    type: 'ADULT' as 'ADULT' | 'CHILD',
    age: '',
    notes: ''
  })
  const [inviteMessage, setInviteMessage] = useState('')

  const getInvitationForGuest = (guestId: string) => {
    return invitations.find(inv => inv.guestId === guestId)
  }

  const getStatusBadgeVariant = (status: Invitation['status']) => {
    switch (status) {
      case 'ACCEPTED': return 'default'
      case 'DECLINED': return 'destructive'
      case 'MAYBE': return 'secondary'
      case 'SENT': return 'outline'
      default: return 'secondary'
    }
  }

  const getStatusIcon = (status: Invitation['status']) => {
    switch (status) {
      case 'ACCEPTED': return <UserCheck className="w-3 h-3" />
      case 'DECLINED': return <UserX className="w-3 h-3" />
      case 'SENT': return <Mail className="w-3 h-3" />
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
      notes: newGuest.notes.trim() || undefined
    }
    
    onAddGuest?.(guestData)
    setNewGuest({ name: '', email: '', phone: '', type: 'ADULT', age: '', notes: '' })
    setIsAddDialogOpen(false)
  }

  const handleEditGuest = () => {
    if (!editingGuest) return
    
    const guestData = {
      name: editingGuest.name.trim(),
      email: editingGuest.email?.trim() || undefined,
      phone: editingGuest.phone?.trim() || undefined,
      type: editingGuest.type,
      age: editingGuest.type === 'CHILD' && editingGuest.age ? editingGuest.age : undefined,
      notes: editingGuest.notes?.trim() || undefined
    }
    
    onEditGuest?.(editingGuest.id, guestData)
    setEditingGuest(null)
  }

  const handleSendInvitation = () => {
    if (!inviteDialogGuest) return
    
    onSendInvitation?.(inviteDialogGuest.id, inviteMessage)
    setInviteDialogGuest(null)
    setInviteMessage('')
  }

  const adultGuests = guests.filter(g => g.type === 'ADULT')
  const childGuests = guests.filter(g => g.type === 'CHILD')
  const totalGuests = guests.length
  const acceptedCount = invitations.filter(inv => inv.status === 'ACCEPTED').length
  const declinedCount = invitations.filter(inv => inv.status === 'DECLINED').length
  const pendingCount = invitations.filter(inv => inv.status === 'PENDING' || inv.status === 'SENT').length

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Total Guests</p>
                <p className="text-2xl font-bold">{totalGuests}</p>
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

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Guest List</h3>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-pink-500 to-purple-600 text-white">
              <UserPlus className="w-4 h-4 mr-2" />
              Add Guest
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Guest</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={newGuest.name}
                  onChange={(e) => setNewGuest({ ...newGuest, name: e.target.value })}
                  placeholder="Guest name"
                />
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
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={newGuest.type}
                    onValueChange={(value: 'ADULT' | 'CHILD') => setNewGuest({ ...newGuest, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADULT">Adult</SelectItem>
                      <SelectItem value="CHILD">Child</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {newGuest.type === 'CHILD' && (
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
                )}
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
      </div>

      {/* Guest List Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Guests ({totalGuests})</TabsTrigger>
          <TabsTrigger value="adults">Adults ({adultGuests.length})</TabsTrigger>
          <TabsTrigger value="children">Children ({childGuests.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-3">
          {guests.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No guests added yet</p>
                <p className="text-sm text-gray-500 mt-1">Add your first guest to get started</p>
              </CardContent>
            </Card>
          ) : (
            guests.map((guest) => {
              const invitation = getInvitationForGuest(guest.id)
              return (
                <Card key={guest.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
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
                      
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          {guest.type === 'ADULT' ? 'Adult' : 'Child'}
                        </Badge>
                        
                        {invitation && (
                          <Badge variant={getStatusBadgeVariant(invitation.status)} className="text-xs">
                            {getStatusIcon(invitation.status)}
                            <span className="ml-1">{invitation.status}</span>
                          </Badge>
                        )}
                        
                        {(!invitation || invitation.status === 'PENDING') && guest.email && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setInviteDialogGuest(guest)}
                              >
                                <Send className="w-3 h-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Send Invitation to {guest.name}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="message">Custom Message</Label>
                                  <Textarea
                                    id="message"
                                    value={inviteMessage}
                                    onChange={(e) => setInviteMessage(e.target.value)}
                                    placeholder="Add a personal message to the invitation..."
                                    rows={4}
                                  />
                                </div>
                                <div className="flex justify-end space-x-2">
                                  <Button variant="outline" onClick={() => setInviteDialogGuest(null)}>
                                    Cancel
                                  </Button>
                                  <Button onClick={handleSendInvitation}>
                                    Send Invitation
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                        
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
                    
                    {guest.notes && (
                      <p className="text-sm text-gray-600 mt-2 pl-3 border-l-2 border-gray-200">
                        {guest.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>
        
        <TabsContent value="adults" className="space-y-3">
          {adultGuests.map((guest) => {
            const invitation = getInvitationForGuest(guest.id)
            return (
              <Card key={guest.id}>
                <CardContent className="p-4">
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
                      <h4 className="font-medium">{guest.name}</h4>
                      {guest.age && (
                        <p className="text-xs text-gray-500">Age: {guest.age}</p>
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
      </Tabs>
      
      {/* Edit Guest Dialog */}
      {editingGuest && (
        <Dialog open={!!editingGuest} onOpenChange={() => setEditingGuest(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Guest</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  value={editingGuest.name}
                  onChange={(e) => setEditingGuest({ ...editingGuest, name: e.target.value })}
                />
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
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-type">Type</Label>
                  <Select
                    value={editingGuest.type}
                    onValueChange={(value: 'ADULT' | 'CHILD') => setEditingGuest({ ...editingGuest, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADULT">Adult</SelectItem>
                      <SelectItem value="CHILD">Child</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {editingGuest.type === 'CHILD' && (
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
                )}
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
                <Button onClick={handleEditGuest}>
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