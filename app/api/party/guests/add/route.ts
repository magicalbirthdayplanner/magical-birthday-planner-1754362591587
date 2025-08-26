import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { partyId, guestData } = body
    
    if (!partyId || !guestData) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Party ID and guest data are required' 
        },
        { status: 400 }
      )
    }

    // Get authenticated user
    const supabase = createServerComponentClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Authentication required' 
        },
        { status: 401 }
      )
    }

    // Verify party ownership
    const { data: party, error: partyError } = await supabase
      .from('parties')
      .select('*')
      .eq('id', partyId)
      .eq('user_id', user.id)
      .single()

    if (partyError || !party) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Party not found or access denied' 
        },
        { status: 404 }
      )
    }

    // Create guest
    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .insert({
        ...guestData,
        party_id: partyId,
        user_id: user.id,
      })
      .select()
      .single()

    if (guestError) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to create guest: ${guestError.message}` 
        },
        { status: 500 }
      )
    }

    // Create invitation record
    await supabase
      .from('invitations')
      .insert({
        party_id: partyId,
        guest_id: guest.id,
        user_id: user.id,
        status: 'PENDING',
      })

    return NextResponse.json({
      success: true,
      guest: guest
    })

  } catch (error) {
    console.error('Error adding guest:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    )
  }
}
