import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const partyId = searchParams.get('id')
    
    if (!partyId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Party ID is required' 
        },
        { status: 400 }
      )
    }

    console.log('Getting party data for ID:', partyId)

    // Get authenticated user using proper cookie handling
    const supabase = createServerComponentClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('Authentication failed:', authError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'User not authenticated',
          authError: authError?.message 
        },
        { status: 401 }
      )
    }

    console.log('User authenticated:', user.id, user.email)

    // Get party data with guests and invitations
    const { data: party, error: partyError } = await supabase
      .from('parties')
      .select(`
        *,
        guests(id, name, email, phone, type, age, notes),
        invitations(id, status, responded_at, sent_at)
      `)
      .eq('id', partyId)
      .eq('user_id', user.id)  // Security: ensure user owns this party
      .single()

    if (partyError) {
      console.error('Database error getting party:', partyError)
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to get party: ${partyError.message}`,
          details: partyError
        },
        { status: 500 }
      )
    }

    if (!party) {
      console.error('Party not found or user does not have permission')
      return NextResponse.json(
        { 
          success: false, 
          error: 'Party not found or you do not have permission to access it' 
        },
        { status: 404 }
      )
    }

    console.log('Party data retrieved successfully:', party.id)

    return NextResponse.json({ 
      success: true, 
      party: party,
      message: 'Party data loaded successfully!'
    })

  } catch (error) {
    console.error('Unexpected error in get party API:', error)
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
