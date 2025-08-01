import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client only if API key is available
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

interface ThemeRequest {
  childName: string;
  age: number;
  interests: string[];
  favoriteColors?: string[];
  activities?: string[];
  childGender?: string;
  childDetails?: string;
}

interface ThemeRecommendation {
  id: string;
  name: string;
  description: string;
  whyRecommended: string;
  colorPalette: string[];
  decorations: string[];
  activities: string[];
  printableIdeas: string[];
  emoji: string;
  ageAppropriate: boolean;
  matchScore: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: ThemeRequest = await request.json();
    const { childName, age, interests, favoriteColors = [], activities = [], childGender, childDetails } = body;

    if (!openai || !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { 
          error: 'OpenAI API key not configured',
          fallback: true,
          recommendations: getFallbackRecommendations(childName, age, interests)
        },
        { status: 200 }
      );
    }

    // Use the user's exact prompt specification
    const prompt = `Based on the following inputs, suggest 3-5 creative and trending kids' birthday party themes. Each theme should directly reflect the child's age, gender, interests, favorite color, and anything from their current favorites or recent passions. For each theme, include: (1) theme name and short fun description, (2) why it matches this child (cite details!), (3) suggested activities or games for that theme, (4) suggested color palette and decorations, and (5) one or two printable ideas. Here are the child's details:
- Name: ${childName}
- Gender: ${childGender || 'Not specified'}
- Age / DOB: ${age} years old
- Interests: ${interests.join(', ')}
- Favorite Color: ${favoriteColors.length > 0 ? favoriteColors.join(', ') : 'Not specified'}
- Current Favorites / Recent Hobbies: ${childDetails || 'Not specified'}

Themes must be age-appropriate, imaginative, and reflect current party trends. Personalize every suggestion fully for this child and explain the match.

Return ONLY a valid JSON array of 3-5 theme objects with the following structure:
[
  {
    "id": "unique-id",
    "name": "Theme Name",
    "description": "Short fun description",
    "whyRecommended": "Why it matches this child (cite details!)",
    "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4"],
    "decorations": ["decoration1", "decoration2", "decoration3"],
    "activities": ["activity1", "activity2", "activity3"],
    "printableIdeas": ["printable1", "printable2"],
    "emoji": "🎊",
    "ageAppropriate": true,
    "matchScore": 95
  }
]`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an extremely creative and imaginative party planning expert specializing in personalized kids birthday parties. You create unique, trending, and highly personalized theme recommendations that perfectly match each child\'s specific interests and preferences. Always respond with valid JSON only, no additional text. Be very creative and imaginative with theme names and descriptions.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.9,
      max_tokens: 2500,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

    try {
      const recommendations: ThemeRecommendation[] = JSON.parse(responseText);
      
      // Validate and ensure we have 5 recommendations
      if (!Array.isArray(recommendations) || recommendations.length < 3) {
        throw new Error('Invalid recommendations format');
      }

      // Sort by match score and take top 5
      const sortedRecommendations = recommendations
        .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
        .slice(0, 5);

      return NextResponse.json({
        recommendations: sortedRecommendations,
        fallback: false,
        generatedAt: new Date().toISOString(),
      });

    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Response text:', responseText);
      
      // Return fallback recommendations
      return NextResponse.json({
        error: 'Failed to parse AI response',
        fallback: true,
        recommendations: getFallbackRecommendations(childName, age, interests)
      });
    }

  } catch (error) {
    console.error('Theme recommendation error:', error);
    
    // Always return fallback recommendations on error
    const body: ThemeRequest = await request.json().catch(() => ({
      childName: 'Child',
      age: 5,
      interests: ['games']
    }));
    
    return NextResponse.json({
      error: 'Failed to generate recommendations',
      fallback: true,
      recommendations: getFallbackRecommendations(body.childName, body.age, body.interests)
    });
  }
}

function getFallbackRecommendations(childName: string, age: number, interests: string[]): ThemeRecommendation[] {
  const fallbackThemes = [
    {
      id: 'superhero-adventure',
      name: 'Superhero Adventure',
      description: 'Transform into mighty heroes and save the day with action-packed adventures!',
      whyRecommended: `Perfect for ${childName} who loves action and adventure - every child dreams of being a superhero!`,
      colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'],
      decorations: ['Cape station with personalized capes', 'Cityscape backdrop with buildings', 'Comic book speech bubble props'],
      activities: ['Hero training obstacle course', 'Design your own superhero logo', 'Villain capture game'],
      printableIdeas: ['Superhero certificates', 'Comic book coloring pages'],
      emoji: '🦸‍♂️',
      ageAppropriate: age >= 3,
      matchScore: interests.some(i => ['action', 'games', 'movies'].includes(i.toLowerCase())) ? 90 : 75
    },
    {
      id: 'magical-unicorn',
      name: 'Magical Unicorn Paradise',
      description: 'Enter a world of rainbow magic, sparkles, and enchanted unicorn friends!',
      whyRecommended: `Chosen for ${childName} because unicorns represent magic and wonder - perfect for creative spirits!`,
      colorPalette: ['#FF69B4', '#9370DB', '#FFB6C1', '#F0E68C'],
      decorations: ['Rainbow balloon arch', 'Unicorn horn headbands', 'Glittery cloud decorations'],
      activities: ['Unicorn slime making', 'Rainbow treasure hunt', 'Magical horn decorating'],
      printableIdeas: ['Unicorn coloring sheets', 'Magic potion recipe cards'],
      emoji: '🦄',
      ageAppropriate: true,
      matchScore: interests.some(i => ['art', 'crafts', 'magic', 'animals'].includes(i.toLowerCase())) ? 88 : 70
    },
    {
      id: 'dinosaur-discovery',
      name: 'Dinosaur Discovery Expedition',
      description: 'Embark on a prehistoric adventure to discover ancient dinosaur secrets!',
      whyRecommended: `Selected for ${childName} who loves exploration and learning - dinosaurs fascinate curious minds!`,
      colorPalette: ['#228B22', '#8B4513', '#DAA520', '#CD853F'],
      decorations: ['Dinosaur fossil dig site', 'Jungle vine decorations', 'Dinosaur footprint trail'],
      activities: ['Fossil excavation sandbox', 'Dinosaur egg hunt', 'Paleontologist training course'],
      printableIdeas: ['Dinosaur fact cards', 'Archaeological dig certificates'],
      emoji: '🦕',
      ageAppropriate: true,
      matchScore: interests.some(i => ['animals', 'science', 'nature', 'games'].includes(i.toLowerCase())) ? 92 : 78
    },
    {
      id: 'space-explorer',
      name: 'Space Explorer Mission',
      description: 'Blast off to the stars on an intergalactic adventure through the cosmos!',
      whyRecommended: `Perfect for ${childName} who dreams big - space exploration combines science with wonder!`,
      colorPalette: ['#4B0082', '#000080', '#C0C0C0', '#FFD700'],
      decorations: ['Solar system hanging mobile', 'Astronaut photo booth', 'Starry night ceiling'],
      activities: ['Build and launch rockets', 'Planet scavenger hunt', 'Astronaut training camp'],
      printableIdeas: ['Space mission certificates', 'Constellation coloring pages'],
      emoji: '🚀',
      ageAppropriate: age >= 4,
      matchScore: interests.some(i => ['science', 'space', 'building', 'games'].includes(i.toLowerCase())) ? 94 : 80
    },
    {
      id: 'art-studio',
      name: 'Creative Art Studio',
      description: 'Unleash creativity in a colorful art studio filled with endless possibilities!',
      whyRecommended: `Designed for ${childName}'s artistic spirit - perfect for expressing creativity and imagination!`,
      colorPalette: ['#FF6347', '#32CD32', '#FF69B4', '#FFD700'],
      decorations: ['Paint palette table settings', 'Colorful paint splatter banners', 'Artist easel displays'],
      activities: ['Canvas painting party', 'Clay sculpture workshop', 'Collaborative mural creation'],
      printableIdeas: ['Artist certificate templates', 'Color-by-number party sheets'],
      emoji: '🎨',
      ageAppropriate: true,
      matchScore: interests.some(i => ['art', 'crafts', 'drawing', 'colors'].includes(i.toLowerCase())) ? 96 : 82
    }
  ];

  return fallbackThemes.slice(0, 5);
}