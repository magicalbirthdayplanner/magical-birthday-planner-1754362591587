import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AzureOpenAIConfig {
  apiKey: string;
  endpoint: string;
  deploymentName: string;
  apiVersion: string;
}

interface MashupIdea {
  title: string;
  description: string;
  mashupSuggestion: string;
  confidence: number;
  sourceInspirations: string[];
}

// Mock AI-generated mashup ideas for demo/fallback
function generateMockMashupIdeas(inspirations: any[], theme: string = 'princess'): MashupIdea[] {
  const mockMashups: MashupIdea[] = [
    {
      title: 'Royal Tea Party Castle',
      description: 'Combine elegant princess decorations with DIY castle centerpieces for an enchanting tea party setup',
      mashupSuggestion: 'Create a magical dining experience by placing DIY castle centerpieces on tables decorated with royal pink and gold elements. Add princess-themed tea sets and miniature crowns for each guest to create an authentic royal tea party atmosphere.',
      confidence: 92,
      sourceInspirations: ['demo-1', 'demo-2']
    },
    {
      title: 'Interactive Princess Quest',
      description: 'Merge princess party games with photo booth props for an engaging royal adventure',
      mashupSuggestion: 'Design a princess quest where guests complete royal challenges at different stations, using photo booth props as rewards and memory makers. Each completed quest earns them a photo prop and brings them closer to becoming a true princess.',
      confidence: 88,
      sourceInspirations: ['demo-4', 'demo-7']
    },
    {
      title: 'Royal Feast Experience',
      description: 'Combine princess cake ideas with themed party food for a complete royal dining experience',
      mashupSuggestion: 'Create a grand royal feast by pairing your stunning princess cake with themed finger foods, royal sandwiches cut with crown-shaped cutters, and pink lemonade served in fancy glasses. Present everything on tiered serving stands for maximum royal impact.',
      confidence: 90,
      sourceInspirations: ['demo-3', 'demo-8']
    }
  ];

  // Customize based on theme
  if (theme.toLowerCase() === 'superhero') {
    return [
      {
        title: 'Superhero Training Academy',
        description: 'Transform your space into a training facility where heroes learn new powers',
        mashupSuggestion: 'Set up different training stations with superhero decorations and action-packed activities. Create obstacle courses, strength tests, and skill challenges that make every guest feel like they\'re gaining superpowers.',
        confidence: 94,
        sourceInspirations: ['demo-superhero-1']
      }
    ];
  }

  return mockMashups;
}

async function callAzureOpenAI(prompt: string): Promise<any> {
  const config: AzureOpenAIConfig = {
    apiKey: process.env.AZURE_OPENAI_API_KEY || '',
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
    deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || '',
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview'
  };

  // Check if Azure OpenAI is configured
  if (!config.apiKey || !config.endpoint || !config.deploymentName) {
    console.log('Azure OpenAI not configured, using mock AI responses');
    throw new Error('Azure OpenAI not configured');
  }

  try {
    const url = `${config.endpoint}/openai/deployments/${config.deploymentName}/chat/completions?api-version=${config.apiVersion}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are an expert party planning AI assistant specializing in creating innovative mashup ideas from Pinterest inspirations. You analyze party themes, decorations, and activities to create unique combinations that enhance the overall party experience.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error(`Azure OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);

  } catch (error) {
    console.error('Azure OpenAI API call failed:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { partyId, inspirations, partyTheme, action } = await request.json();

    if (!partyId || !inspirations || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Handle demo mode
    if (partyId === 'demo' || partyId === 'demo-party') {
      const mockMashups = generateMockMashupIdeas(inspirations, partyTheme);
      return NextResponse.json({
        mashupIdeas: mockMashups,
        isDemo: true,
        totalCount: mockMashups.length
      });
    }

    if (action === 'generate-mashups') {
      // Verify party exists
      const party = await prisma.party.findUnique({
        where: { id: partyId }
      });

      if (!party) {
        return NextResponse.json({ error: 'Party not found' }, { status: 404 });
      }

      try {
        // Create AI prompt for mashup generation
        const inspirationTitles = inspirations.map((insp: any) => insp.title).join(', ');
        const inspirationDescriptions = inspirations.map((insp: any) => 
          `${insp.title}: ${insp.description || 'No description'}`
        ).join('\n');

        const prompt = `
Given these Pinterest party inspirations for a ${partyTheme} themed birthday party:

${inspirationDescriptions}

Generate 3 creative mashup ideas that combine these inspirations in innovative ways. 
For each mashup, provide:
1. A catchy title (max 50 characters)
2. A brief description (max 100 characters) 
3. A detailed mashup suggestion (max 300 characters)
4. A confidence score (0-100) for how well this mashup would work
5. An array of source inspiration IDs used

Respond in JSON format:
{
  "mashupIdeas": [
    {
      "title": "string",
      "description": "string", 
      "mashupSuggestion": "string",
      "confidence": number,
      "sourceInspirations": ["string"]
    }
  ]
}

Focus on practical, achievable combinations that would create memorable party experiences.
`;

        const aiResponse = await callAzureOpenAI(prompt);
        const mashupIdeas = aiResponse.mashupIdeas || [];

        // Save mashup ideas to database
        const savedMashups = await Promise.all(
          mashupIdeas.map((mashup: MashupIdea) =>
            prisma.aiMashupIdea.create({
              data: {
                title: mashup.title,
                description: mashup.description,
                mashupSuggestion: mashup.mashupSuggestion,
                confidence: mashup.confidence,
                sourceInspirations: mashup.sourceInspirations,
                partyId: partyId
              }
            })
          )
        );

        return NextResponse.json({
          mashupIdeas: savedMashups,
          isDemo: false,
          totalCount: savedMashups.length
        });

      } catch (aiError) {
        console.error('AI generation failed, using mock data:', aiError);
        
        // Fallback to mock data
        const mockMashups = generateMockMashupIdeas(inspirations, partyTheme);
        return NextResponse.json({
          mashupIdeas: mockMashups,
          isDemo: true,
          totalCount: mockMashups.length,
          fallback: true,
          message: 'Using mock AI responses - Azure OpenAI not available'
        });
      }
    }

    if (action === 'enhance-inspiration') {
      const { inspirationId } = await request.json();
      
      if (!inspirationId) {
        return NextResponse.json({ error: 'Inspiration ID required' }, { status: 400 });
      }

      try {
        // Get the specific inspiration
        const inspiration = inspirations.find((insp: any) => insp.id === inspirationId);
        if (!inspiration) {
          return NextResponse.json({ error: 'Inspiration not found' }, { status: 404 });
        }

        const prompt = `
Analyze this Pinterest inspiration for a ${partyTheme} themed birthday party:

Title: ${inspiration.title}
Description: ${inspiration.description || 'No description provided'}

Provide:
1. A category classification (GAMES, FOOD, CAKE, DECORATIONS, VENUE_STYLING, ENTERTAINMENT, ACTIVITIES, CRAFTS, FAVORS, INVITATIONS, OUTFITS, PHOTOGRAPHY)
2. An AI match score (0-100) for how well this fits the ${partyTheme} theme
3. A detailed analysis explaining why this inspiration works for the theme

Respond in JSON format:
{
  "category": "string",
  "aiMatchScore": number,
  "aiAnalysis": "string"
}
`;

        const aiResponse = await callAzureOpenAI(prompt);

        // Update inspiration with AI analysis
        if (partyId !== 'demo' && partyId !== 'demo-party') {
          await prisma.partyInspiration.update({
            where: { id: inspirationId },
            data: {
              category: aiResponse.category,
              aiMatchScore: aiResponse.aiMatchScore,
              aiAnalysis: aiResponse.aiAnalysis,
              processedAt: new Date()
            }
          });
        }

        return NextResponse.json({
          enhanced: true,
          category: aiResponse.category,
          aiMatchScore: aiResponse.aiMatchScore,
          aiAnalysis: aiResponse.aiAnalysis
        });

      } catch (aiError) {
        console.error('AI enhancement failed:', aiError);
        
        // Fallback enhancement
        return NextResponse.json({
          enhanced: true,
          category: 'DECORATIONS',
          aiMatchScore: 85,
          aiAnalysis: `This inspiration aligns well with the ${partyTheme} theme and would create a memorable party experience.`,
          fallback: true
        });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('AI expand inspiration API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}