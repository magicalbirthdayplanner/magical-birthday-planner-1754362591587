import { NextRequest, NextResponse } from 'next/server';

interface EnhanceQueryRequest {
  query: string;
  partyTheme?: string;
  childAge?: string;
}

interface EnhanceQueryResponse {
  originalQuery: string;
  enhancedQuery: string;
  isDemo: boolean;
}

// Function to call Azure OpenAI GPT-4.1 for query enhancement
async function enhanceQueryWithAI(query: string, partyTheme?: string, childAge?: string): Promise<string> {
  const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';

  if (!azureApiKey || !azureEndpoint || !deploymentName) {
    console.log('Azure OpenAI credentials not configured, using fallback enhancement');
    return generateFallbackEnhancement(query, partyTheme, childAge);
  }

  try {
    const url = `${azureEndpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;
    
    const systemPrompt = `You are an assistant that expands user keywords into rich Pinterest search queries for kids' birthday parties. Your goal is to take simple keywords and expand them into comprehensive, specific search terms that will find the best Pinterest boards and pins for party planning.

Guidelines:
- Focus on party-specific elements: decorations, table setups, cake designs, activities, favors
- Include age-appropriate details when child age is provided
- Incorporate the party theme when available
- Add descriptive adjectives that Pinterest users commonly search for
- Include popular Pinterest keywords like "DIY", "party ideas", "birthday party"
- Keep the enhanced query under 100 characters for optimal search results
- Make it natural and searchable, not just a list of keywords`;

    const userContext: string[] = [];
    if (partyTheme) userContext.push(`Party theme: ${partyTheme}`);
    if (childAge) userContext.push(`Child age: ${childAge}`);
    
    const contextString = userContext.length > 0 ? `\nContext: ${userContext.join(', ')}` : '';
    
    const userPrompt = `Original keywords: "${query}"${contextString}

Expand these keywords into a rich Pinterest search query for kids' birthday party planning. Focus on specific, searchable terms that will find the best party inspiration boards.`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${azureApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 150,
        temperature: 0.7,
        top_p: 0.9
      }),
    });

    if (!response.ok) {
      console.error(`Azure OpenAI API error: ${response.status} ${response.statusText}`);
      return generateFallbackEnhancement(query, partyTheme, childAge);
    }

    const data = await response.json();
    const enhancedQuery = data.choices?.[0]?.message?.content?.trim();

    if (!enhancedQuery) {
      console.log('No enhanced query returned from Azure OpenAI, using fallback');
      return generateFallbackEnhancement(query, partyTheme, childAge);
    }

    return enhancedQuery;

  } catch (error) {
    console.error('Azure OpenAI API call failed:', error);
    return generateFallbackEnhancement(query, partyTheme, childAge);
  }
}

// Fallback function for query enhancement when AI is not available
function generateFallbackEnhancement(query: string, partyTheme?: string, childAge?: string): string {
  const baseQuery = query.toLowerCase().trim();
  const enhancements: string[] = [];

  // Add theme context if available
  if (partyTheme && !baseQuery.includes(partyTheme.toLowerCase())) {
    enhancements.push(partyTheme);
  }

  // Add age-appropriate terms
  if (childAge) {
    const age = parseInt(childAge);
    if (age <= 3) {
      enhancements.push('toddler party');
    } else if (age <= 6) {
      enhancements.push('kids party');
    } else if (age <= 12) {
      enhancements.push('children birthday');
    }
  }

  // Add common party elements
  const partyElements = [
    'birthday party decorations',
    'party ideas',
    'table setup',
    'birthday cake designs',
    'party favors',
    'DIY party decorations'
  ];

  // Select relevant elements based on the query
  if (baseQuery.includes('decor') || baseQuery.includes('decoration')) {
    enhancements.push('party decorations', 'table setup', 'birthday balloons');
  } else if (baseQuery.includes('cake')) {
    enhancements.push('birthday cake designs', 'party cake ideas');
  } else if (baseQuery.includes('food')) {
    enhancements.push('party food ideas', 'birthday treats');
  } else {
    // General enhancement
    enhancements.push('birthday party decorations', 'party ideas', 'celebration setup');
  }

  // Combine and clean up
  const allTerms = [baseQuery, ...enhancements].join(' ');
  
  // Remove duplicates and clean up
  const words = allTerms.split(' ');
  const uniqueWords = Array.from(new Set(words));
  return uniqueWords.join(' ').substring(0, 100);
}

export async function POST(request: NextRequest) {
  try {
    const body: EnhanceQueryRequest = await request.json();
    
    if (!body.query || body.query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const enhancedQuery = await enhanceQueryWithAI(
      body.query,
      body.partyTheme,
      body.childAge
    );

    const response: EnhanceQueryResponse = {
      originalQuery: body.query,
      enhancedQuery: enhancedQuery,
      isDemo: !process.env.AZURE_OPENAI_API_KEY
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Query enhancement API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // For testing purposes - return API status
  return NextResponse.json({
    service: 'Pinterest Query Enhancement',
    status: 'operational',
    aiEnabled: !!process.env.AZURE_OPENAI_API_KEY,
    version: '1.0.0'
  });
}