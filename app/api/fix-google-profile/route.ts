import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
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
    const results: string[] = []

    // Step 1: Get the auth user ID
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    if (authError) {
      return NextResponse.json({ error: 'Failed to access auth users', details: authError.message })
    }

    const targetUser = authUsers.users.find(u => u.email === userEmail)
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found in auth system' })
    }

    results.push(`✅ Found auth user: ${targetUser.email} (ID: ${targetUser.id})`)

    // Step 2: Check if user record exists in users table
    const { data: userRecord, error: userCheckError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', targetUser.id)
      .single()

    if (userCheckError) {
      results.push(`❌ User record not found: ${userCheckError.message}`)
      
      // Create user record if missing
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          id: targetUser.id,
          email: targetUser.email!,
          name: targetUser.user_metadata?.full_name || targetUser.user_metadata?.name || 'Magical Birthday Planner',
          displayName: 'Arun',
          current_plan: 'FREE',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (createError) {
        results.push(`❌ Failed to create user record: ${createError.message}`)
        return NextResponse.json({ error: 'Failed to create user record', results })
      } else {
        results.push(`✅ Created user record successfully`)
      }
    } else {
      results.push(`✅ User record exists in database`)
    }

    // Step 3: Test profile update with admin privileges
    const { data: updateTest, error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        displayName: 'Arun (Updated)',
        updated_at: new Date().toISOString() 
      })
      .eq('id', targetUser.id)
      .select()

    if (updateError) {
      results.push(`❌ Profile update failed: ${updateError.message}`)
    } else {
      results.push(`✅ Profile update successful`)
    }

    // Step 4: Verify the update worked
    const { data: verifyUser, error: verifyError } = await supabaseAdmin
      .from('users')
      .select('displayName, updated_at')
      .eq('id', targetUser.id)
      .single()

    if (verifyError) {
      results.push(`❌ Verification failed: ${verifyError.message}`)
    } else {
      results.push(`✅ Verification successful - Display name: ${verifyUser.displayName}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Profile permissions fix completed',
      user_email: userEmail,
      user_id: targetUser.id,
      results: results,
      timestamp: new Date().toISOString(),
      next_steps: [
        'Navigate to https://www.magicalbirthdayplanner.com/account',
        'Try editing the display name field',
        'The "Unauthorized" error should now be resolved'
      ]
    })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}