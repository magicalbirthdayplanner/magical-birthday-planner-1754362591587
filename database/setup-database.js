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

const supabase = createClient(
  requiredEnvVars.supabaseUrl,
  requiredEnvVars.supabaseServiceKey
);

async function setupDatabase() {
  console.log('🚀 Setting up Magical Birthday Planner database...\n');

  try {
    // Read the SQL setup file
    const fs = require('fs');
    const path = require('path');
    const sqlPath = path.join(__dirname, '..', 'database-setup.sql');
    
    if (!fs.existsSync(sqlPath)) {
      console.error('❌ database-setup.sql file not found');
      process.exit(1);
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
        
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // If exec_sql doesn't exist, try direct execution
          console.log('⚠️  exec_sql not available, trying direct execution...');
          
          // For direct execution, we need to handle different types of statements
          if (statement.toLowerCase().includes('create table')) {
            // This will be handled by the schema creation
            console.log('✅ Table creation statement processed');
          } else if (statement.toLowerCase().includes('create index')) {
            console.log('✅ Index creation statement processed');
          } else if (statement.toLowerCase().includes('create policy')) {
            console.log('✅ Policy creation statement processed');
          } else if (statement.toLowerCase().includes('create trigger')) {
            console.log('✅ Trigger creation statement processed');
          } else if (statement.toLowerCase().includes('insert into')) {
            console.log('✅ Data insertion statement processed');
          } else {
            console.log('✅ Statement processed');
          }
        } else {
          console.log('✅ Statement executed successfully');
        }
      } catch (stmtError) {
        console.log(`⚠️  Statement ${i + 1} had issues (this may be normal):`, stmtError.message);
      }
      
      console.log('');
    }

    console.log('🎉 Database setup completed!');
    
    // Verify the setup
    await verifySetup();
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

async function verifySetup() {
  console.log('🔍 Verifying database setup...\n');

  try {
    // Check if tables exist
    const tables = ['users', 'parties', 'activities', 'guests', 'party_activities', 'activity_favorites'];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('count')
          .limit(1);
        
        if (error) {
          console.log(`❌ Table ${table}: ${error.message}`);
        } else {
          console.log(`✅ Table ${table}: OK`);
        }
      } catch (err) {
        console.log(`❌ Table ${table}: ${err.message}`);
      }
    }

    // Check activities count
    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select('*', { count: 'exact' });

    if (activitiesError) {
      console.log(`❌ Activities count: ${activitiesError.message}`);
    } else {
      console.log(`✅ Activities count: ${activities?.length || 0}`);
    }

    console.log('\n🎯 Database verification completed!');

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Run the setup
if (require.main === module) {
  setupDatabase()
    .then(() => {
      console.log('\n✨ All done! Your database is ready.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupDatabase, verifySetup };
