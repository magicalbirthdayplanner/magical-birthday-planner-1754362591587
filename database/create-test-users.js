#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: __dirname + '/../.env' });

// Use the specified email pattern
const emailBase = 'arunexprasad@gmail.com';

// Test users configuration
// Based on current database constraints: FREE, STARTER, PROFESSIONAL
// Future: PLUS and PRO will be supported after constraint update
const testUsers = [
  {
    email: `free+test@${emailBase.split('@')[1]}`,
    password: '12345678',
    name: 'Free User',
    plan: 'FREE'
  },
  {
    email: `starter+test@${emailBase.split('@')[1]}`,
    password: '12345678',
    name: 'Starter User',
    plan: 'STARTER'
  },
  {
    email: `plus+test@${emailBase.split('@')[1]}`,
    password: '12345678',
    name: 'Plus User (using STARTER plan)',
    plan: 'STARTER'  // Using STARTER until PLUS is supported
  },
  {
    email: `pro+test@${emailBase.split('@')[1]}`,
    password: '12345678',
    name: 'Pro User',
    plan: 'PROFESSIONAL'  // Using PROFESSIONAL as it's currently supported
  }
];

async function createTestUsers() {
  console.log('🧪 Creating test users with different subscription plans...\n');

  // Validate environment variables
  console.log('Environment variables check:');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET');

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

  // Track successful creations
  let successCount = 0;

  // Create each test user
  for (const [index, user] of testUsers.entries()) {
    console.log(`👤 Creating ${user.plan} user: ${user.email}...`);
    
    try {
      // 1. Create auth user
      const { data: authUser, error: signUpError } = await supabase.auth.signUp({
        email: user.email,
        password: user.password,
        options: {
          data: {
            full_name: user.name
          }
        }
      });

      if (signUpError) {
        // If user already exists, try to update instead
        if (signUpError.message.includes('already registered')) {
          console.log(`   ⚠️  User already exists, updating profile...`);
          
          // Find the existing user
          const { data: existingUsers, error: fetchError } = await supabase
            .from('users')
            .select('id')
            .eq('email', user.email)
            .single();

          if (fetchError) {
            console.error(`   ❌ Error finding existing user: ${fetchError.message}`);
            continue;
          }

          // Update user profile with plan
          const { error: updateError } = await supabase
            .from('users')
            .update({
              current_plan: user.plan,
              full_name: user.name
            })
            .eq('email', user.email);

          if (updateError) {
            console.error(`   ❌ Error updating user: ${updateError.message}`);
            continue;
          }

          console.log(`   ✅ Updated existing user with ${user.plan} plan`);
          successCount++;
        } else {
          console.error(`   ❌ Error creating user: ${signUpError.message}`);
          continue;
        }
      } else {
        console.log(`   ✅ Auth user created successfully`);

        // 2. Create/update user profile in users table
        const userId = authUser.user.id;
        
        const { error: profileError } = await supabase
          .from('users')
          .upsert({
            id: userId,
            email: user.email,
            full_name: user.name,
            current_plan: user.plan
          }, {
            onConflict: 'id'
          });

        if (profileError) {
          console.error(`   ❌ Error creating user profile: ${profileError.message}`);
          continue;
        }

        console.log(`   ✅ User profile created with ${user.plan} plan`);
        successCount++;
      }
      
      // 3. Confirm the user's email (since these are test users)
      try {
        const { error: confirmError } = await supabase.auth.admin.updateUserById(
          authUser.user.id,
          { email_confirm: true }
        );
        
        if (confirmError) {
          console.error(`   ⚠️  Warning: Could not confirm email: ${confirmError.message}`);
        } else {
          console.log(`   ✅ Email confirmed for test user`);
        }
      } catch (confirmErr) {
        console.error(`   ⚠️  Warning: Could not confirm email: ${confirmErr.message}`);
      }
    } catch (error) {
      console.error(`   ❌ Unexpected error: ${error.message}`);
      continue;
    }

    console.log(`   🎉 ${user.plan} user setup complete!\n`);
  }

  if (successCount === testUsers.length) {
    console.log('✅ All test users created successfully!');
  } else {
    console.log(`⚠️  Created ${successCount} out of ${testUsers.length} test users`);
  }

  console.log('\n📋 Test User Credentials:');
  console.log('========================');
  testUsers.forEach((user, index) => {
    const displayName = index === 2 ? 'PLUS' : (user.plan === 'PROFESSIONAL' ? 'PRO' : user.plan);
    console.log(`📧 ${user.email} | 🔑 ${user.password} | 📦 ${displayName} Plan`);
  });
  console.log('\n💡 You can now log in with these credentials to test different subscription features.');
}

// Run the script
createTestUsers().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});