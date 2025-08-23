"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import GuestList, { Guest, Invitation } from "@/components/GuestList";
import BulkInvitations from "@/components/BulkInvitations";
import RSVPTracker from "@/components/RSVPTracker";
import SimpleBudgetTracker from "@/components/SimpleBudgetTracker";
import ShoppingSuite from "@/components/ShoppingSuite";
import FoodTab from "@/components/FoodTab";
import CakeBakeryTab from "@/components/CakeBakeryTab";
import ActivitiesTab from "@/components/ActivitiesTab";
import HostModeTab from "@/components/HostModeTab";
import ThemesTab from "@/components/ThemesTab";
import SharePlanModal from "@/components/SharePlanModal";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
// Removed server action imports - now using API routes
import { generatePartyPlanPDF } from "@/lib/pdf-generator";
import { 
  PartyPopper, 
  CheckCircle2, 
  Users, 
  User,
  Baby,
  Utensils, 
  Gift, 
  Music, 
  Camera,
  Clock,
  MapPin,
  Palette,
  Sparkles,
  Download,
  Share2,
  Mail,
  Calendar,
  Timer,
  AlertTriangle,
  AlertCircle,
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
  ShoppingBag,
  Home,
  UtensilsCrossed,
  Cake,
  Crown,
  Lightbulb,
  Building,
  Heart,
} from "lucide-react";
import Link from "next/link";

interface PartyData {
  id?: string;
  childName: string;
  childAge: string;
  partyDate: Date;
  selectedTheme?: string | null;
  theme?: string | null;
  interests?: string[];
  favoriteColors?: string[];
  budget?: number;
  zipCode?: string;
  guestCount?: number;
  adultCount?: number;
  kidCount?: number;
  venue?: 'indoor' | 'outdoor' | 'mixed';
  duration?: string;
  themeActivities?: string;
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
  const { user } = useAuth();
  const { currentPlan, isTabAllowed, getRestrictedMessage } = useSubscription();
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
  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Set<string>>(new Set(['Venue and RSVP', 'Decorations', 'Planning', 'Setup', 'Food', 'Gifts', 'Documentation']));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPartyId, setCurrentPartyId] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Tab configuration based on subscription plans
  const tabConfigs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: PartyPopper,
      gradient: 'from-purple-500 to-pink-500',
      hoverColor: 'bg-purple-50 dark:bg-purple-900/20',
      requiredPlan: 'FREE' // Always allowed (included in all plans)
    },
    {
      id: 'themes',
      label: 'Themes',
      icon: Palette,
      gradient: 'from-purple-500 to-pink-500',
      hoverColor: 'bg-purple-50 dark:bg-purple-900/20',
      requiredPlan: 'FREE' // Always allowed (included in all plans)
    },
    {
      id: 'budget',
      label: 'Budget',
      icon: DollarSign,
      gradient: 'from-green-500 to-emerald-500',
      hoverColor: 'bg-green-50 dark:bg-green-900/20',
      requiredPlan: 'STARTER' // Plus and Pro plans
    },
    {
      id: 'activities',
      label: 'Activities',
      icon: Sparkles,
      gradient: 'from-violet-500 to-purple-500',
      hoverColor: 'bg-violet-50 dark:bg-violet-900/20',
      requiredPlan: 'STARTER' // Plus and Pro plans
    },
    {
      id: 'host-mode',
      label: 'Host Mode',
      icon: Crown,
      gradient: 'from-purple-600 to-pink-600',
      hoverColor: 'bg-purple-50 dark:bg-purple-900/20',
      requiredPlan: 'STARTER' // Plus and Pro plans
    },
    {
      id: 'shopping',
      label: 'Shopping',
      icon: ShoppingBag,
      gradient: 'from-orange-500 to-red-500',
      hoverColor: 'bg-orange-50 dark:bg-orange-900/20',
      requiredPlan: 'PROFESSIONAL' // Pro plan only
    },
    {
      id: 'food',
      label: 'Food',
      icon: UtensilsCrossed,
      gradient: 'from-red-500 to-pink-500',
      hoverColor: 'bg-red-50 dark:bg-red-900/20',
      requiredPlan: 'PROFESSIONAL' // Pro plan only
    },
    {
      id: 'cake',
      label: 'Cake',
      icon: Cake,
      gradient: 'from-pink-500 to-rose-500',
      hoverColor: 'bg-pink-50 dark:bg-pink-900/20',
      requiredPlan: 'PROFESSIONAL' // Pro plan only
    },
    {
      id: 'guests',
      label: 'Guests',
      icon: Users,
      gradient: 'from-teal-500 to-cyan-500',
      hoverColor: 'bg-teal-50 dark:bg-teal-900/20',
      requiredPlan: 'FREE' // Always allowed (included in all plans)
    },
    {
      id: 'timeline',
      label: 'Timeline',
      icon: Clock,
      gradient: 'from-indigo-500 to-purple-500',
      hoverColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      requiredPlan: 'FREE' // Always allowed (included in all plans)
    },
    {
      id: 'ideas',
      label: 'Ideas',
      icon: Lightbulb,
      gradient: 'from-yellow-500 to-amber-500',
      hoverColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      requiredPlan: 'STARTER' // Plus and Pro plans
    },
    {
      id: 'checklist',
      label: 'Checklist',
      icon: CheckCircle2,
      gradient: 'from-blue-500 to-cyan-500',
      hoverColor: 'bg-blue-50 dark:bg-blue-900/20',
      requiredPlan: 'FREE' // Always allowed (included in all plans)
    },
  ];

  // Helper function to get plan level for comparison
  const getPlanLevel = (plan: string): number => {
    switch (plan) {
      case 'FREE': return 0;
      case 'STARTER': return 1;
      case 'PROFESSIONAL': return 2;
      default: return 0;
    }
  };

  // Get tabs allowed for current subscription plan
  const allowedTabs = tabConfigs.filter(tab => {
    // Check if the current plan has access to this tab
    const currentPlanLevel = getPlanLevel(currentPlan);
    const requiredPlanLevel = getPlanLevel(tab.requiredPlan);
    return currentPlanLevel >= requiredPlanLevel;
  });

  // Get all tabs for display (only allowed tabs, restricted ones disappear)
  const allTabs = allowedTabs;

  // Helper function to check if a tab is restricted for current plan
  const isTabRestricted = (tabId: string): boolean => {
    const tab = tabConfigs.find(t => t.id === tabId);
    if (!tab) return true;
    
    const currentPlanLevel = getPlanLevel(currentPlan);
    const requiredPlanLevel = getPlanLevel(tab.requiredPlan);
    return currentPlanLevel < requiredPlanLevel;
  };

  // Helper function to get the required plan for a tab
  const getRequiredPlanForTab = (tabId: string): string => {
    const tab = tabConfigs.find(t => t.id === tabId);
    return tab?.requiredPlan || 'FREE';
  };

  // Handle PDF download functionality
  const handleDownloadPDF = async () => {
    if (!partyData) return;

    try {
      // Collect budget data (if available)
      let budgetData;
      if (isTabAllowed('budget')) {
        // Try to get budget data from budget tracker
        const budgetElement = document.querySelector('[data-budget-tracker]');
        if (budgetElement) {
          // Extract budget data from the component if possible
          budgetData = {
            totalBudget: partyData.budget || 0,
            categories: [
              { name: 'Venue', budget: (partyData.budget || 0) * 0.3, spent: 0 },
              { name: 'Food & Cake', budget: (partyData.budget || 0) * 0.25, spent: 0 },
              { name: 'Decorations', budget: (partyData.budget || 0) * 0.2, spent: 0 },
              { name: 'Entertainment', budget: (partyData.budget || 0) * 0.15, spent: 0 },
              { name: 'Other', budget: (partyData.budget || 0) * 0.1, spent: 0 }
            ]
          };
        }
      }


      // Collect food vendor data (if available)
      let foodVendors;
      if (isTabAllowed('food')) {
        // Mock food vendor data - in real implementation, this would come from FoodTab component
        foodVendors = [
          { name: 'Pizza Palace', cuisine: 'Italian', rating: 4.3, deliveryAvailable: true, specialties: ['Pizza', 'Pasta'] },
          { name: 'Burger Barn', cuisine: 'American', rating: 4.1, deliveryAvailable: true, specialties: ['Burgers', 'Fries'] }
        ];
      }

      // Generate PDF
      const doc = generatePartyPlanPDF(
        partyData,
        checklist,
        guests,
        invitations,
        budgetData,
        foodVendors
      );

      // Download the PDF
      const fileName = `${partyData.childName}_Party_Plan_${partyData.selectedTheme}.pdf`;
      doc.save(fileName);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  // Create upgrade notification component for restricted content
  const UpgradeNotification = ({ tabName }: { tabName: string }) => (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-full flex items-center justify-center">
          <Crown className="w-8 h-8 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Premium Feature
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md">
            {getRestrictedMessage(tabName)}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button asChild className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
            <Link href="/pricing">
              <Crown className="w-4 h-4 mr-2" />
              Upgrade Plan
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/pricing">
              Compare Plans
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );

  // Protected tab content wrapper
  const ProtectedTabContent = ({ tabName, children, className = "" }: { 
    tabName: string; 
    children: React.ReactNode; 
    className?: string;
  }) => (
    <TabsContent value={tabName} className={className}>
      {isTabAllowed(tabName) ? children : <UpgradeNotification tabName={tabName} />}
    </TabsContent>
  );

  // Save checklist data to database (no auto-save, manual save on changes)
  const saveChecklistData = async (checklistData: ChecklistItem[]) => {
    if (!user || !currentPartyId) return;
    
    try {
      await updateParty(currentPartyId, {
        checklistData: checklistData
      });
    } catch (error) {
      console.error('Failed to save checklist data:', error);
    }
  };

  // Helper function to get budget data (now from database only)
  const getBudgetData = () => {
    // Use budget from party data (Step 4 budget)
    if (partyData?.budget && partyData.budget > 0) {
      return { totalBudget: partyData.budget, totalSpent: 0, percentage: 0 };
    }
    
    return { totalBudget: 0, totalSpent: 0, percentage: 0 };
  };


  useEffect(() => {
    const loadPartyData = async () => {
      if (!user) {
        setError('Please sign in to view your party plan');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Get party ID from URL query parameter
        const urlParams = new URLSearchParams(window.location.search);
        const partyId = urlParams.get('id');
        const isLocal = urlParams.get('local') === 'true';
        
        console.log('Debug - Party loading:', { partyId, isLocal, currentPath: window.location.pathname + window.location.search });
        
        // Handle local party data first
        if (isLocal && partyId && partyId.startsWith('local_')) {
          console.log('Loading local party data for ID:', partyId);
          
          try {
            // Try to load from localStorage
            const localPartyData = localStorage.getItem('lastCreatedParty');
            const localParties = localStorage.getItem('localParties');
            
            if (localPartyData) {
              const parsedLocalParty = JSON.parse(localPartyData);
              if (parsedLocalParty.id === partyId) {
                console.log('Found local party data:', parsedLocalParty);
                loadPartyDetails(parsedLocalParty);
                return;
              }
            }
            
            if (localParties) {
              const parsedLocalParties = JSON.parse(localParties);
              const foundLocalParty = parsedLocalParties.find((p: any) => p.id === partyId);
              if (foundLocalParty) {
                console.log('Found local party in localParties:', foundLocalParty);
                loadPartyDetails(foundLocalParty);
                return;
              }
            }
            
            // If local party not found, show error
            setError(`Local party not found (Party ID: ${partyId}). The party data may have been cleared from your browser.`);
            setLoading(false);
            return;
            
          } catch (localError) {
            console.error('Error loading local party data:', localError);
            setError('Error loading local party data. Please try creating a new party.');
            setLoading(false);
            return;
          }
        }
        
        if (!partyId || partyId === 'current') {
          // If no specific party ID or using 'current', get the user's most recent party
          console.log('No specific party ID provided, fetching user parties...');
          
          try {
            const partiesResult = await fetch('/api/user/parties');
            
            if (!partiesResult.ok) {
              console.error('Failed to fetch parties:', partiesResult.status, partiesResult.statusText);
              
              // If database connection fails, show helpful message
              if (partiesResult.status >= 500) {
                setError('Database connection issue. Please check your Supabase configuration in Vercel environment variables.');
                setLoading(false);
                return;
              }
              
              throw new Error(`Failed to load parties (Status: ${partiesResult.status})`);
            }
            
            const response = await partiesResult.json();
            console.log('Parties API response:', response);
            
            const { parties, error } = response;
            
            if (error) {
              console.error('Database error from API:', error);
              setError(`Database error: ${error}. Please verify your Supabase credentials are correctly set in Vercel.`);
              setLoading(false);
              return;
            }
            
            console.log('User parties fetched:', { partiesCount: parties?.length });
            
            if (!parties || parties.length === 0) {
              setError('No parties found. Please create a party first.');
              setLoading(false);
              return;
            }
            
            // Use the most recent party
            const latestParty = parties[parties.length - 1];
            console.log('Using latest party:', { partyId: latestParty.id, childName: latestParty.childName });
            loadPartyDetails(latestParty);
            
          } catch (fetchError) {
            console.error('Error fetching parties:', fetchError);
            setError('Unable to connect to database. Please check your Supabase configuration in Vercel environment variables.');
            setLoading(false);
            return;
          }
        } else {
          // Load specific party by ID from database
          console.log(`Loading specific party with ID: ${partyId}`);
          
          try {
            // Use API route instead of server action
            const response = await fetch(`/api/party/get?id=${partyId}`);
            const result = await response.json();
            
            console.log('Party fetch result:', { success: result.success, hasParty: !!result.party, error: result.error });
            
            if (!result.success || !result.party) {
              const errorMessage = result.error || 'Party not found or access denied';
              console.error('Failed to load party:', { partyId, error: result.error });
              
              // Check if it's a database connection error
              if (result.error && result.error.includes("Can't reach database server")) {
                setError('Database connection failed. Please verify your Supabase configuration is correct in Vercel environment variables.');
              } else {
                setError(`${errorMessage} (Party ID: ${partyId})`);
              }
              
              setLoading(false);
              return;
            }
            
            console.log('Party loaded successfully:', { partyId: result.party.id, childName: result.party.childName });
            loadPartyDetails(result.party);
            
          } catch (getPartyError) {
            console.error('Error loading party:', getPartyError);
            setError('Database connection error. Please check your Supabase configuration in Vercel.');
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        console.error('Error loading party data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load party data');
      } finally {
        setLoading(false);
      }
    };

    const loadPartyDetails = (party: any) => {
      // CRITICAL: Set the current party ID for all subsequent operations
      setCurrentPartyId(party.id);
      
      // Set party data with all required fields for inspiration tab
      setPartyData({
        id: party.id,
        childName: party.childName,
        childAge: party.childAge.toString(),
        partyDate: new Date(party.partyDate),
        selectedTheme: party.theme,
        theme: party.theme,
        interests: party.interests || [],
        favoriteColors: party.favoriteColors || [],
        budget: party.budget || undefined,
        zipCode: party.location || undefined,
        guestCount: party.guestCount || undefined,
        venue: party.venue || 'mixed',
        duration: party.duration || '2-3 hours',
        themeActivities: party.themeActivities || undefined,
      });

      // Set guests from database only
      let finalGuestData: Guest[] = [];
      
      if (party.guests && party.guests.length > 0) {
        // Use database data
        finalGuestData = party.guests.map((guest: any) => ({
          id: guest.id,
          name: guest.name,
          email: guest.email || '',
          phone: guest.phone || '',
          type: guest.type,
          age: guest.age || undefined,
          notes: guest.notes || '',
        }));
        console.log('Loaded guests from database:', finalGuestData.length);
      }
      
      setGuests(finalGuestData);

      // Set invitations from database only
      let finalInvitationData: Invitation[] = [];
      
      if (party.invitations && party.invitations.length > 0) {
        // Use database data
        finalInvitationData = party.invitations.map((inv: any) => ({
          id: inv.id,
          guestId: inv.guestId,
          guestName: inv.guest?.name || '',
          status: inv.status,
          sentAt: inv.sentAt ? new Date(inv.sentAt) : undefined,
          respondedAt: inv.respondedAt ? new Date(inv.respondedAt) : undefined,
          message: inv.message || '',
          notes: inv.notes || '',
        }));
        console.log('Loaded invitations from database:', finalInvitationData.length);
      }
      
      setInvitations(finalInvitationData);

      // Generate and load checklist
      const baseChecklist = generateBaseChecklist(party);
      if (party.checklistData) {
        // Merge saved progress with base checklist
        const savedProgress = party.checklistData;
        const mergedChecklist = baseChecklist.map(baseItem => {
          const savedItem = savedProgress.find((saved: any) => saved.id === baseItem.id);
          return savedItem ? { ...baseItem, completed: savedItem.completed } : baseItem;
        });
        setChecklist(mergedChecklist);
      } else {
        setChecklist(baseChecklist);
      }
    };

    loadPartyData();
  }, [user]);

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
      
      // Day before
      { id: "10", task: "Set up decorations", category: "Decorations", completed: false, timeline: "Day before", weeksOrDaysBefore: 1 },
      { id: "11", task: "Prepare food that can be made ahead", category: "Food", completed: false, timeline: "Day before", weeksOrDaysBefore: 1 },
      { id: "12", task: "Charge camera/phone", category: "Documentation", completed: false, timeline: "Day before", weeksOrDaysBefore: 1 },
      
      // Day of party
      { id: "13", task: "Final setup and decorations", category: "Setup", completed: false, timeline: "Day of party", weeksOrDaysBefore: 0 },
      { id: "14", task: "Prepare fresh food", category: "Food", completed: false, timeline: "Day of party", weeksOrDaysBefore: 0 },
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
    
    // Checklist progress is now loaded from database in loadPartyDetails function

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
    
    // Save checklist updates directly to database
    setTimeout(() => {
      saveChecklistData(checklist.map(item => 
        item.id === id ? { ...item, completed: !item.completed } : item
      ));
    }, 100);
  };

  // Database sync function for guests
  const syncGuestsToDatabase = async (guestData: Guest[]) => {
    if (!currentPartyId || !user) {
      console.log('Cannot sync: missing party ID or user authentication');
      return;
    }
    
    try {
      console.log('Syncing guests to database...');
      
      // Get current database guests for this party
      const response = await fetch(`/api/party/get?id=${currentPartyId}`);
      const partyResult = await response.json();
      
      if (!partyResult.success || !partyResult.party) {
        throw new Error('Failed to fetch party data for sync');
      }
      
      const dbGuests = partyResult.party.guests || [];
      const localGuests = guestData;
      
      // Handle new guests (those with temporary IDs)
      for (const localGuest of localGuests) {
        if (localGuest.id.startsWith('guest_')) {
          // This is a temporary ID, create in database
          console.log(`Creating new guest in database: ${localGuest.name}`);
          // TODO: Replace with API call when route is ready
          console.log(`Would create guest in database: ${localGuest.name}`);
          // For now, skip database creation to avoid errors
        } else {
          // This is a real database ID, check if it needs updating
          const dbGuest = dbGuests.find(g => g.id === localGuest.id);
          if (dbGuest) {
            // Check if data differs
            if (
              dbGuest.name !== localGuest.name ||
              dbGuest.email !== (localGuest.email || null) ||
              dbGuest.phone !== (localGuest.phone || null) ||
              dbGuest.type !== localGuest.type ||
              dbGuest.age !== (localGuest.age || null) ||
              dbGuest.notes !== (localGuest.notes || null)
            ) {
              // Update existing guest
              console.log(`Would update existing guest: ${localGuest.name}`);
              // TODO: Replace with API call when route is ready
            }
          }
        }
      }
      
      // Handle deleted guests (in database but not in local)
      for (const dbGuest of dbGuests) {
        const localGuest = localGuests.find(g => g.id === dbGuest.id);
        if (!localGuest) {
          // Guest was deleted locally, delete from database
          console.log(`Would delete guest from database: ${dbGuest.name}`);
          // TODO: Replace with API call when route is ready
        }
      }
      
      // Guest data is now synchronized with database directly
      
      console.log('Guest sync completed successfully');
      
    } catch (error) {
      console.error('Failed to sync guests to database:', error);
      throw error;
    }
  };

  // Guest management functions
  const handleAddGuest = async (guestData: Omit<Guest, 'id'>) => {
    if (!currentPartyId || !user) {
      console.error('Cannot add guest: missing party ID or user authentication');
      return;
    }

    try {
      // Create guest in database first
      const result = await addGuest(currentPartyId, {
        name: guestData.name,
        email: guestData.email,
        phone: guestData.phone,
        type: guestData.type,
        age: guestData.age,
        notes: guestData.notes
      });

      if (result.success && result.guest?.data) {
        // Add to local state with real database ID
        const newGuest: Guest = {
          id: result.guest.data.id,
          name: result.guest.data.name,
          email: result.guest.data.email || undefined,
          phone: result.guest.data.phone || undefined,
          type: result.guest.data.type,
          age: result.guest.data.age || undefined,
          notes: result.guest.data.notes || undefined,
        };

        const updatedGuests = [...guests, newGuest];
        setGuests(updatedGuests);

        console.log('Guest added successfully to database and local state');
      } else {
        console.error('Failed to add guest to database:', result.error);
        throw new Error(result.error || 'Failed to add guest');
      }
    } catch (error) {
      console.error('Error adding guest:', error);
    }
  };

  const handleEditGuest = async (id: string, guestData: Partial<Guest>) => {
    if (!currentPartyId || !user) {
      console.error('Cannot edit guest: missing party ID or user authentication');
      return;
    }

    try {
      // Update guest in database first (only if it's a real database ID)
      if (!id.startsWith('guest_')) {
        const result = await updateGuest(id, {
          name: guestData.name || '',
          email: guestData.email || '',
          phone: guestData.phone || '',
          type: guestData.type || 'ADULT',
          age: guestData.age,
          notes: guestData.notes || ''
        });

        if (result.success) {
          console.log('Guest updated successfully in database');
        } else {
          console.error('Failed to update guest in database:', result.error);
        }
      }

      // Update local state
      const updatedGuests = guests.map(guest => 
        guest.id === id ? { ...guest, ...guestData } : guest
      );
      setGuests(updatedGuests);

      // Guest data is now managed directly through database
    } catch (error) {
      console.error('Error editing guest:', error);
    }
  };

  const handleDeleteGuest = async (id: string) => {
    if (!currentPartyId || !user) {
      console.error('Cannot delete guest: missing party ID or user authentication');
      return;
    }

    try {
      // Delete from database first (only if it's a real database ID)
      if (!id.startsWith('guest_')) {
        const result = await deleteGuest(id);
        
        if (result.success) {
          console.log('Guest deleted successfully from database');
        } else {
          console.error('Failed to delete guest from database:', result.error);
        }
      }

      // Update local state
      const updatedGuests = guests.filter(guest => guest.id !== id);
      setGuests(updatedGuests);
      
      // Also remove any invitations for this guest
      const updatedInvitations = invitations.filter(inv => inv.guestId !== id);
      setInvitations(updatedInvitations);

      // Guest data is now managed directly through database
    } catch (error) {
      console.error('Error deleting guest:', error);
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
      // Invitation data is now managed directly through database
    }
  };

  const handleSendBulkInvitations = async (guestIds: string[], templateId: string, customMessage: string) => {
    // Note: Bulk invitations are now handled by the BulkInvitations component directly via API
    // This function is called after successful email sending to update local state
    
    console.log('Updating local invitation state after bulk send');
    
    // Re-fetch party data to get updated invitations from database
    if (currentPartyId) {
      try {
        const response = await fetch(`/api/party/get?id=${currentPartyId}`);
        const result = await response.json();
        
        if (result.success && result.party) {
          // Update local state with database invitations
          const dbInvitations = result.party.invitations?.map((inv: any) => ({
            id: inv.id,
            guestId: inv.guestId,
            guestName: inv.guest?.name || '',
            status: inv.status,
            sentAt: inv.sentAt ? new Date(inv.sentAt) : undefined,
            respondedAt: inv.respondedAt ? new Date(inv.respondedAt) : undefined,
            message: inv.customMessage || '',
            notes: inv.notes || '',
          })) || [];
          
          setInvitations(dbInvitations);
          
          // Invitation data is now managed directly through database
        }
      } catch (error) {
        console.error('Error refreshing invitation data:', error);
      }
    }
  };

  const handleUpdateRSVP = async (invitationId: string, status: Invitation['status'], notes?: string) => {
    if (!currentPartyId || !user) {
      console.error('Cannot update RSVP: missing party ID or user authentication');
      return;
    }

    try {
      // Update RSVP in database first (only if it's a real database ID)
      if (!invitationId.startsWith('inv_')) {
        const result = await updateInvitationStatus(invitationId, status as any, notes);
        
        if (result.success) {
          console.log('RSVP updated successfully in database');
        } else {
          console.error('Failed to update RSVP in database:', result.error);
        }
      }

      // Update local state
      const updatedInvitations = invitations.map(inv => 
        inv.id === invitationId 
          ? { ...inv, status, notes, respondedAt: new Date() }
          : inv
      );
      setInvitations(updatedInvitations);

      // Invitation data is now managed directly through database
    } catch (error) {
      console.error('Error updating RSVP:', error);
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
      // Invitation data is now managed directly through database
    }
  };

  const getThemeDetails = () => {
    // Check for selected theme in both fields (theme and selectedTheme)
    const currentTheme = (partyData?.theme && partyData.theme !== '') ? partyData.theme : 
                        (partyData?.selectedTheme && partyData.selectedTheme !== '') ? partyData.selectedTheme : null;
    
    if (!currentTheme) return null;
    
    // Define classic themes data to match ThemesTab component
    const classicThemesData = {
      dinosaur: {
        name: "Dinosaur Adventure",
        emoji: "🦕",
        colors: ["Green", "Brown", "Orange", "Yellow"]
      },
      space: {
        name: "Space Explorer Mission",
        emoji: "🚀",
        colors: ["Blue", "Purple", "Silver", "Black"]
      },
      safari: {
        name: "African Safari Adventure",
        emoji: "🦁",
        colors: ["Yellow", "Orange", "Brown", "Green"]
      },
      ocean: {
        name: "Under the Sea Adventure",
        emoji: "🐠",
        colors: ["Blue", "Cyan", "Teal", "Aqua"]
      },
      princess: {
        name: "Royal Princess Castle",
        emoji: "👸",
        colors: ["Pink", "Purple", "Gold", "Silver"]
      },
      superhero: {
        name: "Superhero Training Academy",
        emoji: "🦸‍♂️",
        colors: ["Red", "Blue", "Yellow", "Silver"]
      },
      sports: {
        name: "Championship Sports Day",
        emoji: "⚽",
        colors: ["Orange", "Red", "Green", "Blue"]
      },
      unicorn: {
        name: "Magical Unicorn Kingdom",
        emoji: "🦄",
        colors: ["Pink", "Purple", "Blue", "Yellow"]
      }
    };

    // Check if it's a classic theme
    const classicTheme = classicThemesData[currentTheme as keyof typeof classicThemesData];
    if (classicTheme) {
      return classicTheme;
    }

    // If it's an AI theme (starts with 'ai-'), try to get details from localStorage
    if (currentTheme.startsWith('ai-')) {
      // Try to get the AI theme details from localStorage
      if (typeof window !== 'undefined') {
        const savedAiThemes = localStorage.getItem('aiGeneratedThemes');
        if (savedAiThemes) {
          try {
            const aiThemes = JSON.parse(savedAiThemes);
            const aiTheme = aiThemes.find((theme: any) => theme.id === currentTheme);
            if (aiTheme) {
              return {
                name: aiTheme.name,
                emoji: aiTheme.emoji,
                colors: aiTheme.colorPalette || ["Purple", "Pink", "Blue", "Gold"]
              };
            }
          } catch (error) {
            console.error('Error parsing AI themes from localStorage:', error);
          }
        }
      }
      
      // Fallback for AI themes - extract theme name from ID
      const extractedName = currentTheme.replace('ai-', '').replace(/[-_]/g, ' ');
      const capitalizedName = extractedName.charAt(0).toUpperCase() + extractedName.slice(1);
      return {
        name: capitalizedName,
        emoji: "🤖",
        colors: ["Purple", "Pink", "Blue", "Gold"]
      };
    }

    // Fallback for any other themes - extract theme name from ID
    const extractedName = currentTheme.replace(/[-_]/g, ' ');
    const capitalizedName = extractedName.charAt(0).toUpperCase() + extractedName.slice(1);
    return {
      name: capitalizedName,
      emoji: "🎉",
      colors: ["Purple", "Pink"]
    };
  };

  // Calculate theme details for display
  const themeDetails = getThemeDetails();

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

  if (error) {
    // Check if this is a local party error
    const isLocalPartyError = error.includes('Local party not found') || error.includes('local party data');
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
        <div className="text-center max-w-lg">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mb-6">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
              {isLocalPartyError ? 'Local Party Data Lost' : 'Unable to Load Party'}
            </h3>
            <p className="text-red-600 dark:text-red-300 mb-4 text-sm">{error}</p>
            <div className="text-xs text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-2 rounded border text-left">
              <p className="font-medium mb-1">
                {isLocalPartyError ? 'What happened:' : 'Possible causes:'}
              </p>
              <ul className="list-disc list-inside space-y-1">
                {isLocalPartyError ? (
                  <>
                    <li>Your browser's local storage was cleared</li>
                    <li>You're using a different browser or device</li>
                    <li>The party data wasn't properly saved locally</li>
                    <li>Database connection failed during creation</li>
                  </>
                ) : (
                  <>
                    <li>Party was not saved to database properly</li>
                    <li>You don't have permission to access this party</li>
                    <li>The party ID in the URL is invalid</li>
                    <li>Authentication session expired</li>
                  </>
                )}
              </ul>
            </div>
          </div>
          <div className="space-x-3">
            <Button onClick={() => window.location.href = '/create-party'} className="bg-gradient-to-r from-purple-600 to-pink-600">
              {isLocalPartyError ? 'Create New Party' : 'Create New Party'}
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
              Go to Dashboard
            </Button>
            {isLocalPartyError && (
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/create-party'} 
                className="mt-2 w-full"
              >
                Try Again
              </Button>
            )}
          </div>
          {isLocalPartyError && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
              💡 Tip: Make sure you're using the same browser and haven't cleared your data. 
              If the problem persists, try creating a new party.
            </p>
          )}
          {isLocalPartyError && (
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
              <details className="text-xs text-gray-600 dark:text-gray-400">
                <summary className="cursor-pointer font-medium mb-2">🔍 Debug Information</summary>
                <div className="text-left space-y-2">
                  <div>
                    <strong>Available Local Data:</strong>
                    <div className="ml-2">
                      <div>• lastCreatedParty: {localStorage.getItem('lastCreatedParty') ? '✅ Found' : '❌ Not found'}</div>
                      <div>• localParties: {localStorage.getItem('localParties') ? '✅ Found' : '❌ Not found'}</div>
                    </div>
                  </div>
                  <div>
                    <strong>Current URL:</strong>
                    <div className="ml-2 break-all">{window.location.href}</div>
                  </div>
                  <div>
                    <strong>Party ID from URL:</strong>
                    <div className="ml-2">{new URLSearchParams(window.location.search).get('id')}</div>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
    );
  }

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 py-4 sm:py-6 lg:py-8">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-8">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex justify-center mb-3 sm:mb-4">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-2 sm:p-3 rounded-full">
              <PartyPopper className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-yellow-600 bg-clip-text text-transparent mb-2 leading-tight px-2">
            {partyData.childName}'s {themeDetails?.name} Party Plan
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 px-2">
            Age {partyData.childAge} • {partyData.partyDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        {/* Progress Card with Enhanced Countdown Timeline - Improved Visual Organization */}
        <div className="space-y-6 mb-8">
          {/* Party Overview Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-gradient-to-b from-purple-600 to-pink-600 rounded-full"></div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Party Overview</h2>
            </div>
            
            <Card className="border-2 border-purple-200 dark:border-purple-700 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 shadow-lg">
              <CardHeader className="px-6 py-5">
                <div className={`grid grid-cols-1 ${isTabAllowed('budget') ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6`}>
                  {/* Planning Progress */}
                  <div className="space-y-4">
                    <CardTitle className="flex items-center gap-3 text-lg font-bold text-purple-800 dark:text-purple-200">
                      <div className="p-2 rounded-full bg-green-600 shadow-sm">
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      </div>
                      Planning Progress
                    </CardTitle>
                    
                    {/* Progress Content */}
                    <div className="bg-gradient-to-r from-green-50 via-blue-50 to-purple-50 dark:from-green-900/20 dark:via-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
                      <CardDescription className="mb-3 text-purple-700 dark:text-purple-300 font-medium">
                        {completedTasks} of {totalTasks} tasks completed
                      </CardDescription>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-purple-600 dark:text-purple-400 font-medium">Progress</span>
                        <span className="text-xl font-black text-purple-700 dark:text-purple-300">
                          {Math.round(progressPercentage)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-4 shadow-inner">
                        <div 
                          className="bg-gradient-to-r from-purple-600 to-pink-600 h-4 rounded-full transition-all duration-500 shadow-sm"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Budget Overview - Only show if budget tab is allowed */}
                  {isTabAllowed('budget') && (
                    <div className="space-y-4">
                      <CardTitle className="flex items-center gap-3 text-lg font-bold text-green-800 dark:text-green-200">
                        <div className="p-2 rounded-full bg-green-600 shadow-sm">
                          <DollarSign className="h-5 w-5 text-white" />
                        </div>
                        Budget Tracker
                      </CardTitle>
                      
                      {/* Budget Content */}
                      <div 
                        className="bg-gradient-to-r from-green-50 via-blue-50 to-purple-50 dark:from-green-900/20 dark:via-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700 cursor-pointer hover:bg-gradient-to-r hover:from-green-100 hover:via-blue-100 hover:to-purple-100 dark:hover:from-green-800/20 dark:hover:via-blue-800/20 dark:hover:to-purple-800/20 transition-all duration-200 hover:shadow-md"
                        onClick={() => {
                          const budgetTab = document.querySelector('[value="budget"]') as HTMLButtonElement;
                          if (budgetTab) budgetTab.click();
                        }}
                      >
                        <CardDescription className="mb-3 text-green-700 dark:text-green-300 font-medium">
                          {(() => {
                            const { totalBudget, totalSpent } = getBudgetData(); 
                            return totalBudget > 0 ? `$${totalSpent.toFixed(0)} of $${totalBudget} spent` : 'Click to set budget';
                          })()}
                        </CardDescription>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-green-600 dark:text-green-400 font-medium">Budget Used</span>
                          <span className="text-xl font-black text-green-700 dark:text-green-300">
                            {Math.round(getBudgetData().percentage)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-4 shadow-inner">
                          <div 
                            className="bg-gradient-to-r from-green-600 to-emerald-600 h-4 rounded-full transition-all duration-500 shadow-sm"
                            style={{ width: `${getBudgetData().percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Party Countdown */}
                  <div className="space-y-4">
                    <CardTitle className="flex items-center gap-3 text-lg font-bold text-blue-800 dark:text-blue-200">
                      <div className="p-2 rounded-full bg-blue-600 shadow-sm">
                        <Timer className="h-5 w-5 text-white" />
                      </div>
                      Party Countdown
                    </CardTitle>
                    
                    {/* Countdown Content */}
                    <div className="bg-gradient-to-r from-green-50 via-blue-50 to-purple-50 dark:from-green-900/20 dark:via-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
                      {/* Days Count */}
                      <div className="text-center mb-4">
                        <div className="text-4xl font-black bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                          {Math.abs(daysUntilParty)}
                        </div>
                        <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                          {daysUntilParty === 1 ? 'day until party!' : daysUntilParty === 0 ? 'Party is today!' : daysUntilParty < 0 ? 'days ago' : 'days until party!'}
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
                        <div 
                          className="h-full bg-gradient-to-r from-green-400 via-blue-400 to-purple-400 rounded-full transition-all duration-500 shadow-sm"
                          style={{ 
                            width: `${(() => {
                              try {
                                if (partyData?.partyDate && !isNaN(partyData.partyDate.getTime()) && daysUntilParty > 0) {
                                  const today = new Date();
                                  const partyDate = new Date(partyData.partyDate);
                                  if (!isNaN(today.getTime()) && !isNaN(partyDate.getTime())) {
                                    const planningStartDate = new Date(partyDate);
                                    planningStartDate.setDate(planningStartDate.getDate() - 42);
                                    const totalPlanningDays = Math.ceil((partyDate.getTime() - planningStartDate.getTime()) / (1000 * 60 * 60 * 24));
                                    const daysPassed = Math.ceil((today.getTime() - planningStartDate.getTime()) / (1000 * 60 * 60 * 24));
                                    return Math.max(0, Math.min(100, (daysPassed / totalPlanningDays) * 100));
                                  }
                                } else if (daysUntilParty <= 0) {
                                  return 100;
                                }
                                return 10;
                              } catch (error) {
                                console.error('Error calculating timeline progress:', error);
                                return 10;
                              }
                            })()}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* Main Content Tabs - Enhanced Visual Organization */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-gradient-to-b from-indigo-600 to-purple-600 rounded-full"></div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Party Management</h2>
          </div>
          
          <Tabs defaultValue="overview" className="w-full">
            <div className="overflow-x-auto mb-6">
              <TabsList className="flex w-full h-auto p-1.5 gap-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 shadow-md rounded-xl">
                {allTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isRestricted = isTabRestricted(tab.id);
                  const isActive = allowedTabs.some(allowedTab => allowedTab.id === tab.id);
                  
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      disabled={isRestricted}
                      className={`flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium px-2 sm:px-3 py-2 flex-1 min-w-0 rounded-lg transition-all duration-200 ${
                        isRestricted 
                          ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-60' 
                          : 'text-gray-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-gray-100'
                      } ${
                        isActive 
                          ? 'data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:font-bold data-[state=active]:border-none data-[state=active]:transform data-[state=active]:scale-[1.02]' 
                          : ''
                      }`}
                      style={{
                        backgroundImage: isActive ? (
                          tab.id === 'overview' ? 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)' : 
                          tab.id === 'themes' ? 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)' :
                          tab.id === 'budget' ? 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)' :
                          tab.id === 'activities' ? 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 50%, #c084fc 100%)' :
                          tab.id === 'host-mode' ? 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)' :
                          tab.id === 'shopping' ? 'linear-gradient(135deg, #dc2626 0%, #f97316 50%, #fbbf24 100%)' :
                          tab.id === 'venue' ? 'linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #fbbf24 100%)' :
                          tab.id === 'food' ? 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)' :
                          tab.id === 'cake' ? 'linear-gradient(135deg, #be185d 0%, #ec4899 50%, #f472b6 100%)' :
                          tab.id === 'guests' ? 'linear-gradient(135deg, #0891b2 0%, #14b8a6 50%, #2dd4bf 100%)' :
                          tab.id === 'timeline' ? 'linear-gradient(135deg, #4338ca 0%, #6366f1 50%, #818cf8 100%)' :
                          tab.id === 'checklist' ? 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 50%, #60a5fa 100%)' :
                          'linear-gradient(135deg, #4338ca 0%, #6366f1 50%, #818cf8 100%)'
                        ) : 'none'
                      } as any}
                      title={isRestricted ? `Upgrade to ${getRequiredPlanForTab(tab.id)} plan to access ${tab.label}` : tab.label}
                    >
                      <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                      <span className="truncate font-semibold">{tab.label}</span>
                      {isRestricted && (
                        <Crown className="h-3 w-3 ml-1 text-yellow-500" />
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

          {/* Overview Tab */}
                      <TabsContent value="overview" className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* Theme Card */}
                <Card className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-2xl">{themeDetails?.emoji || "🎉"}</span>
                      <div className="flex-1">
                        {themeDetails?.name || "No Theme Selected"} 
                        {themeDetails ? " Theme" : ""}
                      </div>
                      {themeDetails && (
                        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                          <Star className="w-3 h-3 mr-1" />
                          Selected
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {themeDetails ? (
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-semibold mb-2">Color Palette:</h4>
                          <div className="flex flex-wrap gap-2">
                            {themeDetails?.colors.map((color, index) => (
                              <Badge key={index} variant="secondary">{color}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Enhanced navigation with multiple robust fallback methods
                              let success = false;
                              
                              // Method 1: Direct value selector
                              const themesTab = document.querySelector('[value="themes"]') as HTMLButtonElement;
                              if (themesTab && !success) {
                                themesTab.click();
                                success = true;
                              }
                              
                              // Method 2: Find by role="tab" and text content
                              if (!success) {
                                const tabButtons = document.querySelectorAll('[role="tab"]');
                                for (const button of Array.from(tabButtons)) {
                                  if (button.textContent?.trim().toLowerCase().includes('themes')) {
                                    (button as HTMLButtonElement).click();
                                    success = true;
                                    break;
                                  }
                                }
                              }
                              
                              // Method 3: Find by data-state attribute and text content
                              if (!success) {
                                const allButtons = document.querySelectorAll('button');
                                for (const button of Array.from(allButtons)) {
                                  if (button.textContent?.trim().toLowerCase() === 'themes' && 
                                      button.getAttribute('data-state') !== null) {
                                    button.click();
                                    success = true;
                                    break;
                                  }
                                }
                              }
                              
                              // Method 4: Direct class-based search for TabsTrigger
                              if (!success) {
                                const triggers = document.querySelectorAll('[class*="TabsTrigger"], [class*="tabs-trigger"]');
                                for (const trigger of Array.from(triggers)) {
                                  if (trigger.textContent?.trim().toLowerCase().includes('themes')) {
                                    (trigger as HTMLButtonElement).click();
                                    success = true;
                                    break;
                                  }
                                }
                              }
                              
                              console.log(success ? 'Successfully navigated to themes tab' : 'Failed to find themes tab');
                            }}
                            className="w-full"
                          >
                            <Palette className="w-4 h-4 mr-2" />
                            Change Theme
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-gray-600 dark:text-gray-400 mb-3">
                          No theme selected yet
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Enhanced navigation with multiple robust fallback methods
                            let success = false;
                            
                            // Method 1: Direct value selector
                            const themesTab = document.querySelector('[value="themes"]') as HTMLButtonElement;
                            if (themesTab && !success) {
                              themesTab.click();
                              success = true;
                            }
                            
                            // Method 2: Find by role="tab" and text content
                            if (!success) {
                              const tabButtons = document.querySelectorAll('[role="tab"]');
                              for (const button of Array.from(tabButtons)) {
                                if (button.textContent?.trim().toLowerCase().includes('themes')) {
                                  (button as HTMLButtonElement).click();
                                  success = true;
                                  break;
                                }
                              }
                            }
                            
                            // Method 3: Find by data-state attribute and text content
                            if (!success) {
                              const allButtons = document.querySelectorAll('button');
                              for (const button of Array.from(allButtons)) {
                                if (button.textContent?.trim().toLowerCase() === 'themes' && 
                                    button.getAttribute('data-state') !== null) {
                                  button.click();
                                  success = true;
                                  break;
                                }
                              }
                            }
                            
                            // Method 4: Direct class-based search for TabsTrigger
                            if (!success) {
                              const triggers = document.querySelectorAll('[class*="TabsTrigger"], [class*="tabs-trigger"]');
                              for (const trigger of Array.from(triggers)) {
                                if (trigger.textContent?.trim().toLowerCase().includes('themes')) {
                                  (trigger as HTMLButtonElement).click();
                                  success = true;
                                  break;
                                }
                              }
                            }
                            
                            console.log(success ? 'Successfully navigated to themes tab' : 'Failed to find themes tab');
                          }}
                          className="w-full"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Select Theme
                        </Button>
                      </div>
                    )}
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
                    
                    {/* Adults/Kids Breakdown */}
                    {(partyData?.adultCount || partyData?.kidCount) && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm flex items-center gap-1">
                            <User className="h-3 w-3" />
                            Adults
                          </span>
                          <Badge variant="outline">{partyData.adultCount || 0}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm flex items-center gap-1">
                            <Baby className="h-3 w-3" />
                            Kids
                          </span>
                          <Badge variant="outline">{partyData.kidCount || 0}</Badge>
                        </div>
                      </>
                    )}
                    
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

                {/* Actions Card - Dynamic content based on available tabs */}
                <Card className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => setShareModalOpen(true)}
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Share Plan
                    </Button>
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={handleDownloadPDF}
                    >
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
                    {/* Budget Quick Action - Only show if budget tab is available */}
                    {isTabAllowed('budget') && (
                      <Button 
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white"
                        onClick={() => {
                          const budgetTab = document.querySelector('[value="budget"]') as HTMLButtonElement;
                          if (budgetTab) budgetTab.click();
                        }}
                      >
                        <DollarSign className="h-4 w-4 mr-2" />
                        Manage Budget
                      </Button>
                    )}
                    {/* Shopping Quick Action - Only show if shopping tab is available */}
                    {isTabAllowed('shopping') && (
                      <Button 
                        className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white"
                        onClick={() => {
                          const shoppingTab = document.querySelector('[value="shopping"]') as HTMLButtonElement;
                          if (shoppingTab) shoppingTab.click();
                        }}
                      >
                        <ShoppingBag className="h-4 w-4 mr-2" />
                        Party Shopping
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

          {/* Budget Tab */}
          <ProtectedTabContent tabName="budget" className="space-y-6">
            <SimpleBudgetTracker
              partyId={partyData?.childName || 'party'}
              initialBudget={partyData?.budget}
              childAge={parseInt(partyData?.childAge || '0')}
            />
          </ProtectedTabContent>

          {/* Activities Tab */}
          <ProtectedTabContent tabName="activities" className="space-y-6">
            <ActivitiesTab
              partyId={currentPartyId || partyData?.childName || 'party'}
              partyData={partyData ? {
                childName: partyData.childName,
                childAge: parseInt(partyData.childAge || '0'),
                theme: partyData.selectedTheme || 'Birthday',
                interests: partyData.interests || [],
                favoriteColors: partyData.favoriteColors || [],
                venue: partyData.venue,
                guestCount: partyData.guestCount
              } : undefined}
            />
          </ProtectedTabContent>

          {/* Host Mode Tab */}
          <ProtectedTabContent tabName="host-mode" className="space-y-6">
            <HostModeTab
              partyId={currentPartyId || partyData?.childName || 'party'}
              partyData={partyData ? {
                childName: partyData.childName,
                childAge: parseInt(partyData.childAge || '0'),
                theme: partyData.selectedTheme || 'Birthday',
                interests: partyData.interests || [],
                favoriteColors: partyData.favoriteColors || [],
                venue: partyData.venue,
                guestCount: partyData.guestCount
              } : undefined}
            />
          </ProtectedTabContent>


          {/* Shopping Tab */}
          <ProtectedTabContent tabName="shopping" className="space-y-6">
            <ShoppingSuite
              partyBudget={partyData?.budget}
              zipCode={partyData?.zipCode}
              childAge={parseInt(partyData?.childAge || '0')}
              theme={partyData?.selectedTheme || undefined}
              partyId={partyData?.childName || 'party'}
            />
          </ProtectedTabContent>


          {/* Food Tab */}
          <ProtectedTabContent tabName="food" className="space-y-6">
            <FoodTab
              zipCode={partyData?.zipCode}
              partyId={currentPartyId || partyData?.childName || 'party'}
              guestCount={guests.length}
            />
          </ProtectedTabContent>

          {/* Cake Tab */}
          <ProtectedTabContent tabName="cake" className="space-y-6">
            <CakeBakeryTab
              zipCode={partyData?.zipCode}
              partyId={currentPartyId || partyData?.childName || 'party'}
              guestCount={guests.length}
            />
          </ProtectedTabContent>


          {/* Checklist Tab */}
          <TabsContent value="checklist" className="space-y-6">
            <div className="grid gap-6">
              {['4-6 weeks before', '2-3 weeks before', '1 week before', 'Day before', 'Day of party'].map((timeline) => {
                const timelineTasks = checklist.filter(item => item.timeline === timeline);
                if (timelineTasks.length === 0) return null;

                return (
                  <Card key={timeline} className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">{timeline}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {timelineTasks.map((item) => {
                          const getStatusColor = (status: string) => {
                            switch (status) {
                              case 'completed':
                                return 'border-green-300 bg-green-100 dark:border-green-600 dark:bg-green-900/40';
                              case 'overdue':
                                return 'border-red-300 bg-red-100 dark:border-red-600 dark:bg-red-900/40';
                              case 'due-soon':
                                return 'border-orange-300 bg-orange-100 dark:border-orange-600 dark:bg-orange-900/40';
                              default:
                                return 'border-gray-300 bg-white dark:border-slate-500 dark:bg-slate-700/60';
                            }
                          };

                          const getStatusIcon = (status: string) => {
                            switch (status) {
                              case 'completed':
                                return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />;
                              case 'overdue':
                                return <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />;
                              case 'due-soon':
                                return <Timer className="h-5 w-5 text-orange-600 dark:text-orange-400" />;
                              default:
                                return <Calendar className="h-5 w-5 text-gray-500 dark:text-gray-400" />;
                            }
                          };

                          return (
                            <div key={item.id} className={`p-5 rounded-lg border-2 transition-all duration-200 shadow-sm ${getStatusColor(item.status || 'upcoming')}`}>
                              <div className="flex items-center space-x-4">
                                <Checkbox
                                  id={item.id}
                                  checked={item.completed}
                                  onCheckedChange={() => toggleChecklistItem(item.id)}
                                  className="w-5 h-5"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-3 mb-2">
                                    {getStatusIcon(item.status || 'upcoming')}
                                    <label
                                      htmlFor={item.id}
                                      className={`text-base font-semibold leading-snug cursor-pointer ${
                                        item.completed ? 'line-through text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'
                                      }`}
                                    >
                                      {item.task}
                                    </label>
                                  </div>
                                  {item.dueDate && (
                                    <div className="text-sm text-gray-800 dark:text-gray-200 ml-8 font-medium">
                                      Due: {item.dueDate.toLocaleDateString('en-US', { 
                                        weekday: 'short', 
                                        month: 'short', 
                                        day: 'numeric' 
                                      })}
                                      {item.status === 'overdue' && (
                                        <span className="text-red-700 dark:text-red-400 ml-2 font-bold">OVERDUE</span>
                                      )}
                                      {item.status === 'due-soon' && (
                                        <span className="text-orange-700 dark:text-orange-400 ml-2 font-bold">DUE SOON</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-sm shrink-0 font-semibold px-3 py-1">
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

          {/* Themes Tab */}
          <TabsContent value="themes" className="space-y-6">
            <ThemesTab
              partyData={{
                childName: partyData?.childName || '',
                childAge: partyData?.childAge || '',
                interests: partyData?.interests || [],
                favoriteColors: partyData?.favoriteColors || [],
                selectedTheme: (partyData?.theme && partyData.theme !== '') ? partyData.theme : (partyData?.selectedTheme && partyData.selectedTheme !== '') ? partyData.selectedTheme : null
              }}
              onThemeSelect={(themeId) => {
                if (partyData?.id) {
                  updateParty(partyData.id, { theme: themeId || '' })
                    .then(() => {
                      setPartyData(prev => prev ? { ...prev, theme: themeId || '', selectedTheme: themeId || null } : prev);
                      
                      // Auto-navigate back to overview tab after theme selection
                      setTimeout(() => {
                        let success = false;
                        
                        // Method 1: Direct value selector
                        const overviewTab = document.querySelector('[value="overview"]') as HTMLButtonElement;
                        if (overviewTab && !success) {
                          overviewTab.click();
                          success = true;
                        }
                        
                        // Method 2: Find by role="tab" and text content
                        if (!success) {
                          const tabButtons = document.querySelectorAll('[role="tab"]');
                          for (const button of Array.from(tabButtons)) {
                            if (button.textContent?.trim().toLowerCase().includes('overview')) {
                              (button as HTMLButtonElement).click();
                              success = true;
                              break;
                            }
                          }
                        }
                        
                        console.log(success ? 'Successfully navigated back to overview tab' : 'Failed to navigate back to overview tab');
                      }, 500);
                    })
                    .catch(error => {
                      console.error('Error updating theme:', error);
                    });
                } else {
                  // Fallback to localStorage for parties without database ID
                  setPartyData(prev => prev ? { ...prev, theme: themeId || '', selectedTheme: themeId || null } : prev);
                  
                  // Save to localStorage as backup
                  const currentPartyData = localStorage.getItem('currentPartyData');
                  if (currentPartyData) {
                    try {
                      const parsed = JSON.parse(currentPartyData);
                      parsed.theme = themeId || '';
                      parsed.selectedTheme = themeId || null;
                      localStorage.setItem('currentPartyData', JSON.stringify(parsed));
                    } catch (error) {
                      console.error('Error saving theme to localStorage:', error);
                    }
                  }
                  
                  // Auto-navigate back to overview tab
                  setTimeout(() => {
                    let success = false;
                    
                    // Method 1: Direct value selector
                    const overviewTab = document.querySelector('[value="overview"]') as HTMLButtonElement;
                    if (overviewTab && !success) {
                      overviewTab.click();
                      success = true;
                    }
                    
                    // Method 2: Find by role="tab" and text content
                    if (!success) {
                      const tabButtons = document.querySelectorAll('[role="tab"]');
                      for (const button of Array.from(tabButtons)) {
                        if (button.textContent?.trim().toLowerCase().includes('overview')) {
                          (button as HTMLButtonElement).click();
                          success = true;
                          break;
                        }
                      }
                    }
                    
                    console.log(success ? 'Successfully navigated back to overview tab' : 'Failed to navigate back to overview tab');
                  }, 500);
                }
              }}
            />
          </TabsContent>


          {/* Guests Tab - Combined Guest Management and Invitations */}
          <TabsContent value="guests" className="space-y-6">
            <Tabs defaultValue="manage" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="manage">Manage Guests</TabsTrigger>
                <TabsTrigger value="bulk">Send Invitations</TabsTrigger>
                <TabsTrigger value="rsvp">RSVP Tracking</TabsTrigger>
              </TabsList>
              
              <TabsContent value="manage" className="mt-6">
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
              
              <TabsContent value="bulk" className="mt-6">
                <BulkInvitations
                  partyId={currentPartyId || partyData?.childName || 'party'}
                  childName={partyData?.childName || ''}
                  childAge={partyData?.childAge ? parseInt(partyData.childAge.toString()) : 0}
                  partyDate={partyData?.partyDate && !isNaN(partyData.partyDate.getTime()) ? partyData.partyDate.toISOString() : ''}
                  partyTime="2:00 PM"
                  partyLocation="TBD"
                  theme={partyData?.selectedTheme || ''}
                  guests={guests}
                  invitations={invitations}
                  userId={user?.id}
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

      {/* Share Plan Modal */}
      {partyData && currentPartyId && (
        <SharePlanModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          party={{
            id: currentPartyId,
            childName: partyData.childName,
            theme: partyData.selectedTheme || 'Birthday',
            date: partyData.partyDate.toISOString(),
            age: parseInt(partyData.childAge),
          }}
        />
      )}
    </div>
  );
}