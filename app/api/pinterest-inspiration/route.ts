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
    ]
  };

  // Return theme-specific boards or default to princess
  return mockBoards[theme.toLowerCase()] || mockBoards['princess'];
}

// Function to search Pinterest via unofficial API or scraping
async function searchPinterest(query: string): Promise<PinterestBoard[]> {
  // In a real implementation, you would use:
  // 1. Unofficial Pinterest API (e.g., from RapidAPI)
  // 2. Pinterest scraping service (e.g., Apify)
  // 3. SerpAPI if they add Pinterest support
  
  try {
    // Placeholder for actual Pinterest API integration
    // For now, return mock data based on query
    console.log(`Searching Pinterest for: ${query}`);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Return mock data based on query theme
    const theme = query.toLowerCase().includes('superhero') ? 'superhero' : 
                  query.toLowerCase().includes('princess') ? 'princess' : 'princess';
    
    return generateMockPinterestData(theme);
  } catch (error) {
    console.error('Pinterest search failed:', error);
    return generateMockPinterestData(); // Fallback to mock data
  }
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