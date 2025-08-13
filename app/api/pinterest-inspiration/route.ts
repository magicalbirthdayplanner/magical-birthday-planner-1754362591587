import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { PrismaClient, InspirationCategory } from '@prisma/client';

const prisma = new PrismaClient();

interface PinterestSearchParams {
  query: string;
  category?: InspirationCategory;
  limit?: number;
  offset?: number;
}

interface PinterestPin {
  id: string;
  title: string;
  imageUrl: string;
  pinterestUrl: string;
  description?: string;
  keywords: string[];
}

// Mock Pinterest data for development (will be replaced with actual API)
const generateMockPinterestData = (query: string, category: InspirationCategory = 'GENERAL'): PinterestPin[] => {
  const themes = ['princess', 'superhero', 'dinosaur', 'space', 'safari', 'ocean', 'pirate', 'unicorn'];
  const categories = ['decorations', 'cake', 'games', 'invitations', 'costumes', 'party ideas'];
  
  const keywords = query.toLowerCase().split(' ');
  const theme = themes.find(t => keywords.includes(t)) || 'party';
  const categoryStr = category.toLowerCase().replace('_', ' ');

  const mockData: PinterestPin[] = [];
  
  for (let i = 1; i <= 20; i++) {
    const id = `pin_${theme}_${category}_${i}`;
    const title = `${theme.charAt(0).toUpperCase() + theme.slice(1)} ${categoryStr} Ideas ${i}`;
    const imageUrl = `https://images.unsplash.com/400x600/?party,${theme},${categoryStr}&sig=${i}`;
    const pinterestUrl = `https://pinterest.com/pin/${id}`;
    const description = `Beautiful ${theme} ${categoryStr} inspiration for your party planning`;
    
    mockData.push({
      id,
      title,
      imageUrl,
      pinterestUrl,
      description,
      keywords: [theme, categoryStr, 'party', 'birthday']
    });
  }

  return mockData;
};

// Function to search Pinterest using SerpAPI
async function searchPinterestWithSerpAPI(query: string, limit: number = 20): Promise<PinterestPin[]> {
  const serpApiKey = process.env.SERPAPI_API_KEY;
  
  if (!serpApiKey) {
    console.log('SERPAPI_API_KEY not found, using mock data');
    return generateMockPinterestData(query);
  }

  try {
    // Use Google Images search with site:pinterest.com to get Pinterest results
    const searchUrl = `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(query + ' site:pinterest.com')}&api_key=${serpApiKey}&num=${limit}`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    if (data.images_results) {
      return data.images_results.map((result: any, index: number) => ({
        id: `serpapi_${index}`,
        title: result.title || query,
        imageUrl: result.original || result.thumbnail,
        pinterestUrl: result.link || `https://pinterest.com/search/pins/?q=${encodeURIComponent(query)}`,
        description: result.snippet || '',
        keywords: query.toLowerCase().split(' ')
      }));
    }
    
    return generateMockPinterestData(query);
  } catch (error) {
    console.error('SerpAPI error:', error);
    return generateMockPinterestData(query);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const category = (searchParams.get('category') as InspirationCategory) || 'GENERAL';
    const limit = parseInt(searchParams.get('limit') || '20');
    const partyId = searchParams.get('partyId');

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    if (!partyId) {
      return NextResponse.json({ error: 'PartyId parameter is required' }, { status: 400 });
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify party belongs to user
    const party = await prisma.party.findFirst({
      where: { id: partyId, userId: user.id }
    });

    if (!party) {
      return NextResponse.json({ error: 'Party not found' }, { status: 404 });
    }

    // Search for Pinterest inspiration
    const pinterestResults = await searchPinterestWithSerpAPI(query, limit);

    // Save results to database for caching and future reference
    const savedInspirations = await Promise.all(
      pinterestResults.map(async (pin) => {
        // Check if this pin already exists for this party
        const existing = await prisma.partyInspiration.findFirst({
          where: {
            partyId,
            pinterestUrl: pin.pinterestUrl
          }
        });

        if (existing) {
          return existing;
        }

        // Create new inspiration record
        return await prisma.partyInspiration.create({
          data: {
            partyId,
            title: pin.title,
            imageUrl: pin.imageUrl,
            pinterestUrl: pin.pinterestUrl,
            description: pin.description,
            category,
            keywords: pin.keywords,
            isSaved: false
          }
        });
      })
    );

    return NextResponse.json({
      success: true,
      inspirations: savedInspirations,
      query,
      category,
      total: savedInspirations.length
    });

  } catch (error) {
    console.error('Pinterest inspiration fetch error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch Pinterest inspiration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inspirationId, action } = body;

    if (!inspirationId || !action) {
      return NextResponse.json({ error: 'InspirationId and action are required' }, { status: 400 });
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle different actions
    switch (action) {
      case 'save':
        const savedInspiration = await prisma.partyInspiration.update({
          where: { id: inspirationId },
          data: { isSaved: true }
        });
        return NextResponse.json({ success: true, inspiration: savedInspiration });

      case 'unsave':
        const unsavedInspiration = await prisma.partyInspiration.update({
          where: { id: inspirationId },
          data: { isSaved: false }
        });
        return NextResponse.json({ success: true, inspiration: unsavedInspiration });

      case 'ai_expand':
        // This will be implemented when we add the AI expand feature
        return NextResponse.json({ error: 'AI expand feature coming soon' }, { status: 501 });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Pinterest inspiration action error:', error);
    return NextResponse.json({ 
      error: 'Failed to perform action',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}