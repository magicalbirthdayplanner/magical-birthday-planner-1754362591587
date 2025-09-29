import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })
    
    const results: Array<{
      check: string
      status: string
      details: string
    }> = []
    
    // Check auth user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    results.push({
      check: 'Auth User',
      status: authError ? 'Failed' : (user ? 'Authenticated' : 'Not authenticated'),
      details: authError ? authError.message : (user ? `User: ${user.email}` : 'No user')
    })
    
    // Check if profiles table exists
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1)
    
    results.push({
      check: 'Profiles Table',
      status: profilesError ? 'Failed' : 'Exists',
      details: profilesError ? profilesError.message : 'Table accessible'
    })
    
    // Check if users table exists
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(1)
    
    results.push({
      check: 'Users Table',
      status: usersError ? 'Failed' : 'Exists',
      details: usersError ? usersError.message : 'Table accessible'
    })
    
    // If user is authenticated, check their records
    if (user) {
      // Check profiles record
      const { data: userProfile, error: userProfileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      results.push({
        check: 'User Profile Record',
        status: userProfileError ? 'Failed' : 'Found',
        details: userProfileError ? userProfileError.message : `Profile exists: ${JSON.stringify(userProfile)}`
      })
      
      // Check users record
      const { data: userRecord, error: userRecordError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      
      results.push({
        check: 'User Record',
        status: userRecordError ? 'Failed' : 'Found',
        details: userRecordError ? userRecordError.message : `User record exists: ${JSON.stringify(userRecord)}`
      })
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      database_diagnosis: results,
      recommendations: [
        'If profiles table missing: Create profiles table',
        'If user records missing: User data not being saved correctly',
        'Check auth callback logs for upsert errors'
      ]
    })
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}