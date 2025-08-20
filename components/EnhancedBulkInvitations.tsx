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
import { Progress } from './ui/progress'
import { Separator } from './ui/separator'
import { 
  Mail, 
  Send, 
  Users, 
  MessageSquare, 
  Palette, 
  Eye, 
  Copy, 
  Upload,
  Download,
  Edit3,
  Plus,
  Trash2,
  Save,
  Image,
  Link,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Globe,
  Calendar,
  MapPin,
  Phone,
  AtSign,
  Wand2,
  Sparkles,
  Crown,
  Star
} from 'lucide-react'
import { Guest, Invitation } from './EnhancedGuestList'

interface InvitationTemplate {
  id: string
  name: string
  subject: string
  content: string
  theme: string
  isDefault: boolean
  isCustom: boolean
  emailEnabled: boolean
  smsEnabled: boolean
  logoUrl?: string
  backgroundColor?: string
  textColor?: string
  buttonColor?: string
}

interface EnhancedBulkInvitationsProps {
  partyId: string
  childName: string
  childAge: number
  partyDate: string
  partyTime?: string
  partyLocation?: string
  hostName?: string
  hostEmail?: string
  hostPhone?: string
  theme: string
  guests: Guest[]
  invitations: Invitation[]
  currentPlan: string
  onSendBulkInvitations?: (guestIds: string[], templateId: string, customMessage: string, sendVia: 'email' | 'sms' | 'both') => void
  onSaveTemplate?: (template: Omit<InvitationTemplate, 'id'>) => void
  onDeleteTemplate?: (templateId: string) => void
  onGenerateRSVPLinks?: (guestIds: string[]) => Promise<{ [guestId: string]: string }>
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

{rsvpLink}

With excitement,
{hostName}
{hostContact}

{customMessage}`,
    theme: 'magical',
    isDefault: true,
    isCustom: false,
    emailEnabled: true,
    smsEnabled: false,
    backgroundColor: '#f8f9ff',
    textColor: '#374151',
    buttonColor: '#8b5cf6'
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
{rsvpLink}

Can't wait to party with you!
{hostName}
{hostContact}

{customMessage}`,
    theme: 'fun',
    isDefault: true,
    isCustom: false,
    emailEnabled: true,
    smsEnabled: true,
    backgroundColor: '#fff7ed',
    textColor: '#374151',
    buttonColor: '#f97316'
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
{rsvpLink}

Warm regards,
{hostName}
{hostContact}

{customMessage}`,
    theme: 'elegant',
    isDefault: true,
    isCustom: false,
    emailEnabled: true,
    smsEnabled: false,
    backgroundColor: '#fafafa',
    textColor: '#374151',
    buttonColor: '#6b7280'
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
{rsvpLink}

Hero Command Center,
{hostName}
{hostContact}

{customMessage}`,
    theme: 'superhero',
    isDefault: true,
    isCustom: false,
    emailEnabled: true,
    smsEnabled: true,
    backgroundColor: '#eff6ff',
    textColor: '#374151',
    buttonColor: '#3b82f6'
  }
]

const PLAN_FEATURES = {
  FREE: { 
    maxTemplates: 2, 
    customTemplates: false, 
    emailEnabled: true, 
    smsEnabled: false, 
    branding: true,
    analytics: false,
    scheduling: false
  },
  STARTER: { 
    maxTemplates: 5, 
    customTemplates: true, 
    emailEnabled: true, 
    smsEnabled: false, 
    branding: false,
    analytics: true,
    scheduling: true
  },
  PROFESSIONAL: { 
    maxTemplates: -1, 
    customTemplates: true, 
    emailEnabled: true, 
    smsEnabled: true, 
    branding: false,
    analytics: true,
    scheduling: true
  }
}

export default function EnhancedBulkInvitations({
  partyId,
  childName,
  childAge,
  partyDate,
  partyTime = 'TBD',
  partyLocation = 'TBD',
  hostName = 'The Party Planning Team',
  hostEmail,
  hostPhone,
  theme,
  guests,
  invitations,
  currentPlan = 'FREE',
  onSendBulkInvitations,
  onSaveTemplate,
  onDeleteTemplate,
  onGenerateRSVPLinks
}: EnhancedBulkInvitationsProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<InvitationTemplate>(DEFAULT_TEMPLATES[0])
  const [customTemplates, setCustomTemplates] = useState<InvitationTemplate[]>([])
  const [selectedGuests, setSelectedGuests] = useState<string[]>([])
  const [customMessage, setCustomMessage] = useState('')
  const [sendVia, setSendVia] = useState<'email' | 'sms' | 'both'>('email')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  
  const [previewGuest, setPreviewGuest] = useState<Guest | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)
  
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    subject: '',
    content: '',
    theme: '',
    emailEnabled: true,
    smsEnabled: false,
    backgroundColor: '#ffffff',
    textColor: '#374151',
    buttonColor: '#8b5cf6'
  })

  const planFeatures = PLAN_FEATURES[currentPlan as keyof typeof PLAN_FEATURES]
  const fileInputRef = useRef<HTMLInputElement>(null)

  const availableGuests = guests.filter(guest => 
    guest.email && (!invitations.find(inv => inv.guestId === guest.id && inv.status !== 'PENDING' && inv.status !== 'FAILED'))
  )

  const allTemplates = [...DEFAULT_TEMPLATES.slice(0, planFeatures.maxTemplates > 0 ? planFeatures.maxTemplates : DEFAULT_TEMPLATES.length), ...customTemplates]

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

  const handleSelectByType = (type: Guest['type']) => {
    const guestsOfType = availableGuests.filter(g => g.type === type).map(g => g.id)
    setSelectedGuests(prev => {
      const combined = [...prev, ...guestsOfType]
      return Array.from(new Set(combined))
    })
  }

  const handleSelectVIP = () => {
    const vipGuests = availableGuests.filter(g => g.isVip).map(g => g.id)
    setSelectedGuests(prev => {
      const combined = [...prev, ...vipGuests]
      return Array.from(new Set(combined))
    })
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

    const hostContact = hostEmail ? `Email: ${hostEmail}${hostPhone ? ` | Phone: ${hostPhone}` : ''}` : (hostPhone ? `Phone: ${hostPhone}` : '');
    const rsvpLink = planFeatures.analytics ? '🔗 Click here to RSVP: [RSVP_LINK]' : 'Please reply to this message with your RSVP';

    const replacements = {
      '{guestName}': guest.name,
      '{childName}': childName,
      '{childAge}': childAge.toString(),
      '{partyDate}': partyDateFormatted,
      '{partyTime}': partyTime,
      '{partyLocation}': partyLocation,
      '{theme}': theme,
      '{rsvpDate}': rsvpDateFormatted,
      '{hostName}': hostName,
      '{hostContact}': hostContact,
      '{rsvpLink}': rsvpLink,
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
      // Generate RSVP links if analytics are enabled
      let rsvpLinks: { [guestId: string]: string } = {}
      if (planFeatures.analytics && onGenerateRSVPLinks) {
        rsvpLinks = await onGenerateRSVPLinks(selectedGuests)
      }

      await onSendBulkInvitations?.(selectedGuests, selectedTemplate.id, customMessage, sendVia)
      setSelectedGuests([])
      setCustomMessage('')
    } finally {
      setIsSending(false)
    }
  }

  const handleScheduleInvitations = () => {
    if (!scheduleDate || !scheduleTime) return
    
    // Here you would implement the scheduling logic
    console.log('Scheduling invitations for:', scheduleDate, scheduleTime)
    setIsScheduling(false)
  }

  const handleCreateTemplate = () => {
    if (!newTemplate.name || !newTemplate.subject || !newTemplate.content) return
    
    const template: Omit<InvitationTemplate, 'id'> = {
      ...newTemplate,
      isDefault: false,
      isCustom: true
    }
    
    onSaveTemplate?.(template)
    setCustomTemplates(prev => [...prev, { ...template, id: `custom_${Date.now()}` }])
    setNewTemplate({
      name: '',
      subject: '',
      content: '',
      theme: '',
      emailEnabled: true,
      smsEnabled: false,
      backgroundColor: '#ffffff',
      textColor: '#374151',
      buttonColor: '#8b5cf6'
    })
    setIsCreatingTemplate(false)
  }

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    // Here you would upload the file and get the URL
    console.log('Uploading logo:', file.name)
  }

  const copyTemplateToClipboard = () => {
    if (availableGuests.length > 0) {
      const preview = renderTemplate(selectedTemplate, availableGuests[0])
      navigator.clipboard.writeText(`Subject: ${preview.subject}\n\n${preview.body}`)
    }
  }

  const exportGuestList = () => {
    const selectedGuestData = guests
      .filter(g => selectedGuests.includes(g.id))
      .map(g => ({
        name: g.name,
        email: g.email,
        phone: g.phone,
        type: g.type,
        category: g.category,
        tags: g.tags?.join(';')
      }))
    
    const csv = [
      ['Name', 'Email', 'Phone', 'Type', 'Category', 'Tags'].join(','),
      ...selectedGuestData.map(g => [
        g.name,
        g.email || '',
        g.phone || '',
        g.type,
        g.category || '',
        g.tags || ''
      ].join(','))
    ].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `selected-guests-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center">
            <Sparkles className="w-5 h-5 mr-2 text-purple-500" />
            Enhanced Invitations
          </h3>
          <p className="text-sm text-gray-600">
            Send personalized invitations with {currentPlan} plan features
          </p>
        </div>
        <Badge variant="outline" className="flex items-center">
          <Crown className="w-3 h-3 mr-1" />
          {currentPlan} Plan
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="template">
              <Palette className="w-4 h-4 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="guests">
              <Users className="w-4 h-4 mr-2" />
              Select Guests
            </TabsTrigger>
            <TabsTrigger value="customize">
              <Edit3 className="w-4 h-4 mr-2" />
              Customize
            </TabsTrigger>
            <TabsTrigger value="send">
              <Send className="w-4 h-4 mr-2" />
              Review & Send
            </TabsTrigger>
          </TabsList>

          <TabsContent value="template" className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">Choose Template</h4>
              {planFeatures.customTemplates && (
                <Dialog open={isCreatingTemplate} onOpenChange={setIsCreatingTemplate}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="w-3 h-3 mr-1" />
                      Create Custom
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>Create Custom Template</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="template-name">Template Name</Label>
                          <Input
                            id="template-name"
                            value={newTemplate.name}
                            onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                            placeholder="My Custom Template"
                          />
                        </div>
                        <div>
                          <Label htmlFor="template-theme">Theme</Label>
                          <Input
                            id="template-theme"
                            value={newTemplate.theme}
                            onChange={(e) => setNewTemplate({ ...newTemplate, theme: e.target.value })}
                            placeholder="e.g., Birthday, Celebration"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="template-subject">Email Subject</Label>
                        <Input
                          id="template-subject"
                          value={newTemplate.subject}
                          onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                          placeholder="You're invited to {childName}'s party!"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="template-content">Message Content</Label>
                        <Textarea
                          id="template-content"
                          value={newTemplate.content}
                          onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                          placeholder="Dear {guestName}..."
                          rows={8}
                        />
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="bg-color">Background Color</Label>
                          <Input
                            id="bg-color"
                            type="color"
                            value={newTemplate.backgroundColor}
                            onChange={(e) => setNewTemplate({ ...newTemplate, backgroundColor: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="text-color">Text Color</Label>
                          <Input
                            id="text-color"
                            type="color"
                            value={newTemplate.textColor}
                            onChange={(e) => setNewTemplate({ ...newTemplate, textColor: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="button-color">Button Color</Label>
                          <Input
                            id="button-color"
                            type="color"
                            value={newTemplate.buttonColor}
                            onChange={(e) => setNewTemplate({ ...newTemplate, buttonColor: e.target.value })}
                          />
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <div className="flex space-x-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="email-enabled"
                              checked={newTemplate.emailEnabled}
                              onCheckedChange={(checked) => setNewTemplate({ ...newTemplate, emailEnabled: !!checked })}
                            />
                            <Label htmlFor="email-enabled">Email</Label>
                          </div>
                          {planFeatures.smsEnabled && (
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="sms-enabled"
                                checked={newTemplate.smsEnabled}
                                onCheckedChange={(checked) => setNewTemplate({ ...newTemplate, smsEnabled: !!checked })}
                              />
                              <Label htmlFor="sms-enabled">SMS</Label>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button variant="outline" onClick={() => setIsCreatingTemplate(false)}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleCreateTemplate}
                            disabled={!newTemplate.name || !newTemplate.subject || !newTemplate.content}
                          >
                            <Save className="w-3 h-3 mr-1" />
                            Save Template
                          </Button>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allTemplates.map((template) => (
                <Card 
                  key={template.id}
                  className={`cursor-pointer transition-all ${
                    selectedTemplate.id === template.id 
                      ? 'ring-2 ring-purple-500 border-purple-200' 
                      : 'hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center">
                        {template.isCustom ? (
                          <Edit3 className="w-3 h-3 mr-1 text-blue-500" />
                        ) : (
                          <Sparkles className="w-3 h-3 mr-1 text-purple-500" />
                        )}
                        {template.name}
                      </CardTitle>
                      <div className="flex items-center space-x-1">
                        {template.emailEnabled && (
                          <Mail className="w-3 h-3 text-green-500" />
                        )}
                        {template.smsEnabled && planFeatures.smsEnabled && (
                          <Smartphone className="w-3 h-3 text-blue-500" />
                        )}
                        {template.isCustom && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteTemplate?.(template.id)
                              setCustomTemplates(prev => prev.filter(t => t.id !== template.id))
                            }}
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-gray-600 line-clamp-3 mb-3">
                      {template.content.substring(0, 120)}...
                    </p>
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePreview(availableGuests[0])
                        }}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Preview
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={(e) => {
                          e.stopPropagation()
                          copyTemplateToClipboard()
                        }}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Template Variables
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
                  <Badge variant="outline">{'{guestName}'}</Badge>
                  <Badge variant="outline">{'{childName}'}</Badge>
                  <Badge variant="outline">{'{childAge}'}</Badge>
                  <Badge variant="outline">{'{partyDate}'}</Badge>
                  <Badge variant="outline">{'{partyTime}'}</Badge>
                  <Badge variant="outline">{'{partyLocation}'}</Badge>
                  <Badge variant="outline">{'{theme}'}</Badge>
                  <Badge variant="outline">{'{rsvpDate}'}</Badge>
                  <Badge variant="outline">{'{hostName}'}</Badge>
                  <Badge variant="outline">{'{hostContact}'}</Badge>
                  <Badge variant="outline">{'{rsvpLink}'}</Badge>
                  <Badge variant="outline">{'{customMessage}'}</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="guests" className="space-y-4">
            <div className="flex flex-wrap gap-2 justify-between items-center">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={handleSelectAll}
                  size="sm"
                >
                  {selectedGuests.length === availableGuests.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSelectByType('ADULT')}
                  size="sm"
                >
                  Adults ({availableGuests.filter(g => g.type === 'ADULT').length})
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSelectByType('CHILD')}
                  size="sm"
                >
                  Children ({availableGuests.filter(g => g.type === 'CHILD').length})
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSelectByType('FAMILY')}
                  size="sm"
                >
                  Families ({availableGuests.filter(g => g.type === 'FAMILY').length})
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSelectVIP}
                  size="sm"
                >
                  <Star className="w-3 h-3 mr-1" />
                  VIP ({availableGuests.filter(g => g.isVip).length})
                </Button>
              </div>
              
              <div className="flex items-center space-x-2">
                <Badge variant="secondary">
                  {selectedGuests.length} of {availableGuests.length} selected
                </Badge>
                {selectedGuests.length > 0 && (
                  <Button variant="outline" size="sm" onClick={exportGuestList}>
                    <Download className="w-3 h-3 mr-1" />
                    Export Selected
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {availableGuests.map((guest) => (
                <Card key={guest.id} className={selectedGuests.includes(guest.id) ? 'ring-2 ring-blue-500' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        checked={selectedGuests.includes(guest.id)}
                        onCheckedChange={() => handleGuestToggle(guest.id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="font-medium">{guest.name}</p>
                              {guest.isVip && (
                                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                              )}
                            </div>
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                              {guest.email && (
                                <div className="flex items-center space-x-1">
                                  <AtSign className="w-3 h-3" />
                                  <span>{guest.email}</span>
                                </div>
                              )}
                              {guest.phone && planFeatures.smsEnabled && (
                                <div className="flex items-center space-x-1">
                                  <Smartphone className="w-3 h-3" />
                                  <span>{guest.phone}</span>
                                </div>
                              )}
                            </div>
                            {guest.type === 'CHILD' && guest.age && (
                              <p className="text-xs text-gray-500">Age: {guest.age}</p>
                            )}
                            {guest.dietaryReqs && (
                              <p className="text-xs text-orange-600">Dietary: {guest.dietaryReqs}</p>
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
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePreview(guest)}
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        
                        {guest.tags && guest.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {guest.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="customize" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Custom Message
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Add a personal message that will be included in all invitations..."
                    rows={4}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    This message will be added to the end of your selected template
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center">
                    <Send className="w-4 h-4 mr-2" />
                    Delivery Options
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Send Via</Label>
                    <Select value={sendVia} onValueChange={(value: 'email' | 'sms' | 'both') => setSendVia(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">
                          <div className="flex items-center">
                            <AtSign className="w-3 h-3 mr-2" />
                            Email Only
                          </div>
                        </SelectItem>
                        {planFeatures.smsEnabled && (
                          <>
                            <SelectItem value="sms">
                              <div className="flex items-center">
                                <Smartphone className="w-3 h-3 mr-2" />
                                SMS Only
                              </div>
                            </SelectItem>
                            <SelectItem value="both">
                              <div className="flex items-center">
                                <Globe className="w-3 h-3 mr-2" />
                                Email & SMS
                              </div>
                            </SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {planFeatures.scheduling && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="schedule"
                          checked={isScheduling}
                          onCheckedChange={(checked) => setIsScheduling(!!checked)}
                        />
                        <Label htmlFor="schedule">Schedule for later</Label>
                      </div>
                      
                      {isScheduling && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor="schedule-date" className="text-xs">Date</Label>
                            <Input
                              id="schedule-date"
                              type="date"
                              value={scheduleDate}
                              onChange={(e) => setScheduleDate(e.target.value)}
                              min={new Date().toISOString().split('T')[0]}
                            />
                          </div>
                          <div>
                            <Label htmlFor="schedule-time" className="text-xs">Time</Label>
                            <Input
                              id="schedule-time"
                              type="time"
                              value={scheduleTime}
                              onChange={(e) => setScheduleTime(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {!planFeatures.branding && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center">
                      <Image className="w-4 h-4 mr-2" />
                      Branding
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Logo
                      </Button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleLogoUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <p className="text-xs text-gray-500">
                        Add your custom logo to invitations (JPG, PNG, max 2MB)
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="send" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Invitation Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Template:</p>
                    <p className="text-gray-600 flex items-center">
                      {selectedTemplate.isCustom ? (
                        <Edit3 className="w-3 h-3 mr-1" />
                      ) : (
                        <Sparkles className="w-3 h-3 mr-1" />
                      )}
                      {selectedTemplate.name}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Recipients:</p>
                    <p className="text-gray-600">{selectedGuests.length} guests</p>
                  </div>
                  <div>
                    <p className="font-medium">Delivery:</p>
                    <p className="text-gray-600 flex items-center">
                      {sendVia === 'email' && <AtSign className="w-3 h-3 mr-1" />}
                      {sendVia === 'sms' && <Smartphone className="w-3 h-3 mr-1" />}
                      {sendVia === 'both' && <Globe className="w-3 h-3 mr-1" />}
                      {sendVia === 'email' ? 'Email' : sendVia === 'sms' ? 'SMS' : 'Email & SMS'}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Timing:</p>
                    <p className="text-gray-600 flex items-center">
                      {isScheduling ? (
                        <>
                          <Clock className="w-3 h-3 mr-1" />
                          Scheduled for {scheduleDate} at {scheduleTime}
                        </>
                      ) : (
                        <>
                          <Send className="w-3 h-3 mr-1" />
                          Send immediately
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {customMessage && (
                  <div>
                    <p className="font-medium text-sm">Custom Message:</p>
                    <div className="bg-gray-50 p-3 rounded mt-1 border-l-4 border-purple-500">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{customMessage}</p>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="flex space-x-2">
                  {isScheduling ? (
                    <Button
                      onClick={handleScheduleInvitations}
                      disabled={selectedGuests.length === 0 || !scheduleDate || !scheduleTime}
                      className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 text-white"
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      Schedule {selectedGuests.length} Invitations
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSendInvitations}
                      disabled={selectedGuests.length === 0 || isSending}
                      className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 text-white"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {isSending ? 'Sending...' : `Send ${selectedGuests.length} Invitations`}
                    </Button>
                  )}
                  
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
                  <CardTitle className="text-sm">Selected Recipients</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedGuests.map((guestId) => {
                      const guest = guests.find(g => g.id === guestId)
                      if (!guest) return null
                      
                      return (
                        <div key={guest.id} className="flex items-center space-x-2 text-sm p-2 bg-gray-50 rounded">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span className="font-medium">{guest.name}</span>
                          {guest.isVip && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                          <span className="text-gray-500">
                            ({sendVia === 'email' || sendVia === 'both' ? guest.email : guest.phone})
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {planFeatures.analytics && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Analytics enabled: You'll receive delivery confirmations and track RSVP responses in real-time.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Preview Dialog */}
      {previewGuest && (
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Eye className="w-4 h-4 mr-2" />
                Invitation Preview - {previewGuest.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div 
                className="p-6 rounded-lg border"
                style={{ 
                  backgroundColor: selectedTemplate.backgroundColor || '#ffffff',
                  color: selectedTemplate.textColor || '#374151'
                }}
              >
                <div className="mb-4">
                  <Label className="text-sm font-semibold">Subject:</Label>
                  <p className="text-lg font-semibold mt-1">
                    {renderTemplate(selectedTemplate, previewGuest).subject}
                  </p>
                </div>
                <Separator />
                <div className="mt-4">
                  <Label className="text-sm font-semibold">Message:</Label>
                  <div className="mt-2 whitespace-pre-line leading-relaxed">
                    {renderTemplate(selectedTemplate, previewGuest).body}
                  </div>
                </div>
                
                {planFeatures.analytics && (
                  <div className="mt-6 p-4 bg-white rounded border">
                    <Button 
                      className="w-full"
                      style={{ backgroundColor: selectedTemplate.buttonColor || '#8b5cf6' }}
                    >
                      RSVP Now
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="flex justify-between">
                <div className="text-xs text-gray-500">
                  <p>Delivery via: {sendVia === 'email' ? '📧 Email' : sendVia === 'sms' ? '📱 SMS' : '📧📱 Email & SMS'}</p>
                  {isScheduling && <p>⏰ Scheduled for: {scheduleDate} at {scheduleTime}</p>}
                </div>
                
                <div className="space-x-2">
                  <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
                    Close
                  </Button>
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
                    className="bg-gradient-to-r from-purple-500 to-pink-600 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
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