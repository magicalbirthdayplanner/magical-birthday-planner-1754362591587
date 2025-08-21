const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for admin operations

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Load activities data
const activitiesData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/birthday_activities_db.json'), 'utf8')
);

async function seedActivities() {
  console.log('🚀 Starting activities seeding...');
  console.log(`📊 Found ${activitiesData.length} activities to seed`);

  try {
    // First, let's check if activities table exists and has data
    const { data: existingActivities, error: checkError } = await supabase
      .from('activities')
      .select('id')
      .limit(1);

    if (checkError) {
      console.error('❌ Error checking activities table:', checkError);
      console.log('📝 Creating activities table...');
      
      // If table doesn't exist, we'll need to create it via Prisma
      console.log('⚠️  Please run "npx prisma db push" first to create the table structure');
      return;
    }

    if (existingActivities && existingActivities.length > 0) {
      console.log('⚠️  Activities table already has data. Skipping seeding.');
      return;
    }

    // Transform the data to match our schema
    const transformedActivities = activitiesData.map(activity => ({
      name: activity.name,
      description: activity.description,
      fullDescription: activity.fullDescription || null,
      suppliesNeeded: activity.suppliesNeeded || [],
      setupTime: activity.setupTime || 0,
      helpersRequired: activity.helpersRequired || 0,
      stepByStepInstructions: activity.stepByStepInstructions || '',
      hostScript: activity.hostScript || '',
      ageGroup: activity.ageGroup || [],
      venueType: activity.venueType || [],
      duration: activity.duration || 'DURATION_15',
      durationMinutes: activity.durationMinutes || 15,
      themeCompatibility: activity.themeCompatibility || [],
      effortLevel: activity.effortLevel || 'LOW',
      participantRange: activity.participantRange || '1-10',
      minParticipants: activity.minParticipants || 1,
      maxParticipants: activity.maxParticipants || 10,
      category: activity.category || 'General',
      tags: activity.tags || []
    }));

    console.log('📝 Inserting activities into database...');

    // Insert activities in batches to avoid overwhelming the database
    const batchSize = 50;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < transformedActivities.length; i += batchSize) {
      const batch = transformedActivities.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('activities')
        .insert(batch)
        .select();

      if (error) {
        console.error(`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
        errorCount += batch.length;
      } else {
        successCount += batch.length;
        console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} activities`);
      }

      // Add a small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n🎉 Activities seeding completed!');
    console.log(`✅ Successfully inserted: ${successCount} activities`);
    if (errorCount > 0) {
      console.log(`❌ Failed to insert: ${errorCount} activities`);
    }

  } catch (error) {
    console.error('❌ Unexpected error during seeding:', error);
  }
}

// Run the seeding
seedActivities()
  .then(() => {
    console.log('🏁 Seeding process finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seeding failed:', error);
    process.exit(1);
  });
