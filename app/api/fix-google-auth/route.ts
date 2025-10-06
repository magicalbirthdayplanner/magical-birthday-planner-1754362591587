import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function POST() {
  try {
    const cookieStore = cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })

    // Read the SQL fix file
    const sqlPath = join(process.cwd(), 'database', 'fix-google-auth-user-creation.sql')
    const sqlContent = readFileSync(sqlPath, 'utf8')

    console.log('🔄 Applying Google Auth user creation fix...')

    // Execute the SQL fix
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent })

    if (error) {
      console.error('❌ Error applying Google Auth fix:', error)
      return NextResponse.json(
        { error: 'Failed to apply Google Auth fix', details: error },
        { status: 500 }
      )
    }

    console.log('✅ Google Auth user creation fix applied successfully')

    return NextResponse.json({
      success: true,
      message: 'Google Auth user creation fix applied successfully',
      data
    })

  } catch (error) {
    console.error('❌ Exception while applying Google Auth fix:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    )
  }
}