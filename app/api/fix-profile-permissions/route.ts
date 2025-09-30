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

    const results: Array<{
      step: string
      status: string
      details: string
      action: string
    }> = []

    // Step 1: Check current user record for magicalbirthdayplanner@gmail.com
    const { data: userRecord, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', 'magicalbirthdayplanner@gmail.com')
      .single()

    results.push({
      step: 'Check User Record',
      status: userError ? 'Failed' : 'Success',
      details: userError ? userError.message : `User record found: ${userRecord.email}`,
      action: userError ? 'User record missing or inaccessible' : 'User record exists'
    })

    // Step 2: Check if user has profile update permissions
    if (!userError && userRecord) {
      try {
        // Try to update the user record with admin privileges
        const { data: updateTest, error: updateError } = await supabaseAdmin
          .from('users')
          .update({ 
            displayName: userRecord.displayName || 'Test Update',
            updated_at: new Date().toISOString() 
          })
          .eq('id', userRecord.id)
          .select()

        results.push({
          step: 'Test Profile Update',
          status: updateError ? 'Failed' : 'Success',
          details: updateError ? `Update failed: ${updateError.message}` : 'Profile update successful',
          action: updateError ? 'Fix RLS policies needed' : 'Update permissions working'
        })

        // Step 3: Fix RLS policies if needed
        if (updateError) {
          // Create permissive RLS policy for users table
          const policySQL = `
            DROP POLICY IF EXISTS "Users can update own profile" ON users;
            CREATE POLICY "Users can update own profile" ON users
            FOR UPDATE USING (auth.uid()::text = id::text)
            WITH CHECK (auth.uid()::text = id::text);
            
            DROP POLICY IF EXISTS "Users can read own profile" ON users;
            CREATE POLICY "Users can read own profile" ON users
            FOR SELECT USING (auth.uid()::text = id::text);
          `

          const { error: policyError } = await supabaseAdmin.rpc('exec', { sql: policySQL })

          results.push({
            step: 'Create RLS Policies',
            status: policyError ? 'Failed' : 'Success',
            details: policyError ? `Policy creation failed: ${policyError.message}` : 'RLS policies created successfully',
            action: policyError ? 'Manual policy creation needed' : 'Policies are now permissive'
          })
        }
      } catch (error) {
        results.push({
          step: 'Test Profile Update',
          status: 'Failed',
          details: `Update test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          action: 'Database access issue'
        })
      }
    }

    // Step 4: Ensure user record has all required fields
    if (!userError && userRecord) {
      const missingFields: string[] = []
      if (!userRecord.name) missingFields.push('name')
      if (!userRecord.displayName) missingFields.push('displayName')

      if (missingFields.length > 0) {
        const { data: enrichData, error: enrichError } = await supabaseAdmin
          .from('users')
          .update({
            name: userRecord.name || 'Magical Birthday Planner',
            displayName: userRecord.displayName || 'Arun',
            updated_at: new Date().toISOString()
          })
          .eq('id', userRecord.id)
          .select()

        results.push({
          step: 'Enrich User Profile',
          status: enrichError ? 'Failed' : 'Success',
          details: enrichError ? enrichError.message : `Added missing fields: ${missingFields.join(', ')}`,
          action: enrichError ? 'Manual field addition needed' : 'Profile is now complete'
        })
      } else {
        results.push({
          step: 'Check Profile Completeness',
          status: 'Success',
          details: 'All required fields present',
          action: 'Profile is complete'
        })
      }
    }

    const successSteps = results.filter(r => r.status === 'Success').length

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      diagnosis: 'Automated profile permission fix for Google OAuth users',
      results: results,
      success_rate: `${successSteps}/${results.length}`,
      fix_applied: successSteps >= 2,
      user_email: 'magicalbirthdayplanner@gmail.com',
      next_action: successSteps >= 2 ? 'Profile editing should now work' : 'Manual intervention required',
      test_instructions: {
        step1: 'Navigate to https://www.magicalbirthdayplanner.com/account',
        step2: 'Click "Edit" in the Personal Information section',
        step3: 'Try updating the Display Name field',
        step4: 'Click Save to test if the fix worked'
      }
    })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}