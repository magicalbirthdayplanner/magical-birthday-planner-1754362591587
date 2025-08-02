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
import SmartBudgetAssistant from "@/components/SmartBudgetAssistant";
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
  CalendarDays,
  Flag,
  Star,
  Edit3,
  Plus,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  MoreHorizontal,
  Trash2,
  Save,
  X,
  Info,
  DollarSign,
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
  const [showCompleted, setShowCompleted] = useState(true);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingDate, setEditingDate] = useState("");
  const [timelineView, setTimelineView] = useState<'horizontal' | 'vertical'>('horizontal');
  const [isTimelineCollapsed, setIsTimelineCollapsed] = useState(false);
  const [timelineDensity, setTimelineDensity] = useState<'compact' | 'expanded'>('expanded');
  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Set<string>>(new Set(['Venue and RSVP', 'Decorations', 'Activities', 'Planning', 'Setup', 'Food', 'Gifts', 'Documentation']));
  const [budgetRefresh, setBudgetRefresh] = useState(0);

  // Helper function to get budget data
  const getBudgetData = () => {
    if (typeof window === 'undefined') return { totalBudget: 0, totalSpent: 0, percentage: 0 };
    
    try {
      const savedBudget = localStorage.getItem(`budget_${partyData?.childName || 'party'}`);
      if (savedBudget) {
        const data = JSON.parse(savedBudget);
        const totalBudget = data.totalBudget || 0;
        const totalSpent = data.categories ? data.categories.reduce((sum: number, cat: any) => sum + (cat.spent || 0), 0) : 0;
        const percentage = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;
        return { totalBudget, totalSpent, percentage };
      }
    } catch (error) {
      console.error('Error getting budget data:', error);
    }
    
    return { totalBudget: 0, totalSpent: 0, percentage: 0 };
  };

  // Refresh budget data periodically to sync with changes
  useEffect(() => {
    const interval = setInterval(() => {
      setBudgetRefresh(prev => prev + 1);
    }, 2000); // Refresh every 2 seconds
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Check if we're on the client side to avoid hydration issues
    if (typeof window !== 'undefined') {
      try {
        // Load party data from localStorage
        const savedData = localStorage.getItem('partyData');
        if (savedData) {
          const data = JSON.parse(savedData);
          // Safely handle partyDate conversion with validation
          let partyDate;
          try {
            partyDate = data.partyDate ? new Date(data.partyDate) : new Date();
            // Validate the date object
            if (isNaN(partyDate.getTime())) {
              partyDate = new Date();
            }
          } catch (error) {
            console.error('Error parsing party date:', error);
            partyDate = new Date();
          }
          
          setPartyData({
            ...data,
            partyDate: partyDate
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
      } catch (error) {
        console.error('Error loading party data from localStorage:', error);
        // Clear corrupted data
        localStorage.removeItem('partyData');
        localStorage.removeItem('partyGuests');
        localStorage.removeItem('partyInvitations');
        localStorage.removeItem('partyChecklist');
      }
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
    // Safely handle partyDate with validation
    let partyDate;
    try {
      partyDate = data.partyDate ? new Date(data.partyDate) : new Date();
      // Validate the date object
      if (isNaN(partyDate.getTime())) {
        partyDate = new Date();
      }
    } catch (error) {
      console.error('Error parsing party date in generateChecklist:', error);
      partyDate = new Date();
    }
    
    const baseChecklist = generateBaseChecklist(data);

    let checklistWithProgress = baseChecklist;
    
    // Check for saved checklist progress only on client side
    if (typeof window !== 'undefined') {
      try {
        const savedChecklist = localStorage.getItem('partyChecklist');
        if (savedChecklist) {
          const parsedChecklist = JSON.parse(savedChecklist);
          checklistWithProgress = baseChecklist.map(baseItem => {
            const savedItem = parsedChecklist.find((saved: ChecklistItem) => saved.id === baseItem.id);
            return savedItem ? { ...baseItem, completed: savedItem.completed } : baseItem;
          });
        }
      } catch (error) {
        console.error('Error loading checklist from localStorage:', error);
        // Use base checklist if there's an error
        checklistWithProgress = baseChecklist;
      }
    }

    // Calculate due dates and status for each task
    const checklistWithDates = checklistWithProgress.map(item => {
      let dueDate;
      let daysDifference = 0;
      
      try {
        dueDate = new Date(partyDate);
        // Validate the dueDate object
        if (isNaN(dueDate.getTime())) {
          dueDate = new Date();
        }
        dueDate.setDate(dueDate.getDate() - (item.weeksOrDaysBefore || 0));
        
        const today = new Date();
        // Safely calculate the difference with validation
        if (!isNaN(dueDate.getTime()) && !isNaN(today.getTime())) {
          daysDifference = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }
      } catch (error) {
        console.error('Error calculating due date for task:', item.task, error);
        dueDate = new Date();
        daysDifference = 0;
      }
      
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
            let daysDifference = 0;
            try {
              const today = new Date();
              if (item.dueDate && !isNaN(item.dueDate.getTime()) && !isNaN(today.getTime())) {
                daysDifference = Math.ceil((item.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              }
            } catch (error) {
              console.error('Error recalculating status:', error);
              daysDifference = 0;
            }
            
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
    
    // Persist to localStorage only on client side
    if (typeof window !== 'undefined') {
      try {
        const updatedChecklist = checklist.map(item => {
          if (item.id === id) {
            const updatedItem = { ...item, completed: !item.completed };
            if (updatedItem.completed) {
              updatedItem.status = 'completed';
            } else {
              let daysDifference = 0;
              try {
                const today = new Date();
                if (item.dueDate && !isNaN(item.dueDate.getTime()) && !isNaN(today.getTime())) {
                  daysDifference = Math.ceil((item.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                }
              } catch (error) {
                console.error('Error calculating days difference:', error);
                daysDifference = 0;
              }
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
      } catch (error) {
        console.error('Error saving checklist to localStorage:', error);
      }
    }
  };

  // Guest management functions
  const handleAddGuest = (guestData: Omit<Guest, 'id'>) => {
    const newGuest: Guest = {
      ...guestData,
      id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    const updatedGuests = [...guests, newGuest];
    setGuests(updatedGuests);
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('partyGuests', JSON.stringify(updatedGuests));
      } catch (error) {
        console.error('Error saving guests to localStorage:', error);
      }
    }
  };

  const handleEditGuest = (id: string, guestData: Partial<Guest>) => {
    const updatedGuests = guests.map(guest => 
      guest.id === id ? { ...guest, ...guestData } : guest
    );
    setGuests(updatedGuests);
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('partyGuests', JSON.stringify(updatedGuests));
      } catch (error) {
        console.error('Error saving guests to localStorage:', error);
      }
    }
  };

  const handleDeleteGuest = (id: string) => {
    const updatedGuests = guests.filter(guest => guest.id !== id);
    setGuests(updatedGuests);
    
    // Also remove any invitations for this guest
    const updatedInvitations = invitations.filter(inv => inv.guestId !== id);
    setInvitations(updatedInvitations);
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('partyGuests', JSON.stringify(updatedGuests));
        localStorage.setItem('partyInvitations', JSON.stringify(updatedInvitations));
      } catch (error) {
        console.error('Error saving data to localStorage:', error);
      }
    }
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
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('partyInvitations', JSON.stringify(updatedInvitations));
      } catch (error) {
        console.error('Error saving invitations to localStorage:', error);
      }
    }
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
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('partyInvitations', JSON.stringify(updatedInvitations));
      } catch (error) {
        console.error('Error saving invitations to localStorage:', error);
      }
    }
  };

  const handleUpdateRSVP = (invitationId: string, status: Invitation['status'], notes?: string) => {
    const updatedInvitations = invitations.map(inv => 
      inv.id === invitationId 
        ? { ...inv, status, notes, respondedAt: new Date() }
        : inv
    );
    setInvitations(updatedInvitations);
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('partyInvitations', JSON.stringify(updatedInvitations));
      } catch (error) {
        console.error('Error saving invitations to localStorage:', error);
      }
    }
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
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('partyInvitations', JSON.stringify(updatedInvitations));
      } catch (error) {
        console.error('Error saving invitations to localStorage:', error);
      }
    }
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
    try {
      const today = new Date();
      const party = new Date(partyData.partyDate);
      
      // Validate both date objects
      if (isNaN(today.getTime()) || isNaN(party.getTime())) {
        return 0;
      }
      
      const timeDiff = party.getTime() - today.getTime();
      return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    } catch (error) {
      console.error('Error calculating days until party:', error);
      return 0;
    }
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

              {/* Budget Overview */}
              <div 
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-lg p-2 -m-2 transition-colors"
                onClick={() => {
                  const budgetTab = document.querySelector('[value="budget"]') as HTMLButtonElement;
                  if (budgetTab) budgetTab.click();
                }}
              >
                <CardTitle className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Budget Tracker
                </CardTitle>
                <CardDescription className="mb-3">
                  {(() => {
                    const { totalBudget, totalSpent } = getBudgetData(); 
                    return totalBudget > 0 ? `$${totalSpent.toFixed(0)} of $${totalBudget} spent` : 'Click to set budget';
                  })()}
                </CardDescription>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Budget Used</span>
                  <span className="text-lg font-bold text-green-600">
                    {Math.round(getBudgetData().percentage)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-green-600 to-emerald-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${getBudgetData().percentage}%` }}
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
          <TabsList className="grid w-full grid-cols-7 mb-8">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <PartyPopper className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="budget" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Budget
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

          {/* Budget Tab */}
          <TabsContent value="budget" className="space-y-6">
            <SmartBudgetAssistant
              partyId={partyData?.childName || 'party'}
              childName={partyData?.childName || ''}
              childAge={parseInt(partyData?.childAge || '0')}
              partyDate={partyData?.partyDate && !isNaN(partyData.partyDate.getTime()) ? partyData.partyDate.toISOString() : ''}
              theme={partyData?.selectedTheme || ''}
              guestCount={guests.length}
            />
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
                  partyDate={partyData?.partyDate && !isNaN(partyData.partyDate.getTime()) ? partyData.partyDate.toISOString() : ''}
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
                  partyDate={partyData?.partyDate && !isNaN(partyData.partyDate.getTime()) ? partyData.partyDate.toISOString() : ''}
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
            {/* Interactive Timeline */}
            <Card className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-blue-600" />
                    <CardTitle>Interactive Planning Timeline</CardTitle>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCompleted(!showCompleted)}
                      className="text-xs"
                    >
                      {showCompleted ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                      {showCompleted ? 'Hide' : 'Show'} Completed
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTimelineView(timelineView === 'horizontal' ? 'vertical' : 'horizontal')}
                      className="text-xs"
                    >
                      {timelineView === 'horizontal' ? 'Vertical' : 'Horizontal'} View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTimelineDensity(timelineDensity === 'compact' ? 'expanded' : 'compact')}
                      className="text-xs"
                    >
                      {timelineDensity === 'compact' ? <Plus className="h-3 w-3 mr-1" /> : <MoreHorizontal className="h-3 w-3 mr-1" />}
                      {timelineDensity === 'compact' ? 'Expand' : 'Compact'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Enhanced Swimlane Timeline System */}
                {(() => {
                  // Group tasks by category (swimlanes)
                  const swimlanes: { [key: string]: { icon: React.ReactElement, tasks: ChecklistItem[], color: string } } = {
                    'Venue and RSVP': { icon: <MapPin className="h-4 w-4" />, tasks: [], color: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' },
                    'Decorations': { icon: <Palette className="h-4 w-4" />, tasks: [], color: 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800' },
                    'Activities': { icon: <Users className="h-4 w-4" />, tasks: [], color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
                    'Food': { icon: <Utensils className="h-4 w-4" />, tasks: [], color: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' },
                    'Planning': { icon: <Calendar className="h-4 w-4" />, tasks: [], color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
                    'Setup': { icon: <CheckCircle2 className="h-4 w-4" />, tasks: [], color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
                    'Gifts': { icon: <Gift className="h-4 w-4" />, tasks: [], color: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' },
                    'Documentation': { icon: <Camera className="h-4 w-4" />, tasks: [], color: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' }
                  };

                  // Distribute tasks into appropriate swimlanes
                  checklist
                    .filter(item => showCompleted || !item.completed)
                    .forEach(item => {
                      const category = item.category;
                      if (swimlanes[category]) {
                        swimlanes[category].tasks.push(item);
                      } else {
                        // Fallback to Planning if category doesn't exist
                        swimlanes['Planning'].tasks.push(item);
                      }
                    });

                  // Helper functions
                  const getStatusIcon = (item: ChecklistItem) => {
                    if (item.completed) return <CheckCircle className="h-4 w-4 text-green-600" />;
                    if (item.status === 'overdue') return <AlertTriangle className="h-4 w-4 text-red-500" />;
                    if (item.status === 'due-soon') return <Timer className="h-4 w-4 text-orange-500" />;
                    return <Clock className="h-4 w-4 text-blue-500" />;
                  };

                  const getTaskCardStyle = (item: ChecklistItem) => {
                    if (item.completed) return 'bg-gray-100 dark:bg-slate-700 border-gray-300 dark:border-slate-600 opacity-75';
                    if (item.status === 'overdue') return 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-600';
                    if (item.status === 'due-soon') return 'bg-orange-50 dark:bg-orange-900/30 border-orange-300 dark:border-orange-600';
                    return 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600';
                  };

                  const calculatePosition = (item: ChecklistItem) => {
                    try {
                      const today = new Date();
                      const partyDate = new Date(partyData?.partyDate || new Date());
                      
                      // Validate date objects
                      if (isNaN(today.getTime()) || isNaN(partyDate.getTime())) {
                        return 50; // Default position if dates are invalid
                      }
                      
                      const totalDays = Math.max(1, Math.ceil((partyDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
                      const taskDaysFromToday = item.dueDate && !isNaN(item.dueDate.getTime()) ? Math.ceil((item.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                      return Math.max(5, Math.min(95, ((totalDays - taskDaysFromToday) / totalDays) * 90 + 5));
                    } catch (error) {
                      console.error('Error calculating position:', error);
                      return 50; // Default position
                    }
                  };

                  const toggleSwimlane = (swimlaneName: string) => {
                    const newCollapsed = new Set(collapsedSwimlanes);
                    if (newCollapsed.has(swimlaneName)) {
                      newCollapsed.delete(swimlaneName);
                    } else {
                      newCollapsed.add(swimlaneName);
                    }
                    setCollapsedSwimlanes(newCollapsed);
                  };

                  // Group tasks by dates for smart collapsing
                  const groupTasksByDate = (tasks: ChecklistItem[]) => {
                    const groups: { [date: string]: ChecklistItem[] } = {};
                    tasks.forEach(task => {
                      if (task.dueDate) {
                        const dateKey = task.dueDate.toDateString();
                        if (!groups[dateKey]) groups[dateKey] = [];
                        groups[dateKey].push(task);
                      }
                    });
                    return groups;
                  };

                  return (
                    <div className="space-y-1">
                      {/* Fixed Timeline Header with TODAY and PARTY DAY markers */}
                      <div className={`sticky top-0 z-30 bg-gradient-to-r from-green-100 via-blue-100 via-purple-100 to-pink-100 dark:from-green-900/30 dark:via-blue-900/30 dark:via-purple-900/30 dark:to-pink-900/30 p-4 rounded-lg border-2 border-dashed border-purple-300 dark:border-purple-600 ${timelineDensity === 'compact' ? 'py-2' : 'py-4'}`}>
                        <div className="relative flex items-center justify-between">
                          {/* TODAY Marker - Fixed Left */}
                          <div className="flex items-center gap-2 bg-green-500 text-white px-3 py-1 rounded-full shadow-lg">
                            <Flag className="h-4 w-4" />
                            <div className="text-sm font-bold">TODAY</div>
                            <div className="text-xs opacity-90">
                              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                          </div>

                          {/* Countdown Center */}
                          <div className="text-center px-4">
                            <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                              {daysUntilParty}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-300">
                              {daysUntilParty === 1 ? 'day until party!' : daysUntilParty === 0 ? 'Party is today!' : daysUntilParty < 0 ? 'days since party' : 'days until party!'}
                            </div>
                          </div>

                          {/* PARTY DAY Marker - Fixed Right */}
                          <div className="flex items-center gap-2 bg-purple-500 text-white px-3 py-1 rounded-full shadow-lg">
                            <Star className="h-4 w-4" />
                            <div className="text-sm font-bold">PARTY DAY</div>
                            <div className="text-xs opacity-90">
                              {partyData?.partyDate && !isNaN(partyData.partyDate.getTime()) ? partyData.partyDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD'}
                            </div>
                          </div>
                        </div>
                        
                        {/* Timeline Progress Bar */}
                        <div className="mt-3 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-green-400 to-purple-400 rounded-full transition-all duration-500"
                            style={{ 
                              width: `${(() => {
                                try {
                                  if (partyData?.partyDate && !isNaN(partyData.partyDate.getTime()) && daysUntilParty > 0) {
                                    const today = new Date();
                                    if (!isNaN(today.getTime())) {
                                      return Math.max(0, Math.min(100, ((today.getTime() - (partyData.partyDate.getTime() - (daysUntilParty * 24 * 60 * 60 * 1000))) / (daysUntilParty * 24 * 60 * 60 * 1000)) * 100));
                                    }
                                  }
                                  return 0;
                                } catch (error) {
                                  console.error('Error calculating progress:', error);
                                  return 0;
                                }
                              })()}%` 
                            }}
                          />
                        </div>
                      </div>

                      {/* Swimlanes */}
                      {Object.entries(swimlanes).map(([swimlaneName, swimlaneData]) => {
                        if (swimlaneData.tasks.length === 0) return null;
                        
                        const isCollapsed = collapsedSwimlanes.has(swimlaneName);
                        const dateGroups = groupTasksByDate(swimlaneData.tasks);
                        const hasOverdueOrDueSoon = swimlaneData.tasks.some(task => task.status === 'overdue' || task.status === 'due-soon');

                        return (
                          <div key={swimlaneName} className={`border-2 rounded-lg overflow-hidden transition-all duration-300 ${swimlaneData.color}`}>
                            {/* Swimlane Header */}
                            <div 
                              className="flex items-center justify-between p-3 bg-white/50 dark:bg-slate-800/50 cursor-pointer hover:bg-white/70 dark:hover:bg-slate-800/70 transition-colors"
                              onClick={() => toggleSwimlane(swimlaneName)}
                            >
                              <div className="flex items-center gap-3">
                                {swimlaneData.icon}
                                <div className="font-semibold text-gray-800 dark:text-gray-200">{swimlaneName}</div>
                                <Badge variant="outline" className="text-xs">
                                  {swimlaneData.tasks.length} tasks
                                </Badge>
                                {hasOverdueOrDueSoon && (
                                  <Badge variant="destructive" className="text-xs animate-pulse">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Needs Attention
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {/* Progress indicator */}
                                <div className="flex items-center gap-1">
                                  <div className="text-xs text-gray-600 dark:text-gray-400">
                                    {Math.round((swimlaneData.tasks.filter(t => t.completed).length / swimlaneData.tasks.length) * 100)}%
                                  </div>
                                  <div className="w-12 h-2 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-green-400 transition-all duration-300"
                                      style={{ width: `${(swimlaneData.tasks.filter(t => t.completed).length / swimlaneData.tasks.length) * 100}%` }}
                                    />
                                  </div>
                                </div>
                                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                              </div>
                            </div>

                            {/* Swimlane Content */}
                            {!isCollapsed && (
                              <div className="p-3 space-y-3">
                                {timelineDensity === 'compact' ? (
                                  /* Compact View - Group dense dates */
                                  Object.entries(dateGroups).map(([dateKey, tasksForDate]) => (
                                    <div key={dateKey} className="space-y-2">
                                      {tasksForDate.length > 1 ? (
                                        /* Multiple tasks on same date - grouped */
                                        <div className="bg-white/70 dark:bg-slate-800/70 rounded-lg p-3 border border-gray-200 dark:border-slate-600">
                                          <div className="flex items-center gap-2 mb-2">
                                            <CalendarDays className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                                            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                              Due {new Date(dateKey).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </div>
                                            <Badge variant="outline" className="text-xs">
                                              {tasksForDate.length} tasks
                                            </Badge>
                                          </div>
                                          <div className="grid gap-2">
                                            {tasksForDate.map(task => (
                                              <div key={task.id} className={`flex items-center gap-2 p-2 rounded border ${getTaskCardStyle(task)} cursor-pointer hover:shadow-sm transition-shadow`}>
                                                <div onClick={() => toggleChecklistItem(task.id)} className="flex items-center gap-2 flex-1">
                                                  {getStatusIcon(task)}
                                                  <span className={`text-sm ${task.completed ? 'line-through opacity-70' : ''}`}>
                                                    {task.task}
                                                  </span>
                                                </div>
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  className="h-6 w-6 p-0"
                                                  onClick={() => {
                                                    if (editingTask === task.id) {
                                                      setEditingTask(null);
                                                    } else {
                                                      setEditingTask(task.id);
                                                      setEditingText(task.task);
                                                      setEditingDate(task.dueDate && !isNaN(task.dueDate.getTime()) ? task.dueDate.toISOString().split('T')[0] : "");
                                                    }
                                                  }}
                                                >
                                                  <Edit3 className="h-3 w-3" />
                                                </Button>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ) : (
                                        /* Single task */
                                        tasksForDate.map(task => (
                                          <div key={task.id} className={`p-3 rounded-lg border-2 shadow-sm transition-all duration-300 hover:shadow-md ${getTaskCardStyle(task)}`}>
                                            <div className="flex items-center justify-between mb-2">
                                              <div className="flex items-center gap-2">
                                                {getStatusIcon(task)}
                                                <span className={`font-medium ${task.completed ? 'line-through opacity-70' : ''}`}>
                                                  {task.task}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  className="h-6 w-6 p-0"
                                                  onClick={() => {
                                                    if (editingTask === task.id) {
                                                      setEditingTask(null);
                                                    } else {
                                                      setEditingTask(task.id);
                                                      setEditingText(task.task);
                                                      setEditingDate(task.dueDate && !isNaN(task.dueDate.getTime()) ? task.dueDate.toISOString().split('T')[0] : "");
                                                    }
                                                  }}
                                                >
                                                  <Edit3 className="h-3 w-3" />
                                                </Button>
                                                <div 
                                                  className="cursor-pointer"
                                                  onClick={() => toggleChecklistItem(task.id)}
                                                >
                                                  <Badge variant="outline" className="text-xs">
                                                    {task.completed ? 'Done' : task.status === 'overdue' ? 'Overdue' : task.status === 'due-soon' ? 'Due Soon' : 'Upcoming'}
                                                  </Badge>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="text-xs text-gray-600 dark:text-gray-400">
                                              Due: {task.dueDate?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                              {task.dueDate && (
                                                <span className="ml-2">
                                                  {(() => {
                                                    try {
                                                      if (task.dueDate && !isNaN(task.dueDate.getTime())) {
                                                        const today = new Date();
                                                        if (!isNaN(today.getTime())) {
                                                          const days = Math.abs(Math.ceil((task.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
                                                          const isUpcoming = task.dueDate.getTime() > today.getTime();
                                                          return `(${days} days ${isUpcoming ? 'left' : 'ago'})`;
                                                        }
                                                      }
                                                      return '';
                                                    } catch (error) {
                                                      console.error('Error calculating task countdown:', error);
                                                      return '';
                                                    }
                                                  })()}
                                                </span>
                                              )}
                                            </div>
                                            
                                            {/* Editing Interface */}
                                            {editingTask === task.id && (
                                              <div className="mt-3 pt-3 border-t space-y-2">
                                                <input
                                                  type="text"
                                                  value={editingText}
                                                  onChange={(e) => setEditingText(e.target.value)}
                                                  className="w-full p-2 border rounded-lg bg-white dark:bg-slate-700 dark:border-slate-600 text-sm"
                                                  placeholder="Task description"
                                                />
                                                <input
                                                  type="date"
                                                  value={editingDate}
                                                  onChange={(e) => setEditingDate(e.target.value)}
                                                  className="w-full p-2 border rounded-lg bg-white dark:bg-slate-700 dark:border-slate-600 text-sm"
                                                />
                                                <div className="flex gap-2">
                                                  <Button size="sm" onClick={() => {
                                                    setEditingTask(null);
                                                    setEditingText("");
                                                    setEditingDate("");
                                                  }}>
                                                    <Save className="h-3 w-3 mr-1" />
                                                    Save
                                                  </Button>
                                                  <Button size="sm" variant="outline" onClick={() => {
                                                    setEditingTask(null);
                                                    setEditingText("");
                                                    setEditingDate("");
                                                  }}>
                                                    <X className="h-3 w-3 mr-1" />
                                                    Cancel
                                                  </Button>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  /* Expanded View - All tasks individually */
                                  <div className="space-y-3">
                                    {swimlaneData.tasks
                                      .sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0))
                                      .map(task => (
                                        <div key={task.id} className={`p-4 rounded-xl border-2 shadow-sm transition-all duration-300 hover:shadow-lg ${getTaskCardStyle(task)}`}>
                                          <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                              {getStatusIcon(task)}
                                              <div>
                                                <h3 className={`font-semibold text-base ${task.completed ? 'line-through opacity-70' : ''}`}>
                                                  {task.task}
                                                </h3>
                                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                  Due: {task.dueDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-8 p-0"
                                                onClick={() => {
                                                  if (editingTask === task.id) {
                                                    setEditingTask(null);
                                                  } else {
                                                    setEditingTask(task.id);
                                                    setEditingText(task.task);
                                                    setEditingDate(task.dueDate && !isNaN(task.dueDate.getTime()) ? task.dueDate.toISOString().split('T')[0] : "");
                                                  }
                                                }}
                                              >
                                                <Edit3 className="h-4 w-4" />
                                              </Button>
                                              <div 
                                                className="cursor-pointer"
                                                onClick={() => toggleChecklistItem(task.id)}
                                              >
                                                <Badge variant="outline">
                                                  {task.completed ? <CheckCircle className="h-3 w-3 mr-1" /> : 
                                                   task.status === 'overdue' ? <AlertTriangle className="h-3 w-3 mr-1" /> :
                                                   task.status === 'due-soon' ? <Timer className="h-3 w-3 mr-1" /> :
                                                   <Clock className="h-3 w-3 mr-1" />}
                                                  {task.completed ? 'Complete' : task.status === 'overdue' ? 'Overdue' : task.status === 'due-soon' ? 'Due Soon' : 'Upcoming'}
                                                </Badge>
                                              </div>
                                            </div>
                                          </div>

                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600 dark:text-gray-400">
                                            <div>
                                              <span className="font-medium">Timeline:</span> {task.timeline}
                                            </div>
                                            {task.dueDate && (
                                              <div>
                                                <span className="font-medium">Countdown:</span>
                                                <span className={`ml-1 ${(() => {
                                                  try {
                                                    if (task.dueDate && !isNaN(task.dueDate.getTime())) {
                                                      const today = new Date();
                                                      if (!isNaN(today.getTime())) {
                                                        return task.dueDate.getTime() < today.getTime() ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400';
                                                      }
                                                    }
                                                    return 'text-gray-600 dark:text-gray-400';
                                                  } catch (error) {
                                                    return 'text-gray-600 dark:text-gray-400';
                                                  }
                                                })()}`}>
                                                  {(() => {
                                                    try {
                                                      if (task.dueDate && !isNaN(task.dueDate.getTime())) {
                                                        const today = new Date();
                                                        if (!isNaN(today.getTime())) {
                                                          const days = Math.abs(Math.ceil((task.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
                                                          const isUpcoming = task.dueDate.getTime() > today.getTime();
                                                          return `${days} days ${isUpcoming ? 'remaining' : 'overdue'}`;
                                                        }
                                                      }
                                                      return 'N/A';
                                                    } catch (error) {
                                                      console.error('Error calculating countdown:', error);
                                                      return 'N/A';
                                                    }
                                                  })()}
                                                </span>
                                              </div>
                                            )}
                                          </div>

                                          {/* Editing Interface */}
                                          {editingTask === task.id && (
                                            <div className="mt-4 pt-4 border-t space-y-3">
                                              <input
                                                type="text"
                                                value={editingText}
                                                onChange={(e) => setEditingText(e.target.value)}
                                                className="w-full p-3 border rounded-lg bg-white dark:bg-slate-700 dark:border-slate-600"
                                                placeholder="Task description"
                                              />
                                              <input
                                                type="date"
                                                value={editingDate}
                                                onChange={(e) => setEditingDate(e.target.value)}
                                                className="w-full p-3 border rounded-lg bg-white dark:bg-slate-700 dark:border-slate-600"
                                              />
                                              <div className="flex gap-2">
                                                <Button size="sm" onClick={() => {
                                                  setEditingTask(null);
                                                  setEditingText("");
                                                  setEditingDate("");
                                                }}>
                                                  <Save className="h-4 w-4 mr-1" />
                                                  Save Changes
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => {
                                                  setEditingTask(null);
                                                  setEditingText("");
                                                  setEditingDate("");
                                                }}>
                                                  <X className="h-4 w-4 mr-1" />
                                                  Cancel
                                                </Button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Status Legend - Redesigned to look different from swimlanes */}
                      <div className="mt-6 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-900/20 dark:via-purple-900/20 dark:to-pink-900/20 rounded-xl p-4 border-2 border-dashed border-purple-200 dark:border-purple-700">
                        <div className="flex items-center justify-center mb-4">
                          <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-sm border flex items-center gap-2">
                            <Info className="h-5 w-5 text-purple-600" />
                            <span className="font-semibold text-purple-800 dark:text-purple-200">Status Guide</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-center gap-4">
                          <div className="bg-white dark:bg-slate-800 px-3 py-2 rounded-full shadow-sm border flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium">Completed</span>
                          </div>
                          <div className="bg-white dark:bg-slate-800 px-3 py-2 rounded-full shadow-sm border flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span className="text-sm font-medium">Overdue</span>
                          </div>
                          <div className="bg-white dark:bg-slate-800 px-3 py-2 rounded-full shadow-sm border flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                            <Timer className="h-4 w-4 text-orange-500" />
                            <span className="text-sm font-medium">Due Soon</span>
                          </div>
                          <div className="bg-white dark:bg-slate-800 px-3 py-2 rounded-full shadow-sm border flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            <Clock className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-medium">Upcoming</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}