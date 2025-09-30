import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const userEmail = 'magicalbirthdayplanner@gmail.com'

    // Get auth user
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    const targetUser = authUsers?.users.find(u => u.email === userEmail)

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found in auth' })
    }

    // Check user record
    const { data: userRecord, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', targetUser.id)
      .single()

    // Check parties
    const { data: userParties, error: partiesError } = await supabaseAdmin
      .from('parties')
      .select('*')
      .eq('user_id', targetUser.id)

    return NextResponse.json({
      diagnosis: 'Complete user analysis',
      auth_user: {
        id: targetUser.id,
        email: targetUser.email,
        created_at: targetUser.created_at,
        user_metadata: targetUser.user_metadata
      },
      user_record: {
        exists: !userError,
        error: userError?.message,
        data: userRecord
      },
      parties: {
        count: userParties?.length || 0,
        error: partiesError?.message,
        has_parties: userParties && userParties.length > 0,
        data: userParties
      },
      should_show_welcome: {
        no_parties: !userParties || userParties.length === 0,
        conclusion: (!userParties || userParties.length === 0) ? 'SHOULD SHOW WELCOME' : 'SHOULD NOT SHOW WELCOME'
      }
    })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}