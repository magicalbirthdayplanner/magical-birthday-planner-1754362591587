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
      keywords: [theme, categoryStr, 'party', 'birthday'],
      aiCategoryTag: getCategoryFromKeywords(title + ' ' + description),
      aiMatchScore: Math.floor(Math.random() * 30) + 70,
      relevanceReason: 'Matches party theme and requirements'
    });
  }

  return mockData;
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

    // First try Pinterest API, then fallback to SerpAPI
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
    }

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