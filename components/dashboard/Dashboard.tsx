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
    // Load parties from localStorage for now
    const loadParties = () => {
      try {
        const partyPlanData = localStorage.getItem('partyPlanData')
        if (partyPlanData) {
          const data = JSON.parse(partyPlanData)
          
          // Convert localStorage data to dashboard format
          const party: Party = {
            id: 'current',
            childName: data.childName || 'Your Child',
            age: data.age || 5,
            date: new Date(data.date || Date.now()),
            theme: data.theme || 'Superhero',
            guestCount: (data.guests || []).length,
            checkedTasks: (data.tasks || []).filter((task: any) => task.completed).length,
            totalTasks: (data.tasks || []).length || 15,
            status: 'upcoming'
          }
          setParties([party])
        }
      } catch (error) {
        console.error('Error loading parties:', error)
      }
      setLoading(false)
    }

    loadParties()
  }, [])

  const upcomingParties = parties.filter(party => party.status === 'upcoming')
  const completedParties = parties.filter(party => party.status === 'completed')
  const totalGuests = parties.reduce((sum, party) => sum + party.guestCount, 0)
  const totalTasks = parties.reduce((sum, party) => sum + party.totalTasks, 0)
  const completedTasks = parties.reduce((sum, party) => sum + party.checkedTasks, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 p-4 pt-20">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 p-4 pt-20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <PartyPopper className="w-8 h-8 text-purple-600" />
                Welcome back{user?.user_metadata?.display_name ? `, ${user.user_metadata.display_name}` : ''}!
              </h1>
              <p className="text-gray-600 mt-1">
                Let's create magical birthday memories for your little ones
              </p>
            </div>
            <Button
              asChild
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Link href="/create-party">
                <Plus className="w-4 h-4 mr-2" />
                New Party
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Parties</CardTitle>
              <Calendar className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{upcomingParties.length}</div>
              <p className="text-xs text-muted-foreground">
                {upcomingParties.length === 1 ? 'party' : 'parties'} in planning
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Guests</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalGuests}</div>
              <p className="text-xs text-muted-foreground">
                across all parties
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedTasks}/{totalTasks}</div>
              <p className="text-xs text-muted-foreground">
                {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}% complete
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Parties</CardTitle>
              <Sparkles className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedParties.length}</div>
              <p className="text-xs text-muted-foreground">
                magical memories created
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Parties Section */}
        <Tabs defaultValue="upcoming" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="upcoming" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Upcoming ({upcomingParties.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Completed ({completedParties.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-6">
            {upcomingParties.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcomingParties.map((party) => (
                  <PartyCard key={party.id} party={party} />
                ))}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <PartyPopper className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <CardTitle className="text-lg mb-2">No parties planned yet</CardTitle>
                  <CardDescription className="mb-4">
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
              <Card className="text-center py-12">
                <CardContent>
                  <Sparkles className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <CardTitle className="text-lg mb-2">No completed parties yet</CardTitle>
                  <CardDescription>
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