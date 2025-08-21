import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createServerComponentClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { activityId, partyData } = await request.json();
    
    if (!activityId || !partyData) {
      return NextResponse.json(
        { error: 'Activity ID and party data are required' },
        { status: 400 }
      );
    }

    // Get the activity details
    const activity = await prisma.birthdayActivity.findUnique({
      where: { id: activityId }
    });

    if (!activity) {
      return NextResponse.json(
        { error: 'Activity not found' },
        { status: 404 }
      );
    }

    // Check if OpenAI API key is configured
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API not configured' },
        { status: 500 }
      );
    }

    // Prepare the prompt for GPT-4.1
    const prompt = `You are a magical birthday party planning expert. I need you to create a personalized tip for a birthday party activity.

Party Context:
- Child's Name: ${partyData.childName}
- Child's Age: ${partyData.childAge} years old
- Party Theme: ${partyData.theme}
- Child's Interests: ${partyData.interests.join(', ')}
- Favorite Colors: ${partyData.favoriteColors.join(', ')}
- Venue: ${partyData.venue || 'mixed'}
- Guest Count: ${partyData.guestCount || 'unknown'}

Activity Details:
- Name: ${activity.name}
- Description: ${activity.description}
- Category: ${activity.category}
- Duration: ${activity.durationMinutes} minutes
- Effort Level: ${activity.effortLevel}
- Materials Needed: ${activity.suppliesNeeded?.join(', ') || 'minimal'}
- Age Groups: ${activity.ageGroup?.join(', ') || 'all ages'}

Please create a personalized tip that:
1. References the child's name and age specifically
2. Suggests how to adapt the activity for their theme
3. Incorporates their interests and favorite colors
4. Provides practical advice for their specific party setup
5. Makes it feel magical and special for them
6. Is written in a warm, enthusiastic tone
7. Is 2-3 sentences long

The tip should be engaging and make the parent feel excited about trying this activity with their child.`;

    try {
      // Call OpenAI GPT-4.1 API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Using GPT-4o-mini as it's more cost-effective and still very capable
          messages: [
            {
              role: 'system',
              content: 'You are a magical birthday party planning expert who creates personalized, engaging tips for parents.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 150,
          temperature: 0.8,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const personalizedTip = data.choices[0]?.message?.content?.trim();

      if (!personalizedTip) {
        throw new Error('No response from OpenAI API');
      }

      // Store the personalized tip in the database for future use (optional)
      // You could create a new table to cache these tips

      return NextResponse.json({
        personalizedTip,
        activityId,
        partyData
      });

    } catch (openaiError) {
      console.error('OpenAI API error:', openaiError);
      
      // Fallback: Generate a simple personalized tip without AI
      const fallbackTip = generateFallbackTip(activity, partyData);
      
      return NextResponse.json({
        personalizedTip: fallbackTip,
        activityId,
        partyData,
        note: 'Generated fallback tip due to AI service unavailability'
      });
    }

  } catch (error) {
    console.error('Error personalizing activity:', error);
    return NextResponse.json(
      { error: 'Failed to personalize activity' },
      { status: 500 }
    );
  }
}

// Fallback function to generate a simple personalized tip
function generateFallbackTip(activity: any, partyData: any): string {
  const { childName, childAge, theme, interests, favoriteColors } = partyData;
  
  let tip = `Hey ${childName}! This ${activity.name} activity is perfect for your ${theme} party! `;
  
  if (childAge <= 5) {
    tip += `Since you're ${childAge}, we'll make it super fun and simple. `;
  } else if (childAge <= 8) {
    tip += `At ${childAge}, you'll love the challenge and creativity! `;
  } else {
    tip += `As a ${childAge}-year-old, you'll be amazing at this! `;
  }
  
  if (favoriteColors.length > 0) {
    tip += `Try using your favorite colors (${favoriteColors.join(' and ')}) to make it extra special!`;
  } else {
    tip += `This will be the highlight of your party!`;
  }
  
  return tip;
}
