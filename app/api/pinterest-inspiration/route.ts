import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PinterestBoard {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  pinterestUrl: string;
  pinCount?: number;
  followers?: number;
  category?: string;
  aiMatchScore?: number;
  aiAnalysis?: string;
}

// Mock Pinterest data for demo/fallback purposes
function generateMockPinterestData(theme: string = 'princess'): PinterestBoard[] {
  const mockBoards: Record<string, PinterestBoard[]> = {
    princess: [
      {
        id: 'demo-1',
        title: 'Princess Birthday Party Decorations',
        description: 'Magical pink and gold princess decorations for the perfect royal celebration',
        imageUrl: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop',
        pinterestUrl: 'https://www.pinterest.com/search/pins/?q=princess%20birthday%20decorations',
        pinCount: 847,
        followers: 1200,
        category: 'DECORATIONS',
        aiMatchScore: 95,
        aiAnalysis: 'Perfect match for princess theme with royal decorations and pink color scheme'
      },
      {
        id: 'demo-2',
        title: 'DIY Princess Castle Centerpieces',
        description: 'Easy DIY castle centerpieces that will make any princess feel like royalty',
        imageUrl: 'https://images.unsplash.com/photo-1587691592099-24045742c181?w=400&h=300&fit=crop',
        pinterestUrl: 'https://www.pinterest.com/search/pins/?q=diy%20princess%20castle%20centerpiece',
        pinCount: 324,
        followers: 856,
        category: 'CRAFTS',
        aiMatchScore: 88,
        aiAnalysis: 'Great DIY project for creating magical castle decorations'
      },
      {
        id: 'demo-3',
        title: 'Princess Birthday Cake Ideas',
        description: 'Stunning princess cakes that will be the highlight of the royal celebration',
        imageUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop',
        pinterestUrl: 'https://www.pinterest.com/search/pins/?q=princess%20birthday%20cake',
        pinCount: 1250,
        followers: 2100,
        category: 'CAKE',
        aiMatchScore: 92,
        aiAnalysis: 'Beautiful princess-themed cakes perfect for creating magical birthday memories'
      },
      {
        id: 'demo-4',
        title: 'Princess Party Games & Activities',
        description: 'Fun royal games and activities to entertain little princesses',
        imageUrl: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&h=300&fit=crop',
        pinterestUrl: 'https://www.pinterest.com/search/pins/?q=princess%20party%20games',
        pinCount: 567,
        followers: 945,
        category: 'GAMES',
        aiMatchScore: 85,
        aiAnalysis: 'Engaging princess-themed activities perfect for party entertainment'
      },
      {
        id: 'demo-5',
        title: 'Royal Princess Party Favors',
        description: 'Magical party favors that every little guest will treasure',
        imageUrl: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop',
        pinterestUrl: 'https://www.pinterest.com/search/pins/?q=princess%20party%20favors',
        pinCount: 423,
        followers: 678,
        category: 'FAVORS',
        aiMatchScore: 80,
        aiAnalysis: 'Lovely princess-themed favors that guests will love to take home'
      },
      {
        id: 'demo-6',
        title: 'Princess Birthday Invitation Ideas',
        description: 'Elegant invitation designs fit for a royal celebration',
        imageUrl: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop',
        pinterestUrl: 'https://www.pinterest.com/search/pins/?q=princess%20birthday%20invitations',
        pinCount: 234,
        followers: 456,
        category: 'INVITATIONS',
        aiMatchScore: 78,
        aiAnalysis: 'Beautiful royal invitation designs that set the perfect tone'
      },
      {
        id: 'demo-7',
        title: 'Princess Photo Booth Props',
        description: 'Fun photo props to capture magical princess party memories',
        imageUrl: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop',
        pinterestUrl: 'https://www.pinterest.com/search/pins/?q=princess%20photo%20booth%20props',
        pinCount: 189,
        followers: 312,
        category: 'PHOTOGRAPHY',
        aiMatchScore: 75,
        aiAnalysis: 'Creative photo props perfect for capturing royal memories'
      },
      {
        id: 'demo-8',
        title: 'Princess Party Food Ideas',
        description: 'Royal feast ideas that will delight every little princess',
        imageUrl: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop',
        pinterestUrl: 'https://www.pinterest.com/search/pins/?q=princess%20party%20food',
        pinCount: 678,
        followers: 1100,
        category: 'FOOD',
        aiMatchScore: 87,
        aiAnalysis: 'Delicious princess-themed food ideas perfect for a royal celebration'
      }
    ],
    superhero: [
      {
        id: 'demo-superhero-1',
        title: 'Superhero Birthday Party Decorations',
        description: 'Epic superhero decorations to save the day at your party',
        imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
        pinterestUrl: 'https://www.pinterest.com/search/pins/?q=superhero%20birthday%20decorations',
        pinCount: 945,
        followers: 1580,
        category: 'DECORATIONS',
        aiMatchScore: 96,
        aiAnalysis: 'Perfect superhero theme with bold colors and action-packed decorations'
      }
    ],
    space: [
      {
        id: 'demo-space-1',
        title: 'Space Birthday Party Decorations',
        description: 'Out-of-this-world space decorations for an intergalactic celebration',
        imageUrl: 'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=400&h=300&fit=crop',
        pinterestUrl: 'https://www.pinterest.com/search/pins/?q=space%20birthday%20decorations',
        pinCount: 1230,
        followers: 1890,
        category: 'DECORATIONS',
        aiMatchScore: 97,
        aiAnalysis: 'Amazing space theme with planets, stars, and galaxy decorations perfect for cosmic adventures'
      },
      {
        id: 'demo-space-2',
        title: 'Galaxy Birthday Cake Ideas',
        description: 'Cosmic cakes that will transport your party to another galaxy',
        imageUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop',
        pinterestUrl: 'https://www.pinterest.com/search/pins/?q=galaxy%20space%20birthday%20cake',
        pinCount: 876,
        followers: 1456,
        category: 'CAKE',
        aiMatchScore: 94,
        aiAnalysis: 'Stunning galaxy-themed cakes with edible glitter and cosmic colors'
      },
      {
        id: 'demo-space-3',
        title: 'Astronaut Party Games & Activities',
        description: 'Space mission games and astronaut training activities for future space explorers',
        imageUrl: 'https://images.unsplash.com/photo-1581822261290-991b38693d1b?w=400&h=300&fit=crop',
        pinterestUrl: 'https://www.pinterest.com/search/pins/?q=space%20astronaut%20party%20games',
        pinCount: 543,
        followers: 987,
        category: 'GAMES',
        aiMatchScore: 91,
        aiAnalysis: 'Interactive space-themed games that encourage imagination and exploration'
      },
      {
        id: 'demo-space-4',
        title: 'Solar System Party Crafts',
        description: 'DIY solar system crafts and planet-making activities',
        imageUrl: 'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?w=400&h=300&fit=crop',
        pinterestUrl: 'https://www.pinterest.com/search/pins/?q=solar%20system%20party%20crafts',
        pinCount: 432,
        followers: 765,
        category: 'CRAFTS',
        aiMatchScore: 89,
        aiAnalysis: 'Educational and fun space crafts that kids can take home as souvenirs'
      },
      {
        id: 'demo-space-5',
        title: 'Space Food & Cosmic Treats',
        description: 'Galaxy-themed snacks and space food for cosmic adventurers',
        imageUrl: 'https://images.unsplash.com/photo-1517686469429-8bdb88b9f907?w=400&h=300&fit=crop',
        pinterestUrl: 'https://www.pinterest.com/search/pins/?q=space%20themed%20party%20food',
        pinCount: 678,
        followers: 1123,
        category: 'FOOD',
        aiMatchScore: 86,
        aiAnalysis: 'Creative space-themed treats that look like they came from another planet'
      },
      {
        id: 'demo-space-6',
        title: 'Rocket Ship Party Favors',
        description: 'Space-themed party favors and astronaut gear for young explorers',
        imageUrl: 'https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?w=400&h=300&fit=crop',
        pinterestUrl: 'https://www.pinterest.com/search/pins/?q=space%20rocket%20party%20favors',
        pinCount: 345,
        followers: 567,
        category: 'FAVORS',
        aiMatchScore: 83,
        aiAnalysis: 'Exciting space-themed favors that extend the cosmic adventure beyond the party'
      },
      {
        id: 'demo-space-7',
        title: 'Galaxy Photo Booth Props',
        description: 'Space-themed photo booth props including helmets, rockets, and alien accessories',
        imageUrl: 'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?w=400&h=300&fit=crop',
        pinterestUrl: 'https://www.pinterest.com/search/pins/?q=space%20photo%20booth%20props',
        pinCount: 234,
        followers: 445,
        category: 'PHOTOGRAPHY',
        aiMatchScore: 80,
        aiAnalysis: 'Fun space props perfect for capturing memorable moments from the cosmic celebration'
      },
      {
        id: 'demo-space-8',
        title: 'Astronaut Training Party Activities',
        description: 'Space mission training activities and cosmic challenges for party guests',
        imageUrl: 'https://images.unsplash.com/photo-1581822261290-991b38693d1b?w=400&h=300&fit=crop',
        pinterestUrl: 'https://www.pinterest.com/search/pins/?q=astronaut%20training%20party%20activities',
        pinCount: 456,
        followers: 789,
        category: 'ACTIVITIES',
        aiMatchScore: 88,
        aiAnalysis: 'Engaging astronaut training activities that make kids feel like real space explorers'
      }
    ],
    dinosaur: [
      {
        id: 'demo-dino-1',
        title: 'Dinosaur Birthday Party Decorations',
        description: 'Prehistoric decorations to transport your party back to the Jurassic era',
        imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
        pinterestUrl: 'https://www.pinterest.com/search/pins/?q=dinosaur%20birthday%20decorations',
        pinCount: 1156,
        followers: 1743,
        category: 'DECORATIONS',
        aiMatchScore: 96,
        aiAnalysis: 'Perfect dinosaur theme with prehistoric elements and earth-toned decorations'
      }
    ],
    pirate: [
      {
        id: 'demo-pirate-1',
        title: 'Pirate Birthday Party Decorations',
        description: 'Ahoy matey! Treasure-filled decorations for a swashbuckling celebration',
        imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
        pinterestUrl: 'https://www.pinterest.com/search/pins/?q=pirate%20birthday%20decorations',
        pinCount: 892,
        followers: 1234,
        category: 'DECORATIONS',
        aiMatchScore: 95,
        aiAnalysis: 'Exciting pirate theme with treasure chests, ships, and nautical elements'
      }
    ],
    unicorn: [
      {
        id: 'demo-unicorn-1',
        title: 'Unicorn Birthday Party Decorations',
        description: 'Magical unicorn decorations with rainbows and sparkles for a fantasy celebration',
        imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
        pinterestUrl: 'https://www.pinterest.com/search/pins/?q=unicorn%20birthday%20decorations',
        pinCount: 1378,
        followers: 2156,
        category: 'DECORATIONS',
        aiMatchScore: 97,
        aiAnalysis: 'Enchanting unicorn theme with pastel colors, rainbows, and magical elements'
      }
    ],
    ocean: [
      {
        id: 'demo-ocean-1',
        title: 'Ocean Birthday Party Decorations',
        description: 'Under-the-sea decorations with mermaids, fish, and ocean waves',
        imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
        pinterestUrl: 'https://www.pinterest.com/search/pins/?q=ocean%20birthday%20decorations',
        pinCount: 967,
        followers: 1543,
        category: 'DECORATIONS',
        aiMatchScore: 94,
        aiAnalysis: 'Beautiful ocean theme with blue tones and sea creature decorations'
      }
    ],
    safari: [
      {
        id: 'demo-safari-1',
        title: 'Safari Birthday Party Decorations',
        description: 'Wild safari decorations with jungle animals and adventure themes',
        imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
        pinterestUrl: 'https://www.pinterest.com/search/pins/?q=safari%20birthday%20decorations',
        pinCount: 743,
        followers: 1298,
        category: 'DECORATIONS',
        aiMatchScore: 93,
        aiAnalysis: 'Adventurous safari theme with earth tones and wild animal decorations'
      }
    ]
  };

  // Return theme-specific boards or default to princess
  return mockBoards[theme.toLowerCase()] || mockBoards['princess'];
}

// Function to search Pinterest using Pinterest API
async function searchPinterest(query: string): Promise<PinterestBoard[]> {
  const pinterestApiKey = process.env.PINTEREST_API_KEY;
  
  if (!pinterestApiKey) {
    console.log('Pinterest API key not provided, using mock data');
    return getMockDataForQuery(query);
  }

  try {
    console.log(`Searching Pinterest for: ${query}`);
    
    // Pinterest API v5 search endpoint for boards
    const searchUrl = `https://api.pinterest.com/v5/search/boards/?query=${encodeURIComponent(query)}&page_size=20`;
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${pinterestApiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Magical Birthday Planner/1.0'
      }
    });

    if (!response.ok) {
      console.error(`Pinterest API error: ${response.status} ${response.statusText}`);
      return getMockDataForQuery(query);
    }

    const data = await response.json();
    
    if (!data.items || !Array.isArray(data.items)) {
      console.log('No Pinterest boards found, using mock data');
      return getMockDataForQuery(query);
    }

    // Transform Pinterest API response to our format
    const boards: PinterestBoard[] = data.items.map((board: any, index: number) => ({
      id: board.id || `pinterest-${index}`,
      title: board.name || 'Untitled Board',
      description: board.description || '',
      imageUrl: board.media?.image_cover_url || generateFallbackImage(),
      pinterestUrl: `https://www.pinterest.com/${board.owner?.username || 'pinterest'}/boards/${board.name || board.id}/`,
      pinCount: board.pin_count || 0,
      followers: board.follower_count || 0,
      category: categorizeBoard(board.name || '', query),
      aiMatchScore: calculateMatchScore(board.name || '', board.description || '', query),
      aiAnalysis: generateAIAnalysis(board.name || '', board.description || '', query)
    }));

    // If we got valid results, return them
    if (boards.length > 0) {
      return boards.sort((a, b) => (b.aiMatchScore || 0) - (a.aiMatchScore || 0));
    }

    // Fallback to mock data if no results
    return getMockDataForQuery(query);
    
  } catch (error) {
    console.error('Pinterest API search failed:', error);
    return getMockDataForQuery(query);
  }
}

// Helper function to get theme-appropriate mock data
function getMockDataForQuery(query: string): PinterestBoard[] {
  let theme = 'princess'; // default
  const queryLower = query.toLowerCase();
  
  if (queryLower.includes('space') || queryLower.includes('astronaut') || queryLower.includes('galaxy') || queryLower.includes('cosmic')) {
    theme = 'space';
  } else if (queryLower.includes('superhero') || queryLower.includes('hero')) {
    theme = 'superhero';
  } else if (queryLower.includes('princess') || queryLower.includes('royal')) {
    theme = 'princess';
  } else if (queryLower.includes('dinosaur') || queryLower.includes('dino')) {
    theme = 'dinosaur';
  } else if (queryLower.includes('pirate') || queryLower.includes('treasure')) {
    theme = 'pirate';
  } else if (queryLower.includes('unicorn') || queryLower.includes('rainbow')) {
    theme = 'unicorn';
  } else if (queryLower.includes('ocean') || queryLower.includes('mermaid') || queryLower.includes('sea')) {
    theme = 'ocean';
  } else if (queryLower.includes('safari') || queryLower.includes('jungle') || queryLower.includes('animal')) {
    theme = 'safari';
  }
  
  return generateMockPinterestData(theme);
}

// Helper function to categorize Pinterest boards
function categorizeBoard(title: string, query: string): string {
  const titleLower = title.toLowerCase();
  const queryLower = query.toLowerCase();
  
  if (titleLower.includes('cake') || titleLower.includes('dessert') || titleLower.includes('sweet')) return 'CAKE';
  if (titleLower.includes('decoration') || titleLower.includes('decor') || titleLower.includes('styling')) return 'DECORATIONS';
  if (titleLower.includes('game') || titleLower.includes('activity') || titleLower.includes('entertainment')) return 'GAMES';
  if (titleLower.includes('food') || titleLower.includes('snack') || titleLower.includes('treat')) return 'FOOD';
  if (titleLower.includes('favor') || titleLower.includes('gift') || titleLower.includes('goodie')) return 'FAVORS';
  if (titleLower.includes('craft') || titleLower.includes('diy') || titleLower.includes('project')) return 'CRAFTS';
  if (titleLower.includes('photo') || titleLower.includes('picture') || titleLower.includes('memory')) return 'PHOTOGRAPHY';
  if (titleLower.includes('invitation') || titleLower.includes('invite')) return 'INVITATIONS';
  
  return 'ACTIVITIES';
}

// Helper function to calculate relevance score
function calculateMatchScore(title: string, description: string, query: string): number {
  const text = `${title} ${description}`.toLowerCase();
  const queryWords = query.toLowerCase().split(' ');
  
  let score = 0;
  queryWords.forEach(word => {
    if (text.includes(word)) {
      score += 15;
    }
  });
  
  // Bonus for exact query match
  if (text.includes(query.toLowerCase())) {
    score += 30;
  }
  
  // Random variation to simulate AI scoring
  score += Math.floor(Math.random() * 20);
  
  return Math.min(score, 100);
}

// Helper function to generate AI analysis
function generateAIAnalysis(title: string, description: string, query: string): string {
  const category = categorizeBoard(title, query);
  const score = calculateMatchScore(title, description, query);
  
  if (score >= 90) {
    return `Excellent match for ${query} with highly relevant ${category.toLowerCase()} content`;
  } else if (score >= 75) {
    return `Great ${category.toLowerCase()} inspiration that aligns well with your ${query} theme`;
  } else if (score >= 60) {
    return `Good ${category.toLowerCase()} ideas that could work for your ${query} party`;
  } else {
    return `Creative ${category.toLowerCase()} concepts that offer unique inspiration for your celebration`;
  }
}

// Helper function to generate fallback images
function generateFallbackImage(): string {
  const fallbackImages = [
    'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1587691592099-24045742c181?w=400&h=300&fit=crop'
  ];
  return fallbackImages[Math.floor(Math.random() * fallbackImages.length)];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partyId = searchParams.get('partyId');
    
    if (!partyId) {
      return NextResponse.json({ error: 'Party ID required' }, { status: 400 });
    }

    // Handle demo mode
    if (partyId === 'demo' || partyId === 'demo-party') {
      const mockData = generateMockPinterestData();
      return NextResponse.json({
        inspirations: mockData,
        totalCount: mockData.length,
        isDemo: true
      });
    }

    // For real party IDs, check if party exists and get inspiration data
    const party = await prisma.party.findUnique({
      where: { id: partyId },
      include: {
        inspirations: {
          orderBy: [
            { aiMatchScore: 'desc' },
            { createdAt: 'desc' }
          ]
        }
      }
    });

    if (!party) {
      return NextResponse.json({ error: 'Party not found' }, { status: 404 });
    }

    // If we have cached inspirations, return them
    if (party.inspirations.length > 0) {
      return NextResponse.json({
        inspirations: party.inspirations,
        totalCount: party.inspirations.length,
        isDemo: false
      });
    }

    // Otherwise, fetch fresh Pinterest data
    const searchQuery = `${party.theme} birthday party decorations ideas`;
    const pinterestBoards = await searchPinterest(searchQuery);

    // Save to database (optional - could be done asynchronously)
    const savedInspirations = await Promise.all(
      pinterestBoards.map(board =>
        prisma.partyInspiration.create({
          data: {
            title: board.title,
            description: board.description,
            imageUrl: board.imageUrl,
            pinterestUrl: board.pinterestUrl,
            originalId: board.id,
            pinCount: board.pinCount,
            boardFollowers: board.followers,
            category: board.category as any,
            aiMatchScore: board.aiMatchScore,
            aiAnalysis: board.aiAnalysis,
            partyId: partyId
          }
        })
      )
    );

    return NextResponse.json({
      inspirations: savedInspirations,
      totalCount: savedInspirations.length,
      isDemo: false
    });

  } catch (error) {
    console.error('Pinterest inspiration API error:', error);
    
    // Fallback to mock data on any error
    const mockData = generateMockPinterestData();
    return NextResponse.json({
      inspirations: mockData,
      totalCount: mockData.length,
      isDemo: true,
      error: 'Using fallback data due to API error'
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { partyId, inspirationId, action } = await request.json();

    if (!partyId || !inspirationId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Handle demo mode
    if (partyId === 'demo' || partyId === 'demo-party') {
      return NextResponse.json({ 
        success: true, 
        message: `Demo mode: ${action} action simulated`,
        isDemo: true 
      });
    }

    // Handle save/unsave actions for real parties
    if (action === 'save') {
      await prisma.partyInspiration.update({
        where: { id: inspirationId },
        data: { isSaved: true }
      });
    } else if (action === 'unsave') {
      await prisma.partyInspiration.update({
        where: { id: inspirationId },
        data: { isSaved: false }
      });
    } else if (action === 'view') {
      await prisma.partyInspiration.update({
        where: { id: inspirationId },
        data: { viewCount: { increment: 1 } }
      });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Pinterest inspiration POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}