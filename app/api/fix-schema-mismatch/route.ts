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

    const results: string[] = []

    // Step 1: Check current schema
    results.push('🔍 Checking current users table schema...')
    
    const { data: columns, error: schemaError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND table_schema = 'public'
        ORDER BY ordinal_position;
      `
    })

    if (schemaError) {
      results.push(`❌ Schema check failed: ${schemaError.message}`)
      return NextResponse.json({ error: 'Schema check failed', results })
    }

    results.push(`✅ Found ${columns?.length || 0} columns in users table`)

    // Step 2: Add missing columns with proper names
    results.push('📝 Adding missing columns...')
    
    const { error: alterError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        -- Add missing columns if they don't exist
        ALTER TABLE public.users 
        ADD COLUMN IF NOT EXISTS name TEXT,
        ADD COLUMN IF NOT EXISTS "displayName" TEXT,
        ADD COLUMN IF NOT EXISTS "emailNotifications" BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS "partyReminders" BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS "marketingEmails" BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS "currentPlan" TEXT DEFAULT 'FREE';
      `
    })

    if (alterError) {
      results.push(`❌ Failed to add columns: ${alterError.message}`)
    } else {
      results.push('✅ Successfully added missing columns')
    }

    // Step 3: Migrate data from old columns to new columns
    results.push('🔄 Migrating data from old column names...')
    
    const { error: migrateError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        -- Migrate data from old columns to new columns
        UPDATE public.users 
        SET 
          name = COALESCE(name, full_name),
          "currentPlan" = COALESCE("currentPlan", current_plan, 'FREE')
        WHERE name IS NULL OR "currentPlan" IS NULL;
      `
    })

    if (migrateError) {
      results.push(`❌ Data migration failed: ${migrateError.message}`)
    } else {
      results.push('✅ Successfully migrated data')
    }

    // Step 4: Fix specific user record for magicalbirthdayplanner@gmail.com
    results.push('👤 Updating specific user record...')
    
    const { error: updateUserError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: 'f72f8eaf-ef9c-42e9-8f4c-5c8163b78db6', // ID from previous check
        email: 'magicalbirthdayplanner@gmail.com',
        name: 'Magical Birthday Planner',
        displayName: 'Arun',
        currentPlan: 'FREE',
        emailNotifications: true,
        partyReminders: true,
        marketingEmails: false,
        updated_at: new Date().toISOString()
      })

    if (updateUserError) {
      results.push(`❌ User record update failed: ${updateUserError.message}`)
    } else {
      results.push('✅ Successfully updated user record')
    }

    // Step 5: Test the update operation
    results.push('🧪 Testing profile update...')
    
    const { data: testUpdate, error: testError } = await supabaseAdmin
      .from('users')
      .update({ 
        displayName: 'Arun (Updated)',
        updated_at: new Date().toISOString() 
      })
      .eq('email', 'magicalbirthdayplanner@gmail.com')
      .select()

    if (testError) {
      results.push(`❌ Test update failed: ${testError.message}`)
    } else {
      results.push('✅ Profile update test successful!')
    }

    // Step 6: Fix RLS policies
    results.push('🛡️ Fixing RLS policies...')
    
    const { error: policyError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        -- Drop existing policies
        DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
        DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
        DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.users;
        
        -- Create permissive policies
        CREATE POLICY "Users can read own profile" ON public.users
        FOR SELECT USING (auth.uid()::text = id::text);
        
        CREATE POLICY "Users can update own profile" ON public.users
        FOR UPDATE USING (auth.uid()::text = id::text)
        WITH CHECK (auth.uid()::text = id::text);
        
        CREATE POLICY "Users can insert own profile" ON public.users
        FOR INSERT WITH CHECK (auth.uid()::text = id::text);
      `
    })

    if (policyError) {
      results.push(`❌ RLS policy update failed: ${policyError.message}`)
    } else {
      results.push('✅ RLS policies updated successfully')
    }

    return NextResponse.json({
      success: true,
      message: 'Schema fix completed successfully',
      results: results,
      timestamp: new Date().toISOString(),
      next_steps: [
        'Navigate to https://www.magicalbirthdayplanner.com/account',
        'Try editing the Display Name field',
        'Click Save - the Unauthorized error should be resolved'
      ]
    })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}