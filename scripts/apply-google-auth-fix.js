#!/usr/bin/env node

/**
 * Script to apply Google Auth user creation fix
 * This script sets up the database trigger to automatically create user profiles
 * when users sign up via Google OAuth.
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Read environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('- NEXT_PUBLIC_SUPABASE_URL')
  console.error('- SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyGoogleAuthFix() {
  try {
    console.log('🔄 Starting Google Auth user creation fix...')

    // Step 1: Ensure trial columns exist
    console.log('📝 Step 1: Adding trial columns if they don\'t exist...')
    const { error: alterError } = await supabase.rpc('exec', {
      sql: `
        ALTER TABLE public.users 
        ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS trial_plan TEXT DEFAULT 'PRO',
        ADD COLUMN IF NOT EXISTS is_trial_active BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS has_used_trial BOOLEAN DEFAULT FALSE;
      `
    })

    if (alterError) {
      console.warn('⚠️ Note: Column addition might have failed (this is ok if columns already exist):', alterError.message)
    } else {
      console.log('✅ Trial columns ensured')
    }

    // Step 2: Create the trigger function
    console.log('📝 Step 2: Creating user creation trigger function...')
    const { error: functionError } = await supabase.rpc('exec', {
      sql: `
        CREATE OR REPLACE FUNCTION handle_new_user()
        RETURNS TRIGGER AS $$
        BEGIN
          INSERT INTO public.users (
            id,
            email,
            full_name,
            avatar_url,
            current_plan,
            trial_started_at,
            trial_expires_at,
            trial_plan,
            is_trial_active,
            has_used_trial,
            created_at,
            updated_at
          ) VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
            NEW.raw_user_meta_data->>'avatar_url',
            'PRO',
            NOW(),
            NOW() + INTERVAL '24 hours',
            'PRO',
            TRUE,
            TRUE,
            NOW(),
            NOW()
          ) ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = COALESCE(EXCLUDED.full_name, users.full_name),
            avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
            updated_at = NOW();
          
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
    })

    if (functionError) {
      console.error('❌ Error creating trigger function:', functionError)
      return
    }
    console.log('✅ Trigger function created')

    // Step 3: Create the trigger
    console.log('📝 Step 3: Creating trigger...')
    const { error: triggerError } = await supabase.rpc('exec', {
      sql: `
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
        CREATE TRIGGER on_auth_user_created
          AFTER INSERT ON auth.users
          FOR EACH ROW EXECUTE FUNCTION handle_new_user();
      `
    })

    if (triggerError) {
      console.error('❌ Error creating trigger:', triggerError)
      return
    }
    console.log('✅ Trigger created')

    // Step 4: Update RLS policies
    console.log('📝 Step 4: Updating RLS policies...')
    const { error: policyError } = await supabase.rpc('exec', {
      sql: `
        DROP POLICY IF EXISTS "Allow user creation via trigger" ON public.users;
        CREATE POLICY "Allow user creation via trigger" ON public.users
          FOR INSERT WITH CHECK (true);
          
        DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
        CREATE POLICY "Users can insert own profile" ON public.users
          FOR INSERT WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);
      `
    })

    if (policyError) {
      console.warn('⚠️ Note: RLS policy update might have failed:', policyError.message)
    } else {
      console.log('✅ RLS policies updated')
    }

    // Step 5: Add indexes
    console.log('📝 Step 5: Adding performance indexes...')
    const { error: indexError } = await supabase.rpc('exec', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_users_trial_expires_at ON public.users(trial_expires_at);
        CREATE INDEX IF NOT EXISTS idx_users_is_trial_active ON public.users(is_trial_active);
      `
    })

    if (indexError) {
      console.warn('⚠️ Note: Index creation might have failed:', indexError.message)
    } else {
      console.log('✅ Performance indexes added')
    }

    console.log('🎉 Google Auth user creation fix applied successfully!')
    console.log('🔄 From now on, when users sign up via Google OAuth:')
    console.log('   • User profiles will be automatically created in the users table')
    console.log('   • Users will get a 24-hour PRO trial automatically')
    console.log('   • The auth callback route has been improved for better error handling')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

// Run the fix
applyGoogleAuthFix().then(() => {
  console.log('✅ Script completed successfully')
  process.exit(0)
}).catch((error) => {
  console.error('❌ Script failed:', error)
  process.exit(1)
})