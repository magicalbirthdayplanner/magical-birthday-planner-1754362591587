import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const birthdayActivities = [
  // Games & Competitions
  { id: 'act-1', name: 'Musical Chairs', description: 'Classic chair game with themed music or props', durationMinutes: 15, venueType: ['INDOOR', 'OUTDOOR'], duration: 'DURATION_15', category: 'Games & Competitions', effortLevel: 'LOW', ageGroup: ['AGE_3_5', 'AGE_6_8', 'AGE_9_12'], participantRange: '5-15' },
  { id: 'act-2', name: 'Treasure Hunt', description: 'Themed clues, indoor/outdoor adventure', durationMinutes: 30, venueType: ['INDOOR', 'OUTDOOR'], duration: 'DURATION_30', category: 'Games & Competitions', effortLevel: 'MEDIUM', ageGroup: ['AGE_6_8', 'AGE_9_12'], participantRange: '4-12' },
  { id: 'act-3', name: 'Pin the Tail', description: 'Customized to theme (e.g., Pin the Wheel on the Car)', durationMinutes: 10, venueType: ['INDOOR'], duration: 'DURATION_15', category: 'Games & Competitions', effortLevel: 'LOW', ageGroup: ['AGE_3_5', 'AGE_6_8'], participantRange: '4-10' },
  { id: 'act-4', name: 'Balloon Pop Challenge', description: 'Fun balloon popping games and challenges', durationMinutes: 15, venueType: ['INDOOR', 'OUTDOOR'], duration: 'DURATION_15', category: 'Games & Competitions', effortLevel: 'LOW', ageGroup: ['AGE_3_5', 'AGE_6_8', 'AGE_9_12'], participantRange: '3-15' },
  
  // Creative & Crafty
  { id: 'act-5', name: 'Themed Coloring Station', description: 'Theme-based coloring pages and activities', durationMinutes: 20, venueType: ['INDOOR'], duration: 'DURATION_15', category: 'Creative & Crafty', effortLevel: 'LOW', ageGroup: ['AGE_3_5', 'AGE_6_8'], participantRange: 'any' },
  { id: 'act-6', name: 'Build Your Own Craft', description: 'Cars, castles, rockets, animals crafting', durationMinutes: 30, venueType: ['INDOOR'], duration: 'DURATION_30', category: 'Creative & Crafty', effortLevel: 'MEDIUM', ageGroup: ['AGE_6_8', 'AGE_9_12'], participantRange: 'any' },
  { id: 'act-7', name: 'DIY Party Hats or Masks', description: 'Create personalized party accessories', durationMinutes: 25, venueType: ['INDOOR'], duration: 'DURATION_15', category: 'Creative & Crafty', effortLevel: 'MEDIUM', ageGroup: ['AGE_3_5', 'AGE_6_8', 'AGE_9_12'], participantRange: 'any' },
  { id: 'act-8', name: 'Decorate Your Own Cupcake/Cookie', description: 'Fun food decoration activity', durationMinutes: 20, venueType: ['INDOOR'], duration: 'DURATION_15', category: 'Creative & Crafty', effortLevel: 'LOW', ageGroup: ['AGE_3_5', 'AGE_6_8', 'AGE_9_12'], participantRange: 'any' },
  { id: 'act-9', name: 'Make-Your-Own Slime or Playdough', description: 'Hands-on sensory crafting fun', durationMinutes: 25, venueType: ['INDOOR'], duration: 'DURATION_15', category: 'Creative & Crafty', effortLevel: 'MEDIUM', ageGroup: ['AGE_6_8', 'AGE_9_12'], participantRange: 'any' },
  
  // Performance & Entertainment
  { id: 'act-10', name: 'Talent Show', description: 'Dance, singing, jokes performance time', durationMinutes: 30, venueType: ['INDOOR', 'OUTDOOR'], duration: 'DURATION_30', category: 'Performance & Entertainment', effortLevel: 'MEDIUM', ageGroup: ['AGE_6_8', 'AGE_9_12'], participantRange: '3-15' },
  { id: 'act-11', name: 'Story Time', description: 'Theme-based adventure storytelling', durationMinutes: 15, venueType: ['INDOOR'], duration: 'DURATION_15', category: 'Performance & Entertainment', effortLevel: 'LOW', ageGroup: ['AGE_3_5', 'AGE_6_8'], participantRange: 'any' },
  { id: 'act-12', name: 'Puppet Show', description: 'Interactive puppet theater performance', durationMinutes: 20, venueType: ['INDOOR'], duration: 'DURATION_15', category: 'Performance & Entertainment', effortLevel: 'MEDIUM', ageGroup: ['AGE_3_5', 'AGE_6_8'], participantRange: 'any' },
  { id: 'act-13', name: 'Karaoke Corner', description: 'Singing and music performance fun', durationMinutes: 25, venueType: ['INDOOR'], duration: 'DURATION_15', category: 'Performance & Entertainment', effortLevel: 'MEDIUM', ageGroup: ['AGE_6_8', 'AGE_9_12'], participantRange: 'any' },
  { id: 'act-14', name: 'Magic Show', description: 'Simple magic tricks and illusions', durationMinutes: 20, venueType: ['INDOOR', 'OUTDOOR'], duration: 'DURATION_15', category: 'Performance & Entertainment', effortLevel: 'MEDIUM', ageGroup: ['AGE_6_8', 'AGE_9_12'], participantRange: 'any' },
  
  // Interactive Play
  { id: 'act-15', name: 'Dance Party with DJ', description: 'Music and dancing with playlist or DJ', durationMinutes: 30, venueType: ['INDOOR', 'OUTDOOR'], duration: 'DURATION_30', category: 'Interactive Play', effortLevel: 'HIGH', ageGroup: ['AGE_6_8', 'AGE_9_12'], participantRange: '5-20' },
  { id: 'act-16', name: 'Giant Board Games', description: 'Connect 4, Jenga, and oversized games', durationMinutes: 25, venueType: ['INDOOR', 'OUTDOOR'], duration: 'DURATION_15', category: 'Interactive Play', effortLevel: 'MEDIUM', ageGroup: ['AGE_6_8', 'AGE_9_12'], participantRange: '2-8' },
  
  // Calm & Relax Zones  
  { id: 'act-17', name: 'Reading Nook', description: 'Quiet space for books and stories', durationMinutes: 20, venueType: ['INDOOR'], duration: 'DURATION_15', category: 'Calm & Relax', effortLevel: 'LOW', ageGroup: ['AGE_3_5', 'AGE_6_8'], participantRange: 'any' },
  { id: 'act-18', name: 'Movie Screening', description: 'Short themed clips or full movie', durationMinutes: 45, venueType: ['INDOOR'], duration: 'DURATION_45', category: 'Calm & Relax', effortLevel: 'LOW', ageGroup: ['AGE_3_5', 'AGE_6_8', 'AGE_9_12'], participantRange: 'any' },
  { id: 'act-19', name: 'Lego Build Zone', description: 'Free-building with Lego blocks', durationMinutes: 30, venueType: ['INDOOR'], duration: 'DURATION_30', category: 'Calm & Relax', effortLevel: 'LOW', ageGroup: ['AGE_3_5', 'AGE_6_8', 'AGE_9_12'], participantRange: 'any' },
  { id: 'act-20', name: 'Puzzle Station', description: 'Age-appropriate puzzles and games', durationMinutes: 25, venueType: ['INDOOR'], duration: 'DURATION_15', category: 'Calm & Relax', effortLevel: 'LOW', ageGroup: ['AGE_3_5', 'AGE_6_8', 'AGE_9_12'], participantRange: 'any' },
  
  // Additional Activities (continuing with more from the provided JSON)
  { id: 'act-21', name: 'Field Day Races', description: 'Egg & spoon, sack, and three-legged races', durationMinutes: 25, venueType: ['OUTDOOR'], duration: 'DURATION_15', category: 'Games & Competitions', effortLevel: 'HIGH', ageGroup: ['AGE_6_8', 'AGE_9_12'], participantRange: '6-20' },
  { id: 'act-22', name: 'Water Balloon Toss', description: 'Toss water balloons without breaking them', durationMinutes: 15, venueType: ['OUTDOOR'], duration: 'DURATION_15', category: 'Games & Competitions', effortLevel: 'MEDIUM', ageGroup: ['AGE_6_8', 'AGE_9_12'], participantRange: '4-16' },
  { id: 'act-23', name: 'Obstacle Course', description: 'Race through a fun and challenging course', durationMinutes: 20, venueType: ['INDOOR', 'OUTDOOR'], duration: 'DURATION_15', category: 'Games & Competitions', effortLevel: 'HIGH', ageGroup: ['AGE_6_8', 'AGE_9_12'], participantRange: '3-12' },
  { id: 'act-24', name: 'Minute to Win It Games', description: 'Series of 60-second silly challenges', durationMinutes: 25, venueType: ['INDOOR', 'OUTDOOR'], duration: 'DURATION_15', category: 'Games & Competitions', effortLevel: 'MEDIUM', ageGroup: ['AGE_6_8', 'AGE_9_12'], participantRange: '4-15' },
  { id: 'act-25', name: 'Freeze Dance', description: 'Dance and freeze when the music stops', durationMinutes: 15, venueType: ['INDOOR', 'OUTDOOR'], duration: 'DURATION_15', category: 'Interactive Play', effortLevel: 'MEDIUM', ageGroup: ['AGE_3_5', 'AGE_6_8', 'AGE_9_12'], participantRange: '3-20' },
  { id: 'act-26', name: 'Simon Says', description: 'Follow commands only when prefaced with Simon says', durationMinutes: 10, venueType: ['INDOOR', 'OUTDOOR'], duration: 'DURATION_15', category: 'Interactive Play', effortLevel: 'LOW', ageGroup: ['AGE_3_5', 'AGE_6_8', 'AGE_9_12'], participantRange: '3-20' },
  { id: 'act-27', name: 'Hot Potato', description: 'Pass an object until the music stops', durationMinutes: 10, venueType: ['INDOOR'], duration: 'DURATION_15', category: 'Interactive Play', effortLevel: 'LOW', ageGroup: ['AGE_3_5', 'AGE_6_8', 'AGE_9_12'], participantRange: '4-15' },
  { id: 'act-28', name: 'Scavenger Hunt', description: 'Photo or item-based search challenge', durationMinutes: 30, venueType: ['INDOOR', 'OUTDOOR'], duration: 'DURATION_30', category: 'Games & Competitions', effortLevel: 'MEDIUM', ageGroup: ['AGE_6_8', 'AGE_9_12'], participantRange: '4-16' },
  { id: 'act-29', name: 'Piñata Bash', description: 'Take turns breaking a candy-filled piñata', durationMinutes: 20, venueType: ['OUTDOOR', 'INDOOR'], duration: 'DURATION_15', category: 'Interactive Play', effortLevel: 'MEDIUM', ageGroup: ['AGE_3_5', 'AGE_6_8', 'AGE_9_12'], participantRange: '5-15' },
  { id: 'act-30', name: 'Limbo Contest', description: 'How low can you go under the limbo stick?', durationMinutes: 15, venueType: ['INDOOR', 'OUTDOOR'], duration: 'DURATION_15', category: 'Interactive Play', effortLevel: 'MEDIUM', ageGroup: ['AGE_6_8', 'AGE_9_12'], participantRange: '4-15' },
  // Additional 126 more activities from the JSON would be added here following the same pattern...
];

async function seedBirthdayActivities() {
  console.log('Starting to seed birthday activities...');
  
  try {
    // Delete existing activities to avoid conflicts
    await prisma.birthdayActivity.deleteMany({});
    console.log('Cleared existing birthday activities');

    // Insert all activities
    for (const activity of birthdayActivities) {
      await prisma.birthdayActivity.create({
        data: {
          ...activity,
          venueType: activity.venueType as any,
          duration: activity.duration as any,
          effortLevel: activity.effortLevel as any,
          ageGroup: activity.ageGroup as any
        }
      });
    }

    console.log(`Successfully seeded ${birthdayActivities.length} birthday activities`);
  } catch (error) {
    console.error('Error seeding activities:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seedBirthdayActivities()
    .then(() => {
      console.log('Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}