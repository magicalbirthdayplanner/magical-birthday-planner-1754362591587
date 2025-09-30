import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

export async function POST() {
  try {
    const cookieStore = cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })
    
    // Try to manually insert a test user to verify database connectivity
    const testUserId = 'test-user-' + Date.now()
    const { data: insertData, error: insertError } = await supabase
      .from('users')
      .insert({
        id: testUserId,
        email: 'test@example.com',
        full_name: 'Test User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
    
    if (insertError) {
      return NextResponse.json({
        step: 'Manual Insert Test',
        status: 'Failed',
        error: insertError.message,
        details: 'Database insertion failed - likely RLS policy issue',
        recommended_fix: 'Run the SQL from fix-users-table.sql in Supabase dashboard'
      })
    }
    
    // Try to read back the inserted user
    const { data: readData, error: readError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'test@example.com')
    
    // Clean up test user
    await supabase
      .from('users')
      .delete()
      .eq('id', testUserId)
    
    return NextResponse.json({
      step: 'Manual Insert Test',
      status: 'Success',
      insertResult: insertData,
      readResult: readData,
      message: 'Database is working - OAuth session persistence is the issue'
    })
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}