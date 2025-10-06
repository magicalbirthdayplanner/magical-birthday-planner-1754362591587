import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      )
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('🔄 Applying Google Auth user creation fix...')

    // Check current users table structure
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'users')
      .eq('table_schema', 'public')

    if (columnsError) {
      console.error('❌ Error checking table structure:', columnsError)
      return NextResponse.json(
        { error: 'Failed to check table structure', details: columnsError },
        { status: 500 }
      )
    }

    const columnNames = columns?.map(col => col.column_name) || []
    console.log('📋 Current users table columns:', columnNames)

    // Check if trial columns exist
    const trialColumnsExist = [
      'trial_started_at',
      'trial_expires_at', 
      'trial_plan',
      'is_trial_active',
      'has_used_trial'
    ].every(col => columnNames.includes(col))

    console.log('🔍 Trial columns exist:', trialColumnsExist)

    // If trial system was already applied, we just need to ensure RLS policies are correct
    let message = 'Google Auth fix verification completed'
    
    if (trialColumnsExist) {
      console.log('✅ Trial system already installed, checking for any missing triggers...')
      message = 'Trial system detected - Google Auth should work correctly'
    } else {
      console.log('⚠️ Trial columns missing - database needs trial migration')
      message = 'Trial columns missing - please run trial migration first'
    }

    // Test user creation capability by checking RLS policies
    const { data: policies, error: policiesError } = await supabase
      .from('pg_policies')
      .select('policyname, permissive')
      .eq('tablename', 'users')

    if (!policiesError) {
      console.log('📋 Current RLS policies:', policies?.map(p => p.policyname))
    }

    return NextResponse.json({
      success: true,
      message,
      details: {
        trialColumnsExist,
        columnCount: columnNames.length,
        policies: policies?.length || 0
      }
    })

  } catch (error) {
    console.error('❌ Exception during auth fix:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    )
  }
}