const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Load environment variables
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearAndSeedActivities() {
  try {
    console.log('🗑️  Clearing existing activities...');
    
    // Delete all existing activities
    const { error: deleteError } = await supabase
      .from('activities')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
    
    if (deleteError) {
      console.error('Error clearing activities:', deleteError);
      return;
    }
    
    console.log('✅ Activities cleared successfully');
    
    // Load activities from JSON file
    const activitiesPath = path.join(__dirname, '..', 'data', 'birthday_activities_db.json');
    const activitiesData = JSON.parse(fs.readFileSync(activitiesPath, 'utf8'));
    
    console.log(`📚 Loading ${activitiesData.length} activities from JSON...`);
    
    // Transform activities to match database schema
    const transformedActivities = activitiesData.map(activity => ({
      id: uuidv4(), // Generate UUID for each activity
      name: activity.name,
      description: activity.description,
      category: activity.category,
      age_group: activity.ageGroup || ['AGE_3_5', 'AGE_6_8', 'AGE_9_12'],
      duration: activity.duration,
      supplies_needed: activity.suppliesNeeded || ['Basic supplies'],
      setup_time: activity.setupTime || 15,
      helpers_required: activity.helpersRequired || 0,
      step_by_step_instructions: activity.stepByStepInstructions || activity.description,
      host_script: activity.hostScript || '',
      venue_type: activity.venueType || ['INDOOR'],
      duration_minutes: activity.durationMinutes || (activity.duration === 'DURATION_15' ? 15 : activity.duration === 'DURATION_30' ? 30 : activity.duration === 'DURATION_60' ? 60 : 30),
      theme_compatibility: activity.themeCompatibility || ['General'],
      effort_level: activity.effortLevel || 'MEDIUM',
      participant_range: activity.participantRange || '2-10',
      min_participants: activity.minParticipants || 2,
      max_participants: activity.maxParticipants || 10,
      tags: [],
      full_description: activity.fullDescription || activity.description,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    
    console.log('🔄 Inserting activities into database...');
    
    // Insert activities in batches
    const batchSize = 10;
    for (let i = 0; i < transformedActivities.length; i += batchSize) {
      const batch = transformedActivities.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('activities')
        .insert(batch);
      
      if (insertError) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError);
        return;
      }
      
      console.log(`✅ Inserted batch ${i / batchSize + 1}/${Math.ceil(transformedActivities.length / batchSize)}`);
    }
    
    console.log('🎉 All activities seeded successfully!');
    
    // Verify the count
    const { count, error: countError } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Error counting activities:', countError);
    } else {
      console.log(`📊 Total activities in database: ${count}`);
    }
    
  } catch (error) {
    console.error('Error in clearAndSeedActivities:', error);
  }
}

clearAndSeedActivities();
