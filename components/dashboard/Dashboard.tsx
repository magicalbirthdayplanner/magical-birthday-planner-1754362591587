"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, PartyPopper, Calendar, Users, CheckCircle, Clock, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import PartyCard from './PartyCard'
import Link from 'next/link'

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

export default function Dashboard() {
  const { user } = useAuth()
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadParties = async () => {
      try {
        if (user) {
          // Load from database if user is authenticated
          const response = await fetch('/api/party-data')
          if (response.ok) {
            const { parties: dbParties } = await response.json()
            
            const formattedParties = dbParties.map((party: any) => {
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
                status: new Date(party.partyDate) > new Date() ? 'upcoming' : 'completed'
              }
            })
            
            setParties(formattedParties)
          } else {
            // Fallback to localStorage if API fails
            loadFromLocalStorage()
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
        const partyPlanData = localStorage.getItem('partyPlanData')
        if (partyPlanData) {
          const data = JSON.parse(partyPlanData)
          
          // Convert localStorage data to dashboard format with safe date handling
          let partyDate: Date;
          try {
            const dateValue = data.date || Date.now();
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

          const party: Party = {
            id: 'current',
            childName: data.childName || 'Your Child',
            age: data.age || 5,
            date: partyDate,
            theme: data.theme || 'Superhero',
            guestCount: (data.guests || []).length,
            checkedTasks: (data.tasks || []).filter((task: any) => task.completed).length,
            totalTasks: (data.tasks || []).length || 15,
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
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4 sm:gap-0">
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

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
          <Card className="dark:bg-slate-800 dark:border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium dark:text-gray-200">Active Parties</CardTitle>
              <Calendar className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold dark:text-gray-100">{upcomingParties.length}</div>
              <p className="text-xs text-muted-foreground dark:text-gray-400">
                {upcomingParties.length === 1 ? 'party' : 'parties'} in planning
              </p>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-800 dark:border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium dark:text-gray-200">Total Guests</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold dark:text-gray-100">{totalGuests}</div>
              <p className="text-xs text-muted-foreground dark:text-gray-400">
                across all parties
              </p>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-800 dark:border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium dark:text-gray-200">Tasks Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold dark:text-gray-100">{completedTasks}/{totalTasks}</div>
              <p className="text-xs text-muted-foreground dark:text-gray-400">
                {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}% complete
              </p>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-800 dark:border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium dark:text-gray-200">Completed Parties</CardTitle>
              <Sparkles className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold dark:text-gray-100">{completedParties.length}</div>
              <p className="text-xs text-muted-foreground dark:text-gray-400">
                magical memories created
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Parties Section */}
        <Tabs defaultValue="upcoming" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full max-w-sm sm:max-w-md grid-cols-2 dark:bg-slate-800">
            <TabsTrigger value="upcoming" className="flex items-center gap-1 sm:gap-2 text-sm sm:text-base px-2 sm:px-4">
              <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Upcoming ({upcomingParties.length})</span>
              <span className="sm:hidden">Upcoming</span>
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-1 sm:gap-2 text-sm sm:text-base px-2 sm:px-4">
              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Completed ({completedParties.length})</span>
              <span className="sm:hidden">Done</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-4 sm:space-y-6">
            {upcomingParties.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {upcomingParties.map((party) => (
                  <PartyCard key={party.id} party={party} />
                ))}
              </div>
            ) : (
              <Card className="text-center py-12 dark:bg-slate-800 dark:border-slate-700">
                <CardContent>
                  <PartyPopper className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <CardTitle className="text-lg mb-2 dark:text-gray-100">No parties planned yet</CardTitle>
                  <CardDescription className="mb-4 dark:text-gray-300">
                    Ready to create your first magical birthday party?
                  </CardDescription>
                  <Button
                    asChild
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
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

          <TabsContent value="completed" className="space-y-6">
            {completedParties.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {completedParties.map((party) => (
                  <PartyCard key={party.id} party={party} />
                ))}
              </div>
            ) : (
              <Card className="text-center py-12 dark:bg-slate-800 dark:border-slate-700">
                <CardContent>
                  <Sparkles className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <CardTitle className="text-lg mb-2 dark:text-gray-100">No completed parties yet</CardTitle>
                  <CardDescription className="dark:text-gray-300">
                    Your magical memories will appear here once you've celebrated!
                  </CardDescription>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}