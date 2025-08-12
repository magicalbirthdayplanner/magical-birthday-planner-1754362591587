import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ActivityGenerationRequest {
  theme: string;
  ageGroup: string;
  numberOfKids: number;
  totalDuration: string;
  setting: string;
  budgetLevel: string;
  specialRequests?: string[];
  customText?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { partyId: string } }
) {
  try {
    const { partyId } = params;

    // Validate partyId parameter
    if (!partyId || typeof partyId !== 'string' || partyId.trim() === '') {
      console.warn('Invalid partyId provided in generate:', partyId);
      return NextResponse.json(
        { 
          error: 'Invalid party ID',
          message: 'Party ID is required and must be a valid string'
        },
        { status: 400 }
      );
    }

    // Parse and validate request body
    let data: ActivityGenerationRequest;
    try {
      data = await request.json();
    } catch (parseError) {
      console.error('Invalid JSON in generate request body:', parseError);
      return NextResponse.json(
        { 
          error: 'Invalid request body',
          message: 'Request body must be valid JSON'
        },
        { status: 400 }
      );
    }

    // Validate required fields for activity generation
    const requiredFields = ['theme', 'ageGroup', 'numberOfKids', 'totalDuration', 'setting', 'budgetLevel'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          message: `The following fields are required for activity generation: ${missingFields.join(', ')}`
        },
        { status: 400 }
      );
    }

    // First check if the party exists with enhanced error handling
    let party;
    try {
      party = await prisma.party.findUnique({
        where: { id: partyId.trim() }
      });
    } catch (dbError) {
      console.error('Database error while finding party in generate:', dbError);
      return NextResponse.json(
        { 
          error: 'Database connection error',
          message: 'Unable to connect to database. Please try again later.'
        },
        { status: 503 }
      );
    }

    if (!party) {
      console.warn('Party not found in generate for ID:', partyId);
      return NextResponse.json(
        { 
          error: 'Party not found',
          message: 'The specified party does not exist or you do not have access to it'
        },
        { status: 404 }
      );
    }

    // Check if Azure OpenAI is configured
    const hasAzureOpenAI = process.env.AZURE_OPENAI_API_KEY && 
                          process.env.AZURE_OPENAI_ENDPOINT && 
                          process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

    let generatedActivities: any[] = [];
    let aiGenerated = false;

    if (hasAzureOpenAI) {
      try {
        console.log('Attempting AI generation for party:', partyId);
        generatedActivities = await generateActivitiesWithAI(data, partyId);
        aiGenerated = true;
        console.log('AI generation successful, generated', generatedActivities.length, 'activities');
      } catch (error) {
        console.error('AI generation failed, falling back to default activities:', error);
        generatedActivities = generateDefaultActivities(data);
        aiGenerated = false;
      }
    } else {
      console.log('Azure OpenAI not configured, using default activities for party:', partyId);
      generatedActivities = generateDefaultActivities(data);
      aiGenerated = false;
    }

    // Validate generated activities
    if (!Array.isArray(generatedActivities) || generatedActivities.length === 0) {
      console.error('Invalid or empty activities generated for party:', partyId);
      return NextResponse.json(
        { 
          error: 'Activity generation failed',
          message: 'Unable to generate activities. Please try again or contact support.'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      activities: generatedActivities,
      aiGenerated: aiGenerated,
      count: generatedActivities.length
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/parties/[partyId]/activities/generate:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'An unexpected error occurred while generating activities',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}

async function generateActivitiesWithAI(data: ActivityGenerationRequest, partyId: string) {
  const prompt = `You are the AI Party Activity Genie, the super-fun, creative best friend for any parent or host planning a kid's party! Your mission is to generate a dazzling party activity plan that's perfectly matched to the party's theme, age group, group size, and any special requests.

Here's the party's vibe:
- Theme: ${data.theme}
- Age group: ${data.ageGroup}
- Number of kids: ${data.numberOfKids}
- Total party duration: ${data.totalDuration}
- Setting: ${data.setting}
- Budget level: ${data.budgetLevel}
- Special requests: ${data.specialRequests?.join(', ') || 'None'}
- Additional notes: ${data.customText || 'None'}

Give me a list of 4–8 unique, kid-friendly activities in JSON format. Each activity should have:
- name: A fun and themed activity name
- category: One of "GAME", "CRAFT", "DANCE", "QUIET", "OUTDOOR", "EDUCATIONAL"
- difficulty: One of "EASY", "MEDIUM", "HARD"
- timeEstimate: Time estimate like "15-20 minutes"
- bestGroupSize: Group size like "4-8 kids"
- instructions: Array of step-by-step instructions for parents
- materials: Array of required materials
- materialAlternatives: Object with household alternatives for materials
- energyLevel: One of "HIGH", "MEDIUM", "CALM"

Respond with only valid JSON array of activities.`;

  const response = await fetch(`${process.env.AZURE_OPENAI_ENDPOINT}openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}/chat/completions?api-version=${process.env.AZURE_OPENAI_API_VERSION}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.AZURE_OPENAI_API_KEY!,
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content: 'You are an expert party planner specializing in children\'s birthday parties. Always respond with valid JSON arrays only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.8,
      top_p: 0.9
    })
  });

  if (!response.ok) {
    throw new Error(`Azure OpenAI API error: ${response.status}`);
  }

  const result = await response.json();
  const aiContent = result.choices[0]?.message?.content;

  if (!aiContent) {
    throw new Error('No content received from Azure OpenAI');
  }

  try {
    const activities = JSON.parse(aiContent);
    return activities.map((activity: any, index: number) => ({
      ...activity,
      sequence: index + 1,
      isAiGenerated: true,
      aiPrompt: prompt
    }));
  } catch (parseError) {
    console.error('Failed to parse AI response:', parseError);
    throw new Error('Invalid JSON response from AI');
  }
}

function generateDefaultActivities(data: ActivityGenerationRequest) {
  const ageNum = parseInt(data.ageGroup.split('-')[0]) || 5;
  const isToddler = ageNum <= 3;
  const theme = data.theme.charAt(0).toUpperCase() + data.theme.slice(1);

  const activities = [
    {
      name: `${theme} Themed Treasure Hunt`,
      category: 'GAME',
      difficulty: isToddler ? 'EASY' : 'MEDIUM',
      timeEstimate: '20-30 minutes',
      bestGroupSize: `4-${Math.min(data.numberOfKids, 15)} kids`,
      instructions: [
        'Hide themed treasures around the party area',
        'Give each child a treasure map or clue list',
        'Guide younger children, let older ones work independently',
        'Celebrate each discovery with cheers and high-fives',
        'End with everyone sharing their favorite find'
      ],
      materials: ['Themed treasures/toys', 'Maps or clue cards', 'Small bags for collecting', 'Stickers as rewards'],
      materialAlternatives: {
        'Themed treasures/toys': ['Wrapped candy', 'Small household items painted in theme colors', 'Homemade themed cutouts'],
        'Maps or clue cards': ['Hand-drawn maps', 'Picture clues for non-readers', 'Riddles written on paper'],
        'Small bags for collecting': ['Paper lunch bags', 'Plastic containers', 'Pillowcases']
      },
      energyLevel: 'HIGH',
      sequence: 1,
      isAiGenerated: false
    },
    {
      name: `Create Your Own ${theme} Masterpiece`,
      category: 'CRAFT',
      difficulty: 'EASY',
      timeEstimate: '25-35 minutes',
      bestGroupSize: `1-${data.numberOfKids} kids`,
      instructions: [
        'Set up craft stations with all materials organized',
        'Show examples but encourage creativity',
        'Help younger children with difficult steps',
        'Let each child personalize their creation',
        'Have a show-and-tell at the end'
      ],
      materials: ['Craft supplies', 'Glue sticks', 'Child-safe scissors', 'Crayons/markers', 'Decorative items'],
      materialAlternatives: {
        'Craft supplies': ['Cardboard from boxes', 'Toilet paper tubes', 'Construction paper', 'Paper plates'],
        'Decorative items': ['Buttons', 'Cotton balls', 'Aluminum foil', 'Stickers from around the house']
      },
      energyLevel: 'CALM',
      sequence: 2,
      isAiGenerated: false
    },
    {
      name: `${theme} Dance Party Freeze`,
      category: 'DANCE',
      difficulty: 'EASY',
      timeEstimate: '15-20 minutes',
      bestGroupSize: `3-${data.numberOfKids} kids`,
      instructions: [
        'Play upbeat themed music',
        'Demonstrate fun theme-related dance moves',
        'When music stops, everyone freezes like a statue',
        'Add fun poses related to the theme',
        'Give everyone a chance to show their best freeze pose'
      ],
      materials: ['Themed music playlist', 'Speaker or music player', 'Optional: themed props'],
      materialAlternatives: {
        'Themed music playlist': ['YouTube playlists on phone', 'Radio with theme-appropriate music', 'Kids singing together'],
        'Speaker or music player': ['Phone speaker', 'Laptop speakers', 'Singing without music']
      },
      energyLevel: 'HIGH',
      sequence: 3,
      isAiGenerated: false
    },
    {
      name: `${theme} Story Circle`,
      category: 'QUIET',
      difficulty: 'EASY',
      timeEstimate: '15-20 minutes',
      bestGroupSize: `3-${data.numberOfKids} kids`,
      instructions: [
        'Gather everyone in a cozy circle',
        'Start a themed story with 2-3 sentences',
        'Each child adds one sentence to continue the story',
        'Keep it lighthearted and fun',
        'End with applause for the group story creation'
      ],
      materials: ['Comfortable seating', 'Optional: themed props for inspiration'],
      materialAlternatives: {
        'Comfortable seating': ['Pillows from couch', 'Blankets on floor', 'Sitting in grass outside'],
        'themed props': ['Toys related to theme', 'Pictures from books', 'Drawings made earlier']
      },
      energyLevel: 'CALM',
      sequence: 4,
      isAiGenerated: false
    }
  ];

  // Add team challenge for larger groups
  if (data.numberOfKids >= 8) {
    activities.push({
      name: `${theme} Team Challenge`,
      category: 'GAME',
      difficulty: 'MEDIUM',
      timeEstimate: '25-30 minutes',
      bestGroupSize: `8-${data.numberOfKids} kids`,
      instructions: [
        'Divide into 2-3 teams of equal size',
        'Set up themed challenges at different stations',
        'Teams rotate through each challenge',
        'Focus on fun and teamwork over competition',
        'Celebrate all teams with themed stickers or high-fives'
      ],
      materials: ['Station markers', 'Themed challenge props', 'Timer', 'Team name tags'],
      materialAlternatives: {
        'Station markers': ['Colored paper signs', 'Cones made from paper', 'Chairs as markers'],
        'Team name tags': ['Colored stickers', 'Hand-drawn badges', 'Colored ribbons'],
        'Timer': ['Phone timer', 'Kitchen timer', 'Counting aloud'],
        'Themed challenge props': ['Household items', 'DIY obstacles', 'Simple games']
      } as any,
      energyLevel: 'HIGH',
      sequence: 5,
      isAiGenerated: false
    });
  }

  return activities;
}