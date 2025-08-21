import { createAdminClient } from '../lib/supabase-client';

const supabase = createAdminClient();

async function seedActivities() {
  console.log('🌱 Seeding activities to Supabase...');

  try {
    // Sample activities data
    const activities = [
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
      },
      {
        name: 'Dance Party',
        description: 'High-energy dance party with music and games',
        full_description: 'A fun-filled dance party with popular kids music, dance games, and prizes for the best dancers.',
        supplies_needed: ['Music player', 'Speakers', 'Prizes'],
        setup_time: 10,
        helpers_required: 1,
        step_by_step_instructions: '1. Set up music and speakers\n2. Play popular kids songs\n3. Organize dance games and contests\n4. Award prizes to winners',
        host_script: 'Get ready to dance! Show us your best moves and have a blast!',
        age_group: ['3-12'],
        venue_type: ['INDOOR', 'OUTDOOR'],
        duration: 'DURATION_30',
        duration_minutes: 30,
        theme_compatibility: ['Music', 'Dance', 'Celebration'],
        effort_level: 'LOW',
        participant_range: '5-25',
        min_participants: 5,
        max_participants: 25,
        category: 'Entertainment',
        tags: ['dance', 'music', 'energy']
      }
    ];

    for (const activity of activities) {
      const { error } = await supabase
        .from('activities')
        .insert(activity);
      
      if (error) {
        console.log(`⚠️  Activity "${activity.name}" insertion had issues:`, error.message);
      } else {
        console.log(`✅ Activity "${activity.name}" inserted`);
      }
    }

    console.log('🎯 Activities seeding completed!');

  } catch (error) {
    console.error('❌ Activities seeding failed:', error);
  }
}

// Run the seeding
seedActivities()
  .then(() => {
    console.log('✨ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seeding failed:', error);
    process.exit(1);
  });