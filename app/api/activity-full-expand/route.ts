import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { partyId, activityId } = await request.json();
    console.log('Full activity expansion request:', { partyId, activityId });

    if (!partyId || !activityId) {
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
      return NextResponse.json(
        { error: 'Activity not found for the specified party' },
        { status: 404 }
      );
    }

    // Get Azure OpenAI configuration
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';

    if (!apiKey || !endpoint || !deploymentName) {
      return NextResponse.json(
        { error: 'AI service not configured. Please check environment variables.' },
        { status: 500 }
      );
    }

    // Create the comprehensive expansion prompt
    const prompt = createComprehensiveExpansionPrompt(activity, activity.party);

    // Call Azure OpenAI
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
              content: 'You are an expert party planner and host specializing in children\'s birthday parties. You create comprehensive, contextual activity guides that include detailed scripts, materials lists, rules, and parent tips. Your content is engaging, age-appropriate, and perfectly tailored to the specific party theme and context.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 4000,
          temperature: 0.8,
          top_p: 0.9,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Azure OpenAI error response:', errorText);
      throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content received from AI');
    }

    // Parse the AI response
    const expandedContent = parseComprehensiveResponse(content, activity);

    // Update the activity in the database
    const updatedActivity = await prisma.partyActivity.update({
      where: { id: activityId },
      data: {
        fullHostScript: expandedContent.fullHostScript,
        rulesAndVariations: expandedContent.rulesAndVariations,
        materialsList: expandedContent.materialsList,
        optionalExtras: expandedContent.optionalExtras,
        isFullyExpanded: true,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      activity: updatedActivity,
      expandedContent,
    });

  } catch (error) {
    console.error('Full activity expansion error:', error);
    return NextResponse.json(
      { error: `Failed to expand activity: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

function createComprehensiveExpansionPrompt(activity: any, party: any) {
  return `Create comprehensive activity content for "${activity.name}" for ${party.childName}'s ${party.childAge}-year-old ${party.theme} birthday party.

ACTIVITY TO EXPAND:
Name: ${activity.name}
Description: ${activity.description || 'No description provided'}
Supplies: ${activity.supplies?.join(', ') || 'None specified'}
Estimated Time: ${activity.estimatedTime || 'Not specified'} ${activity.timeUnit}

PARTY CONTEXT FROM WIZARD STEPS 1-5:
- Child: ${party.childName}, age ${party.childAge}, ${party.gender || 'child'}
- Theme: ${party.theme}
- Interests: ${party.interests?.join(', ') || 'general fun'}
- Favorite Colors: ${party.favoriteColors?.join(', ') || 'colorful'}
- Guest Count: ${party.guestCount || 12} children
- Venue: ${party.venueType || 'mixed'} venue
- Duration: ${party.duration || 'flexible'}
- Location: ${party.location || 'party location'}

Please provide a JSON response with ALL FOUR sections:

{
  "fullHostScript": "Energetic, fun host read-aloud script with stage directions in brackets [like this]. Make it engaging, use ${party.childName}'s name and interests, incorporate ${party.theme} theme elements, and include crowd participation moments.",
  
  "rulesAndVariations": {
    "baseRules": ["Rule 1", "Rule 2", "Rule 3"],
    "ageVariations": {
      "toddlers_2_4": "Adaptation for 2-4 year olds",
      "young_kids_5_7": "Adaptation for 5-7 year olds", 
      "older_kids_8_12": "Adaptation for 8-12 year olds"
    },
    "groupSizeAdjustments": {
      "small_group_5_8": "How to adapt for 5-8 kids",
      "large_group_15_25": "How to adapt for 15-25 kids"
    },
    "spaceAdjustments": {
      "indoor": "Indoor space modifications with mess control",
      "outdoor": "Outdoor setup with weather considerations"
    }
  },
  
  "materialsList": {
    "craftMaterials": [
      {"item": "Material name", "quantity": "Amount for ${party.guestCount || 12} kids", "purpose": "What it's for"}
    ],
    "extras": [
      {"item": "Optional item", "purpose": "Enhancement purpose"}
    ],
    "prepReminders": [
      "Pre-party preparation step 1",
      "Pre-party preparation step 2"
    ]
  },
  
  "optionalExtras": {
    "prepTime": "X mins before party",
    "playTime": "X-X mins depending on group size", 
    "messFactor": "Low/Medium/High (explanation)",
    "adultInvolvement": "Minimal/Moderate/High (specific help needed)"
  }
}

CRITICAL REQUIREMENTS:
1. Use ${party.childName}'s name throughout the script
2. Incorporate ${party.theme} theme deeply into all content
3. Reference ${party.interests?.join(', ') || 'their interests'} and ${party.favoriteColors?.join(', ') || 'their favorite colors'}
4. Make content age-appropriate for ${party.childAge}-year-olds
5. Adapt for ${party.guestCount || 12} children in ${party.venueType || 'any'} venue
6. Script should be 2nd person with clear stage directions in brackets
7. Materials list should be specific quantities for the guest count
8. Include theme-specific sound effects and engagement techniques

Make it magical, personalized, and easy for parents to execute!`;
}

function parseComprehensiveResponse(content: string, originalActivity: any) {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(content);
    
    return {
      fullHostScript: parsed.fullHostScript || 'Host script needs to be developed',
      rulesAndVariations: parsed.rulesAndVariations || {
        baseRules: ['Activity rules need to be defined'],
        ageVariations: {},
        groupSizeAdjustments: {},
        spaceAdjustments: {}
      },
      materialsList: parsed.materialsList || {
        craftMaterials: [],
        extras: [],
        prepReminders: []
      },
      optionalExtras: parsed.optionalExtras || {
        prepTime: 'Not specified',
        playTime: 'Variable',
        messFactor: 'Medium',
        adultInvolvement: 'Moderate'
      }
    };
  } catch (e) {
    console.error('Failed to parse AI response as JSON:', e);
    
    // Fallback parsing for non-JSON responses
    return {
      fullHostScript: extractScriptFromText(content) || 'Host script needs to be developed',
      rulesAndVariations: {
        baseRules: ['Activity rules need to be defined'],
        ageVariations: {},
        groupSizeAdjustments: {},
        spaceAdjustments: {}
      },
      materialsList: {
        craftMaterials: [],
        extras: [],
        prepReminders: []
      },
      optionalExtras: {
        prepTime: 'Not specified',
        playTime: 'Variable',
        messFactor: 'Medium',
        adultInvolvement: 'Moderate'
      }
    };
  }
}

function extractScriptFromText(content: string): string | null {
  // Try to extract script-like content from text
  const scriptMatch = content.match(/script[:\s]*([^}]+)/i);
  if (scriptMatch) {
    return scriptMatch[1].trim();
  }
  
  // Look for text with stage directions in brackets
  const stageDirectionMatch = content.match(/\[.*?\].*?[.!?]/g);
  if (stageDirectionMatch && stageDirectionMatch.length > 0) {
    return stageDirectionMatch.join(' ');
  }
  
  return null;
}