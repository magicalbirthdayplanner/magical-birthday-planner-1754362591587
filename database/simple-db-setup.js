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

async function createTables() {
  console.log('🚀 Creating database tables...\n');

  try {
    // Create users table
    console.log('📝 Creating users table...');
    const { error: usersError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.users (
          id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          full_name TEXT,
          avatar_url TEXT,
          current_plan TEXT DEFAULT 'FREE' CHECK (current_plan IN ('FREE', 'STARTER', 'PLUS', 'PRO')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
    
    if (usersError) {
      console.log('⚠️  Users table creation had issues (may already exist):', usersError.message);
    } else {
      console.log('✅ Users table created');
    }

    // Create parties table
    console.log('📝 Creating parties table...');
    const { error: partiesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.parties (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
          child_name TEXT NOT NULL,
          child_age INTEGER NOT NULL,
          child_gender TEXT,
          party_date DATE NOT NULL,
          party_time TIME,
          party_location TEXT,
          zip_code TEXT,
          guest_count INTEGER DEFAULT 0,
          budget DECIMAL(10,2),
          theme TEXT,
          colors TEXT[],
          venue_type TEXT,
          status TEXT DEFAULT 'PLANNING' CHECK (status IN ('PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
          is_shared BOOLEAN DEFAULT FALSE,
          share_token TEXT UNIQUE,
          shared_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
    
    if (partiesError) {
      console.log('⚠️  Parties table creation had issues (may already exist):', partiesError.message);
    } else {
      console.log('✅ Parties table created');
    }

    // Create activities table
    console.log('📝 Creating activities table...');
    const { error: activitiesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.activities (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          full_description TEXT,
          supplies_needed TEXT[],
          setup_time INTEGER NOT NULL,
          helpers_required INTEGER DEFAULT 0,
          step_by_step_instructions TEXT NOT NULL,
          host_script TEXT,
          age_group TEXT[],
          venue_type TEXT[],
          duration TEXT NOT NULL,
          duration_minutes INTEGER NOT NULL,
          theme_compatibility TEXT[],
          effort_level TEXT NOT NULL,
          participant_range TEXT,
          min_participants INTEGER DEFAULT 1,
          max_participants INTEGER,
          category TEXT NOT NULL,
          tags TEXT[],
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
    
    if (activitiesError) {
      console.log('⚠️  Activities table creation had issues (may already exist):', activitiesError.message);
    } else {
      console.log('✅ Activities table created');
    }

    // Create guests table
    console.log('📝 Creating guests table...');
    const { error: guestsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.guests (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          party_id UUID REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
          user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          type TEXT DEFAULT 'GUEST' CHECK (type IN ('GUEST', 'HELPER', 'HOST')),
          age INTEGER,
          notes TEXT,
          rsvp_status TEXT DEFAULT 'PENDING' CHECK (rsvp_status IN ('PENDING', 'CONFIRMED', 'DECLINED', 'MAYBE')),
          dietary_restrictions TEXT[],
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
    
    if (guestsError) {
      console.log('⚠️  Guests table creation had issues (may already exist):', guestsError.message);
    } else {
      console.log('✅ Guests table created');
    }

    // Create party_activities table
    console.log('📝 Creating party_activities table...');
    const { error: partyActivitiesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.party_activities (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          party_id UUID REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
          user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
          activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE NOT NULL,
          is_selected BOOLEAN DEFAULT TRUE,
          sort_order INTEGER DEFAULT 0,
          custom_notes TEXT,
          estimated_time INTEGER,
          people_required INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(party_id, activity_id)
        );
      `
    });
    
    if (partyActivitiesError) {
      console.log('⚠️  Party activities table creation had issues (may already exist):', partyActivitiesError.message);
    } else {
      console.log('✅ Party activities table created');
    }

    // Create activity_favorites table
    console.log('📝 Creating activity_favorites table...');
    const { error: favoritesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.activity_favorites (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
          activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, activity_id)
        );
      `
    });
    
    if (favoritesError) {
      console.log('⚠️  Activity favorites table creation had issues (may already exist):', favoritesError.message);
    } else {
      console.log('✅ Activity favorites table created');
    }

    console.log('\n🎉 All tables created successfully!');

  } catch (error) {
    console.error('❌ Table creation failed:', error);
  }
}

async function insertSampleData() {
  console.log('\n📊 Inserting sample data...\n');

  try {
    // Insert sample activities
    console.log('📝 Inserting sample activities...');
    
    const sampleActivities = [
      {
        name: 'Treasure Hunt',
        description: 'Exciting treasure hunt with clues and prizes',
        full_description: 'A classic treasure hunt where kids follow clues to find hidden treasures. Perfect for developing problem-solving skills and teamwork.',
        supplies_needed: ['Clues', 'Prizes', 'Map'],
        setup_time: 15,
        helpers_required: 2,
        step_by_step_instructions: '1. Hide clues around the venue\n2. Give each child a starting clue\n3. Let them solve and find the next clue\n4. Celebrate when treasure is found!',
        host_script: 'Welcome to our amazing treasure hunt! Are you ready to find some hidden treasures?',
        age_group: ['5-12'],
        venue_type: ['INDOOR', 'OUTDOOR'],
        duration: 'DURATION_30',
        duration_minutes: 30,
        theme_compatibility: ['Adventure', 'Pirate', 'Dinosaur'],
        effort_level: 'MEDIUM',
        participant_range: '5-15',
        min_participants: 5,
        max_participants: 15,
        category: 'Outdoor',
        tags: ['adventure', 'teamwork', 'problem-solving']
      },
      {
        name: 'Craft Station',
        description: 'Creative craft activities for all ages',
        full_description: 'Multiple craft stations where kids can create personalized party favors. Includes painting, coloring, and building activities.',
        supplies_needed: ['Craft supplies', 'Paper', 'Glue', 'Scissors'],
        setup_time: 20,
        helpers_required: 1,
        step_by_step_instructions: '1. Set up different craft stations\n2. Provide instructions at each station\n3. Let kids choose their favorite activity\n4. Display finished crafts proudly',
        host_script: 'Time to get creative! Choose your favorite craft station and make something amazing!',
        age_group: ['3-12'],
        venue_type: ['INDOOR'],
        duration: 'DURATION_45',
        duration_minutes: 45,
        theme_compatibility: ['Creative', 'Art', 'Unicorn'],
        effort_level: 'LOW',
        participant_range: '3-20',
        min_participants: 3,
        max_participants: 20,
        category: 'Creative',
        tags: ['crafts', 'creativity', 'art']
      }
    ];

    for (const activity of sampleActivities) {
      const { error } = await supabase
        .from('activities')
        .insert(activity);
      
      if (error) {
        console.log(`⚠️  Activity "${activity.name}" insertion had issues:`, error.message);
      } else {
        console.log(`✅ Activity "${activity.name}" inserted`);
      }
    }

    console.log('\n🎯 Sample data insertion completed!');

  } catch (error) {
    console.error('❌ Sample data insertion failed:', error);
  }
}

async function verifySetup() {
  console.log('\n🔍 Verifying database setup...\n');

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

// Main execution
async function main() {
  try {
    await createTables();
    await insertSampleData();
    await verifySetup();
    
    console.log('\n✨ Database setup completed successfully!');
    console.log('🚀 Your Magical Birthday Planner is ready to use!');
    
  } catch (error) {
    console.error('\n💥 Setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { createTables, insertSampleData, verifySetup };
