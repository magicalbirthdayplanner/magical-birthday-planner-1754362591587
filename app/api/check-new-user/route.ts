import { NextResponse } from 'next/server'
import { safeJson } from '@/lib/server/safe-json';
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const cookieStore = cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })
    
    // Check if user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return safeJson({
        is_new_user: false,
        authenticated: false,
        message: 'User not authenticated'
      })
    }

    // Check when user was created and when user record was created
    const userCreatedAt = new Date(user.created_at)
    const now = new Date()
    const timeSinceCreation = now.getTime() - userCreatedAt.getTime()
    const minutesSinceCreation = timeSinceCreation / (1000 * 60)

    // Check user record in custom users table
    const { data: userRecord, error: recordError } = await supabase
      .from('users')
      .select('created_at, updated_at, full_name')
      .eq('id', user.id)
      .single()

    let isNewUser = false
    
    if (recordError) {
      // If no record exists, definitely a new user
      isNewUser = true
    } else {
      // Check if user record was created recently (within last 10 minutes)
      const recordCreatedAt = new Date(userRecord.created_at)
      const timeSinceRecordCreation = now.getTime() - recordCreatedAt.getTime()
      const minutesSinceRecordCreation = timeSinceRecordCreation / (1000 * 60)
      
      // Consider user new if:
      // 1. Auth user created within last 30 minutes, OR
      // 2. User record created within last 10 minutes
      isNewUser = minutesSinceCreation <= 30 || minutesSinceRecordCreation <= 10
    }

    // Check if user has any parties (another indicator of new user)
    const { data: userParties, error: partiesError } = await supabase
      .from('parties')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)

    const hasParties = !partiesError && userParties && userParties.length > 0

    // Check if user has complete profile setup
    const hasCompleteProfile = userRecord && userRecord.full_name && userRecord.full_name.trim() !== ''

    // Final determination: new user if:
    // 1. No parties AND (recently created OR incomplete profile)
    // 2. No user record exists at all
    const finalIsNewUser = !userRecord || (!hasParties && (!hasCompleteProfile || isNewUser))

    return safeJson({
      is_new_user: finalIsNewUser,
      authenticated: true,
      user_info: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        minutes_since_creation: Math.round(minutesSinceCreation)
      },
      analysis: {
        recently_created: isNewUser,
        has_parties: hasParties,
        record_exists: !recordError,
        should_show_welcome: finalIsNewUser
      }
    })

  } catch (error) {
    return safeJson({
      error: error instanceof Error ? error.message : 'Unknown error',
      is_new_user: false,
      authenticated: false
    }, { status: 500 })
  }
}
