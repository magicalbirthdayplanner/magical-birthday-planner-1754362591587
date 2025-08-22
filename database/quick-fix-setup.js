const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  try {
    console.log('🔧 Setting up database...');
    
    // Apply the users table fix directly
    console.log('📝 Applying users table fix...');
    
    // Add missing columns to users table
    const { error: error1 } = await supabase.rpc('exec_sql', { 
      sql: `
        ALTER TABLE public.users 
        ADD COLUMN IF NOT EXISTS name TEXT,
        ADD COLUMN IF NOT EXISTS "displayName" TEXT,
        ADD COLUMN IF NOT EXISTS "emailNotifications" BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS "partyReminders" BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS "marketingEmails" BOOLEAN DEFAULT false;
      `
    });
    
    if (error1) {
      console.error('Error adding columns:', error1);
    } else {
      console.log('✅ Added missing columns');
    }
    
    // Migrate data
    const { error: error2 } = await supabase.rpc('exec_sql', { 
      sql: `
        UPDATE public.users 
        SET name = full_name 
        WHERE full_name IS NOT NULL AND name IS NULL;
      `
    });
    
    if (error2) {
      console.error('Error migrating data:', error2);
    } else {
      console.log('✅ Migrated data from full_name to name');
    }
    
    // Create indexes
    const { error: error3 } = await supabase.rpc('exec_sql', { 
      sql: `
        CREATE INDEX IF NOT EXISTS idx_users_name ON public.users(name);
        CREATE INDEX IF NOT EXISTS idx_users_display_name ON public.users("displayName");
      `
    });
    
    if (error3) {
      console.error('Error creating indexes:', error3);
    } else {
      console.log('✅ Created indexes');
    }
    
    console.log('🎉 Database fix complete!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

setupDatabase();