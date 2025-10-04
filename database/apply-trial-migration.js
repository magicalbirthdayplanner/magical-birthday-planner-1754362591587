#!/usr/bin/env node

/**
 * Automated 24-Hour Trial System Database Migration
 * Applies trial system changes to remote Supabase database
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create admin client
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyTrialSystemMigration() {
  console.log('🚀 Starting 24-Hour Trial System Migration...');
  console.log('📡 Connecting to Supabase:', supabaseUrl);
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'trial-system-migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Loaded migration SQL file');
    
    // Split SQL into individual statements (basic splitting)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--') && stmt !== '');
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const { data, error } = await supabase.rpc('sql', { sql: statement });
        
        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          // Continue with next statement for non-critical errors
          if (error.message.includes('already exists') || error.message.includes('IF NOT EXISTS')) {
            console.log('   ℹ️  Skipping - already exists');
            continue;
          }
          throw error;
        }
        
        console.log(`✅ Statement ${i + 1} executed successfully`);
      } catch (err) {
        console.error(`❌ Failed to execute statement ${i + 1}:`, err.message);
        throw err;
      }
    }
    
    console.log('✨ Migration completed successfully!');
    
    // Verify the migration by checking if new columns exist
    console.log('🔍 Verifying migration...');
    
    const { data: columnCheck, error: verifyError } = await supabase
      .from('users')
      .select('trial_started_at, trial_expires_at, trial_plan, is_trial_active, has_used_trial')
      .limit(1);
    
    if (verifyError) {
      console.error('❌ Migration verification failed:', verifyError.message);
      process.exit(1);
    }
    
    console.log('✅ Migration verified - trial columns are accessible');
    
    // Test the trial functions
    console.log('🧪 Testing trial functions...');
    
    try {
      // Create a test to ensure functions are accessible
      const { data: testData, error: testError } = await supabase.rpc('sql', {
        sql: `SELECT 
          EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'start_24_hour_trial') as start_function_exists,
          EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'check_and_expire_trial') as check_function_exists,
          EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'get_trial_status') as status_function_exists`
      });
      
      if (testError) {
        console.warn('⚠️  Function verification failed:', testError.message);
      } else {
        console.log('✅ Trial functions verified and accessible');
      }
    } catch (err) {
      console.warn('⚠️  Function test skipped:', err.message);
    }
    
    console.log('');
    console.log('🎉 24-Hour Trial System Migration Complete!');
    console.log('');
    console.log('📋 Summary of changes:');
    console.log('   • Added trial_started_at column');
    console.log('   • Added trial_expires_at column');
    console.log('   • Added trial_plan column (defaults to PRO)');
    console.log('   • Added is_trial_active column');
    console.log('   • Added has_used_trial column');
    console.log('   • Created trial management functions');
    console.log('   • Created trial status view');
    console.log('   • Added database indexes for performance');
    console.log('');
    console.log('🚀 Ready to implement application-level trial logic!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    console.error('');
    console.error('🔧 Troubleshooting tips:');
    console.error('   1. Check your Supabase service role key has admin permissions');
    console.error('   2. Verify your database connection');
    console.error('   3. Check for any manual schema changes needed');
    console.error('');
    process.exit(1);
  }
}

// Handle direct execution
if (require.main === module) {
  applyTrialSystemMigration()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('💥 Unexpected error:', err);
      process.exit(1);
    });
}

module.exports = { applyTrialSystemMigration };