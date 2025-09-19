#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function fixUserPlans() {
  console.log('🔧 Fixing user plans to match intended subscription levels...\n');

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
    // Update the Plus user to use PLUS plan
    console.log('Updating Plus user to PLUS plan...');
    const { error: plusError } = await supabase
      .from('users')
      .update({ current_plan: 'PLUS' })
      .eq('email', 'plususer.test.1757381672912@gmail.com');

    if (plusError) {
      console.log(`  ❌ Error updating Plus user: ${plusError.message}`);
    } else {
      console.log('  ✅ Plus user updated to PLUS plan');
    }

    // Update the Pro user to use PRO plan (instead of PROFESSIONAL)
    console.log('Updating Pro user to PRO plan...');
    const { error: proError } = await supabase
      .from('users')
      .update({ current_plan: 'PRO' })
      .eq('email', 'prouser.test.1757381672912@gmail.com');

    if (proError) {
      console.log(`  ❌ Error updating Pro user: ${proError.message}`);
    } else {
      console.log('  ✅ Pro user updated to PRO plan');
    }

    console.log('\n✅ User plans updated successfully!');
    console.log('You can now test all subscription plan features with the correct plan assignments.');

  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
fixUserPlans();