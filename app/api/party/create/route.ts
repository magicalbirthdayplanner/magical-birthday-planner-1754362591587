import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Party creation API called with:', body)

    // Get authenticated user using proper cookie handling
    const supabase = createServerComponentClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('Authentication failed:', authError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Authentication required - please sign in first',
          authError: authError?.message 
        },
        { status: 401 }
      )
    }

    console.log('User authenticated:', user.id, user.email)

    // Prepare party data for database
    const partyRecord = {
      user_id: user.id,
      child_name: body.childName || 'Your Child',
      child_age: body.childAge || 5,
      child_gender: body.childGender || null,
      party_date: new Date(body.partyDate || new Date()).toISOString(),
      theme: body.theme || 'princess',
      guest_count: body.guestCount || 0,
      budget: body.budget || null,
      zip_code: body.location || null,
      venue_type: body.venue || null,
      status: 'PLANNING' as const
    }

    console.log('Creating party with data:', partyRecord)

    // Create party in database
    const { data: party, error: createError } = await supabase
      .from('parties')
      .insert(partyRecord)
      .select()
      .single()

    if (createError) {
      console.error('Database error creating party:', createError)
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to create party: ${createError.message}`,
          details: createError
        },
        { status: 500 }
      )
    }

    if (!party?.id) {
      console.error('Party created but no ID returned')
      return NextResponse.json(
        { 
          success: false, 
          error: 'Party created but no ID returned from database' 
        },
        { status: 500 }
      )
    }

    console.log('Party created successfully:', party.id)

    return NextResponse.json({ 
      success: true, 
      party: party,
      message: 'Party created successfully!'
    })

  } catch (error) {
    console.error('Unexpected error in party creation API:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
