import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })
    
    const results: Array<{
      step: string
      status: string
      details: string
    }> = []
    
    // Step 1: Check current auth status
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    results.push({
      step: 'Get Auth User',
      status: authError ? 'Failed' : (user ? 'Success' : 'No User'),
      details: authError ? authError.message : (user ? `User ID: ${user.id}, Email: ${user.email}` : 'Not authenticated')
    })
    
    if (user) {
      // Step 2: Try to read from users table
      const { data: userData, error: readError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      
      results.push({
        step: 'Read User Record',
        status: readError ? 'Failed' : (userData ? 'Found' : 'Not Found'),
        details: readError ? readError.message : (userData ? JSON.stringify(userData) : 'No record exists')
      })
      
      // Step 3: Try to insert/upsert user record
      const { data: upsertData, error: upsertError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
          avatar_url: user.user_metadata?.avatar_url,
          updated_at: new Date().toISOString()
        })
        .select()
      
      results.push({
        step: 'Upsert User Record',
        status: upsertError ? 'Failed' : 'Success',
        details: upsertError ? upsertError.message : `Record upserted: ${JSON.stringify(upsertData)}`
      })
      
      // Step 4: Check RLS policies
      const { data: policyData, error: policyError } = await supabase
        .from('users')
        .select('*')
        .eq('email', 'magicalbirthdayplanner@gmail.com')
      
      results.push({
        step: 'Check RLS Policies',
        status: policyError ? 'Failed' : 'Success',
        details: policyError ? `RLS blocking access: ${policyError.message}` : `Can read records: ${policyData?.length || 0} found`
      })
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      debug_results: results,
      user_metadata: user ? {
        id: user.id,
        email: user.email,
        metadata: user.user_metadata,
        app_metadata: user.app_metadata
      } : null
    })
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}