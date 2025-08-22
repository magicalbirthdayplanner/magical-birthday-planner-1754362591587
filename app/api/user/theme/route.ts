import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get user from Supabase
    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .select('theme')
      .eq('id', user.id)
      .single()

    if (dbError && dbError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Database error:', dbError)
    }

    return NextResponse.json({ 
      theme: dbUser?.theme || 'light' 
    })
  } catch (error) {
    console.error('Error fetching user theme:', error)
    return NextResponse.json(
      { error: 'Failed to fetch theme preference' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { theme } = await request.json()

    if (!theme || !['light', 'dark'].includes(theme)) {
      return NextResponse.json(
        { error: 'Invalid theme. Must be "light" or "dark"' },
        { status: 400 }
      )
    }

    // Create or update user with theme preference in Supabase
    const { error: upsertError } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        email: user.email!,
        name: user.user_metadata?.display_name || user.user_metadata?.full_name || null,
        theme,
        currentPlan: 'FREE', // Default plan
        emailNotifications: true, // Default settings
        partyReminders: true,
        marketingEmails: false,
        emailVerified: false,
        passwordResetRequested: false
      }, {
        onConflict: 'id'
      })

    if (upsertError) {
      console.error('Error upserting user theme:', upsertError)
      return NextResponse.json(
        { error: 'Failed to save theme preference' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving user theme:', error)
    return NextResponse.json(
      { error: 'Failed to save theme preference' },
      { status: 500 }
    )
  }
}