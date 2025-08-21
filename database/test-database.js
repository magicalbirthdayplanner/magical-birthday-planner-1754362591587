#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Check environment variables
console.log('🔍 Checking environment variables...');
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Found' : '❌ Missing');
console.log('Service Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Found' : '❌ Missing');

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('❌ Missing required environment variables. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDatabase() {
  console.log('\n🚀 Testing database connection...');
  
  try {
    // Test basic connection
    console.log('📝 Testing basic connection...');
    const { data, error } = await supabase.from('parties').select('count', { count: 'exact', head: true });
    
    if (error) {
      if (error.code === '42P01') {
        console.log('❌ Parties table does not exist');
        console.log('💡 You need to run the database setup SQL first');
      } else {
        console.log('❌ Database error:', error.message);
      }
    } else {
      console.log('✅ Parties table exists and is accessible');
    }
    
    // Test users table
    console.log('\n📝 Testing users table...');
    const { data: usersData, error: usersError } = await supabase.from('users').select('count', { count: 'exact', head: true });
    
    if (usersError) {
      if (usersError.code === '42P01') {
        console.log('❌ Users table does not exist');
      } else {
        console.log('❌ Users table error:', usersError.message);
      }
    } else {
      console.log('✅ Users table exists and is accessible');
    }
    
    // Test activities table
    console.log('\n📝 Testing activities table...');
    const { data: activitiesData, error: activitiesError } = await supabase.from('activities').select('count', { count: 'exact', head: true });
    
    if (activitiesError) {
      if (activitiesError.code === '42P01') {
        console.log('❌ Activities table does not exist');
      } else {
        console.log('❌ Activities table error:', activitiesError.message);
      }
    } else {
      console.log('✅ Activities table exists and is accessible');
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
  }
  
  console.log('\n📋 NEXT STEPS:');
  console.log('1. Go to your Supabase dashboard');
  console.log('2. Run the SQL script in the SQL Editor');
  console.log('3. Then test your app again');
}

testDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
