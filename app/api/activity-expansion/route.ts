import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const prisma = new PrismaClient();

// Initialize Supabase client for authentication
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Environment validation
function validateEnvironment() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Database not configured');
  }
  
  return {
    hasAzureAI: !!(process.env.AZURE_OPENAI_API_KEY && 
                   process.env.AZURE_OPENAI_ENDPOINT && 
                   process.env.AZURE_OPENAI_DEPLOYMENT_NAME &&
                   process.env.AZURE_OPENAI_API_VERSION)
  };
}

// Initialize Azure OpenAI client only if credentials are available
const openai = (() => {
  try {
    const env = validateEnvironment();
    if (!env.hasAzureAI) return null;
    
    return new OpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY!,
      baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
      defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION },
      defaultHeaders: {
        'api-key': process.env.AZURE_OPENAI_API_KEY!,
      },
    });
  } catch {
    return null;
  }
})();

interface ActivityExpansionRequest {
  partyId: string;
  activityText: string;
  partyData?: {
    childName: string;
    childAge: number;
    theme: string;
    interests: string[];
    favoriteColors: string[];
    venue?: string;
    guestCount?: number;
  };
  keywords?: string[];
  enhancedPrompt?: string;
}

interface ProcessedActivity {
  name: string;
  description?: string;
  supplies: string[];
  estimatedTime?: number;
  timeUnit: string;
  peopleRequired?: number;
  groupInstructions?: string;
  hostScript?: string;
  tips: string[];
  sortOrder: number;
  isCustom: boolean;
  source: 'AI_GENERATED' | 'USER_CREATED' | 'THEME_DEFAULT';
}

// Create enhanced system message based on party context
function createEnhancedSystemMessage(
  partyData?: ActivityExpansionRequest['partyData'], 
  keywords?: string[], 
  enhancedPrompt?: string
): string {
  let baseMessage = `Break these activities into actionable instructions for parents planning a kids' party. Include supplies, time, people, group instructions, host dialogue, and tips.

For each activity, return a JSON object with these exact fields:
- name: string (activity name, editable by user)
- description: string (brief description)
- supplies: array of strings (list with checkboxes)
- estimatedTime: number (numeric value)
- timeUnit: string ("minutes" or "hours")
- peopleRequired: number (number of people required or participants)
- groupInstructions: string (how to split kids by age/number)
- hostScript: string (short, engaging dialogue parents can use to run the activity)
- tips: array of strings (safety notes, fun twists, age-specific adaptations)

Make the output parent-friendly, step-by-step, and ready to execute. Make it fun and engaging with age-appropriate language.`;

  // Add party-specific context if available
  if (partyData) {
    baseMessage += `

PARTY CONTEXT:
- Child: ${partyData.childName}, age ${partyData.childAge}
- Theme: ${partyData.theme}
- Child's interests: ${partyData.interests.join(', ')}
- Favorite colors: ${partyData.favoriteColors.join(', ')}
- Venue: ${partyData.venue || 'Not specified'}
- Expected guests: ${partyData.guestCount || 'Not specified'}`;

    if (keywords && keywords.length > 0) {
      baseMessage += `
- Parent's additional keywords: ${keywords.join(', ')}`;
    }

    baseMessage += `

IMPORTANT: Generate activities that are:
1. Age-appropriate for ${partyData.childAge}-year-olds
2. Specifically themed around ${partyData.theme}
3. Incorporate the child's interests: ${partyData.interests.join(', ')}
4. Use ${partyData.favoriteColors.join(' and ')} colors when possible
5. Suitable for ${partyData.venue || 'any venue'}`;

    if (keywords && keywords.length > 0) {
      baseMessage += `
6. Include elements related to: ${keywords.join(', ')}`;
    }

    // Add theme-specific guidance
    if (partyData.theme.toLowerCase().includes('safari')) {
      baseMessage += `

For Safari theme specifically:
- Include animal sounds, movements, and behaviors
- Create jungle exploration activities
- Add wildlife-themed crafts and games
- Include animal rescue or conservation themes
- Use binoculars, maps, and adventure gear as props`;
    }
  }

  // Add enhanced prompt if provided
  if (enhancedPrompt) {
    baseMessage += `

ADDITIONAL CONTEXT:
${enhancedPrompt}`;
  }

  baseMessage += `

Return only a valid JSON array of activity objects, no other text.`;

  return baseMessage;
}

// Default fallback activities if AI is not available
const getDefaultActivities = (): ProcessedActivity[] => [
  {
    name: "Musical Chairs",
    description: "Classic party game where children walk around chairs and sit when music stops",
    supplies: ["Chairs (one less than number of players)", "Music player", "Speaker"],
    estimatedTime: 15,
    timeUnit: "minutes",
    peopleRequired: 1,
    groupInstructions: "Arrange chairs in a circle, one less than the number of children playing",
    hostScript: "When I play the music, walk around the chairs. When the music stops, quickly find a chair to sit in! Remember to be gentle and have fun!",
    tips: [
      "Remove one chair after each round",
      "Ensure children understand gentle play rules",
      "Have a small prize or applause for all participants"
    ],
    sortOrder: 0,
    isCustom: false,
    source: 'THEME_DEFAULT'
  },
  {
    name: "Treasure Hunt",
    description: "Fun activity where children search for hidden treasures around the party area",
    supplies: ["Small toys or candies", "Treasure hunt clues", "Small bags for collecting"],
    estimatedTime: 20,
    timeUnit: "minutes",
    peopleRequired: 1,
    groupInstructions: "Can be done individually or in small teams of 2-3 children",
    hostScript: "Pirates and explorers! Your mission is to find the hidden treasures using these special clues. Work together and help each other!",
    tips: [
      "Hide items at child-appropriate heights",
      "Ensure every child finds at least one treasure",
      "Have backup treasures ready",
      "Consider age differences when creating clues"
    ],
    sortOrder: 1,
    isCustom: false,
    source: 'THEME_DEFAULT'
  },
  {
    name: "Craft Activity",
    description: "Creative hands-on activity where children make party-themed crafts to take home",
    supplies: ["Construction paper", "Glue sticks", "Scissors", "Crayons/markers", "Stickers"],
    estimatedTime: 25,
    timeUnit: "minutes",
    peopleRequired: 2,
    groupInstructions: "Seat children at tables with 4-6 per table, ensure adult supervision at each table",
    hostScript: "Today we're going to create something amazing! Follow along with me and let your creativity shine. Don't worry about making it perfect - have fun!",
    tips: [
      "Pre-cut difficult shapes for younger children",
      "Have wet wipes ready for cleanup",
      "Prepare extra supplies in case of mistakes",
      "Take photos of children with their finished crafts"
    ],
    sortOrder: 2,
    isCustom: false,
    source: 'THEME_DEFAULT'
  }
];

// POST - Generate activities from AI recommendation text
export async function POST(request: NextRequest) {
  try {
    const body: ActivityExpansionRequest = await request.json();
    const { partyId, activityText, partyData, keywords = [], enhancedPrompt } = body;

    if (!partyId || !activityText) {
      return NextResponse.json({ error: 'Party ID and activity text are required' }, { status: 400 });
    }

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Verify party ownership if userId is available
    if (userId) {
      const party = await prisma.party.findFirst({
        where: {
          id: partyId,
          userId: userId
        }
      });

      if (!party) {
        return NextResponse.json({ error: 'Party not found or access denied' }, { status: 404 });
      }
    }

    let processedActivities: ProcessedActivity[] = [];

    // Try to use AI to expand activities
    if (openai) {
      try {
        // Create enhanced system message based on party context
        const systemMessage = createEnhancedSystemMessage(partyData, keywords, enhancedPrompt);
        
        const completion = await openai.chat.completions.create({
          model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME!,
          messages: [
            {
              role: "system",
              content: systemMessage
            },
            {
              role: "user",
              content: activityText
            }
          ],
          temperature: 0.7,
          max_tokens: 3000
        });

        const aiResponse = completion.choices[0]?.message?.content;
        if (aiResponse) {
          try {
            const aiActivities = JSON.parse(aiResponse);
            if (Array.isArray(aiActivities)) {
              processedActivities = aiActivities.map((activity, index) => ({
                name: activity.name || 'Unnamed Activity',
                description: activity.description || '',
                supplies: Array.isArray(activity.supplies) ? activity.supplies : [],
                estimatedTime: typeof activity.estimatedTime === 'number' ? activity.estimatedTime : 30,
                timeUnit: activity.timeUnit === 'hours' ? 'hours' : 'minutes',
                peopleRequired: typeof activity.peopleRequired === 'number' ? activity.peopleRequired : 1,
                groupInstructions: activity.groupInstructions || '',
                hostScript: activity.hostScript || '',
                tips: Array.isArray(activity.tips) ? activity.tips : [],
                sortOrder: index,
                isCustom: false,
                source: 'AI_GENERATED' as const
              }));
            }
          } catch (parseError) {
            console.error('Failed to parse AI response:', parseError);
            // Fall back to default activities
            processedActivities = getDefaultActivities();
          }
        }
      } catch (aiError) {
        console.error('AI request failed:', aiError);
        // Fall back to default activities
        processedActivities = getDefaultActivities();
      }
    } else {
      // No AI available, use default activities
      processedActivities = getDefaultActivities();
    }

    // If we still don't have activities, use fallback
    if (processedActivities.length === 0) {
      processedActivities = getDefaultActivities();
    }

    // Clear existing AI-generated activities for this party
    await prisma.partyActivity.deleteMany({
      where: {
        partyId: partyId,
        source: 'AI_GENERATED'
      }
    });

    // Save the new activities to database
    const savedActivities: any[] = [];
    for (const activity of processedActivities) {
      const savedActivity = await prisma.partyActivity.create({
        data: {
          partyId: partyId,
          name: activity.name,
          description: activity.description,
          supplies: activity.supplies,
          estimatedTime: activity.estimatedTime,
          timeUnit: activity.timeUnit,
          peopleRequired: activity.peopleRequired,
          groupInstructions: activity.groupInstructions,
          hostScript: activity.hostScript,
          tips: activity.tips,
          sortOrder: activity.sortOrder,
          isCustom: activity.isCustom,
          source: activity.source
        }
      });

      savedActivities.push({
        id: savedActivity.id,
        name: savedActivity.name,
        description: savedActivity.description,
        supplies: savedActivity.supplies,
        estimatedTime: savedActivity.estimatedTime,
        timeUnit: savedActivity.timeUnit,
        peopleRequired: savedActivity.peopleRequired,
        groupInstructions: savedActivity.groupInstructions,
        hostScript: savedActivity.hostScript,
        tips: savedActivity.tips,
        sortOrder: savedActivity.sortOrder,
        isCustom: savedActivity.isCustom,
        source: savedActivity.source,
        isExpanded: false
      });
    }

    return NextResponse.json({ 
      activities: savedActivities,
      message: openai ? 'Activities generated successfully with AI' : 'Activities generated with default templates'
    });

  } catch (error) {
    console.error('Error expanding activities:', error);
    return NextResponse.json(
      { error: 'Failed to expand activities' },
      { status: 500 }
    );
  }
}