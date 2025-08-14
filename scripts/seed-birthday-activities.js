const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function seedBirthdayActivities() {
  try {
    console.log('Starting birthday activities seeding...');
    
    // Read the activities data
    const dataPath = path.join(__dirname, '..', 'data', 'birthday_activities_db.json');
    const activitiesData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    console.log(`Found ${activitiesData.length} activities to seed`);
    
    // Clear existing data
    await prisma.birthdayActivity.deleteMany({});
    console.log('Cleared existing birthday activities');
    
    // Seed new data
    for (const activity of activitiesData) {
      await prisma.birthdayActivity.create({
        data: {
          name: activity.name,
          description: activity.description,
          fullDescription: activity.fullDescription,
          suppliesNeeded: activity.suppliesNeeded,
          setupTime: activity.setupTime,
          helpersRequired: activity.helpersRequired,
          stepByStepInstructions: activity.stepByStepInstructions,
          hostScript: activity.hostScript,
          ageGroup: activity.ageGroup,
          venueType: activity.venueType,
          duration: activity.duration,
          durationMinutes: activity.durationMinutes,
          themeCompatibility: activity.themeCompatibility,
          effortLevel: activity.effortLevel,
          participantRange: activity.participantRange,
          minParticipants: activity.minParticipants,
          maxParticipants: activity.maxParticipants,
          category: activity.category,
          tags: activity.tags,
          isActive: true
        }
      });
    }
    
    console.log(`Successfully seeded ${activitiesData.length} birthday activities!`);
    
    // Verify seeding
    const count = await prisma.birthdayActivity.count();
    console.log(`Total activities in database: ${count}`);
    
  } catch (error) {
    console.error('Error seeding birthday activities:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeder
if (require.main === module) {
  seedBirthdayActivities()
    .then(() => {
      console.log('Birthday activities seeding completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Birthday activities seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedBirthdayActivities };