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
  Mail,
  Calendar,
  Timer,
  AlertTriangle,
  CheckCircle,
  CalendarDays
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
  weeksOrDaysBefore?: number;
  dueDate?: Date;
  isOverdue?: boolean;
  status?: 'upcoming' | 'due-soon' | 'overdue' | 'completed';
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

    // Load saved checklist progress from localStorage
    const savedChecklist = localStorage.getItem('partyChecklist');
    if (savedChecklist && savedData) {
      const parsedChecklist = JSON.parse(savedChecklist);
      // Merge saved progress with newly generated checklist
      const data = JSON.parse(savedData);
      const baseChecklist = generateBaseChecklist(data);
      
      const mergedChecklist = baseChecklist.map(baseItem => {
        const savedItem = parsedChecklist.find((saved: ChecklistItem) => saved.id === baseItem.id);
        return savedItem ? { ...baseItem, completed: savedItem.completed } : baseItem;
      });
      
      setChecklist(mergedChecklist);
    }
  }, []);

  const generateBaseChecklist = (data: any): ChecklistItem[] => {
    return [
      // 4-6 weeks before (using 5 weeks as average)
      { id: "1", task: "Send invitations", category: "Planning", completed: false, timeline: "4-6 weeks before", weeksOrDaysBefore: 35 },
      { id: "2", task: "Book venue (if needed)", category: "Planning", completed: false, timeline: "4-6 weeks before", weeksOrDaysBefore: 35 },
      { id: "3", task: "Order party decorations", category: "Decorations", completed: false, timeline: "4-6 weeks before", weeksOrDaysBefore: 35 },
      
      // 2-3 weeks before (using 2.5 weeks as average)
      { id: "4", task: "Plan party menu", category: "Food", completed: false, timeline: "2-3 weeks before", weeksOrDaysBefore: 17 },
      { id: "5", task: "Order birthday cake", category: "Food", completed: false, timeline: "2-3 weeks before", weeksOrDaysBefore: 17 },
      { id: "6", task: "Buy party favors", category: "Gifts", completed: false, timeline: "2-3 weeks before", weeksOrDaysBefore: 17 },
      
      // 1 week before
      { id: "7", task: "Confirm RSVPs", category: "Planning", completed: false, timeline: "1 week before", weeksOrDaysBefore: 7 },
      { id: "8", task: "Grocery shopping", category: "Food", completed: false, timeline: "1 week before", weeksOrDaysBefore: 7 },
      { id: "9", task: "Prepare activity materials", category: "Activities", completed: false, timeline: "1 week before", weeksOrDaysBefore: 7 },
      
      // Day before
      { id: "10", task: "Set up decorations", category: "Decorations", completed: false, timeline: "Day before", weeksOrDaysBefore: 1 },
      { id: "11", task: "Prepare food that can be made ahead", category: "Food", completed: false, timeline: "Day before", weeksOrDaysBefore: 1 },
      { id: "12", task: "Charge camera/phone", category: "Documentation", completed: false, timeline: "Day before", weeksOrDaysBefore: 1 },
      
      // Day of party
      { id: "13", task: "Final setup and decorations", category: "Setup", completed: false, timeline: "Day of party", weeksOrDaysBefore: 0 },
      { id: "14", task: "Prepare fresh food", category: "Food", completed: false, timeline: "Day of party", weeksOrDaysBefore: 0 },
      { id: "15", task: "Set up activity stations", category: "Activities", completed: false, timeline: "Day of party", weeksOrDaysBefore: 0 },
    ];
  };

  const generateChecklist = (data: any) => {
    const partyDate = new Date(data.partyDate);
    const baseChecklist = generateBaseChecklist(data);

    // Check for saved checklist progress
    const savedChecklist = localStorage.getItem('partyChecklist');
    let checklistWithProgress = baseChecklist;
    
    if (savedChecklist) {
      const parsedChecklist = JSON.parse(savedChecklist);
      checklistWithProgress = baseChecklist.map(baseItem => {
        const savedItem = parsedChecklist.find((saved: ChecklistItem) => saved.id === baseItem.id);
        return savedItem ? { ...baseItem, completed: savedItem.completed } : baseItem;
      });
    }

    // Calculate due dates and status for each task
    const checklistWithDates = checklistWithProgress.map(item => {
      const dueDate = new Date(partyDate);
      dueDate.setDate(dueDate.getDate() - (item.weeksOrDaysBefore || 0));
      
      const today = new Date();
      const daysDifference = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      let status: 'upcoming' | 'due-soon' | 'overdue' | 'completed' = 'upcoming';
      
      if (item.completed) {
        status = 'completed';
      } else if (daysDifference < 0) {
        status = 'overdue';
      } else if (daysDifference <= 3) {
        status = 'due-soon';
      }
      
      return {
        ...item,
        dueDate,
        isOverdue: daysDifference < 0 && !item.completed,
        status
      };
    });

    setChecklist(checklistWithDates);
  };

  const toggleChecklistItem = (id: string) => {
    setChecklist(prev => 
      prev.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, completed: !item.completed };
          // Update status when completing/uncompleting
          if (updatedItem.completed) {
            updatedItem.status = 'completed';
          } else {
            // Recalculate status based on current date
            const today = new Date();
            const daysDifference = item.dueDate ? Math.ceil((item.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;
            
            if (daysDifference < 0) {
              updatedItem.status = 'overdue';
            } else if (daysDifference <= 3) {
              updatedItem.status = 'due-soon';
            } else {
              updatedItem.status = 'upcoming';
            }
          }
          return updatedItem;
        }
        return item;
      })
    );
    
    // Persist to localStorage
    const updatedChecklist = checklist.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, completed: !item.completed };
        if (updatedItem.completed) {
          updatedItem.status = 'completed';
        } else {
          const today = new Date();
          const daysDifference = item.dueDate ? Math.ceil((item.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;
          if (daysDifference < 0) {
            updatedItem.status = 'overdue';
          } else if (daysDifference <= 3) {
            updatedItem.status = 'due-soon';
          } else {
            updatedItem.status = 'upcoming';
          }
        }
        return updatedItem;
      }
      return item;
    });
    
    localStorage.setItem('partyChecklist', JSON.stringify(updatedChecklist));
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
  
  // Calculate days until party
  const getDaysUntilParty = () => {
    if (!partyData?.partyDate) return 0;
    const today = new Date();
    const party = new Date(partyData.partyDate);
    const timeDiff = party.getTime() - today.getTime();
    return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  };
  
  const daysUntilParty = getDaysUntilParty();
  
  // Update checklist when party date changes or time passes
  useEffect(() => {
    if (partyData) {
      generateChecklist(partyData);
    }
  }, [partyData?.partyDate]);
  
  // Refresh every hour to update status colors
  useEffect(() => {
    const interval = setInterval(() => {
      if (partyData) {
        generateChecklist(partyData);
      }
    }, 60 * 60 * 1000); // Update every hour
    
    return () => clearInterval(interval);
  }, [partyData]);

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

        {/* Progress Card with Countdown */}
        <Card className="mb-8 border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
          <CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Planning Progress */}
              <div>
                <CardTitle className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Planning Progress
                </CardTitle>
                <CardDescription className="mb-3">
                  {completedTasks} of {totalTasks} tasks completed
                </CardDescription>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Progress</span>
                  <span className="text-lg font-bold text-purple-600">
                    {Math.round(progressPercentage)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-purple-600 to-pink-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>

              {/* Countdown Timer */}
              <div className="flex flex-col items-center justify-center">
                <div className="flex items-center gap-2 mb-2">
                  <Timer className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg">Party Countdown</CardTitle>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {daysUntilParty}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {daysUntilParty === 1 ? 'day left' : daysUntilParty === 0 ? 'Today!' : 'days left'}
                  </div>
                  {daysUntilParty < 0 && (
                    <div className="text-xs text-red-500 mt-1">
                      Party was {Math.abs(daysUntilParty)} {Math.abs(daysUntilParty) === 1 ? 'day' : 'days'} ago
                    </div>
                  )}
                </div>
              </div>
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
                  <Card key={timeline} className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-lg">{timeline}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {timelineTasks.map((item) => {
                          const getStatusColor = (status: string) => {
                            switch (status) {
                              case 'completed':
                                return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20';
                              case 'overdue':
                                return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
                              case 'due-soon':
                                return 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20';
                              default:
                                return 'border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800';
                            }
                          };

                          const getStatusIcon = (status: string) => {
                            switch (status) {
                              case 'completed':
                                return <CheckCircle className="h-4 w-4 text-green-600" />;
                              case 'overdue':
                                return <AlertTriangle className="h-4 w-4 text-red-600" />;
                              case 'due-soon':
                                return <Timer className="h-4 w-4 text-orange-600" />;
                              default:
                                return <Calendar className="h-4 w-4 text-gray-400" />;
                            }
                          };

                          return (
                            <div key={item.id} className={`p-3 rounded-lg border-2 transition-all duration-200 ${getStatusColor(item.status || 'upcoming')}`}>
                              <div className="flex items-center space-x-3">
                                <Checkbox
                                  id={item.id}
                                  checked={item.completed}
                                  onCheckedChange={() => toggleChecklistItem(item.id)}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    {getStatusIcon(item.status || 'upcoming')}
                                    <label
                                      htmlFor={item.id}
                                      className={`text-sm font-medium leading-none cursor-pointer ${
                                        item.completed ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'
                                      }`}
                                    >
                                      {item.task}
                                    </label>
                                  </div>
                                  {item.dueDate && (
                                    <div className="text-xs text-gray-600 dark:text-gray-300 ml-6">
                                      Due: {item.dueDate.toLocaleDateString('en-US', { 
                                        weekday: 'short', 
                                        month: 'short', 
                                        day: 'numeric' 
                                      })}
                                      {item.status === 'overdue' && (
                                        <span className="text-red-600 ml-2 font-semibold">OVERDUE</span>
                                      )}
                                      {item.status === 'due-soon' && (
                                        <span className="text-orange-600 ml-2 font-semibold">DUE SOON</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-xs shrink-0">
                                  {item.category}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
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
            {/* Visual Timeline Chart */}
            <Card className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-blue-600" />
                  Interactive Planning Timeline
                </CardTitle>
                <CardDescription>
                  Visual timeline showing all tasks mapped between today and your party date
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Timeline Header */}
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">Today</span>
                      <span className="text-xs text-gray-600 dark:text-gray-300">
                        {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        {daysUntilParty} days
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300">until party</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <PartyPopper className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium">Party Day</span>
                      <span className="text-xs text-gray-600 dark:text-gray-300">
                        {partyData?.partyDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  {/* Timeline Tasks */}
                  <div className="space-y-4">
                    {checklist
                      .sort((a, b) => (b.weeksOrDaysBefore || 0) - (a.weeksOrDaysBefore || 0))
                      .map((item, index) => {
                        const today = new Date();
                        const partyDate = new Date(partyData?.partyDate || new Date());
                        const totalDays = Math.ceil((partyDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        const taskDaysFromToday = totalDays - (item.weeksOrDaysBefore || 0);
                        const positionPercentage = totalDays > 0 ? Math.max(0, Math.min(100, (taskDaysFromToday / totalDays) * 100)) : 0;

                        const getTaskStatusColor = (status: string, completed: boolean) => {
                          if (completed) return 'bg-green-600 border-green-600 text-white';
                          switch (status) {
                            case 'overdue': return 'bg-red-100 border-red-600 text-red-800 dark:bg-red-900/30 dark:text-red-300';
                            case 'due-soon': return 'bg-orange-100 border-orange-600 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
                            default: return 'bg-blue-100 border-blue-600 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
                          }
                        };

                        return (
                          <div key={item.id} className="relative">
                            {/* Timeline line */}
                            <div className="absolute left-0 top-0 w-full h-12 bg-gradient-to-r from-gray-200 via-gray-300 to-purple-200 dark:from-slate-700 dark:via-slate-600 dark:to-purple-800 rounded-lg opacity-30"></div>
                            
                            {/* Task marker */}
                            <div 
                              className="absolute top-2 transform -translate-x-1/2 z-10"
                              style={{ left: `${positionPercentage}%` }}
                            >
                              <div 
                                className={`p-2 rounded-lg border-2 shadow-md cursor-pointer transition-all duration-200 hover:scale-105 ${getTaskStatusColor(item.status || 'upcoming', item.completed)}`}
                                onClick={() => toggleChecklistItem(item.id)}
                              >
                                <div className="flex items-center gap-2 min-w-max">
                                  {item.completed ? (
                                    <CheckCircle className="h-4 w-4" />
                                  ) : item.status === 'overdue' ? (
                                    <AlertTriangle className="h-4 w-4" />
                                  ) : item.status === 'due-soon' ? (
                                    <Timer className="h-4 w-4" />
                                  ) : (
                                    <Calendar className="h-4 w-4" />
                                  )}
                                  <span className="text-xs font-medium max-w-32 truncate">{item.task}</span>
                                </div>
                                <div className="text-xs opacity-75 mt-1">
                                  {item.dueDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap items-center justify-center gap-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                      <span className="text-xs">Completed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                      <span className="text-xs">On Schedule</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-orange-600 rounded-full"></div>
                      <span className="text-xs">Due Soon (3 days)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                      <span className="text-xs">Overdue</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Traditional Timeline View */}
            <Card className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
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
                    const overdueTasks = timelineTasks.filter(item => item.status === 'overdue').length;
                    const dueSoonTasks = timelineTasks.filter(item => item.status === 'due-soon').length;
                    
                    return (
                      <div key={timeline} className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-semibold ${
                          completedCount === timelineTasks.length && timelineTasks.length > 0
                            ? 'bg-green-600 text-white'
                            : overdueTasks > 0
                            ? 'bg-red-600 text-white'
                            : dueSoonTasks > 0
                            ? 'bg-orange-600 text-white'
                            : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-lg">{timeline}</h3>
                            <div className="flex items-center gap-2">
                              {overdueTasks > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {overdueTasks} overdue
                                </Badge>
                              )}
                              {dueSoonTasks > 0 && (
                                <Badge className="bg-orange-600 text-xs">
                                  {dueSoonTasks} due soon
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                            {completedCount}/{timelineTasks.length} tasks completed
                          </p>
                          <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-3">
                            <div 
                              className={`h-3 rounded-full transition-all duration-300 ${
                                overdueTasks > 0 
                                  ? 'bg-gradient-to-r from-red-600 to-red-400'
                                  : dueSoonTasks > 0
                                  ? 'bg-gradient-to-r from-orange-600 to-orange-400'
                                  : 'bg-gradient-to-r from-purple-600 to-pink-600'
                              }`}
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