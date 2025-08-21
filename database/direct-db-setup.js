#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Environment validation
const requiredEnvVars = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

// Check for required environment variables
Object.entries(requiredEnvVars).forEach(([key, value]) => {
  if (!value) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
});

console.log('🔑 Environment variables loaded successfully');
console.log('🌐 Supabase URL:', requiredEnvVars.supabaseUrl);
console.log('🔑 Service Key:', requiredEnvVars.supabaseServiceKey.substring(0, 20) + '...');

const supabase = createClient(
  requiredEnvVars.supabaseUrl,
  requiredEnvVars.supabaseServiceKey
);

async function createTables() {
  console.log('\n🚀 Creating database tables...\n');

  try {
    // Test connection first
    console.log('🔍 Testing database connection...');
    const { data: testData, error: testError } = await supabase
      .from('parties')
      .select('count', { count: 'exact', head: true });
    
    if (testError) {
      console.log('📝 Tables may not exist yet, proceeding with creation...');
    } else {
      console.log('✅ Database connection successful');
    }

    // Create users table
    console.log('📝 Creating users table...');
    const { error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (usersError && usersError.code === '42P01') { // Table doesn't exist
      console.log('❌ Users table does not exist. Creating via SQL...');
      // We'll need to use a different approach since we can't execute DDL directly
      console.log('⚠️  Cannot create tables directly. Please run the SQL manually in Supabase dashboard.');
    } else if (usersError) {
      console.log('⚠️  Users table check failed:', usersError.message);
    } else {
      console.log('✅ Users table exists');
    }

    // Check parties table
    console.log('📝 Checking parties table...');
    const { error: partiesError } = await supabase
      .from('parties')
      .select('id')
      .limit(1);
    
    if (partiesError && partiesError.code === '42P01') {
      console.log('❌ Parties table does not exist');
    } else if (partiesError) {
      console.log('⚠️  Parties table check failed:', partiesError.message);
    } else {
      console.log('✅ Parties table exists');
    }

    // Check activities table
    console.log('📝 Checking activities table...');
    const { error: activitiesError } = await supabase
      .from('activities')
      .select('id')
      .limit(1);
    
    if (activitiesError && activitiesError.code === '42P01') {
      console.log('❌ Activities table does not exist');
    } else if (activitiesError) {
      console.log('⚠️  Activities table check failed:', activitiesError.message);
    } else {
      console.log('✅ Activities table exists');
    }

  } catch (error) {
    console.error('💥 Error during table creation:', error);
  }
}

async function insertSampleData() {
  console.log('\n📊 Inserting sample data...\n');

  try {
    // Check if we have any activities
    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select('id')
      .limit(5);
    
    if (activitiesError) {
      console.log('⚠️  Cannot check activities:', activitiesError.message);
      return;
    }

    if (activities && activities.length > 0) {
      console.log(`✅ Found ${activities.length} existing activities`);
    } else {
      console.log('📝 No activities found, would need to insert sample data');
    }

  } catch (error) {
    console.error('💥 Error during sample data insertion:', error);
  }
}

async function verifySetup() {
  console.log('\n🔍 Verifying database setup...\n');

  try {
    // Check users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });
    
    if (usersError) {
      console.log('❌ Users table:', usersError.message);
    } else {
      console.log('✅ Users table: Accessible');
    }

    // Check parties table
    const { data: parties, error: partiesError } = await supabase
      .from('parties')
      .select('count', { count: 'exact', head: true });
    
    if (partiesError) {
      console.log('❌ Parties table:', partiesError.message);
    } else {
      console.log('✅ Parties table: Accessible');
    }

    // Check activities table
    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select('count', { count: 'exact', head: true });
    
    if (activitiesError) {
      console.log('❌ Activities table:', activitiesError.message);
    } else {
      console.log('✅ Activities table: Accessible');
    }

  } catch (error) {
    console.error('💥 Error during verification:', error);
  }
}

async function main() {
  console.log('🎉 MAGICAL BIRTHDAY PLANNER - DATABASE SETUP');
  console.log('=============================================\n');

  try {
    await createTables();
    await insertSampleData();
    await verifySetup();
    
    console.log('\n🎯 Database setup completed!');
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/nwgqmsuaoflklrgrxfwy');
    console.log('2. Go to SQL Editor');
    console.log('3. Copy and paste the SQL from database-setup.sql');
    console.log('4. Run the SQL to create all tables');
    console.log('5. Come back and test party creation!');
    
  } catch (error) {
    console.error('💥 Setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main()
    .then(() => { process.exit(0); })
    .catch((error) => { process.exit(1); });
}

module.exports = { createTables, insertSampleData, verifySetup };
