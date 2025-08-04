import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { partyData, userId } = body

    // If Supabase is not configured or no userId, fall back to localStorage
    if (!supabase || !userId) {
      return NextResponse.json({ 
        success: true, 
        message: 'Auto-save will use localStorage - database not configured or user not authenticated',
        fallbackToLocalStorage: true 
      })
    }

    // Check if party already exists for this user
    const { data: existingParties, error: fetchError } = await supabase
      .from('parties')
      .select('id')
      .eq('userId', userId)
      .limit(1)

    if (fetchError) {
      console.error('Database fetch error:', fetchError)
      return NextResponse.json({ 
        success: true, 
        message: 'Database error - falling back to localStorage',
        fallbackToLocalStorage: true 
      })
    }

    // Prepare party data for database
    const partyRecord = {
      userId,
      childName: partyData.childName || 'Your Child',
      childAge: partyData.childAge || 5,
      childGender: partyData.childGender || '',
      childInterests: partyData.childInterests || [],
      favoriteColors: partyData.favoriteColors || [],
      partyDate: partyData.partyDate || new Date().toISOString(),
      theme: partyData.selectedTheme || partyData.classicTheme || 'Superhero',
      guestCount: partyData.guestCount || 0,
      budget: partyData.budget || null,
      location: partyData.zipCode || '',
      checklistData: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    let result;
    if (existingParties && existingParties.length > 0) {
      // Update existing party
      const { data, error } = await supabase
        .from('parties')
        .update({ ...partyRecord, updatedAt: new Date().toISOString() })
        .eq('userId', userId)
        .select()

      result = { data, error }
    } else {
      // Create new party
      const { data, error } = await supabase
        .from('parties')
        .insert([partyRecord])
        .select()

      result = { data, error }
    }

    if (result.error) {
      console.error('Database save error:', result.error)
      return NextResponse.json({ 
        success: true, 
        message: 'Database save failed - falling back to localStorage',
        fallbackToLocalStorage: true 
      })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Party data saved to database',
      party: result.data?.[0] 
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
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    // If Supabase is not configured or no userId, return empty array for localStorage fallback
    if (!supabase || !userId) {
      return NextResponse.json({ 
        parties: [], 
        message: 'Database not configured or user not authenticated - using localStorage' 
      })
    }

    // Fetch parties for the user
    const { data: parties, error } = await supabase
      .from('parties')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false })

    if (error) {
      console.error('Database fetch error:', error)
      return NextResponse.json({ 
        parties: [], 
        message: 'Database error - using localStorage fallback' 
      })
    }

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