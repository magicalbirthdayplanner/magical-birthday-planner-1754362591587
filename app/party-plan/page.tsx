"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import GuestList, { Guest, Invitation } from "@/components/GuestList";
import BulkInvitations from "@/components/BulkInvitations";
import RSVPTracker from "@/components/RSVPTracker";
import { 
  PartyPopper, 
  CheckCircle2, 
  Users, 
  Utensils, 
  Gift, 
  Music, 
  Camera,
  Clock,
  MapPin,
  Palette,
  Download,
  Share2,
  Mail
} from "lucide-react";

interface PartyData {
  childName: string;
  childAge: string;
  partyDate: Date;
  selectedTheme: string;
}

interface ChecklistItem {
  id: string;
  task: string;
  category: string;
  completed: boolean;
  timeline: string;
}

const themeData = {
  superhero: {
    name: "Superhero",
    emoji: "🦸‍♂️",
    colors: ["Red", "Blue", "Yellow", "Silver"],
    decorations: [
      "City skyline backdrops",
      "Comic book speech bubbles",
      "Cape hanging stations",
      "Hero mask crafting table",
      "POW! BOOM! wall decals"
    ],
    activities: [
      "Design your own superhero cape",
      "Hero training obstacle course",
      "Save the day rescue missions",
      "Comic book creation station",
      "Superhero photo booth"
    ],
    food: [
      "Hero sandwiches (cut in lightning bolt shapes)",
      "Power-up fruit kabobs",
      "Blue punch (hero juice)",
      "Captain's shield pizza",
      "Superhero cake with cape topper"
    ]
  },
  princess: {
    name: "Princess",
    emoji: "👸",
    colors: ["Pink", "Purple", "Gold", "Silver"],
    decorations: [
      "Castle backdrop",
      "Flowing fabric drapes",
      "Crown centerpieces",
      "Fairy lights everywhere",
      "Royal throne chair"
    ],
    activities: [
      "Crown decorating station",
      "Royal makeover spa",
      "Princess dress-up corner",
      "Treasure hunt for jewels",
      "Royal dance party"
    ],
    food: [
      "Royal tea sandwiches",
      "Princess punch in fancy cups",
      "Crown-shaped cookies",
      "Castle cake",
      "Pink lemonade in goblets"
    ]
  },
  // Add more themes as needed
};

export default function PartyPlanPage() {
  const [partyData, setPartyData] = useState<PartyData | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  useEffect(() => {
    // Load party data from localStorage
    const savedData = localStorage.getItem('partyData');
    if (savedData) {
      const data = JSON.parse(savedData);
      setPartyData({
        ...data,
        partyDate: new Date(data.partyDate)
      });
      
      // Generate checklist based on party data
      generateChecklist(data);
    }

    // Load guests and invitations from localStorage
    const savedGuests = localStorage.getItem('partyGuests');
    if (savedGuests) {
      setGuests(JSON.parse(savedGuests));
    }

    const savedInvitations = localStorage.getItem('partyInvitations');
    if (savedInvitations) {
      setInvitations(JSON.parse(savedInvitations));
    }
  }, []);

  const generateChecklist = (data: any) => {
    const baseChecklist: ChecklistItem[] = [
      // 4-6 weeks before
      { id: "1", task: "Send invitations", category: "Planning", completed: false, timeline: "4-6 weeks before" },
      { id: "2", task: "Book venue (if needed)", category: "Planning", completed: false, timeline: "4-6 weeks before" },
      { id: "3", task: "Order party decorations", category: "Decorations", completed: false, timeline: "4-6 weeks before" },
      
      // 2-3 weeks before
      { id: "4", task: "Plan party menu", category: "Food", completed: false, timeline: "2-3 weeks before" },
      { id: "5", task: "Order birthday cake", category: "Food", completed: false, timeline: "2-3 weeks before" },
      { id: "6", task: "Buy party favors", category: "Gifts", completed: false, timeline: "2-3 weeks before" },
      
      // 1 week before
      { id: "7", task: "Confirm RSVPs", category: "Planning", completed: false, timeline: "1 week before" },
      { id: "8", task: "Grocery shopping", category: "Food", completed: false, timeline: "1 week before" },
      { id: "9", task: "Prepare activity materials", category: "Activities", completed: false, timeline: "1 week before" },
      
      // Day before
      { id: "10", task: "Set up decorations", category: "Decorations", completed: false, timeline: "Day before" },
      { id: "11", task: "Prepare food that can be made ahead", category: "Food", completed: false, timeline: "Day before" },
      { id: "12", task: "Charge camera/phone", category: "Documentation", completed: false, timeline: "Day before" },
      
      // Day of party
      { id: "13", task: "Final setup and decorations", category: "Setup", completed: false, timeline: "Day of party" },
      { id: "14", task: "Prepare fresh food", category: "Food", completed: false, timeline: "Day of party" },
      { id: "15", task: "Set up activity stations", category: "Activities", completed: false, timeline: "Day of party" },
    ];

    setChecklist(baseChecklist);
  };

  const toggleChecklistItem = (id: string) => {
    setChecklist(prev => 
      prev.map(item => 
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  // Guest management functions
  const handleAddGuest = (guestData: Omit<Guest, 'id'>) => {
    const newGuest: Guest = {
      ...guestData,
      id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    const updatedGuests = [...guests, newGuest];
    setGuests(updatedGuests);
    localStorage.setItem('partyGuests', JSON.stringify(updatedGuests));
  };

  const handleEditGuest = (id: string, guestData: Partial<Guest>) => {
    const updatedGuests = guests.map(guest => 
      guest.id === id ? { ...guest, ...guestData } : guest
    );
    setGuests(updatedGuests);
    localStorage.setItem('partyGuests', JSON.stringify(updatedGuests));
  };

  const handleDeleteGuest = (id: string) => {
    const updatedGuests = guests.filter(guest => guest.id !== id);
    setGuests(updatedGuests);
    localStorage.setItem('partyGuests', JSON.stringify(updatedGuests));
    
    // Also remove any invitations for this guest
    const updatedInvitations = invitations.filter(inv => inv.guestId !== id);
    setInvitations(updatedInvitations);
    localStorage.setItem('partyInvitations', JSON.stringify(updatedInvitations));
  };

  const handleSendInvitation = (guestId: string, message: string) => {
    const newInvitation: Invitation = {
      id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      guestId,
      status: 'SENT',
      sentAt: new Date(),
      message
    };
    
    const updatedInvitations = [...invitations.filter(inv => inv.guestId !== guestId), newInvitation];
    setInvitations(updatedInvitations);
    localStorage.setItem('partyInvitations', JSON.stringify(updatedInvitations));
  };

  const handleSendBulkInvitations = (guestIds: string[], templateId: string, customMessage: string) => {
    const newInvitations = guestIds.map(guestId => ({
      id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${guestId}`,
      guestId,
      status: 'SENT' as const,
      sentAt: new Date(),
      message: customMessage
    }));
    
    const filteredExistingInvitations = invitations.filter(inv => !guestIds.includes(inv.guestId));
    const updatedInvitations = [...filteredExistingInvitations, ...newInvitations];
    setInvitations(updatedInvitations);
    localStorage.setItem('partyInvitations', JSON.stringify(updatedInvitations));
  };

  const handleUpdateRSVP = (invitationId: string, status: Invitation['status'], notes?: string) => {
    const updatedInvitations = invitations.map(inv => 
      inv.id === invitationId 
        ? { ...inv, status, notes, respondedAt: new Date() }
        : inv
    );
    setInvitations(updatedInvitations);
    localStorage.setItem('partyInvitations', JSON.stringify(updatedInvitations));
  };

  const handleSendReminder = (guestId: string, message: string) => {
    // In a real app, this would send an email reminder
    console.log(`Sending reminder to guest ${guestId}:`, message);
    // For now, just update the sent date
    const updatedInvitations = invitations.map(inv => 
      inv.guestId === guestId 
        ? { ...inv, sentAt: new Date() }
        : inv
    );
    setInvitations(updatedInvitations);
    localStorage.setItem('partyInvitations', JSON.stringify(updatedInvitations));
  };

  const getThemeDetails = () => {
    if (!partyData?.selectedTheme) return null;
    return themeData[partyData.selectedTheme as keyof typeof themeData];
  };

  const completedTasks = checklist.filter(item => item.completed).length;
  const totalTasks = checklist.length;
  const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  if (!partyData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300 mb-4">Loading your party plan...</p>
          <Button onClick={() => window.location.href = '/create-party'}>
            Go back to create party
          </Button>
        </div>
      </div>
    );
  }

  const themeDetails = getThemeDetails();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 rounded-full">
              <PartyPopper className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-yellow-600 bg-clip-text text-transparent mb-2">
            {partyData.childName}'s {themeDetails?.name} Party Plan
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Age {partyData.childAge} • {partyData.partyDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        {/* Progress Card */}
        <Card className="mb-8 border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Planning Progress
                </CardTitle>
                <CardDescription>
                  {completedTasks} of {totalTasks} tasks completed
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round(progressPercentage)}%
                </div>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-purple-600 to-pink-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </CardHeader>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-8">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <PartyPopper className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="checklist" className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Checklist
            </TabsTrigger>
            <TabsTrigger value="guests" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Guests
            </TabsTrigger>
            <TabsTrigger value="invitations" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Invitations
            </TabsTrigger>
            <TabsTrigger value="inspiration" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Theme Board
            </TabsTrigger>
            <TabsTrigger value="timeline" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Timeline
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Theme Card */}
              <Card className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">{themeDetails?.emoji}</span>
                    {themeDetails?.name} Theme
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <h4 className="font-semibold">Color Palette:</h4>
                    <div className="flex flex-wrap gap-2">
                      {themeDetails?.colors.map((color, index) => (
                        <Badge key={index} variant="secondary">{color}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Guest Stats */}
              <Card className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Guest Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Guests</span>
                    <Badge variant="secondary">{guests.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Invitations Sent</span>
                    <Badge variant="outline">
                      {invitations.filter(inv => inv.status === 'SENT' || inv.status === 'ACCEPTED' || inv.status === 'DECLINED' || inv.status === 'MAYBE').length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">RSVPs Received</span>
                    <Badge variant="default">
                      {invitations.filter(inv => inv.status === 'ACCEPTED' || inv.status === 'DECLINED' || inv.status === 'MAYBE').length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Confirmed Attendees</span>
                    <Badge className="bg-green-600">
                      {invitations.filter(inv => inv.status === 'ACCEPTED').length}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Actions Card */}
              <Card className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full" variant="outline">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Plan
                  </Button>
                  <Button className="w-full" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button 
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                    onClick={() => {
                      const guestsTab = document.querySelector('[value="guests"]') as HTMLButtonElement;
                      if (guestsTab) guestsTab.click();
                    }}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Manage Guests ({guests.length})
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Checklist Tab */}
          <TabsContent value="checklist" className="space-y-6">
            <div className="grid gap-4">
              {['4-6 weeks before', '2-3 weeks before', '1 week before', 'Day before', 'Day of party'].map((timeline) => {
                const timelineTasks = checklist.filter(item => item.timeline === timeline);
                if (timelineTasks.length === 0) return null;

                return (
                  <Card key={timeline} className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-lg">{timeline}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {timelineTasks.map((item) => (
                          <div key={item.id} className="flex items-center space-x-3">
                            <Checkbox
                              id={item.id}
                              checked={item.completed}
                              onCheckedChange={() => toggleChecklistItem(item.id)}
                            />
                            <label
                              htmlFor={item.id}
                              className={`flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                                item.completed ? 'line-through text-gray-500 dark:text-gray-400' : ''
                              }`}
                            >
                              {item.task}
                            </label>
                            <Badge variant="outline" className="text-xs">
                              {item.category}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Guests Tab */}
          <TabsContent value="guests" className="space-y-6">
            <GuestList
              partyId={partyData?.childName || 'party'}
              guests={guests}
              invitations={invitations}
              onAddGuest={handleAddGuest}
              onEditGuest={handleEditGuest}
              onDeleteGuest={handleDeleteGuest}
              onSendInvitation={handleSendInvitation}
              onUpdateRSVP={handleUpdateRSVP}
            />
          </TabsContent>

          {/* Invitations Tab */}
          <TabsContent value="invitations" className="space-y-6">
            <Tabs defaultValue="bulk" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="bulk">Bulk Invitations</TabsTrigger>
                <TabsTrigger value="rsvp">RSVP Tracking</TabsTrigger>
              </TabsList>
              
              <TabsContent value="bulk" className="mt-6">
                <BulkInvitations
                  partyId={partyData?.childName || 'party'}
                  childName={partyData?.childName || ''}
                  childAge={parseInt(partyData?.childAge || '0')}
                  partyDate={partyData?.partyDate.toISOString() || ''}
                  partyTime="2:00 PM"
                  partyLocation="TBD"
                  theme={partyData?.selectedTheme || ''}
                  guests={guests}
                  invitations={invitations}
                  onSendBulkInvitations={handleSendBulkInvitations}
                />
              </TabsContent>
              
              <TabsContent value="rsvp" className="mt-6">
                <RSVPTracker
                  partyId={partyData?.childName || 'party'}
                  childName={partyData?.childName || ''}
                  partyDate={partyData?.partyDate.toISOString() || ''}
                  guests={guests}
                  invitations={invitations}
                  onUpdateRSVP={handleUpdateRSVP}
                  onSendReminder={handleSendReminder}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Theme Board Tab */}
          <TabsContent value="inspiration" className="space-y-6">
            {themeDetails && (
              <div className="grid gap-6">
                {/* Decorations */}
                <Card className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PartyPopper className="h-5 w-5" />
                      Decorations & Setup
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {themeDetails.decorations.map((item, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="text-sm">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Activities */}
                <Card className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Activities & Games
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {themeDetails.activities.map((item, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="text-sm">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Food & Treats */}
                <Card className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Utensils className="h-5 w-5" />
                      Food & Treats
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {themeDetails.food.map((item, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="text-sm">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Party Planning Timeline</CardTitle>
                <CardDescription>
                  Follow this timeline to ensure everything is ready for the big day
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {['4-6 weeks before', '2-3 weeks before', '1 week before', 'Day before', 'Day of party'].map((timeline, index) => {
                    const timelineTasks = checklist.filter(item => item.timeline === timeline);
                    const completedCount = timelineTasks.filter(item => item.completed).length;
                    
                    return (
                      <div key={timeline} className="flex items-start gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          completedCount === timelineTasks.length && timelineTasks.length > 0
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold mb-2">{timeline}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                            {completedCount}/{timelineTasks.length} tasks completed
                          </p>
                          <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all duration-300"
                              style={{ 
                                width: timelineTasks.length > 0 ? `${(completedCount / timelineTasks.length) * 100}%` : '0%' 
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}