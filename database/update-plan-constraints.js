#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function updatePlanConstraints() {
  console.log('🔧 Updating database plan constraints...\n');

  // Validate environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase environment variables');
    console.error('   Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file');
    process.exit(1);
  }

  // Create Supabase client with service role key (admin privileges)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  console.log('✅ Connected to Supabase\n');

  try {
    // First, let's check what the current constraint allows by querying the database
    console.log('🔍 Checking current constraint...');
    
    // We'll need to do this through a different approach since we can't use exec_sql
    // Let's try to update one user to each plan to see what works
    
    const testPlans = ['FREE', 'STARTER', 'PLUS', 'PRO', 'PROFESSIONAL'];
    const workingPlans = [];
    
    // Get a test user to work with
    const { data: testUser, error: fetchError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', 'freeuser.test.1757381672912@gmail.com')
      .single();
    
    if (fetchError) {
      console.log('⚠️  Could not find test user, will create one');
    } else {
      console.log('✅ Found test user, testing plan constraints...');
      
      for (const plan of testPlans) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ current_plan: plan })
          .eq('id', testUser.id);
        
        if (updateError) {
          console.log(`  ❌ Plan '${plan}' not allowed: ${updateError.message}`);
        } else {
          console.log(`  ✅ Plan '${plan}' is allowed`);
          workingPlans.push(plan);
        }
      }
    }
    
    console.log(`\n📋 Currently allowed plans: ${workingPlans.join(', ')}`);
    
    // For now, let's just document what we found
    console.log('\n📝 Note: To update the constraint, you would need to run SQL directly in the Supabase dashboard:');
    console.log('   ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_current_plan_check;');
    console.log('   ALTER TABLE public.users ADD CONSTRAINT users_current_plan_check');
    console.log('   CHECK (current_plan IN (\'FREE\', \'STARTER\', \'PLUS\', \'PRO\', \'PROFESSIONAL\'));');
    
    console.log('\n✅ Database constraint check completed!');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
updatePlanConstraints();