const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testActivitiesFlow() {
  console.log('=== Testing Activities Debug ===\n');

  try {
    // 1. Check existing parties
    console.log('1. Checking existing parties...');
    const parties = await prisma.party.findMany({
      select: {
        id: true,
        childName: true,
        theme: true,
        childAge: true,
        guestCount: true,
        userId: true
      }
    });
    console.log(`Found ${parties.length} parties:`, parties);

    if (parties.length === 0) {
      console.log('❌ No parties found - this explains the error!');
      return;
    }

    const partyId = parties[0].id;
    console.log(`\n2. Testing with party ID: ${partyId}`);

    // 2. Check if party exists (simulating API call)
    console.log('2a. Checking party existence...');
    const party = await prisma.party.findUnique({
      where: { id: partyId }
    });
    
    if (!party) {
      console.log('❌ Party not found!');
      return;
    }
    console.log('✅ Party exists:', party.childName);

    // 3. Check for PartyVibeConfig
    console.log('3. Checking for PartyVibeConfig...');
    const vibeConfig = await prisma.partyVibeConfig.findUnique({
      where: { partyId: partyId },
      include: {
        activityPlans: {
          orderBy: { sequence: 'asc' }
        }
      }
    });

    if (!vibeConfig) {
      console.log('⚠️  No PartyVibeConfig found (this is normal for new parties)');
      console.log('API would return: {"vibeConfig": null}');
    } else {
      console.log('✅ PartyVibeConfig exists with', vibeConfig.activityPlans?.length || 0, 'activity plans');
    }

    // 4. Check if PartyVibeConfig and ActivityPlan tables exist
    console.log('\n4. Checking database schema...');
    const tableCheck = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('party_vibe_configs', 'activity_plans', 'parties')
    `;
    
    console.log('Database tables found:', tableCheck);
    
    const requiredTables = ['parties', 'party_vibe_configs', 'activity_plans'];
    const existingTables = tableCheck.map(t => t.table_name);
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    
    if (missingTables.length > 0) {
      console.log('❌ Missing required tables:', missingTables);
      console.log('This could be the cause of the "Something went wrong" error!');
    } else {
      console.log('✅ All required tables exist');
    }

    console.log('\n=== Debug Summary ===');
    console.log(`✅ Database connection: OK`);
    console.log(`✅ Parties exist: ${parties.length} found`);
    console.log(`✅ Schema complete: ${missingTables.length === 0 ? 'YES' : 'NO'}`);
    console.log(`⚠️  Activity config exists: ${vibeConfig ? 'YES' : 'NO (normal for new parties)'}`);

  } catch (error) {
    console.error('❌ Error during test:', error.message);
    console.error('This error could be causing the "Something went wrong" page!');
    
    if (error.code === 'P2021') {
      console.error('💡 This suggests missing database tables - run `npx prisma db push`');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testActivitiesFlow();