import { NextRequest, NextResponse } from 'next/server';

interface ActivityRequest {
  theme: string;
  childAge: number;
  guestCount: number;
  budget: 'low' | 'medium' | 'high';
  venue: 'indoor' | 'outdoor' | 'mixed';
  duration: string;
  customRequests?: string;
}

interface ActivitySuggestion {
  id: string;
  name: string;
  category: 'game' | 'craft' | 'creative' | 'active' | 'quiet' | 'educational';
  difficulty: 'easy' | 'medium' | 'advanced';
  duration: string;
  ageAppropriate: string;
  participants: string;
  description: string;
  materials: string[];
  instructions: string[];
  tips: string[];
  safetyNotes?: string[];
  energyLevel: 'low' | 'medium' | 'high';
  setupTime: string;
  cost: 'free' | 'low' | 'medium' | 'high';
}

function generateDefaultActivities(theme: string, childAge: number, guestCount: number, budget: string, venue: string): ActivitySuggestion[] {
  const isToddler = childAge <= 3;
  const isPreschool = childAge >= 4 && childAge <= 6;
  const isSchoolAge = childAge >= 7;
  
  const activities: ActivitySuggestion[] = [
    {
      id: `default-1-${Date.now()}`,
      name: `${theme.charAt(0).toUpperCase() + theme.slice(1)} Treasure Hunt`,
      category: 'game',
      difficulty: isToddler ? 'easy' : 'medium',
      duration: '20-25 minutes',
      ageAppropriate: `Perfect for ${childAge} year olds`,
      participants: `3-${Math.min(guestCount, 12)} kids`,
      description: `An exciting treasure hunt adventure with ${theme}-themed clues and prizes that will get everyone moving and laughing!`,
      materials: ['Themed clues or maps', 'Small prizes/treasures', 'Collection bags', 'Stickers for marking found items'],
      instructions: [
        'Hide themed treasures or clue cards around your party space',
        'Give each child a treasure map or list of clues to follow',
        'For younger kids, use picture clues; for older kids, use riddles',
        'Help guide the little ones while letting bigger kids work independently',
        'Celebrate each discovery with cheers and high-fives',
        'End with everyone sharing their favorite treasure find'
      ],
      tips: [
        'Make sure every child finds at least one treasure',
        'Have backup treasures ready for quick replacements',
        'Take photos of the kids during their treasure hunting adventures'
      ],
      safetyNotes: [
        'Check that all hiding spots are safe and accessible',
        'Avoid hiding items in areas with potential hazards',
        'Supervise younger children throughout the activity'
      ],
      energyLevel: 'high',
      setupTime: '15-20 minutes',
      cost: budget === 'low' ? 'low' : 'medium'
    },
    {
      id: `default-2-${Date.now()}`,
      name: `DIY ${theme.charAt(0).toUpperCase() + theme.slice(1)} Craft Station`,
      category: 'craft',
      difficulty: 'easy',
      duration: '30-40 minutes',
      ageAppropriate: `Great for ${childAge} year olds`,
      participants: `1-${guestCount} kids (individual activity)`,
      description: `A creative craft station where kids can make their own ${theme}-themed masterpieces to take home as party favors!`,
      materials: ['Construction paper', 'Child-safe glue sticks', 'Crayons or markers', 'Themed stickers', 'Decorative items (sequins, cotton balls, etc.)'],
      instructions: [
        'Set up individual craft stations with all materials organized',
        'Show examples of finished crafts but encourage creativity',
        'Help younger children with cutting or gluing as needed',
        'Let each child personalize their creation with their name',
        'Have a mini craft show where everyone presents their masterpiece',
        'Pack completed crafts in take-home bags'
      ],
      tips: [
        'Cover tables with disposable tablecloths for easy cleanup',
        'Have wet wipes readily available for sticky fingers',
        'Prepare a few extra craft supplies for enthusiastic creators'
      ],
      safetyNotes: [
        'Use only child-safe, non-toxic materials',
        'Supervise the use of any scissors or small parts',
        'Check for any allergies to craft materials beforehand'
      ],
      energyLevel: 'low',
      setupTime: '10-15 minutes',
      cost: budget === 'high' ? 'medium' : 'low'
    },
    {
      id: `default-3-${Date.now()}`,
      name: `${theme.charAt(0).toUpperCase() + theme.slice(1)} Dance Freeze Party`,
      category: 'active',
      difficulty: 'easy',
      duration: '15-20 minutes',
      ageAppropriate: `Fun for ${childAge} year olds`,
      participants: `3-${guestCount} kids`,
      description: `An energetic dance party with ${theme}-themed music where kids dance until the music stops, then freeze like statues!`,
      materials: ['Music playlist', 'Speaker or music player', 'Optional: themed props for dancing'],
      instructions: [
        'Create a playlist of upbeat, kid-friendly music',
        'Teach a few simple ${theme}-themed dance moves',
        'Start the music and encourage everyone to dance freely',
        'Randomly pause the music - everyone must freeze in place!',
        'Compliment creative freeze poses and silly positions',
        'Add themed freeze poses (like superheroes, animals, etc.)',
        'End with a group dance celebration'
      ],
      tips: [
        'Keep music at a comfortable volume for little ears',
        'Join in the dancing to encourage shy participants',
        'Take funny photos of the best freeze poses'
      ],
      safetyNotes: [
        'Ensure there\'s enough space for safe dancing',
        'Remove any obstacles or breakable items from the dance area',
        'Watch for tired children and offer water breaks'
      ],
      energyLevel: 'high',
      setupTime: '5 minutes',
      cost: 'free'
    },
    {
      id: `default-4-${Date.now()}`,
      name: `${theme.charAt(0).toUpperCase() + theme.slice(1)} Story Circle`,
      category: 'quiet',
      difficulty: 'easy',
      duration: '15-20 minutes',
      ageAppropriate: `Perfect for ${childAge} year olds`,
      participants: `3-${guestCount} kids`,
      description: `A cozy storytelling activity where kids create a collaborative ${theme}-themed adventure story together!`,
      materials: ['Comfortable seating (pillows, blankets)', 'Optional: themed props or picture cards for inspiration'],
      instructions: [
        'Gather everyone in a comfortable circle on the floor',
        'Start a ${theme}-themed story with 2-3 exciting sentences',
        'Each child adds one sentence to continue the adventure',
        'Keep the story fun, silly, and age-appropriate',
        'Gently guide the story if it goes off track',
        'End with a satisfying conclusion and applause for the group story',
        'Optional: Act out parts of the story together'
      ],
      tips: [
        'Have a few story starter ideas ready in case kids are shy',
        'Encourage creativity but keep the story moving',
        'Write down funny parts of the story to share with parents later'
      ],
      energyLevel: 'low',
      setupTime: '5 minutes',
      cost: 'free'
    }
  ];

  // Add an extra activity for larger groups
  if (guestCount >= 8) {
    activities.push({
      id: `default-5-${Date.now()}`,
      name: `${theme.charAt(0).toUpperCase() + theme.slice(1)} Team Challenge`,
      category: 'game',
      difficulty: 'medium',
      duration: '25-30 minutes',
      ageAppropriate: `Great for ${childAge} year olds`,
      participants: `8-${guestCount} kids (team activity)`,
      description: `An exciting team-based challenge with ${theme}-themed stations that promotes cooperation and friendly fun!`,
      materials: ['Station markers or signs', 'Themed props for challenges', 'Timer', 'Small prizes or stickers for all participants'],
      instructions: [
        'Divide kids into teams of 3-4 with mixed ages',
        'Set up 3-4 ${theme}-themed challenge stations',
        'Explain each station\'s simple challenge or task',
        'Teams rotate through stations every 5-7 minutes',
        'Focus on participation and teamwork, not winning',
        'Celebrate all teams with equal enthusiasm',
        'End with a group cheer or team high-fives'
      ],
      tips: [
        'Mix ages and personalities when forming teams',
        'Have adult helpers at each station for younger kids',
        'Keep challenges simple and achievable for confidence building'
      ],
      safetyNotes: [
        'Ensure all challenges are age-appropriate and safe',
        'Monitor team dynamics and help resolve any conflicts',
        'Have water available and watch for tired children'
      ],
      energyLevel: 'high',
      setupTime: '15-20 minutes',
      cost: 'low'
    });
  }

  return activities.slice(0, Math.min(5, activities.length));
}

async function generateAIActivities(requestData: ActivityRequest): Promise<ActivitySuggestion[]> {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      console.log('OpenAI API key not found, using default activities');
      return generateDefaultActivities(requestData.theme, requestData.childAge, requestData.guestCount, requestData.budget, requestData.venue);
    }

    const prompt = `You are an expert children's party activity planner. Generate 4-6 creative, safe, and age-appropriate activities for a ${requestData.theme} themed birthday party.

Party Details:
- Theme: ${requestData.theme}
- Child's Age: ${requestData.childAge} years old
- Number of Kids: ${requestData.guestCount}
- Budget Level: ${requestData.budget}
- Venue: ${requestData.venue}
- Party Duration: ${requestData.duration}
${requestData.customRequests ? `- Special Requests: ${requestData.customRequests}` : ''}

Please provide activities that are:
1. Age-appropriate for ${requestData.childAge} year olds
2. Suitable for ${requestData.guestCount} children
3. Match the ${requestData.theme} theme
4. Consider ${requestData.budget} budget constraints
5. Work well in ${requestData.venue} settings

For each activity, provide:
- Creative, themed name
- Category (game, craft, creative, active, quiet, educational)
- Difficulty (easy, medium, advanced)
- Duration (realistic time estimate)
- Age appropriateness description
- Participant count
- Engaging description
- Complete materials list
- Step-by-step instructions (6-8 steps)
- Helpful tips for hosts
- Safety considerations
- Energy level (low, medium, high)
- Setup time
- Cost level (free, low, medium, high)

Return only a valid JSON array of activity objects. Make activities fun, engaging, and memorable!`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert children\'s party planner who creates fun, safe, and creative activities. Always return valid JSON arrays of activity objects.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 3000,
        temperature: 0.8
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    // Parse JSON response
    let activities: ActivitySuggestion[];
    try {
      activities = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      throw new Error('Invalid JSON response from AI');
    }

    // Validate and add IDs
    if (!Array.isArray(activities)) {
      throw new Error('AI response is not an array');
    }

    const validatedActivities = activities.map((activity, index) => ({
      ...activity,
      id: `ai-${Date.now()}-${index}`,
      // Ensure all required fields have defaults
      safetyNotes: activity.safetyNotes || [],
      tips: activity.tips || [],
      materials: activity.materials || [],
      instructions: activity.instructions || []
    }));

    console.log(`Generated ${validatedActivities.length} AI activities successfully`);
    return validatedActivities;

  } catch (error) {
    console.error('AI generation failed, falling back to defaults:', error);
    return generateDefaultActivities(requestData.theme, requestData.childAge, requestData.guestCount, requestData.budget, requestData.venue);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { partyId: string } }
) {
  try {
    const { partyId } = params;

    if (!partyId || partyId.trim() === '') {
      return NextResponse.json(
        { error: 'Invalid party ID' },
        { status: 400 }
      );
    }

    let requestData: ActivityRequest;
    try {
      requestData = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate required fields
    const requiredFields = ['theme', 'childAge', 'guestCount'];
    for (const field of requiredFields) {
      if (!requestData[field as keyof ActivityRequest]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Set defaults for optional fields
    requestData.budget = requestData.budget || 'medium';
    requestData.venue = requestData.venue || 'mixed';
    requestData.duration = requestData.duration || '2-3 hours';

    console.log('Generating activities for party:', partyId, requestData);

    // Generate activities using AI or fallback to defaults
    const activities = await generateAIActivities(requestData);

    return NextResponse.json({
      success: true,
      activities,
      generatedAt: new Date().toISOString(),
      source: process.env.OPENAI_API_KEY ? 'ai' : 'default'
    });

  } catch (error) {
    console.error('Error in activity generation API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate activities',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}