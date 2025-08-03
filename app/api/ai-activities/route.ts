import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { shouldBlockAISuggestions } from '@/lib/profanity-filter';

// Initialize Azure OpenAI client only if credentials are available
const openai = process.env.AZURE_OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
  defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION },
  defaultHeaders: {
    'api-key': process.env.AZURE_OPENAI_API_KEY,
  },
}) : null;

interface AIActivitiesRequest {
  theme: string;
  childAge: number;
  guestCount?: number;
  interests?: string[];
  selectedActivities?: string[];
  partyDuration?: string;
  venue?: string;
}

interface ActivitySuggestion {
  id: string;
  name: string;
  description: string;
  category: 'games' | 'dance' | 'crafts' | 'entertainment' | 'sports' | 'creative';
  duration: string;
  participants: string;
  materials: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  ageRange: string;
  instructions: string[];
  safetyTips: string[];
  variations: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: AIActivitiesRequest = await request.json();
    const { theme, childAge, guestCount = 8, interests = [], selectedActivities = [], partyDuration = '2-3 hours', venue = 'home' } = body;

    // Basic validation
    if (!theme || !childAge) {
      return NextResponse.json(
        { error: 'Theme and child age are required' },
        { status: 400 }
      );
    }

    // Check for inappropriate content
    const content = [theme, ...interests, ...selectedActivities, venue].join(' ');
    if (shouldBlockAISuggestions(content)) {
      return NextResponse.json(
        { 
          error: 'Inappropriate content detected',
          blocked: true,
          message: 'Please use family-friendly language appropriate for children\'s parties.'
        },
        { status: 400 }
      );
    }

    if (!openai || !process.env.AZURE_OPENAI_API_KEY) {
      return NextResponse.json(
        { 
          error: 'Azure OpenAI API key not configured',
          fallback: true,
          activities: getFallbackActivities(theme, childAge, guestCount)
        },
        { status: 200 }
      );
    }

    const prompt = `You are an expert party planner specializing in children's birthday parties. Generate 5-8 creative, age-appropriate activities for a ${theme} themed party.

Party Details:
- Theme: ${theme}
- Child's Age: ${childAge} years old
- Guest Count: ${guestCount} children
- Party Duration: ${partyDuration}
- Venue: ${venue}
- Child's Interests: ${interests.length > 0 ? interests.join(', ') : 'Not specified'}
- Already Planned Activities: ${selectedActivities.length > 0 ? selectedActivities.join(', ') : 'None'}

Requirements:
1. Activities must be age-appropriate for ${childAge}-year-olds
2. Each activity should align with the ${theme} theme
3. Include a mix of active games, creative activities, and entertainment
4. Consider the venue limitations (${venue})
5. Provide detailed instructions and safety considerations
6. Suggest variations for different skill levels
7. Include material lists that are realistic and obtainable
8. Avoid duplicating already planned activities: ${selectedActivities.join(', ')}

For each activity, provide:
- Creative name related to the theme
- Engaging description
- Category (games, dance, crafts, entertainment, sports, creative)
- Duration estimate
- Participant count recommendation
- Complete materials list
- Difficulty level (easy, medium, hard)
- Age range suitability
- Step-by-step instructions
- Safety tips
- Variations for different ages or group sizes

Return ONLY a valid JSON array of activity objects with this structure:
[
  {
    "id": "unique-activity-id",
    "name": "Activity Name",
    "description": "Brief engaging description",
    "category": "games|dance|crafts|entertainment|sports|creative",
    "duration": "10-15 minutes",
    "participants": "4-8 kids",
    "materials": ["item1", "item2", "item3"],
    "difficulty": "easy|medium|hard",
    "ageRange": "4-8",
    "instructions": ["Step 1", "Step 2", "Step 3"],
    "safetyTips": ["Safety tip 1", "Safety tip 2"],
    "variations": ["Variation for younger kids", "Variation for larger groups"]
  }
]

Focus on creating engaging, memorable activities that will make this ${theme} party special for a ${childAge}-year-old child and their friends.`;

    const completion = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert children\'s party planner. Always respond with valid JSON only. No additional text or explanations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 4000,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No response from Azure OpenAI');
    }

    // Parse the JSON response
    let activities: ActivitySuggestion[];
    try {
      // Clean the response to ensure it's valid JSON
      const cleanedResponse = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      activities = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return NextResponse.json(
        { 
          error: 'Failed to parse AI response',
          fallback: true,
          activities: getFallbackActivities(theme, childAge, guestCount)
        },
        { status: 200 }
      );
    }

    // Validate and enhance the activities
    const validatedActivities = activities.map((activity, index) => ({
      ...activity,
      id: activity.id || `ai-activity-${index + 1}`,
      category: ['games', 'dance', 'crafts', 'entertainment', 'sports', 'creative'].includes(activity.category) 
        ? activity.category 
        : 'games',
      difficulty: ['easy', 'medium', 'hard'].includes(activity.difficulty) 
        ? activity.difficulty 
        : 'easy',
      materials: Array.isArray(activity.materials) ? activity.materials : [],
      instructions: Array.isArray(activity.instructions) ? activity.instructions : [],
      safetyTips: Array.isArray(activity.safetyTips) ? activity.safetyTips : [],
      variations: Array.isArray(activity.variations) ? activity.variations : []
    }));

    return NextResponse.json({
      success: true,
      activities: validatedActivities,
      aiGenerated: true,
      theme,
      childAge,
      guestCount
    });

  } catch (error) {
    console.error('Error generating AI activities:', error);
    
    // Return fallback activities if AI fails
    const body: AIActivitiesRequest = await request.json();
    return NextResponse.json(
      { 
        error: 'Failed to generate AI activities',
        fallback: true,
        activities: getFallbackActivities(body.theme, body.childAge, body.guestCount || 8)
      },
      { status: 200 }
    );
  }
}

// Fallback activities when AI is not available
function getFallbackActivities(theme: string, childAge: number, guestCount: number): ActivitySuggestion[] {
  const themeActivities: { [key: string]: ActivitySuggestion[] } = {
    superhero: [
      {
        id: 'superhero-training-course',
        name: 'Superhero Training Academy',
        description: 'Complete challenges to become a certified superhero',
        category: 'sports',
        duration: '20-30 minutes',
        participants: `4-${guestCount} kids`,
        materials: ['Cones', 'Jump ropes', 'Hula hoops', 'Timer'],
        difficulty: 'medium',
        ageRange: `${Math.max(3, childAge - 2)}-${childAge + 2}`,
        instructions: [
          'Set up obstacle course with cones and hoops',
          'Time each child completing the course',
          'Award superhero certificates to all participants'
        ],
        safetyTips: ['Ensure clear pathways', 'Supervise jumping activities'],
        variations: ['Add crawling sections for younger kids', 'Create team relays for larger groups']
      },
      {
        id: 'villain-freeze-tag',
        name: 'Freeze the Villain',
        description: 'Tag game where superheroes must freeze the villains',
        category: 'games',
        duration: '15-20 minutes',
        participants: `5-${guestCount} kids`,
        materials: ['Villain masks', 'Superhero badges'],
        difficulty: 'easy',
        ageRange: `${Math.max(3, childAge - 2)}-${childAge + 3}`,
        instructions: [
          'Choose 1-2 kids to be villains',
          'Villains try to tag superheroes',
          'Tagged superheroes must freeze until rescued'
        ],
        safetyTips: ['Set clear boundaries', 'No running indoors'],
        variations: ['Musical freeze for younger kids', 'Add special powers for older kids']
      }
    ],
    princess: [
      {
        id: 'royal-makeover-station',
        name: 'Royal Makeover Palace',
        description: 'Transform into beautiful princesses with makeup and accessories',
        category: 'creative',
        duration: '25-35 minutes',
        participants: `1-${Math.min(6, guestCount)} kids at a time`,
        materials: ['Child-safe makeup', 'Tiaras', 'Nail stickers', 'Mirrors'],
        difficulty: 'easy',
        ageRange: `${Math.max(3, childAge - 1)}-${childAge + 2}`,
        instructions: [
          'Set up makeover stations with mirrors',
          'Apply light makeup and nail stickers',
          'Crown each princess with a tiara'
        ],
        safetyTips: ['Use only child-safe products', 'Check for allergies'],
        variations: ['Face painting for boys', 'Hair braiding station']
      }
    ]
  };

  const fallbackActivities: ActivitySuggestion[] = [
    {
      id: 'musical-chairs-classic',
      name: 'Musical Chairs',
      description: 'Classic party game with fun music and excitement',
      category: 'games',
      duration: '10-15 minutes',
      participants: `5-${guestCount} kids`,
      materials: ['Chairs', 'Music player'],
      difficulty: 'easy',
      ageRange: `${Math.max(3, childAge - 2)}-${childAge + 3}`,
      instructions: [
        'Set up chairs in a circle (one less than players)',
        'Play music while kids walk around chairs',
        'When music stops, everyone finds a seat'
      ],
      safetyTips: ['Ensure chairs are stable', 'Supervise to prevent pushing'],
      variations: ['Dance freeze for non-elimination fun', 'Add props for theme integration']
    },
    {
      id: 'treasure-hunt-adventure',
      name: 'Birthday Treasure Hunt',
      description: 'Search for hidden treasures around the party area',
      category: 'games',
      duration: '20-30 minutes',
      participants: `4-${guestCount} kids`,
      materials: ['Clue cards', 'Small prizes', 'Treasure box'],
      difficulty: 'medium',
      ageRange: `${Math.max(4, childAge - 1)}-${childAge + 2}`,
      instructions: [
        'Hide clues around the party area',
        'Give first clue to start the hunt',
        'Lead to final treasure for everyone to share'
      ],
      safetyTips: ['Keep hunt area safe and bounded', 'Ensure all kids participate'],
      variations: ['Picture clues for non-readers', 'Team hunts for larger groups']
    }
  ];

  const themeKey = theme.toLowerCase();
  return themeActivities[themeKey] || fallbackActivities;
}