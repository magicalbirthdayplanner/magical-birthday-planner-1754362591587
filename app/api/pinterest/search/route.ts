import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, theme } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Step 1: Enhance query with GPT-4.1 (if available)
    let enhancedQuery = query;
    
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      
      if (openaiApiKey) {
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [
              {
                role: 'system',
                content: 'You are enhancing search queries for Pinterest birthday inspiration. Given theme, colors, preferences, and party details, generate the most relevant Pinterest search query. Return a short keyword string only, optimized for Pinterest search.'
              },
              {
                role: 'user',
                content: `Enhance this Pinterest query for a kids' birthday party context: "${query}". Theme: ${theme || 'general'}. Return only a short search string.`
              }
            ],
            max_tokens: 100,
            temperature: 0.7,
          }),
        });

        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json();
          enhancedQuery = openaiData.choices?.[0]?.message?.content?.trim() || query;
        }
      }
    } catch (openaiError) {
      console.log('OpenAI enhancement failed, using original query:', openaiError);
      // Fallback: Manual enhancement
      enhancedQuery = enhanceQueryManually(query, theme);
    }

    // Step 2: Search Pinterest (if API token available)
    let pinterestResults: any[] = [];
    
    try {
      const pinterestToken = process.env.PINTEREST_API_KEY;
      
      if (pinterestToken) {
        // Search pins
        const pinsResponse = await fetch(
          `https://api.pinterest.com/v5/search/pins?query=${encodeURIComponent(enhancedQuery)}&page_size=20`,
          {
            headers: {
              'Authorization': `Bearer ${pinterestToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (pinsResponse.ok) {
          const pinsData = await pinsResponse.json();
          
          // Transform Pinterest API response to our format
          pinterestResults = (pinsData.items || []).map((pin: any) => ({
            id: pin.id,
            title: pin.title || pin.description || 'Pinterest Inspiration',
            image_url: pin.media?.images?.['474x']?.url || pin.media?.images?.original?.url,
            url: pin.url || `https://www.pinterest.com/pin/${pin.id}`,
            category: categorizePin(pin.title, pin.description),
            description: pin.description || pin.title
          }));
        }
      }
    } catch (pinterestError) {
      console.log('Pinterest API failed, using demo data:', pinterestError);
    }

    // Step 3: Fallback to demo data if no Pinterest results
    if (pinterestResults.length === 0) {
      pinterestResults = generateDemoData(enhancedQuery, theme);
    }

    // Step 4: Categorize results for better filtering
    const categorizedResults = {
      defaultQuery: enhancedQuery,
      defaultResults: categorizePinterestResults(pinterestResults)
    };

    return NextResponse.json({
      query_used: enhancedQuery,
      results: pinterestResults,
      categorized: categorizedResults
    });

  } catch (error) {
    console.error('Pinterest search error:', error);
    return NextResponse.json(
      { error: 'Failed to search Pinterest inspiration' },
      { status: 500 }
    );
  }
}

function enhanceQueryManually(query: string, theme?: string): string {
  const baseQuery = query.toLowerCase();
  const themeContext = theme ? `${theme} ` : '';
  
  // Add birthday party context if not present
  if (!baseQuery.includes('birthday') && !baseQuery.includes('party')) {
    return `${themeContext}${query} birthday party ideas`;
  }
  
  // Enhanced context words for better Pinterest results - more specific and Pinterest-friendly
  const contextWords = ['kids', 'children', 'decorations', 'DIY', 'celebration', 'inspiration', 'ideas', 'cute', 'fun'];
  const categoryKeywords = ['decor', 'cake', 'game', 'activity', 'invitation', 'printable', 'costume', 'favor'];
  
  // Check if query already has contextual keywords
  const hasContext = contextWords.some(word => baseQuery.includes(word));
  const hasCategory = categoryKeywords.some(word => baseQuery.includes(word));
  
  let enhancedQuery = `${themeContext}${query}`;
  
  // Add context if missing
  if (!hasContext) {
    enhancedQuery += ' kids birthday party ideas';
  }
  
  // Add Pinterest-specific search terms for better discovery
  if (!baseQuery.includes('pinterest') && !baseQuery.includes('inspiration')) {
    enhancedQuery += ' inspiration';
  }
  
  return enhancedQuery.trim();
}

function categorizePin(title?: string, description?: string): string {
  const text = `${title || ''} ${description || ''}`.toLowerCase();
  
  if (text.includes('decor') || text.includes('decoration') || text.includes('balloon')) {
    return 'DECORATIONS';
  }
  if (text.includes('cake') || text.includes('dessert') || text.includes('sweet')) {
    return 'CAKE';
  }
  if (text.includes('game') || text.includes('activity') || text.includes('fun')) {
    return 'GAMES';
  }
  if (text.includes('invitation') || text.includes('invite')) {
    return 'INVITATIONS';
  }
  if (text.includes('costume') || text.includes('outfit') || text.includes('dress')) {
    return 'COSTUMES';
  }
  
  return 'GENERAL';
}

function categorizePinterestResults(pins: any[]) {
  return {
    decorations: pins.filter(pin => pin.category === 'DECORATIONS'),
    cakes: pins.filter(pin => pin.category === 'CAKE'),
    games: pins.filter(pin => pin.category === 'GAMES'),
    invitations: pins.filter(pin => pin.category === 'INVITATIONS'),
    costumes: pins.filter(pin => pin.category === 'COSTUMES'),
    general: pins.filter(pin => pin.category === 'GENERAL')
  };
}

function generateDemoData(query: string, theme?: string): any[] {
  const themeTitle = theme ? theme.charAt(0).toUpperCase() + theme.slice(1) : 'Birthday';
  
  return [
    {
      id: 'demo-1',
      title: `${themeTitle} Party Decorations - ${query}`,
      image_url: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&h=400&fit=crop',
      url: 'https://www.pinterest.com',
      category: 'DECORATIONS',
      description: `Beautiful ${themeTitle.toLowerCase()} themed party decorations and setup ideas`
    },
    {
      id: 'demo-2',
      title: `${themeTitle} Birthday Cake Ideas`,
      image_url: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=400&h=400&fit=crop',
      url: 'https://www.pinterest.com',
      category: 'CAKE',
      description: `Amazing ${themeTitle.toLowerCase()} birthday cake designs and inspiration`
    },
    {
      id: 'demo-3',
      title: `${themeTitle} Party Games & Activities`,
      image_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop',
      url: 'https://www.pinterest.com',
      category: 'GAMES',
      description: `Fun ${themeTitle.toLowerCase()} themed party games and activities for kids`
    },
    {
      id: 'demo-4',
      title: `${themeTitle} Party Invitations`,
      image_url: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=400&fit=crop',
      url: 'https://www.pinterest.com',
      category: 'INVITATIONS',
      description: `Creative ${themeTitle.toLowerCase()} party invitation templates and designs`
    },
    {
      id: 'demo-5',
      title: `${themeTitle} Party Costumes & Outfits`,
      image_url: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=400&fit=crop',
      url: 'https://www.pinterest.com',
      category: 'COSTUMES',
      description: `Adorable ${themeTitle.toLowerCase()} themed costume ideas for party guests`
    },
    {
      id: 'demo-6',
      title: `DIY ${themeTitle} Party Crafts`,
      image_url: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=400&fit=crop',
      url: 'https://www.pinterest.com',
      category: 'GENERAL',
      description: `Easy DIY crafts and projects for ${themeTitle.toLowerCase()} themed parties`
    }
  ];
}