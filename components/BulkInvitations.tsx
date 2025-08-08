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
import { Checkbox } from './ui/checkbox'
import { Mail, Send, Users, MessageSquare, Palette, Eye, Copy } from 'lucide-react'
import { Guest, Invitation } from './GuestList'

interface InvitationTemplate {
  id: string
  name: string
  subject: string
  content: string
  theme: string
}

const DEFAULT_TEMPLATES: InvitationTemplate[] = [
  {
    id: 'magical',
    name: 'Magical Party',
    subject: "You're Invited to {childName}'s Magical {theme} Birthday Party! 🎉",
    content: `Dear {guestName},

You're cordially invited to {childName}'s magical {theme} birthday party!

🎂 Birthday Child: {childName} (turning {childAge}!)
📅 Date: {partyDate}
🕐 Time: {partyTime}
📍 Location: {partyLocation}

Join us for an enchanting day filled with {theme} adventures, delicious treats, and unforgettable memories!

Please RSVP by {rsvpDate} so we can prepare the perfect celebration.

With excitement,
{hostName}

{customMessage}`,
    theme: 'magical'
  },
  {
    id: 'fun',
    name: 'Fun & Playful',
    subject: "Party Time! {childName}'s {theme} Birthday Bash! 🎈",
    content: `Hey {guestName}!

Get ready for the BEST party ever! {childName} is turning {childAge} and we're throwing an awesome {theme} birthday bash!

🎉 What: {childName}'s {theme} Birthday Party
📅 When: {partyDate} at {partyTime}
📍 Where: {partyLocation}

We'll have amazing {theme} activities, yummy cake, and tons of fun! Don't miss out on the celebration!

Please let us know if you can make it by {rsvpDate}.

Can't wait to party with you!
{hostName}

{customMessage}`,
    theme: 'fun'
  },
  {
    id: 'elegant',
    name: 'Elegant Celebration',
    subject: "An Invitation to Celebrate {childName}'s {theme} Birthday",
    content: `Dear {guestName},

We would be delighted to have you join us in celebrating {childName}'s {childAge}th birthday with a beautiful {theme} themed party.

Event Details:
• Child: {childName} (celebrating {childAge} years!)
• Theme: {theme}
• Date: {partyDate}
• Time: {partyTime}
• Venue: {partyLocation}

Your presence would make this special day even more memorable for {childName}.

Kindly RSVP by {rsvpDate}.

Warm regards,
{hostName}

{customMessage}`,
    theme: 'elegant'
  },
  {
    id: 'superhero',
    name: 'Superhero Adventure',
    subject: "CALLING ALL HEROES! {childName}'s {theme} Birthday Mission! 💥",
    content: `Attention {guestName}!

You have been specially chosen for an important mission: Help celebrate {childName}'s {childAge}th birthday!

🦸‍♀️ MISSION DETAILS:
- Hero: {childName} (turning {childAge}!)
- Mission Theme: {theme}
- Mission Date: {partyDate}
- Mission Time: {partyTime}
- Secret Base: {partyLocation}

Suit up for an action-packed adventure with {theme} training, power-up snacks, and birthday cake fuel!

Confirm your participation by {rsvpDate} - the world (and {childName}) is counting on you!

Hero Command Center,
{hostName}

{customMessage}`,
    theme: 'superhero'
  }
]

interface BulkInvitationsProps {
  partyId: string
  childName: string
  childAge: number
  partyDate: string
  partyTime?: string
  partyLocation?: string
  theme: string
  guests: Guest[]
  invitations: Invitation[]
  userId?: string
  onSendBulkInvitations?: (guestIds: string[], templateId: string, customMessage: string) => void
}

export default function BulkInvitations({
  partyId,
  childName,
  childAge,
  partyDate,
  partyTime = 'TBD',
  partyLocation = 'TBD',
  theme,
  guests,
  invitations,
  userId,
  onSendBulkInvitations
}: BulkInvitationsProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<InvitationTemplate>(DEFAULT_TEMPLATES[0])
  const [selectedGuests, setSelectedGuests] = useState<string[]>([])
  const [customMessage, setCustomMessage] = useState('')
  const [previewGuest, setPreviewGuest] = useState<Guest | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const availableGuests = guests.filter(guest => 
    guest.email && !invitations.find(inv => inv.guestId === guest.id && inv.status !== 'PENDING')
  )

  const handleGuestToggle = (guestId: string) => {
    setSelectedGuests(prev => 
      prev.includes(guestId) 
        ? prev.filter(id => id !== guestId)
        : [...prev, guestId]
    )
  }

  const handleSelectAll = () => {
    if (selectedGuests.length === availableGuests.length) {
      setSelectedGuests([])
    } else {
      setSelectedGuests(availableGuests.map(g => g.id))
    }
  }

  const renderTemplate = (template: InvitationTemplate, guest: Guest) => {
    // Safely create dates with validation
    let partyDateFormatted = 'Invalid date';
    let rsvpDateFormatted = 'Invalid date';
    
    try {
      const partyDateObj = new Date(partyDate);
      if (!isNaN(partyDateObj.getTime())) {
        partyDateFormatted = partyDateObj.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        
        // Create RSVP date safely
        const rsvpDate = new Date(partyDateObj);
        rsvpDate.setDate(rsvpDate.getDate() - 7);
        if (!isNaN(rsvpDate.getTime())) {
          rsvpDateFormatted = rsvpDate.toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric' 
          });
        }
      }
    } catch (error) {
      console.warn('Error formatting dates for invitation:', error);
    }

    const replacements = {
      '{guestName}': guest.name,
      '{childName}': childName,
      '{childAge}': childAge.toString(),
      '{partyDate}': partyDateFormatted,
      '{partyTime}': partyTime,
      '{partyLocation}': partyLocation,
      '{theme}': theme,
      '{rsvpDate}': rsvpDateFormatted,
      '{hostName}': 'The Party Planning Team',
      '{customMessage}': customMessage ? `\n\nSpecial Note:\n${customMessage}` : ''
    }

    let content = template.subject
    let body = template.content

    Object.entries(replacements).forEach(([key, value]) => {
      content = content.replace(new RegExp(key, 'g'), value)
      body = body.replace(new RegExp(key, 'g'), value)
    })

    return { subject: content, body }
  }

  const handlePreview = (guest: Guest) => {
    setPreviewGuest(guest)
    setIsPreviewOpen(true)
  }

  const handleSendInvitations = async () => {
    if (selectedGuests.length === 0) return
    
    setIsSending(true)
    try {
      const response = await fetch('/api/emails/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partyId: partyId,
          guestIds: selectedGuests,
          personalMessage: customMessage.trim() || undefined,
          userId: userId,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Show success message
        alert(`Successfully sent ${data.summary.successful} invitations! ${data.summary.failed > 0 ? `${data.summary.failed} failed.` : ''}`);
        setSelectedGuests([])
        setCustomMessage('')
        // Call optional callback for parent component updates
        await onSendBulkInvitations?.(selectedGuests, selectedTemplate.id, customMessage)
      } else {
        // Show specific error message from server
        const errorMessage = data.error || `Failed to send invitations (Status: ${response.status})`;
        alert(errorMessage);
        console.error('Invitation send failed:', data);
      }
    } catch (error) {
      console.error('Failed to send invitations:', error)
      alert('Network error: Unable to send invitations. Please check your connection and try again.');
    } finally {
      setIsSending(false)
    }
  }

  const copyTemplateToClipboard = () => {
    if (availableGuests.length > 0) {
      const preview = renderTemplate(selectedTemplate, availableGuests[0])
      navigator.clipboard.writeText(`Subject: ${preview.subject}\n\n${preview.body}`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Bulk Invitations</h3>
        <Badge variant="outline">
          {availableGuests.length} guests available
        </Badge>
      </div>

      {availableGuests.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No guests available for invitations</p>
            <p className="text-sm text-gray-500 mt-1">
              Add guests with email addresses to send invitations
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="template" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="template">Choose Template</TabsTrigger>
            <TabsTrigger value="guests">Select Guests</TabsTrigger>
            <TabsTrigger value="send">Review & Send</TabsTrigger>
          </TabsList>

          <TabsContent value="template" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DEFAULT_TEMPLATES.map((template) => (
                <Card 
                  key={template.id}
                  className={`cursor-pointer transition-all ${
                    selectedTemplate.id === template.id 
                      ? 'ring-2 ring-pink-500 border-pink-200' 
                      : 'hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">{template.name}</CardTitle>
                      <div className="flex items-center space-x-1">
                        <Palette className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-gray-600 line-clamp-3">
                      {template.content.substring(0, 120)}...
                    </p>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="mt-3 w-full"
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePreview(availableGuests[0])
                      }}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Preview
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Custom Message (Optional)</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Add a personal message that will be included in all invitations..."
                  rows={3}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="guests" className="space-y-4">
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                onClick={handleSelectAll}
                className="text-sm"
              >
                {selectedGuests.length === availableGuests.length ? 'Deselect All' : 'Select All'}
              </Button>
              <Badge variant="secondary">
                {selectedGuests.length} of {availableGuests.length} selected
              </Badge>
            </div>

            <div className="space-y-2">
              {availableGuests.map((guest) => (
                <Card key={guest.id} className="p-4">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={selectedGuests.includes(guest.id)}
                      onCheckedChange={() => handleGuestToggle(guest.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{guest.name}</p>
                          <p className="text-sm text-gray-600">{guest.email}</p>
                          {guest.type === 'CHILD' && guest.age && (
                            <p className="text-xs text-gray-500">Age: {guest.age}</p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">
                            {guest.type === 'ADULT' ? 'Adult' : 'Child'}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePreview(guest)}
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="send" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Invitation Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Template:</p>
                    <p className="text-gray-600">{selectedTemplate.name}</p>
                  </div>
                  <div>
                    <p className="font-medium">Recipients:</p>
                    <p className="text-gray-600">{selectedGuests.length} guests</p>
                  </div>
                  <div>
                    <p className="font-medium">Party:</p>
                    <p className="text-gray-600">{childName}'s {theme} Birthday</p>
                  </div>
                  <div>
                    <p className="font-medium">Date:</p>
                    <p className="text-gray-600">{new Date(partyDate).toLocaleDateString()}</p>
                  </div>
                </div>

                {customMessage && (
                  <div>
                    <p className="font-medium text-sm">Custom Message:</p>
                    <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded mt-1">
                      {customMessage}
                    </p>
                  </div>
                )}

                <div className="flex space-x-2">
                  <Button
                    onClick={handleSendInvitations}
                    disabled={selectedGuests.length === 0 || isSending}
                    className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 text-white"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {isSending ? 'Sending...' : `Send ${selectedGuests.length} Invitations`}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={copyTemplateToClipboard}
                    className="flex-shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {selectedGuests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Selected Guests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedGuests.map((guestId) => {
                      const guest = guests.find(g => g.id === guestId)
                      return guest ? (
                        <div key={guest.id} className="flex items-center space-x-2 text-sm">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span>{guest.name}</span>
                          <span className="text-gray-500">({guest.email})</span>
                        </div>
                      ) : null
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Preview Dialog */}
      {previewGuest && (
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Invitation Preview - {previewGuest.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="mb-3">
                  <Label className="text-sm font-medium">Subject:</Label>
                  <p className="text-sm mt-1 font-medium">
                    {renderTemplate(selectedTemplate, previewGuest).subject}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Message:</Label>
                  <div className="mt-1 text-sm whitespace-pre-line bg-white p-3 rounded border">
                    {renderTemplate(selectedTemplate, previewGuest).body}
                  </div>
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
                  Close
                </Button>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    onClick={copyTemplateToClipboard}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                  <Button
                    onClick={() => {
                      if (!selectedGuests.includes(previewGuest.id)) {
                        setSelectedGuests(prev => [...prev, previewGuest.id])
                      }
                      setIsPreviewOpen(false)
                    }}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Add to Selection
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}