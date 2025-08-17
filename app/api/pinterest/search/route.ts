import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, theme, partyData } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Step 1: Enhance query with GPT-4.1 (if available) using comprehensive party context
    let enhancedQuery = query;
    
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      
      if (openaiApiKey) {
        // Create comprehensive context from party data for better query enhancement
        const partyContext = partyData ? {
          theme: partyData.selectedTheme || partyData.theme || theme,
          childAge: partyData.childAge,
          interests: partyData.interests || [],
          favoriteColors: partyData.favoriteColors || [],
          venue: partyData.venue,
          guestCount: partyData.guestCount
        } : { theme: theme || 'general' };

        const contextString = `Party theme: ${partyContext.theme}, Child age: ${partyContext.childAge || 'not specified'}, Interests: ${partyContext.interests.join(', ')}, Favorite colors: ${partyContext.favoriteColors.join(', ')}, Venue: ${partyContext.venue || 'not specified'}`;

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4-turbo-preview',
            messages: [
              {
                role: 'system',
                content: 'You are an expert at creating Pinterest search queries that find the most relevant and inspiring pins for birthday parties. Your goal is to transform user search terms into Pinterest-optimized keywords that match exactly what users would search for on Pinterest. Focus on specific, visual, actionable keywords. Pinterest users search for concrete items like "dinosaur cake", "princess party decorations", "superhero birthday invitations", not abstract concepts.'
              },
              {
                role: 'user',
                content: `Transform this search query into highly specific Pinterest-optimized keywords: "${query}"\n\nParty context: ${contextString}\n\nRules:\n1. Make keywords specific and visual (like Pinterest users actually search)\n2. Use the party context to enhance relevance\n3. Focus on concrete items/ideas people can create or buy\n4. Keep it concise but descriptive\n5. Examples: "dinosaur cake" not "dinosaur party ideas", "princess crown cupcakes" not "princess themed treats"\n\nReturn only the optimized search keywords:`
              }
            ],
            max_tokens: 150,
            temperature: 0.3,
          }),
        });

        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json();
          enhancedQuery = openaiData.choices?.[0]?.message?.content?.trim() || query;
        }
      }
    } catch (openaiError) {
      console.log('OpenAI enhancement failed, using enhanced manual fallback:', openaiError);
      // Fallback: Enhanced manual enhancement with party context
      enhancedQuery = enhanceQueryManually(query, theme, partyData);
    }

    // Step 2: Search Pinterest (if API token available)
    let pinterestResults: any[] = [];
    
    try {
      const pinterestToken = process.env.PINTEREST_API_KEY;
      
      if (pinterestToken) {
        // Search pins using Pinterest API v5 with optimized parameters for better relevance
        const searchParams = new URLSearchParams({
          term: enhancedQuery,
          page_size: '25',
          country_code: 'US',
          locale: 'en-US',
          // Add additional parameters to improve search quality and relevance
          search_source: 'typed_query',
          scope: 'pins'
        });

        const pinsResponse = await fetch(
          `https://api.pinterest.com/v5/search/pins?${searchParams.toString()}`,
          {
            headers: {
              'Authorization': `Bearer ${pinterestToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (pinsResponse.ok) {
          const pinsData = await pinsResponse.json();
          
          // Transform Pinterest API response to our format with enhanced categorization
          pinterestResults = (pinsData.items || []).map((pin: any) => {
            const title = pin.title || pin.description || 'Pinterest Inspiration';
            const description = pin.description || pin.title || '';
            
            return {
              id: pin.id,
              title: title,
              image_url: pin.media?.images?.['474x']?.url || 
                        pin.media?.images?.['564x']?.url || 
                        pin.media?.images?.original?.url ||
                        'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400',
              url: pin.url || `https://www.pinterest.com/pin/${pin.id}/`,
              category: categorizePinWithAI(title, description, partyData),
              description: description
            };
          });
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

function enhanceQueryManually(query: string, theme?: string, partyData?: any): string {
  const baseQuery = query.toLowerCase().trim();
  
  // Pinterest users search for specific, visual items rather than broad concepts
  // Transform broad queries into specific Pinterest-style searches
  
  // Enhanced Pinterest query mappings with party context
  const pinterestQueryMappings: { [key: string]: string } = {
    'dinosaur cake': 'dinosaur cake',
    'dinosaur': 'dinosaur birthday cake decorations',
    'princess cake': 'princess castle cake',
    'princess': 'princess birthday party decorations',
    'superhero': 'superhero birthday party ideas',
    'unicorn': 'unicorn birthday cake decorations',
    'space': 'space birthday party decorations',
    'pirate': 'pirate birthday party decorations',
    'safari': 'safari birthday party decorations',
    'ocean': 'ocean birthday party decorations'
  };
  
  // Use party context to enhance the query
  let enhancedQuery = query;
  const currentTheme = partyData?.selectedTheme || partyData?.theme || theme || '';
  const childAge = partyData?.childAge || '';
  const interests = partyData?.interests || [];
  const colors = partyData?.favoriteColors || [];
  
  // Check if query matches a specific mapping
  for (const [pattern, replacement] of Object.entries(pinterestQueryMappings)) {
    if (baseQuery.includes(pattern)) {
      enhancedQuery = replacement;
      break;
    }
  }
  
  // If theme context exists and query doesn't already include it
  if (currentTheme && !baseQuery.includes(currentTheme.toLowerCase())) {
    enhancedQuery = `${currentTheme.toLowerCase()} ${enhancedQuery}`;
  }
  
  // Add age context for relevant searches
  if (childAge && (baseQuery.includes('game') || baseQuery.includes('activity'))) {
    enhancedQuery += ` age ${childAge}`;
  }
  
  // Add color context for decoration and craft searches
  if (colors.length > 0 && (baseQuery.includes('decor') || baseQuery.includes('craft') || baseQuery.includes('diy'))) {
    enhancedQuery += ` ${colors[0]} color`;
  }
  
  // For specific items (cake, decorations, etc.), keep them Pinterest-specific
  const specificItems = ['cake', 'decoration', 'invitation', 'favor', 'costume', 'game'];
  const hasSpecificItem = specificItems.some(item => baseQuery.includes(item));
  
  if (hasSpecificItem) {
    return enhancedQuery;
  }
  
  // For general queries, add minimal but relevant context
  return enhancedQuery.includes('birthday') ? enhancedQuery : `${enhancedQuery} birthday party`;
}

function categorizePinWithAI(title?: string, description?: string, partyData?: any): string {
  // First try basic categorization for speed
  const basicCategory = categorizePin(title, description);
  
  // For now, return basic categorization (can be enhanced with GPT-4.1 later if needed)
  return basicCategory;
}

function categorizePin(title?: string, description?: string): string {
  const text = `${title || ''} ${description || ''}`.toLowerCase();
  
  // Enhanced categorization with more keywords
  if (text.includes('decor') || text.includes('decoration') || text.includes('balloon') || 
      text.includes('banner') || text.includes('backdrop') || text.includes('centerpiece') ||
      text.includes('table setting') || text.includes('party setup')) {
    return 'DECORATIONS';
  }
  if (text.includes('cake') || text.includes('dessert') || text.includes('sweet') || 
      text.includes('cupcake') || text.includes('cookie') || text.includes('treat') ||
      text.includes('candy') || text.includes('frosting')) {
    return 'CAKE';
  }
  if (text.includes('game') || text.includes('activity') || text.includes('fun') || 
      text.includes('entertainment') || text.includes('play') || text.includes('craft') ||
      text.includes('diy') || text.includes('project')) {
    return 'GAMES';
  }
  if (text.includes('invitation') || text.includes('invite') || text.includes('card') ||
      text.includes('announcement') || text.includes('rsvp')) {
    return 'INVITATIONS';
  }
  if (text.includes('costume') || text.includes('outfit') || text.includes('dress') ||
      text.includes('clothing') || text.includes('mask') || text.includes('hat') ||
      text.includes('accessories')) {
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