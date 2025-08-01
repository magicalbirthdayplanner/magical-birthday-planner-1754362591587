import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize Azure OpenAI client only if credentials are available
const openai = process.env.AZURE_OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
  defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION },
  defaultHeaders: {
    'api-key': process.env.AZURE_OPENAI_API_KEY,
  },
}) : null;

interface ThemeRequest {
  childName: string;
  age: number;
  interests: string[];
  favoriteColors?: string[];
  activities?: string[];
  childGender?: string;
  childDetails?: string;
  selectedClassicTheme?: string;
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
    const { childName, age, interests, favoriteColors = [], activities = [], childGender, childDetails, selectedClassicTheme } = body;

    if (!openai || !process.env.AZURE_OPENAI_API_KEY) {
      return NextResponse.json(
        { 
          error: 'Azure OpenAI API key not configured',
          fallback: true,
          recommendations: getFallbackRecommendations(childName, age, interests)
        },
        { status: 200 }
      );
    }

    // Use the user's exact enhanced prompt specification for highly contextual recommendations
    const baseInstructions = selectedClassicTheme 
      ? `Based on the following inputs, create 3-5 highly creative and personalized variations of the ${selectedClassicTheme} theme that are specially tailored for this specific child. Each variation should:
      1. Take the classic ${selectedClassicTheme} theme and blend it with the child's specific interests from their "current favorites" and hobbies
      2. Create unique theme names that combine ${selectedClassicTheme} with the child's interests (e.g., "Safari Explorer meets Lion King", "Dinosaur Detective Adventure", "Princess Unicorn Dreams")
      3. Be completely different from generic ${selectedClassicTheme} themes - make them feel custom and personal
      4. Incorporate the child's favorite colors into the ${selectedClassicTheme} color palette
      5. Reference specific movies, shows, or hobbies mentioned in the child's current favorites
      Make each variation feel like it was designed exclusively for this child, not just a standard ${selectedClassicTheme} party.`
      : `Based on the following inputs, suggest 3-5 creative and trending kids' birthday party themes. Each theme should directly reflect the child's age, gender, interests, favorite color, and anything from their current favorites or recent passions.`

    const prompt = `${baseInstructions} For each theme, include: (1) theme name and short fun description, (2) why it matches this child (cite details!), (3) suggested activities or games for that theme, (4) suggested color palette and decorations, and (5) one or two printable ideas. Here are the child's details:
- Name: ${childName}
- Gender: ${childGender || 'Not specified'}  
- Age / DOB: ${age} years old
- Interests: ${interests.join(', ') || 'Not specified'}
- Favorite Color: ${favoriteColors.length > 0 ? favoriteColors.join(', ') : 'Not specified'}
- Theme Selected: ${selectedClassicTheme ? 'Classic theme' : 'Custom Theme'}
- Current Favorites / Recent Hobbies: ${childDetails || 'Not specified'}
${selectedClassicTheme ? `- Selected Classic Theme: ${selectedClassicTheme} (create personalized variations of this theme)` : ''}

CRITICAL INSTRUCTIONS:
- Themes must be HIGHLY CONTEXTUAL and directly relate to the child's specific interests and current favorites
- If Classic Theme is selected (e.g., Superhero) and child loves Hulk, ALL recommendations must be superhero-related variations incorporating Hulk
- If interests include specific characters, movies, or shows, EVERY theme must incorporate these elements
- DO NOT suggest unrelated themes like unicorns, dinosaurs, or space explorers unless they match the child's specific interests
- Each theme name should reference the child's actual interests and favorites
- Color palettes must incorporate the child's favorite colors
- Activities must be related to the child's stated interests and the selected theme

Themes must be age-appropriate, imaginative, and reflect current party trends. Personalize every suggestion fully for this child and explain the match with specific references to their interests.

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
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an extremely creative and imaginative party planning expert specializing in personalized kids birthday parties. You MUST create themes that are HIGHLY CONTEXTUAL and directly related to the child\'s specific interests and current favorites. If a child loves Hulk and selects Superhero theme, ALL recommendations must be superhero-related incorporating Hulk. NEVER suggest unrelated themes. You create unique, trending, and highly personalized theme recommendations that perfectly match each child\'s specific interests and preferences. Always respond with valid JSON only, no additional text. Be very creative and imaginative with theme names and descriptions while staying strictly within the child\'s stated interests.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 1.1,
      max_tokens: 3000,
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