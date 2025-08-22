import { NextRequest, NextResponse } from 'next/server'
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
      const { data: existingParty, error: findError } = await supabase
        .from('parties')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (findError && findError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('Error finding existing party:', findError)
      }

      // Prepare party data for database with correct field mapping
      const partyRecord = {
        user_id: user.id,
        child_name: partyData.childName || 'Your Child',
        child_age: partyData.childAge || 5,
        child_gender: partyData.childGender || null,
        party_date: new Date(partyData.partyDate || new Date()).toISOString(),
        theme: partyData.selectedTheme || partyData.classicTheme || 'Superhero',
        guest_count: partyData.guestCount || 0,
        budget: partyData.budget || null,
        zip_code: partyData.zipCode || null,
        venue_type: null,
        status: 'PLANNING' as const
      }

      let party;
      if (existingParty) {
        // Update existing party
        const { data: updatedParty, error: updateError } = await supabase
          .from('parties')
          .update(partyRecord)
          .eq('id', existingParty.id)
          .select()
          .single()

        if (updateError) {
          throw new Error(`Failed to update party: ${updateError.message}`)
        }
        party = updatedParty
      } else {
        // Create new party
        const { data: newParty, error: createError } = await supabase
          .from('parties')
          .insert(partyRecord)
          .select()
          .single()

        if (createError) {
          throw new Error(`Failed to create party: ${createError.message}`)
        }
        party = newParty
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
      const { data: parties, error: fetchError } = await supabase
        .from('parties')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) {
        throw new Error(`Failed to fetch parties: ${fetchError.message}`)
      }

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