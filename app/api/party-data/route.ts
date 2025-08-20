import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { partyData } = body

    // Get authenticated user
    const supabase = createServerComponentClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ 
        success: true, 
        message: 'Auto-save will use localStorage - user not authenticated',
        fallbackToLocalStorage: true 
      })
    }

    // Set timeout for database operations
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database operation timeout')), 6000)
    })

    const dbOperation = async () => {
      // Check if party already exists for this user
      const existingParty = await prisma.party.findFirst({
        where: { userId: user.id },
        select: { id: true }
      })

      // Prepare party data for database
      const partyRecord = {
        userId: user.id,
        childName: partyData.childName || 'Your Child',
        childAge: partyData.childAge || 5,
        childGender: partyData.childGender || '',
        interests: partyData.childInterests || [],
        favoriteColors: partyData.favoriteColors || [],
        partyDate: new Date(partyData.partyDate || new Date()),
        theme: partyData.selectedTheme || partyData.classicTheme || 'Superhero',
        guestCount: partyData.guestCount || 0,
        budget: partyData.budget || null,
        location: partyData.zipCode || '',
        checklistData: partyData.checklistData || []
      }

      let party;
      if (existingParty) {
        // Update existing party
        party = await prisma.party.update({
          where: { id: existingParty.id },
          data: partyRecord
        })
      } else {
        // Create new party
        party = await prisma.party.create({
          data: partyRecord
        })
      }

      return party
    }

    const party = await Promise.race([dbOperation(), timeoutPromise])

    return NextResponse.json({ 
      success: true, 
      message: 'Party data saved to database',
      party
    })

  } catch (error) {
    console.error('Error in party data POST API:', error)
    return NextResponse.json({ 
      success: true, 
      message: 'API error - falling back to localStorage',
      fallbackToLocalStorage: true 
    })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = createServerComponentClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ 
        parties: [], 
        message: 'Database not configured or user not authenticated - using localStorage' 
      })
    }

    // Set timeout for database operations
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database fetch timeout')), 5000)
    })

    const fetchOperation = async () => {
      const parties = await prisma.party.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' }
      })
      return parties
    }

    const parties = await Promise.race([fetchOperation(), timeoutPromise])

    return NextResponse.json({ 
      parties: parties || [],
      message: 'Parties loaded from database'
    })

  } catch (error) {
    console.error('Error in party data GET API:', error)
    return NextResponse.json({ 
      parties: [], 
      message: 'API error - using localStorage fallback' 
    })
  }
}