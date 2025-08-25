#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function runDatabaseTest() {
console.log('🔍 MAGICAL BIRTHDAY PLANNER - DATABASE CONFIGURATION TEST\n');

// 1. Environment Variables Check
console.log('📋 1. ENVIRONMENT VARIABLES CHECK');
console.log('=====================================');

const envVars = {
  'NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL,
  'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
  'DATABASE_URL': process.env.DATABASE_URL,
  'NODE_ENV': process.env.NODE_ENV
};

let envErrors = 0;
Object.entries(envVars).forEach(([key, value]) => {
  if (value) {
    if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
      console.log(`✅ ${key}: ${value.substring(0, 10)}...${value.substring(value.length - 4)} (${value.length} chars)`);
    } else {
      console.log(`✅ ${key}: ${value}`);
    }
  } else {
    console.log(`❌ ${key}: NOT SET`);
    envErrors++;
  }
});

if (envErrors > 0) {
  console.log(`\n❌ Found ${envErrors} missing environment variables. Please check your .env file.\n`);
}

// 2. URL Validation
console.log('\n🌐 2. URL VALIDATION');
console.log('=====================');

if (envVars.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    const url = new URL(envVars.NEXT_PUBLIC_SUPABASE_URL);
    console.log(`✅ Supabase URL is valid`);
    console.log(`   - Protocol: ${url.protocol}`);
    console.log(`   - Host: ${url.host}`);
    console.log(`   - Is Supabase domain: ${url.hostname.includes('supabase.co') ? 'Yes' : 'No'}`);
  } catch (error) {
    console.log(`❌ Supabase URL is invalid: ${error.message}`);
  }
}

if (envVars.DATABASE_URL) {
  try {
    const url = new URL(envVars.DATABASE_URL);
    console.log(`✅ Database URL is valid`);
    console.log(`   - Protocol: ${url.protocol}`);
    console.log(`   - Host: ${url.host}`);
  } catch (error) {
    console.log(`❌ Database URL is invalid: ${error.message}`);
  }
}

// 3. Supabase Client Creation Test
console.log('\n🔌 3. SUPABASE CLIENT CREATION');
console.log('===============================');

let supabase = null;
try {
  if (envVars.NEXT_PUBLIC_SUPABASE_URL && envVars.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
      envVars.NEXT_PUBLIC_SUPABASE_URL,
      envVars.SUPABASE_SERVICE_ROLE_KEY
    );
    console.log('✅ Supabase client created successfully');
  } else {
    console.log('❌ Cannot create Supabase client - missing URL or key');
  }
} catch (error) {
  console.log(`❌ Failed to create Supabase client: ${error.message}`);
}

// 4. Authentication Test
console.log('\n🔐 4. AUTHENTICATION TEST');
console.log('==========================');

if (supabase) {
  try {
    // Test basic connectivity by trying to fetch user (should fail but with specific error)
    const { data, error } = await supabase.auth.getUser();
    
    if (error) {
      if (error.message.includes('Invalid API key') || error.message.includes('JWT')) {
        console.log('❌ Authentication failed - Invalid API key or JWT error');
        console.log(`   Error: ${error.message}`);
      } else {
        console.log('⚠️  Expected auth error (service key cannot get user directly)');
        console.log(`   Message: ${error.message}`);
      }
    } else {
      console.log('✅ Unexpected success in auth test');
    }
  } catch (error) {
    console.log(`❌ Authentication test error: ${error.message}`);
  }
}

// 5. Database Connection Test
console.log('\n🗄️  5. DATABASE CONNECTION TEST');
console.log('================================');

if (supabase) {
  try {
    // Try to query a system table that should always exist
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .limit(1);
    
    if (error) {
      console.log('❌ Database connection failed');
      console.log(`   Error: ${error.message}`);
      console.log(`   Code: ${error.code || 'N/A'}`);
      console.log(`   Details: ${error.details || 'N/A'}`);
    } else {
      console.log('✅ Database connection successful');
      console.log(`   Retrieved ${data?.length || 0} system tables`);
    }
  } catch (error) {
    console.log(`❌ Database connection test error: ${error.message}`);
  }
}

// 6. Table Existence Check
console.log('\n📊 6. APPLICATION TABLES CHECK');
console.log('===============================');

const expectedTables = ['users', 'parties', 'activities', 'guests', 'party_activities', 'activity_favorites'];

if (supabase) {
  for (const tableName of expectedTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        if (error.code === '42P01') {
          console.log(`❌ Table '${tableName}' does not exist`);
        } else {
          console.log(`⚠️  Table '${tableName}' exists but has issues: ${error.message}`);
        }
      } else {
        console.log(`✅ Table '${tableName}' exists and is accessible`);
      }
    } catch (error) {
      console.log(`❌ Error checking table '${tableName}': ${error.message}`);
    }
  }
}

// 7. Summary and Recommendations
console.log('\n📋 7. SUMMARY AND RECOMMENDATIONS');
console.log('==================================');

if (envErrors > 0) {
  console.log('❌ CRITICAL: Missing environment variables');
  console.log('   → Check your .env file and ensure all required variables are set');
}

console.log('\n🔧 NEXT STEPS:');
console.log('1. If you see "Invalid API key" errors:');
console.log('   → Verify your Supabase project is active');
console.log('   → Check that the service role key is correct');
console.log('   → Ensure the project URL matches your actual Supabase project');

console.log('\n2. If tables don\'t exist:');
console.log('   → Run the database setup in Supabase dashboard');
console.log('   → Copy the SQL from database/database-simple.sql');
console.log('   → Execute it in the Supabase SQL Editor');

console.log('\n3. If everything looks good:');
console.log('   → Your database is properly configured!');
console.log('   → You can start the application with: npm run dev');

console.log('\n📞 For further help:');
console.log('   → Check the README.md file');
console.log('   → Review the database/README.md file');
console.log('   → Ensure Supabase project is not paused or suspended');
}

// Run the test
runDatabaseTest().catch(console.error);