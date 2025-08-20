import { NextRequest, NextResponse } from 'next/server'
import { prisma, testDatabaseConnection, withDatabaseRetry } from '@/lib/prisma'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  console.log('🎉 Starting party creation process with data:', await request.clone().json().then(body => body.partyData))
  
  try {
    const body = await request.json()
    const { partyData } = body

    console.log('🔐 Validating user authentication...')
    
    // Get authenticated user
    const supabase = createServerComponentClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log('❌ User not authenticated, falling back to localStorage')
      return NextResponse.json({ 
        success: true, 
        message: 'Auto-save will use localStorage - user not authenticated',
        fallbackToLocalStorage: true 
      })
    }

    console.log('✅ User authentication successful:', { id: user.id, email: user.email })
    console.log('✅ Authenticated user:', { id: user.id, email: user.email })

    console.log('🔍 Testing database connection...')
    
    // Test database connection before proceeding
    try {
      await testDatabaseConnection()
      console.log('✅ Database connection verified')
    } catch (dbError: any) {
      console.error('❌ Database connection failed:', dbError.message)
      throw new Error(`Database connection failed. Please try again.`)
    }

    // Enhanced database operation with retry logic
    const dbOperation = async () => {
      return await withDatabaseRetry(async () => {
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
          console.log('✅ Party updated successfully:', party.id)
        } else {
          // Create new party
          party = await prisma.party.create({
            data: partyRecord
          })
          console.log('✅ Party created successfully:', party.id)
        }

        return party
      }, 'Party creation/update', 3)
    }

    const party = await dbOperation()

    return NextResponse.json({ 
      success: true, 
      message: 'Party data saved to database',
      party
    })

  } catch (error: any) {
    console.error('💥 Error creating party:', error.message)
    
    // Provide more specific error handling
    if (error.message.includes('Database connection failed') || error.code === 'P1001') {
      return NextResponse.json({ 
        success: false, 
        error: 'Database connection failed. Please try again.',
        fallbackToLocalStorage: true 
      }, { status: 500 })
    }
    
    console.error('Error in party data POST API:', error)
    return NextResponse.json({ 
      success: true, 
      message: 'API error - falling back to localStorage',
      fallbackToLocalStorage: true 
    })
  }
}

export async function GET(request: NextRequest) {
  console.log('📊 Fetching parties from database...')
  
  try {
    // Get authenticated user
    const supabase = createServerComponentClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log('❌ User not authenticated for party fetch')
      return NextResponse.json({ 
        parties: [], 
        message: 'Database not configured or user not authenticated - using localStorage' 
      })
    }

    console.log('✅ User authenticated for party fetch:', { id: user.id })

    // Test database connection before fetching
    try {
      await testDatabaseConnection()
      console.log('✅ Database connection verified for fetch')
    } catch (dbError: any) {
      console.error('❌ Database connection failed during fetch:', dbError.message)
      return NextResponse.json({ 
        parties: [], 
        message: 'Database connection failed - using localStorage fallback' 
      })
    }

    const fetchOperation = async () => {
      return await withDatabaseRetry(async () => {
        const parties = await prisma.party.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' }
        })
        console.log(`✅ Fetched ${parties.length} parties from database`)
        return parties
      }, 'Party fetch', 2)
    }

    const parties = await fetchOperation()

    return NextResponse.json({ 
      parties: parties || [],
      message: 'Parties loaded from database'
    })

  } catch (error: any) {
    console.error('💥 Error fetching parties:', error.message)
    
    // Provide more specific error handling
    if (error.message.includes('Database connection failed') || error.code === 'P1001') {
      return NextResponse.json({ 
        parties: [], 
        message: 'Database connection failed - using localStorage fallback' 
      })
    }
    
    console.error('Error in party data GET API:', error)
    return NextResponse.json({ 
      parties: [], 
      message: 'API error - using localStorage fallback' 
    })
  }
}