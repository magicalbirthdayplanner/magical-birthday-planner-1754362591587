import { NextRequest, NextResponse } from 'next/server';

interface PinterestSearchResult {
  title: string;
  link: string;
  image_url: string;
}

interface SearchResponse {
  query_used: string;
  results: PinterestSearchResult[];
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    // Step 1: Enhance query with GPT-4.1
    const enhancedQuery = await enhanceQueryWithGPT(query);
    
    // Step 2: Search Pinterest with enhanced query
    const pinterestResults = await searchPinterestAPI(enhancedQuery);

    // Step 3: Return combined results
    const response: SearchResponse = {
      query_used: enhancedQuery,
      results: pinterestResults
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Pinterest search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function enhanceQueryWithGPT(originalQuery: string): Promise<string> {
  const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';

  // If Azure OpenAI not configured, return enhanced query manually
  if (!azureApiKey || !azureEndpoint || !deploymentName) {
    console.log('Azure OpenAI not configured, using manual enhancement');
    return enhanceQueryManually(originalQuery);
  }

  try {
    const url = `${azureEndpoint}openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': azureApiKey,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are an assistant that expands user keywords into rich Pinterest search queries for kids\' birthday parties. Expand the query to include related decorations, themes, colors, activities, and party elements. Keep it concise but comprehensive. Return only the enhanced search query, nothing else.'
          },
          {
            role: 'user',
            content: originalQuery
          }
        ],
        max_tokens: 100,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      console.error(`Azure OpenAI API error: ${response.status}`);
      return enhanceQueryManually(originalQuery);
    }

    const data = await response.json();
    const enhancedQuery = data.choices?.[0]?.message?.content?.trim();
    
    if (enhancedQuery) {
      console.log(`GPT enhanced query: "${originalQuery}" → "${enhancedQuery}"`);
      return enhancedQuery;
    }

    return enhanceQueryManually(originalQuery);

  } catch (error) {
    console.error('GPT enhancement failed:', error);
    return enhanceQueryManually(originalQuery);
  }
}

function enhanceQueryManually(query: string): string {
  const queryLower = query.toLowerCase();
  let enhanced = query;

  // Add common birthday party terms
  if (!queryLower.includes('birthday') && !queryLower.includes('party')) {
    enhanced += ' birthday party';
  }

  // Add specific enhancements based on theme detection
  if (queryLower.includes('cinderella')) {
    enhanced += ' princess birthday decorations, Disney princess party theme, royal birthday balloons, cake table setup';
  } else if (queryLower.includes('space') || queryLower.includes('astronaut')) {
    enhanced += ' space birthday decorations, galaxy party theme, astronaut party supplies, space themed balloons';
  } else if (queryLower.includes('superhero')) {
    enhanced += ' superhero birthday decorations, comic book party theme, hero party supplies, action hero balloons';
  } else if (queryLower.includes('princess')) {
    enhanced += ' princess birthday decorations, royal party theme, pink balloons, castle cake';
  } else if (queryLower.includes('dinosaur')) {
    enhanced += ' dinosaur birthday decorations, prehistoric party theme, dino balloons, fossil cake';
  } else if (queryLower.includes('unicorn')) {
    enhanced += ' unicorn birthday decorations, rainbow party theme, magical balloons, unicorn cake';
  } else {
    // Generic enhancement
    enhanced += ' decorations, balloons, cake ideas, party supplies, table setup';
  }

  console.log(`Manual enhanced query: "${query}" → "${enhanced}"`);
  return enhanced;
}

async function searchPinterestAPI(query: string): Promise<PinterestSearchResult[]> {
  const pinterestApiKey = process.env.PINTEREST_API_KEY;

  // If Pinterest API not configured, return mock data
  if (!pinterestApiKey) {
    console.log('Pinterest API key not configured, returning mock data');
    return generateMockResults(query);
  }

  try {
    // Search both pins and boards in parallel
    const [pinsResponse, boardsResponse] = await Promise.all([
      searchPinterestPins(query, pinterestApiKey),
      searchPinterestBoards(query, pinterestApiKey)
    ]);

    // Combine and limit results
    const combinedResults = [
      ...pinsResponse.slice(0, 8), // Take first 8 pins
      ...boardsResponse.slice(0, 4)  // Take first 4 boards
    ];

    if (combinedResults.length > 0) {
      return combinedResults;
    }

    // Fallback to mock data if no results
    return generateMockResults(query);

  } catch (error) {
    console.error('Pinterest API search failed:', error);
    return generateMockResults(query);
  }
}

async function searchPinterestPins(query: string, apiKey: string): Promise<PinterestSearchResult[]> {
  const url = `https://api.pinterest.com/v5/search/pins/?query=${encodeURIComponent(query)}&page_size=20`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }
  });

  if (!response.ok) {
    throw new Error(`Pinterest pins search failed: ${response.status}`);
  }

  const data = await response.json();
  
  return (data.items || []).map((pin: any) => ({
    title: pin.title || 'Pinterest Pin',
    link: pin.link || `https://www.pinterest.com/pin/${pin.id}/`,
    image_url: pin.media?.images?.original?.url || pin.media?.images?.['736x']?.url || ''
  })).filter((item: PinterestSearchResult) => item.image_url);
}

async function searchPinterestBoards(query: string, apiKey: string): Promise<PinterestSearchResult[]> {
  const url = `https://api.pinterest.com/v5/search/boards/?query=${encodeURIComponent(query)}&page_size=10`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }
  });

  if (!response.ok) {
    throw new Error(`Pinterest boards search failed: ${response.status}`);
  }

  const data = await response.json();
  
  return (data.items || []).map((board: any) => ({
    title: board.name || 'Pinterest Board',
    link: `https://www.pinterest.com/${board.owner?.username || 'pinterest'}/${board.name?.replace(/\s+/g, '-').toLowerCase() || board.id}/`,
    image_url: board.media?.image_cover_url || ''
  })).filter((item: PinterestSearchResult) => item.image_url);
}

function generateMockResults(query: string): PinterestSearchResult[] {
  const queryLower = query.toLowerCase();
  
  // Determine theme for mock data
  let theme = 'party';
  if (queryLower.includes('cinderella') || queryLower.includes('princess')) {
    theme = 'princess';
  } else if (queryLower.includes('space') || queryLower.includes('astronaut')) {
    theme = 'space';
  } else if (queryLower.includes('superhero')) {
    theme = 'superhero';
  } else if (queryLower.includes('dinosaur')) {
    theme = 'dinosaur';
  } else if (queryLower.includes('unicorn')) {
    theme = 'unicorn';
  }

  const mockData: Record<string, PinterestSearchResult[]> = {
    princess: [
      {
        title: 'Cinderella Birthday Party Ideas',
        link: 'https://www.pinterest.com/pin/princess-birthday-party-decorations/',
        image_url: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop'
      },
      {
        title: 'Disney Princess Decor',
        link: 'https://www.pinterest.com/board/disney-princess-party/',
        image_url: 'https://images.unsplash.com/photo-1587691592099-24045742c181?w=400&h=300&fit=crop'
      },
      {
        title: 'Royal Castle Centerpieces',
        link: 'https://www.pinterest.com/pin/princess-castle-decorations/',
        image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop'
      },
      {
        title: 'Princess Birthday Cake Ideas',
        link: 'https://www.pinterest.com/board/princess-birthday-cakes/',
        image_url: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&h=300&fit=crop'
      }
    ],
    space: [
      {
        title: 'Galaxy Birthday Decorations',
        link: 'https://www.pinterest.com/pin/space-birthday-party/',
        image_url: 'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=400&h=300&fit=crop'
      },
      {
        title: 'Astronaut Party Ideas',
        link: 'https://www.pinterest.com/board/astronaut-birthday-party/',
        image_url: 'https://images.unsplash.com/photo-1581822261290-991b38693d1b?w=400&h=300&fit=crop'
      },
      {
        title: 'Solar System Cake',
        link: 'https://www.pinterest.com/pin/galaxy-space-cake/',
        image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop'
      },
      {
        title: 'Space Party Games',
        link: 'https://www.pinterest.com/board/space-party-activities/',
        image_url: 'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?w=400&h=300&fit=crop'
      }
    ],
    superhero: [
      {
        title: 'Superhero Birthday Decorations',
        link: 'https://www.pinterest.com/pin/superhero-party-decorations/',
        image_url: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop'
      },
      {
        title: 'Comic Book Party Theme',
        link: 'https://www.pinterest.com/board/comic-book-birthday/',
        image_url: 'https://images.unsplash.com/photo-1587691592099-24045742c181?w=400&h=300&fit=crop'
      }
    ],
    party: [
      {
        title: 'Birthday Party Decorations',
        link: 'https://www.pinterest.com/pin/birthday-party-ideas/',
        image_url: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop'
      },
      {
        title: 'Kids Party Ideas',
        link: 'https://www.pinterest.com/board/kids-birthday-party/',
        image_url: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&h=300&fit=crop'
      },
      {
        title: 'Birthday Cake Ideas',
        link: 'https://www.pinterest.com/pin/birthday-cake-designs/',
        image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop'
      },
      {
        title: 'Party Games & Activities',
        link: 'https://www.pinterest.com/board/birthday-party-games/',
        image_url: 'https://images.unsplash.com/photo-1581822261290-991b38693d1b?w=400&h=300&fit=crop'
      }
    ]
  };

  return mockData[theme] || mockData.party;
}