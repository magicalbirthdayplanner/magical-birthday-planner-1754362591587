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
  aiCategoryTag?: string;
  aiMatchScore?: number;
  relevanceReason?: string;
}

interface AIMashupIdea {
  id: string;
  title: string;
  description: string;
  combinedElements: string[];
  inspiration: string[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
  estimatedTime: string;
  materials: string[];
}

interface PinterestSearchResult {
  id: string;
  title: string;
  description: string;
  images: {
    '736x': {
      url: string;
    };
    original: {
      url: string;
    };
  };
  link: string;
  board?: {
    name: string;
    description: string;
  };
  dominant_color?: string;
  pin_join?: {
    visual_annotation: string[];
  };
}

// Mock Pinterest data for demo mode
const generateMockPinterestData = (query: string, category: InspirationCategory = 'GENERAL'): PinterestPin[] => {
  const themes = ['princess', 'superhero', 'dinosaur', 'space', 'safari', 'ocean', 'pirate', 'unicorn'];
  const keywords = query.toLowerCase().split(' ');
  const theme = themes.find(t => keywords.includes(t)) || 'birthday';
  const categoryStr = category.toLowerCase().replace('_', ' ');

  // High-quality mock Pinterest boards with realistic titles and descriptions
  const mockBoards = [
    {
      id: 'demo-1',
      title: 'Cinderella Birthday Decor Ideas',
      imageUrl: 'https://i.pinimg.com/736x/82/8a/98/828a98f42c4a8b9c8f4e8c9a8b7c6d5e.jpg',
      pinterestUrl: 'https://www.pinterest.com/search/pins/?q=cinderella%20birthday%20decor',
      description: 'Magical Cinderella party decorations with blue and silver themes, pumpkin carriages, and glass slippers',
      keywords: ['cinderella', 'princess', 'blue', 'silver', 'birthday', 'decorations'],
      aiMatchScore: 95
    },
    {
      id: 'demo-2', 
      title: 'DIY Princess Castle Centerpieces',
      imageUrl: 'https://i.pinimg.com/736x/91/7b/45/917b45e3c2f4a8b9c8f4e8c9a8b7c6d5.jpg',
      pinterestUrl: 'https://www.pinterest.com/search/pins/?q=princess%20castle%20centerpieces',
      description: 'Beautiful princess castle centerpieces made from cardboard towers and glitter - perfect for princess parties',
      keywords: ['princess', 'castle', 'centerpieces', 'diy', 'decorations'],
      aiMatchScore: 88
    },
    {
      id: 'demo-3',
      title: 'Royal Princess Party Games & Activities',
      imageUrl: 'https://i.pinimg.com/736x/74/6c/38/746c38f42c4a8b9c8f4e8c9a8b7c6d5e.jpg', 
      pinterestUrl: 'https://www.pinterest.com/search/pins/?q=princess%20party%20games',
      description: 'Fun princess party games including crown decorating, royal treasure hunts, and princess training activities',
      keywords: ['princess', 'games', 'activities', 'crown', 'treasure hunt'],
      aiMatchScore: 92
    },
    {
      id: 'demo-4',
      title: 'Magical Princess Birthday Cake Ideas',
      imageUrl: 'https://i.pinimg.com/736x/65/5d/29/655d29f42c4a8b9c8f4e8c9a8b7c6d5e.jpg',
      pinterestUrl: 'https://www.pinterest.com/search/pins/?q=princess%20birthday%20cake',
      description: 'Stunning princess birthday cakes with tiered designs, edible pearls, and fondant crowns',
      keywords: ['princess', 'cake', 'birthday', 'tiered', 'crown'],
      aiMatchScore: 94
    },
    {
      id: 'demo-5',
      title: 'Princess Party Invitation Templates',
      imageUrl: 'https://i.pinimg.com/736x/56/4e/1a/564e1af42c4a8b9c8f4e8c9a8b7c6d5e.jpg',
      pinterestUrl: 'https://www.pinterest.com/search/pins/?q=princess%20party%20invitations',
      description: 'Elegant princess party invitations with royal crests, flowing script fonts, and pink and gold accents',
      keywords: ['princess', 'invitations', 'royal', 'pink', 'gold'],
      aiMatchScore: 87
    },
    {
      id: 'demo-6',
      title: 'Princess Dress-Up Station Setup',
      imageUrl: 'https://i.pinimg.com/736x/47/3f/0b/473f0bf42c4a8b9c8f4e8c9a8b7c6d5e.jpg',
      pinterestUrl: 'https://www.pinterest.com/search/pins/?q=princess%20dress%20up%20station',
      description: 'Create a magical dress-up corner with princess costumes, tiaras, jewelry, and a full-length mirror',
      keywords: ['princess', 'dress-up', 'costumes', 'tiaras', 'jewelry'],
      aiMatchScore: 90
    },
    {
      id: 'demo-7',
      title: 'Pink & Gold Princess Table Setting',
      imageUrl: 'https://i.pinimg.com/736x/38/30/fc/3830fcf42c4a8b9c8f4e8c9a8b7c6d5e.jpg',
      pinterestUrl: 'https://www.pinterest.com/search/pins/?q=princess%20table%20setting',
      description: 'Royal table setting with pink linens, gold chargers, crystal glasses, and floral centerpieces',
      keywords: ['princess', 'table', 'pink', 'gold', 'royal'],
      aiMatchScore: 89
    },
    {
      id: 'demo-8',
      title: 'DIY Princess Photo Booth Props',
      imageUrl: 'https://i.pinimg.com/736x/29/21/ed/2921edf42c4a8b9c8f4e8c9a8b7c6d5e.jpg',
      pinterestUrl: 'https://www.pinterest.com/search/pins/?q=princess%20photo%20booth%20props',
      description: 'Create fun princess photo booth props including crowns, wands, lips, and royal speech bubbles',
      keywords: ['princess', 'photo booth', 'props', 'crowns', 'wands'],
      aiMatchScore: 85
    }
  ];

  // Filter and adapt mock boards based on query and category
  return mockBoards.map((board, index) => ({
    ...board,
    id: `demo_${theme}_${category}_${index + 1}`,
    title: board.title.replace('Princess', theme.charAt(0).toUpperCase() + theme.slice(1)),
    description: board.description.replace('princess', theme).replace('Princess', theme.charAt(0).toUpperCase() + theme.slice(1)),
    keywords: [theme, categoryStr, 'party', 'birthday', ...board.keywords.slice(2)],
    aiCategoryTag: getCategoryFromKeywords(board.title + ' ' + board.description),
    relevanceReason: `Perfect match for ${theme} ${categoryStr} party planning`
  }));
};

// Function to search Pinterest using Pinterest API
async function searchPinterestAPI(query: string, limit: number = 20): Promise<PinterestSearchResult[]> {
  const pinterestApiKey = process.env.PINTEREST_API_KEY;
  
  if (!pinterestApiKey) {
    console.log('Pinterest API key not found, using mock data');
    return [];
  }

  try {
    // Pinterest API v5 search endpoint
    const searchUrl = `https://api.pinterest.com/v5/search/pins?query=${encodeURIComponent(query)}&limit=${limit}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${pinterestApiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error('Pinterest API error:', response.status, response.statusText);
      return [];
    }
    
    const data = await response.json();
    return data.items || [];
    
  } catch (error) {
    console.error('Pinterest API error:', error);
    return [];
  }
}

// Function to search Pinterest using SerpAPI as fallback
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
        keywords: query.toLowerCase().split(' '),
        aiCategoryTag: getCategoryFromKeywords(result.title || query),
        aiMatchScore: Math.floor(Math.random() * 30) + 70,
        relevanceReason: 'Found via search'
      }));
    }
    
    return generateMockPinterestData(query);
  } catch (error) {
    console.error('SerpAPI error:', error);
    return generateMockPinterestData(query);
  }
}

// Process Pinterest results through Azure OpenAI GPT-4.1
async function processWithAI(pinterestResults: PinterestSearchResult[], wizardInputs: any): Promise<PinterestPin[]> {
  const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
  const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
  const AZURE_OPENAI_DEPLOYMENT_NAME = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION;

  if (!AZURE_OPENAI_API_KEY || !AZURE_OPENAI_ENDPOINT) {
    console.log('Azure OpenAI not configured, using basic processing');
    return convertPinterestResults(pinterestResults);
  }

  try {
    const prompt = `
Analyze these Pinterest search results for a party with the following requirements:

Wizard Inputs:
- Theme: ${wizardInputs.theme || 'birthday party'}
- Age Group: ${wizardInputs.childAge || 'child'} years old
- Location Type: ${wizardInputs.venue || 'any'}
- Special Keywords: ${wizardInputs.interests ? wizardInputs.interests.join(', ') : 'none'}
- Favorite Colors: ${wizardInputs.favoriteColors ? wizardInputs.favoriteColors.join(', ') : 'none'}

Pinterest Search Results:
${JSON.stringify(pinterestResults.slice(0, 15), null, 2)}

Please:
a) Remove irrelevant or generic results (only return relevant pins)
b) Assign a category tag: Games, Food, Cake, Decorations, Venue Styling, Entertainment, Invitations, Costumes
c) Generate an AI Match Score from 0–100 based on relevance to the wizard inputs
d) Provide a brief explanation for the match score

Return a JSON array where each item has:
{
  "id": "pin_id",
  "title": "pin_title",
  "imageUrl": "image_url",
  "pinterestUrl": "pinterest_link",
  "description": "pin_description",
  "keywords": ["keyword1", "keyword2"],
  "aiCategoryTag": "category_name",
  "aiMatchScore": score_number,
  "relevanceReason": "explanation_text"
}

Only include pins with match score above 50. Maximum 20 results.
`;

    const response = await fetch(`${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT_NAME}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_API_KEY
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are an expert party planner who analyzes Pinterest content for birthday parties. Always return valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 3000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      console.error('Azure OpenAI error:', response.status, response.statusText);
      return convertPinterestResults(pinterestResults);
    }

    const aiResponse = await response.json();
    const aiContent = aiResponse.choices[0]?.message?.content;
    
    try {
      const processedPins = JSON.parse(aiContent);
      return processedPins;
    } catch (parseError) {
      console.error('AI response parsing error:', parseError);
      return convertPinterestResults(pinterestResults);
    }

  } catch (error) {
    console.error('AI processing error:', error);
    return convertPinterestResults(pinterestResults);
  }
}

// Generate AI Mashup Ideas
async function generateAIMashups(topPins: PinterestPin[], wizardInputs: any): Promise<AIMashupIdea[]> {
  const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
  const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
  const AZURE_OPENAI_DEPLOYMENT_NAME = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION;

  if (!AZURE_OPENAI_API_KEY || !AZURE_OPENAI_ENDPOINT) {
    return generateMockMashups();
  }

  try {
    const prompt = `
Based on these top Pinterest inspirations for a ${wizardInputs.theme || 'birthday'} party (child age: ${wizardInputs.childAge || 5}), create 3 unique "AI Mashup Ideas" that combine elements from multiple pins in creative ways:

Top Pinterest Inspirations:
${JSON.stringify(topPins.slice(0, 10), null, 2)}

Wizard Context:
- Theme: ${wizardInputs.theme || 'birthday party'}
- Age: ${wizardInputs.childAge || 5} years old
- Interests: ${wizardInputs.interests ? wizardInputs.interests.join(', ') : 'general'}
- Colors: ${wizardInputs.favoriteColors ? wizardInputs.favoriteColors.join(', ') : 'colorful'}

Create 3 mashup ideas, each combining 2-3 different inspirations. Return JSON array:
[
  {
    "id": "mashup_1",
    "title": "Creative Mashup Name",
    "description": "Detailed description of the combined concept",
    "combinedElements": ["element from inspiration 1", "element from inspiration 2", "element from inspiration 3"],
    "inspiration": ["Pinterest pin title 1", "Pinterest pin title 2"],
    "difficulty": "Easy|Medium|Hard",
    "estimatedTime": "2-3 hours",
    "materials": ["material1", "material2", "material3"]
  }
]

Make mashups practical, creative, and achievable for parents.
`;

    const response = await fetch(`${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT_NAME}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_API_KEY
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are a creative party planning expert who specializes in combining Pinterest ideas to create unique party concepts. Always return valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      console.error('Azure OpenAI mashup error:', response.status);
      return generateMockMashups();
    }

    const aiResponse = await response.json();
    const aiContent = aiResponse.choices[0]?.message?.content;
    
    try {
      const mashups = JSON.parse(aiContent);
      return mashups;
    } catch (parseError) {
      console.error('AI mashup parsing error:', parseError);
      return generateMockMashups();
    }

  } catch (error) {
    console.error('AI mashup generation error:', error);
    return generateMockMashups();
  }
}

// Convert Pinterest API results to our format
function convertPinterestResults(results: PinterestSearchResult[]): PinterestPin[] {
  return results.map((pin, index) => ({
    id: pin.id,
    title: pin.title,
    imageUrl: pin.images?.['736x']?.url || pin.images?.original?.url || '',
    pinterestUrl: pin.link,
    description: pin.description,
    keywords: extractKeywords(pin.title + ' ' + pin.description),
    aiCategoryTag: getCategoryFromKeywords(pin.title + ' ' + pin.description),
    aiMatchScore: Math.floor(Math.random() * 30) + 70, // Random score 70-100
    relevanceReason: 'Matches party theme and requirements'
  }));
}

// Generate mock mashup ideas
function generateMockMashups(): AIMashupIdea[] {
  return [
    {
      id: 'mashup_1',
      title: 'Superhero Space Adventure',
      description: 'Combine superhero themes with space exploration for an out-of-this-world adventure party',
      combinedElements: ['Cape-wearing astronauts', 'Galaxy backdrop with city skyline', 'Rocket ship cake with superhero toppers'],
      inspiration: ['Superhero Cape Station', 'Space Galaxy Decorations', 'Rocket Birthday Cake'],
      difficulty: 'Medium',
      estimatedTime: '3-4 hours',
      materials: ['Silver fabric', 'LED string lights', 'Cardboard tubes', 'Metallic paint', 'Action figures']
    },
    {
      id: 'mashup_2',
      title: 'Princess Unicorn Garden',
      description: 'Magical princess castle meets enchanted unicorn garden with rainbow elements',
      combinedElements: ['Unicorn horn tiaras', 'Rainbow flower arrangements', 'Castle cake with unicorn decorations'],
      inspiration: ['Princess Crown Crafts', 'Unicorn Rainbow Party', 'Castle Birthday Setup'],
      difficulty: 'Easy',
      estimatedTime: '2-3 hours',
      materials: ['Pastel flowers', 'Rainbow streamers', 'Plastic tiaras', 'Glitter', 'Tulle fabric']
    },
    {
      id: 'mashup_3',
      title: 'Dinosaur Safari Expedition',
      description: 'Prehistoric dinosaurs meet modern safari adventure with explorer themes',
      combinedElements: ['Dinosaur dig site setup', 'Safari explorer gear', 'Fossil treasure hunt with adventure maps'],
      inspiration: ['Dinosaur Excavation Party', 'Safari Adventure Theme', 'Treasure Hunt Games'],
      difficulty: 'Hard',
      estimatedTime: '4-5 hours',
      materials: ['Sand boxes', 'Plastic dinosaurs', 'Explorer hats', 'Maps', 'Brushes and tools']
    }
  ];
}

function extractKeywords(text: string): string[] {
  const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an'];
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2 && !commonWords.includes(word))
    .slice(0, 5);
}

function getCategoryFromKeywords(text: string): string {
  const keywords = text.toLowerCase();
  
  if (keywords.includes('cake') || keywords.includes('dessert') || keywords.includes('cupcake')) return 'Cake';
  if (keywords.includes('game') || keywords.includes('activity') || keywords.includes('play')) return 'Games';
  if (keywords.includes('decoration') || keywords.includes('backdrop') || keywords.includes('banner')) return 'Decorations';
  if (keywords.includes('food') || keywords.includes('snack') || keywords.includes('meal')) return 'Food';
  if (keywords.includes('invitation') || keywords.includes('invite') || keywords.includes('card')) return 'Invitations';
  if (keywords.includes('costume') || keywords.includes('outfit') || keywords.includes('dress')) return 'Costumes';
  if (keywords.includes('venue') || keywords.includes('location') || keywords.includes('space')) return 'Venue Styling';
  if (keywords.includes('entertainment') || keywords.includes('show') || keywords.includes('performance')) return 'Entertainment';
  
  return 'Decorations';
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

    let party;
    let user: any = null;
    
    // Handle demo/test cases when no valid party exists - allow without authentication
    if (partyId === 'demo' || partyId === 'demo-party') {
      console.log('Using demo party data for Pinterest inspiration');
      party = {
        id: 'demo',
        theme: query.includes('princess') ? 'Princess' : 
              query.includes('superhero') ? 'Superhero' : 
              query.includes('space') ? 'Space' : 'Birthday',
        childAge: 5,
        location: null,
        partyLocation: null,
        interests: ['games', 'activities'],
        favoriteColors: ['pink', 'purple']
      };
    } else {
      // For non-demo mode, require authentication
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      user = authUser;
      
      // Verify party belongs to user
      party = await prisma.party.findFirst({
        where: { id: partyId, userId: user.id }
      });

      if (!party) {
        return NextResponse.json({ error: 'Party not found' }, { status: 404 });
      }
    }

    // First try Pinterest API, then fallback to SerpAPI, then fallback to mock data
    let pinterestResults: PinterestPin[] = [];
    const pinterestApiResults = await searchPinterestAPI(query, limit);
    
    if (pinterestApiResults.length > 0) {
      // Get wizard inputs from party data for AI processing
      const wizardInputs = {
        theme: party.theme,
        childAge: party.childAge,
        venue: party.location || party.partyLocation,
        interests: party.interests || [],
        favoriteColors: party.favoriteColors || []
      };
      
      // Process Pinterest API results through GPT-4.1
      pinterestResults = await processWithAI(pinterestApiResults, wizardInputs);
    } else {
      // Fallback to SerpAPI
      pinterestResults = await searchPinterestWithSerpAPI(query, limit);
      
      // If SerpAPI also fails or returns no results, ensure we have mock data
      if (pinterestResults.length === 0) {
        console.log('All APIs failed, using mock Pinterest data for query:', query);
        pinterestResults = generateMockPinterestData(query, category);
      }
    }

    // Save results to database for caching and future reference (skip for demo mode)
    let savedInspirations;
    
    if (partyId === 'demo' || partyId === 'demo-party') {
      // For demo mode, just return the Pinterest results without saving to database
      savedInspirations = pinterestResults.map((pin, index) => ({
        id: `demo_${index}`,
        partyId: 'demo',
        title: pin.title,
        imageUrl: pin.imageUrl,
        pinterestUrl: pin.pinterestUrl,
        description: pin.description,
        category,
        keywords: pin.keywords,
        isSaved: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
    } else {
      savedInspirations = await Promise.all(
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
    }

    // Generate AI Mashups for the response
    const wizardInputs = {
      theme: party.theme,
      childAge: party.childAge,
      venue: party.location || party.partyLocation,
      interests: party.interests || [],
      favoriteColors: party.favoriteColors || []
    };
    
    const aiMashups = pinterestResults.length > 0 ? 
      await generateAIMashups(pinterestResults.slice(0, 8), wizardInputs) :
      generateMockMashups();

    return NextResponse.json({
      success: true,
      inspirations: savedInspirations,
      aiMashups: aiMashups,
      query,
      category,
      total: savedInspirations.length,
      hasAI: !!process.env.AZURE_OPENAI_API_KEY,
      hasPinterestAPI: !!process.env.PINTEREST_API_KEY
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

    // Handle demo mode - return success without database operations
    if (inspirationId.startsWith('demo')) {
      return NextResponse.json({ 
        success: true, 
        message: 'Demo mode - changes not persisted',
        inspiration: { id: inspirationId, isSaved: action === 'save' }
      });
    }

    // Get current user for non-demo operations
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