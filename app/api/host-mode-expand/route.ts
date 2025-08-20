import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { partyId, activityId } = await request.json();
    console.log('Host mode expand request:', { partyId, activityId });

    if (!partyId || !activityId) {
      console.log('Missing required fields:', { partyId, activityId });
      return NextResponse.json(
        { error: 'Missing required fields: partyId and activityId are required' },
        { status: 400 }
      );
    }

    // Get the activity and party data
    const activity = await prisma.partyActivity.findFirst({
      where: { id: activityId, partyId },
      include: { party: true }
    });

    if (!activity) {
      console.log('Activity not found:', { activityId, partyId });
      return NextResponse.json(
        { error: 'Activity not found for the specified party' },
        { status: 404 }
      );
    }

    console.log('Found activity:', activity.name);

    // Get Azure OpenAI configuration
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

    if (!apiKey || !endpoint || !deploymentName) {
      console.log('AI service not configured:', { 
        hasApiKey: !!apiKey, 
        hasEndpoint: !!endpoint, 
        hasDeployment: !!deploymentName 
      });
      return NextResponse.json(
        { error: 'AI service not configured. Please check environment variables.' },
        { status: 500 }
      );
    }

    // Create the Host Mode expansion prompt
    const prompt = createHostModePrompt(activity, activity.party);
    console.log('Generated prompt for AI:', prompt.substring(0, 200) + '...');

    // Call Azure OpenAI
    console.log('Calling Azure OpenAI...');
    const response = await fetch(
      `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are an expert party host and event coordinator specializing in children\'s birthday parties. Your role is to transform basic activity ideas into fully-scripted, engaging experiences that parents can confidently host.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.8,
          top_p: 0.9,
        }),
      }
    );

    console.log('Azure OpenAI response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Azure OpenAI error response:', errorText);
      throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    console.log('AI response content preview:', content?.substring(0, 200) + '...');

    if (!content) {
      console.error('No content in AI response:', data);
      throw new Error('No content received from AI');
    }

    // Parse the AI response
    console.log('Parsing AI response...');
    const expandedActivity = parseHostModeResponse(content, activity);
    console.log('Parsed activity data:', {
      themeEmoji: expandedActivity.themeEmoji,
      themeContext: expandedActivity.themeContext?.substring(0, 50) + '...',
      energyLevel: expandedActivity.energyLevel,
      scriptLength: expandedActivity.stepByStepScript?.length || 0,
      soundCuesCount: expandedActivity.soundCues?.length || 0
    });

    // Update the activity in the database
    console.log('Updating activity in database...');
    const updatedActivity = await prisma.partyActivity.update({
      where: { id: activityId },
      data: {
        themeEmoji: expandedActivity.themeEmoji,
        themeContext: expandedActivity.themeContext,
        stepByStepScript: expandedActivity.stepByStepScript,
        soundCues: expandedActivity.soundCues,
        energyLevel: expandedActivity.energyLevel,
        isHostModeReady: true,
        updatedAt: new Date(),
      },
    });

    console.log('Activity updated successfully:', updatedActivity.id);

    return NextResponse.json({
      success: true,
      activity: updatedActivity,
    });

  } catch (error) {
    console.error('Host Mode expansion error:', error);
    return NextResponse.json(
      { error: `Failed to expand activity for Host Mode: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

function createHostModePrompt(activity: any, party: any) {
  return `Transform this basic activity into a full Host Mode experience for "${party.childName}'s ${party.childAge}-year-old ${party.theme} birthday party:

ACTIVITY TO EXPAND:
Name: ${activity.name}
Description: ${activity.description || 'No description provided'}
Supplies: ${activity.supplies.join(', ') || 'None specified'}
Estimated Time: ${activity.estimatedTime || 'Not specified'} ${activity.timeUnit}
Host Script: ${activity.hostScript || 'No script provided'}

COMPREHENSIVE PARTY CONTEXT FROM WIZARD STEPS 1-5:
- Child Details: ${party.childName}, age ${party.childAge}, ${party.gender || 'child'}
- Party Date: ${party.partyDate || 'Not specified'}
- Theme: ${party.theme}
- Child's Interests: ${party.interests?.join(', ') || 'Not specified'}
- Favorite Colors: ${party.favoriteColors?.join(', ') || 'Not specified'}
- Budget: ${party.budget ? `${party.currency || '$'}${party.budget}` : 'Not specified'}
- Location: ${party.location || 'Not specified'}
- Venue Type: ${party.venueType || 'Not specified'}
- Party Duration: ${party.duration || 'Not specified'}
- Guest Count: ${party.guestCount || 'Not specified'}
- Special Requirements: ${party.specialRequirements || 'None specified'}

Please provide a JSON response with the following structure:
{
  "themeEmoji": "🦸‍♂️",
  "themeContext": "Brief setting description to immerse kids in the theme world",
  "stepByStepScript": "Detailed teleprompter script with stage directions in brackets like [say in excited voice] and clear dialogue for the parent to read aloud",
  "soundCues": ["Play superhero theme music", "Use 'whoosh' sound effects", "Play victory fanfare"],
  "energyLevel": "HIGH_ENERGY" | "ACTIVE" | "MEDIUM" | "CALM"
}

CRITICAL REQUIREMENTS:
1. Personalization: Use ${party.childName}'s specific interests (${party.interests?.join(', ') || 'general fun'}) and favorite colors (${party.favoriteColors?.join(', ') || 'colorful'}) throughout the script
2. Theme Integration: Make everything fit the ${party.theme} theme perfectly with immersive storytelling
3. Age Appropriate: Content must be perfect for ${party.childAge}-year-olds with appropriate complexity and language
4. Venue Optimization: Adapt the activity for ${party.venueType || 'any'} venue type with specific space considerations
5. Duration Awareness: Design the activity to fit within ${party.duration || 'flexible timing'} and engage ${party.guestCount || 'a group of'} children
6. Teleprompter Ready: Script should be written in 2nd person with clear stage directions in brackets
7. Immersive Experience: Create a narrative that makes kids feel part of the theme world
8. Sound Enhancement: Suggest specific music/sound effects that enhance the ${party.theme} theme experience
9. Energy Classification: Choose energy level based on activity type, venue, and group size
10. Budget Conscious: Keep supplies realistic within the party's context and budget considerations

SCRIPT FORMAT EXAMPLE:
"[gather all the little heroes in a circle] Welcome, brave superheroes! Today we need your help to save the city! [point dramatically toward the 'mission area'] Can you see that? The villain has hidden the power crystals, and only the strongest heroes can find them! [pause for excitement] Are you ready for this epic quest? Let me hear your best superhero battle cry!"

Make it magical, engaging, and easy for parents to execute confidently!`;
}

function parseHostModeResponse(content: string, originalActivity: any) {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(content);
    
    return {
      themeEmoji: parsed.themeEmoji || '🎉',
      themeContext: parsed.themeContext || 'An exciting party activity experience',
      stepByStepScript: parsed.stepByStepScript || originalActivity.hostScript || 'Activity script needs to be developed',
      soundCues: Array.isArray(parsed.soundCues) ? parsed.soundCues : [],
      energyLevel: ['CALM', 'ACTIVE', 'HIGH_ENERGY', 'MEDIUM'].includes(parsed.energyLevel) 
        ? parsed.energyLevel 
        : 'MEDIUM'
    };
  } catch (e) {
    // If JSON parsing fails, extract information manually
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    
    let themeEmoji = '🎉';
    let themeContext = 'An exciting party activity experience';
    let stepByStepScript = originalActivity.hostScript || 'Activity script needs to be developed';
    let soundCues: string[] = [];
    let energyLevel = 'MEDIUM';

    // Extract emoji
    const emojiMatch = content.match(/[🎉🦸‍♂️👑🦕🚀🦁🌊🏴‍☠️🦄]/);
    if (emojiMatch) themeEmoji = emojiMatch[0];

    // Extract theme context
    const contextMatch = content.match(/theme context[:\s]*([^.\n]+)/i);
    if (contextMatch) themeContext = contextMatch[1].trim();

    // Extract script
    const scriptMatch = content.match(/script[:\s]*([^}]+)/i);
    if (scriptMatch) stepByStepScript = scriptMatch[1].trim();

    // Extract sound cues
    const soundMatches = content.match(/sound[s]?[:\s]*\[(.*?)\]/i);
    if (soundMatches) {
      soundCues = soundMatches[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
    }

    // Extract energy level
    const energyMatch = content.match(/energy[:\s]*(CALM|ACTIVE|HIGH_ENERGY|MEDIUM)/i);
    if (energyMatch) energyLevel = energyMatch[1].toUpperCase();

    return {
      themeEmoji,
      themeContext,
      stepByStepScript,
      soundCues,
      energyLevel
    };
  }
}