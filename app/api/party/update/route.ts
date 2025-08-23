import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { partyId, ...updateData } = body
    console.log('Party update API called with:', { partyId, updateData })

    if (!partyId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Party ID is required for updates' 
        },
        { status: 400 }
      )
    }

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

    // Prepare party data for database update
    const partyRecord = {
      child_name: updateData.childName || 'Your Child',
      child_age: updateData.childAge || 5,
      child_gender: updateData.childGender || null,
      party_date: new Date(updateData.partyDate || new Date()).toISOString(),
      theme: updateData.theme || 'princess',
      guest_count: updateData.guestCount || 0,
      budget: updateData.budget || null,
      zip_code: updateData.location || null,
      venue_type: updateData.venue || null,
      updated_at: new Date().toISOString()
    }

    console.log('Updating party with data:', partyRecord)

    // Update party in database - ensure user owns the party
    const { data: party, error: updateError } = await supabase
      .from('parties')
      .update(partyRecord)
      .eq('id', partyId)
      .eq('user_id', user.id)  // Security: ensure user owns this party
      .select()
      .single()

    if (updateError) {
      console.error('Database error updating party:', updateError)
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to update party: ${updateError.message}`,
          details: updateError
        },
        { status: 500 }
      )
    }

    if (!party) {
      console.error('No party found or user does not have permission')
      return NextResponse.json(
        { 
          success: false, 
          error: 'Party not found or you do not have permission to update it' 
        },
        { status: 404 }
      )
    }

    console.log('Party updated successfully:', party.id)

    return NextResponse.json({ 
      success: true, 
      party: party,
      message: 'Party updated successfully!'
    })

  } catch (error) {
    console.error('Unexpected error in party update API:', error)
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
