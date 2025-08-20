"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, PartyPopper, Calendar, Users, CheckCircle, Clock, Sparkles, Star, Zap, Crown } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import PartyCard from './PartyCard'
import Link from 'next/link'
import { getUserParties, deleteParty } from '@/lib/party-actions'

interface Party {
  id: string
  childName: string
  age: number
  date: Date
  theme: string
  guestCount: number
  checkedTasks: number
  totalTasks: number
  status: 'upcoming' | 'completed' | 'cancelled'
}

const planDetails = {
  FREE: {
    name: "Starter",
    icon: Star,
    color: "text-purple-700 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    borderColor: "border-purple-300 dark:border-purple-700",
    gradientFrom: "from-purple-500",
    gradientTo: "to-purple-600"
  },
  STARTER: {
    name: "Plus",
    icon: Zap,
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    borderColor: "border-blue-300 dark:border-blue-700",
    gradientFrom: "from-blue-500",
    gradientTo: "to-blue-600"
  },
  PROFESSIONAL: {
    name: "Pro",
    icon: Crown,
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    borderColor: "border-amber-300 dark:border-amber-700",
    gradientFrom: "from-amber-500",
    gradientTo: "to-amber-600"
  }
};

type PlanType = 'FREE' | 'STARTER' | 'PROFESSIONAL';

export default function Dashboard() {
  const { user } = useAuth()
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)
  const [userPlan, setUserPlan] = useState<PlanType>('FREE')

  // Listen for plan changes from localStorage or account page
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (user) {
      // Check if user is superadmin for plan switching functionality
      const isSupeadmin = user.email === "arunexprasad@gmail.com";
      if (isSupeadmin) {
        // Listen for plan changes stored in localStorage for superadmin
        try {
          const storedPlan = localStorage.getItem('superadmin_plan') as PlanType;
          if (storedPlan && planDetails[storedPlan]) {
            setUserPlan(storedPlan);
          }
        } catch (error) {
          console.warn('Error accessing localStorage:', error);
        }
        
        // Set up event listener for plan changes
        const handlePlanChange = (event: CustomEvent) => {
          setUserPlan(event.detail.plan);
        };
        
        if (window && window.addEventListener) {
          window.addEventListener('planChanged', handlePlanChange as EventListener);
          
          return () => {
            if (window && window.removeEventListener) {
              window.removeEventListener('planChanged', handlePlanChange as EventListener);
            }
          };
        }
      }
    }
  }, [user]);

  useEffect(() => {
    const loadParties = async () => {
      try {
        if (user) {
          // Clear localStorage to prevent conflicts with database data
          if (typeof window !== 'undefined') {
            localStorage.removeItem('partyData')
            localStorage.removeItem('partyChecklist')
            localStorage.removeItem('demoPartyData')
          }
          
          // Load from database using Prisma server actions
          const result = await getUserParties()
          
          if (result.success && result.parties) {
            const formattedParties = result.parties.map((party: any) => {
              const checklistData = party.checklistData || []
              const checkedTasks = Array.isArray(checklistData) ? checklistData.filter((task: any) => task.completed).length : 0
              const totalTasks = Array.isArray(checklistData) && checklistData.length > 0 ? checklistData.length : 15
              
              return {
                id: party.id,
                childName: party.childName,
                age: party.childAge,
                date: new Date(party.partyDate),
                theme: party.theme,
                guestCount: party.guestCount || party.guests?.length || 0,
                checkedTasks,
                totalTasks,
                status: new Date(party.partyDate) > new Date() ? 'upcoming' as const : 'completed' as const
              }
            })
            
            setParties(formattedParties)
          } else {
            console.error('Failed to load parties from database:', result.error)
            // Only fallback to localStorage if explicitly no database connection
            if (result.error?.includes('database') || result.error?.includes('connection')) {
              console.warn('Database connection issue detected, using localStorage fallback')
              loadFromLocalStorage()
            } else {
              // User has no parties in database, show empty state
              setParties([])
            }
          }
        } else {
          // Load from localStorage if not authenticated
          loadFromLocalStorage()
        }
      } catch (error) {
        console.error('Error loading parties from database:', error)
        // Fallback to localStorage on error
        loadFromLocalStorage()
      }
      setLoading(false)
    }

    const loadFromLocalStorage = () => {
      try {
        // Fix: Use correct localStorage key 'partyData' instead of 'partyPlanData'
        const partyData = localStorage.getItem('partyData')
        if (partyData) {
          const data = JSON.parse(partyData)
          
          // Convert localStorage data to dashboard format with safe date handling
          let partyDate: Date;
          try {
            // Fix: Use 'partyDate' field instead of 'date'
            const dateValue = data.partyDate || Date.now();
            partyDate = new Date(dateValue);
            // Validate the date
            if (isNaN(partyDate.getTime())) {
              console.warn('Invalid date found in party data, using current date');
              partyDate = new Date();
            }
          } catch (error) {
            console.warn('Error parsing party date, using current date:', error);
            partyDate = new Date();
          }

          // Load checklist data from separate localStorage key
          let checklistData: any[] = [];
          try {
            const checklistString = localStorage.getItem('partyChecklist');
            if (checklistString) {
              checklistData = JSON.parse(checklistString);
            }
          } catch (error) {
            console.warn('Error loading checklist data:', error);
          }

          const party: Party = {
            id: 'current',
            childName: data.childName || 'Your Child',
            age: data.childAge || 5, // Fix: Use 'childAge' instead of 'age'
            date: partyDate,
            theme: data.selectedTheme || data.classicTheme || 'Superhero', // Fix: Use 'selectedTheme' or 'classicTheme'
            guestCount: data.guestCount || 0, // Use guestCount from auto-save data
            checkedTasks: Array.isArray(checklistData) ? checklistData.filter((task: any) => task.completed).length : 0,
            totalTasks: Array.isArray(checklistData) && checklistData.length > 0 ? checklistData.length : 15,
            status: 'upcoming'
          }
          setParties([party])
        }
      } catch (error) {
        console.error('Error loading parties from localStorage:', error)
      }
    }

    loadParties()
  }, [user])

  const handleDeleteParty = async (partyId: string) => {
    try {
      const result = await deleteParty(partyId)
      if (result.success) {
        // Remove the party from local state
        setParties(prevParties => prevParties.filter(party => party.id !== partyId))
      } else {
        console.error('Failed to delete party:', result.error)
      }
    } catch (error) {
      console.error('Error deleting party:', error)
    }
  }

  const upcomingParties = parties.filter(party => party.status === 'upcoming')
  const completedParties = parties.filter(party => party.status === 'completed')
  const totalGuests = parties.reduce((sum, party) => sum + party.guestCount, 0)
  const totalTasks = parties.reduce((sum, party) => sum + party.totalTasks, 0)
  const completedTasks = parties.reduce((sum, party) => sum + party.checkedTasks, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4 pt-20">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-3 sm:p-4 pt-16 sm:pt-20">
      <div className="max-w-7xl mx-auto">

        {/* Header - Reduced margins */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-3 sm:gap-0">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <PartyPopper className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />
                <span className="leading-tight">Welcome back{user?.user_metadata?.display_name ? `, ${user.user_metadata.display_name}` : ''}!</span>
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1">
                Let's create magical birthday memories for your little ones
              </p>
            </div>
            <Button
              asChild
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 w-full sm:w-auto"
            >
              <Link href="/create-party">
                <Plus className="w-4 h-4 mr-2" />
                New Party
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Cards - Reduced spacing and optimized layout */}
        <div className="space-y-5 mb-6">
          {/* Planning & Progress Overview Section - Compact design */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-6 bg-gradient-to-b from-purple-600 to-pink-600 rounded-full"></div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Planning Overview</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="border-2 border-purple-200 dark:border-purple-700 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-bold text-purple-800 dark:text-purple-200">Active Parties</CardTitle>
                  <div className="p-1.5 rounded-full bg-purple-600 shadow-sm">
                    <Calendar className="h-4 w-4 text-white" />
                  </div>
                </CardHeader>
                <CardContent className="pt-1 space-y-1">
                  <div className="text-2xl font-black text-purple-700 dark:text-purple-300">{upcomingParties.length}</div>
                  <p className="text-xs font-medium text-purple-600 dark:text-purple-400">
                    {upcomingParties.length === 1 ? 'party' : 'parties'} in planning
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 border-green-200 dark:border-green-700 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-bold text-green-800 dark:text-green-200">Tasks Completed</CardTitle>
                  <div className="p-1.5 rounded-full bg-green-600 shadow-sm">
                    <CheckCircle className="h-4 w-4 text-white" />
                  </div>
                </CardHeader>
                <CardContent className="pt-1 space-y-1">
                  <div className="text-2xl font-black text-green-700 dark:text-green-300">{completedTasks}/{totalTasks}</div>
                  <p className="text-xs font-medium text-green-600 dark:text-green-400">
                    {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}% complete
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 border-blue-200 dark:border-blue-700 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-bold text-blue-800 dark:text-blue-200">Total Guests</CardTitle>
                  <div className="p-1.5 rounded-full bg-blue-600 shadow-sm">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                </CardHeader>
                <CardContent className="pt-1 space-y-1">
                  <div className="text-2xl font-black text-blue-700 dark:text-blue-300">{totalGuests}</div>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    across all parties
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Parties Section - Optimized with reduced spacing */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-orange-500 to-red-500 rounded-full"></div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Your Parties</h2>
          </div>
          
          <Tabs defaultValue="upcoming" className="space-y-4">
            <TabsList className="grid w-full max-w-sm mx-auto grid-cols-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 shadow-sm rounded-lg p-1">
              <TabsTrigger 
                value="upcoming" 
                className="flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=inactive]:text-gray-600 dark:data-[state=inactive]:text-gray-300 transition-all duration-200 rounded-md hover:bg-purple-50 dark:hover:bg-purple-900/20"
              >
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">Upcoming ({upcomingParties.length})</span>
              </TabsTrigger>
              <TabsTrigger 
                value="completed" 
                className="flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white data-[state=inactive]:text-gray-600 dark:data-[state=inactive]:text-gray-300 transition-all duration-200 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20"
              >
                <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">Done ({completedParties.length})</span>
              </TabsTrigger>
            </TabsList>

          <TabsContent value="upcoming" className="space-y-4">
            {upcomingParties.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingParties.map((party) => (
                  <PartyCard key={party.id} party={party} onDelete={handleDeleteParty} />
                ))}
              </div>
            ) : (
              <Card className="text-center py-12 border-2 border-dashed border-orange-200 dark:border-orange-700 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 shadow-md">
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/30 w-fit mx-auto">
                    <PartyPopper className="w-12 h-12 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-bold text-orange-800 dark:text-orange-200">No parties planned yet</CardTitle>
                    <CardDescription className="text-orange-700 dark:text-orange-300 max-w-sm mx-auto text-sm">
                      Ready to create your first magical birthday party? Let's get started!
                    </CardDescription>
                  </div>
                  <Button
                    asChild
                    className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-medium shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 px-6 py-2"
                  >
                    <Link href="/create-party">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Party
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedParties.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedParties.map((party) => (
                  <PartyCard key={party.id} party={party} onDelete={handleDeleteParty} />
                ))}
              </div>
            ) : (
              <Card className="text-center py-12 border-2 border-dashed border-green-200 dark:border-green-700 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 shadow-md">
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30 w-fit mx-auto">
                    <Sparkles className="w-12 h-12 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-bold text-green-800 dark:text-green-200">No completed parties yet</CardTitle>
                    <CardDescription className="text-green-700 dark:text-green-300 max-w-sm mx-auto text-sm">
                      Your magical memories will appear here once you've celebrated your parties!
                    </CardDescription>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}