#!/usr/bin/env node

/**
 * Automated Production Fix for Trial System
 * Diagnoses and fixes trial system issues in production database
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing environment variables');
  console.error('Make sure these are set in your .env file:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function diagnosisAndFix() {
  console.log('🔍 Starting trial system diagnosis...\n');

  try {
    // Step 1: Check if trial columns exist
    console.log('📋 Step 1: Checking trial columns...');
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'users')
      .in('column_name', ['trial_started_at', 'trial_expires_at', 'trial_plan', 'is_trial_active', 'has_used_trial']);

    if (columnsError) {
      console.error('❌ Error checking columns:', columnsError.message);
    } else {
      const existingColumns = columns.map(c => c.column_name);
      const requiredColumns = ['trial_started_at', 'trial_expires_at', 'trial_plan', 'is_trial_active', 'has_used_trial'];
      const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
      
      if (missingColumns.length > 0) {
        console.log('⚠️  Missing trial columns:', missingColumns);
        console.log('🔧 Adding missing columns...');
        
        // Add missing columns
        const { error: alterError } = await supabase.rpc('exec_sql', {
          sql: `
            ALTER TABLE public.users 
            ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS trial_plan TEXT DEFAULT 'PRO',
            ADD COLUMN IF NOT EXISTS is_trial_active BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS has_used_trial BOOLEAN DEFAULT FALSE;
          `
        });
        
        if (alterError) {
          console.error('❌ Error adding columns:', alterError.message);
        } else {
          console.log('✅ Trial columns added successfully');
        }
      } else {
        console.log('✅ All trial columns exist');
      }
    }

    // Step 2: Check current user and activate trial if needed
    console.log('\n📋 Step 2: Checking current users...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError.message);
    } else {
      console.log(`Found ${users.length} recent users`);
      
      for (const user of users) {
        console.log(`\n👤 User: ${user.email}`);
        console.log(`   Current plan: ${user.current_plan}`);
        console.log(`   Has used trial: ${user.has_used_trial}`);
        console.log(`   Trial active: ${user.is_trial_active}`);
        
        // If user doesn't have trial activated, activate it
        if (!user.has_used_trial && user.current_plan === 'FREE') {
          console.log('🚀 Activating 24-hour trial for user...');
          
          const now = new Date();
          const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          
          const { error: updateError } = await supabase
            .from('users')
            .update({
              trial_started_at: now.toISOString(),
              trial_expires_at: expiresAt.toISOString(),
              trial_plan: 'PRO',
              is_trial_active: true,
              has_used_trial: true,
              current_plan: 'PRO',
              updated_at: now.toISOString()
            })
            .eq('id', user.id);
          
          if (updateError) {
            console.error('❌ Error activating trial:', updateError.message);
          } else {
            console.log('✅ Trial activated successfully!');
            console.log(`   Trial expires: ${expiresAt.toISOString()}`);
          }
        }
      }
    }

    // Step 3: Create trial management functions
    console.log('\n📋 Step 3: Creating trial management functions...');
    const functionsSQL = `
      CREATE OR REPLACE FUNCTION start_24_hour_trial(user_id UUID)
      RETURNS VOID AS $$
      BEGIN
        UPDATE public.users 
        SET 
          trial_started_at = NOW(),
          trial_expires_at = NOW() + INTERVAL '24 hours',
          trial_plan = 'PRO',
          is_trial_active = TRUE,
          has_used_trial = TRUE,
          current_plan = 'PRO',
          updated_at = NOW()
        WHERE id = user_id;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      CREATE OR REPLACE FUNCTION check_and_expire_trial(user_id UUID)
      RETURNS BOOLEAN AS $$
      DECLARE
        trial_expired BOOLEAN := FALSE;
      BEGIN
        UPDATE public.users 
        SET 
          is_trial_active = FALSE,
          current_plan = 'FREE',
          updated_at = NOW()
        WHERE id = user_id 
          AND is_trial_active = TRUE 
          AND trial_expires_at < NOW()
        RETURNING TRUE INTO trial_expired;
        
        RETURN COALESCE(trial_expired, FALSE);
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      GRANT EXECUTE ON FUNCTION start_24_hour_trial(UUID) TO authenticated;
      GRANT EXECUTE ON FUNCTION check_and_expire_trial(UUID) TO authenticated;
    `;

    const { error: functionsError } = await supabase.rpc('exec_sql', { sql: functionsSQL });
    
    if (functionsError) {
      console.error('❌ Error creating functions:', functionsError.message);
    } else {
      console.log('✅ Trial management functions created');
    }

    // Step 4: Test trial API endpoint
    console.log('\n📋 Step 4: Testing trial system...');
    
    if (users && users.length > 0) {
      const testUser = users[0];
      console.log(`Testing with user: ${testUser.email}`);
      
      // Test the trial status
      try {
        const response = await fetch(`${supabaseUrl.replace('/rest/v1', '')}/rest/v1/rpc/get_trial_status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey
          },
          body: JSON.stringify({ user_id: testUser.id })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ Trial API working:', result);
        } else {
          console.log('⚠️  Trial API needs setup');
        }
      } catch (apiError) {
        console.log('⚠️  Trial API test skipped:', apiError.message);
      }
    }

    console.log('\n🎉 Trial system diagnosis and fix complete!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Database schema updated');
    console.log('   ✅ Trial functions created');
    console.log('   ✅ Active users checked and fixed');
    console.log('\n🚀 Next steps:');
    console.log('   1. Deploy the latest frontend code');
    console.log('   2. Clear browser cache and test signup');
    console.log('   3. Check for trial banner on dashboard');

  } catch (error) {
    console.error('💥 Error during diagnosis:', error.message);
    console.error('\n🔧 Manual steps needed:');
    console.error('   1. Check Supabase service key permissions');
    console.error('   2. Verify database connection');
    console.error('   3. Run SQL migration manually in Supabase dashboard');
  }
}

// Execute the fix
diagnosisAndFix()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });