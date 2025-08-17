import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();

interface GenerateIdeasRequest {
  partyId: string;
  count?: number;
  offset?: number;
}

interface PartyContext {
  childName: string;
  childAge: number;
  theme: string;
  interests: string[];
  favoriteColors: string[];
  guestCount?: number;
  venue?: string;
}

const categoryEmojis = {
  CAKES_DESSERTS: '🎂',
  DECORATIONS: '🎈',
  ACTIVITIES_GAMES: '🎭',
  PARTY_FAVORS: '🎁',
  ENTERTAINMENT: '🎶'
};

export async function POST(request: NextRequest) {
  try {
    const { partyId, count = 12, offset = 0 }: GenerateIdeasRequest = await request.json();

    if (!partyId) {
      return NextResponse.json({ error: 'Party ID is required' }, { status: 400 });
    }

    // Get party data and user
    const party = await prisma.party.findUnique({
      where: { id: partyId },
      include: { user: true }
    });

    if (!party) {
      return NextResponse.json({ error: 'Party not found' }, { status: 404 });
    }

    const partyContext: PartyContext = {
      childName: party.childName,
      childAge: party.childAge,
      theme: party.theme,
      interests: party.interests,
      favoriteColors: party.favoriteColors,
      guestCount: party.guestCount || undefined,
      venue: 'mixed' // Default venue type since venue field doesn't exist in schema
    };

    let ideas: any[] = [];

    // Try to generate with OpenAI if API key is available
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (openaiApiKey) {
      try {
        ideas = await generateIdeasWithAI(partyContext, count);
      } catch (aiError) {
        console.warn('AI generation failed, falling back to manual ideas:', aiError);
        ideas = generateFallbackIdeas(partyContext, count);
      }
    } else {
      console.log('No OpenAI API key found, using fallback ideas');
      ideas = generateFallbackIdeas(partyContext, count);
    }

    // Save ideas to database
    const savedIdeas = await Promise.all(
      ideas.map(async (idea) => {
        return await prisma.partyIdea.create({
          data: {
            title: idea.title,
            description: idea.description,
            category: idea.category,
            emoji: idea.emoji,
            generatedContext: partyContext as any,
            aiModel: openaiApiKey ? 'gpt-4-turbo' : 'fallback',
            partyId: party.id,
            userId: party.userId
          }
        });
      })
    );

    return NextResponse.json({
      success: true,
      ideas: savedIdeas
    });

  } catch (error) {
    console.error('Error generating ideas:', error);
    return NextResponse.json(
      { error: 'Failed to generate ideas' },
      { status: 500 }
    );
  }
}

async function generateIdeasWithAI(context: PartyContext, count: number) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const categories = Object.keys(categoryEmojis);
  const categoriesPerType = Math.ceil(count / categories.length);

  const prompt = `Generate ${count} creative, personalized birthday party ideas for ${context.childName} (age ${context.childAge}) with a ${context.theme} theme.

Context:
- Child's age: ${context.childAge}
- Party theme: ${context.theme}
- Interests: ${context.interests.join(', ')}
- Favorite colors: ${context.favoriteColors.join(', ')}
- Guest count: ${context.guestCount || 'unknown'}
- Venue: ${context.venue}

Categories to include (roughly ${categoriesPerType} ideas each):
- CAKES_DESSERTS: 🎂 Cakes & Desserts
- DECORATIONS: 🎈 Decorations  
- ACTIVITIES_GAMES: 🎭 Activities & Games
- PARTY_FAVORS: 🎁 Party Favors
- ENTERTAINMENT: 🎶 Entertainment

Requirements:
1. Make each idea specific to the ${context.theme} theme
2. Use child's favorite colors (${context.favoriteColors.join(', ')}) in descriptions
3. Consider the child's age (${context.childAge}) for appropriateness
4. Include the child's interests where relevant
5. Keep descriptions playful and engaging (1-2 sentences max)
6. Include relevant emojis

Return JSON array format:
[
  {
    "title": "Title of the idea",
    "description": "Brief, playful description with specific details",
    "category": "CATEGORY_NAME",
    "emoji": "🎯"
  }
]

Generate ${count} diverse, magical ideas that will make ${context.childName}'s ${context.theme} party unforgettable!`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [
      {
        role: 'system',
        content: 'You are a creative party planning expert who generates magical, age-appropriate birthday party ideas. Always return valid JSON array format.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.8,
    max_tokens: 2000
  });

  const responseText = completion.choices[0]?.message?.content || '';
  
  try {
    const ideasArray = JSON.parse(responseText);
    
    // Validate and clean the response
    return ideasArray.filter((idea: any) => 
      idea.title && idea.description && idea.category && 
      Object.keys(categoryEmojis).includes(idea.category)
    ).map((idea: any) => ({
      ...idea,
      emoji: idea.emoji || categoryEmojis[idea.category as keyof typeof categoryEmojis]
    }));
    
  } catch (parseError) {
    console.error('Failed to parse AI response:', parseError);
    throw new Error('Invalid AI response format');
  }
}

function generateFallbackIdeas(context: PartyContext, count: number): any[] {
  const themeIdeas: Record<string, any[]> = {
    superhero: [
      { title: "Superhero Cape Station", description: `Let kids design their own ${context.favoriteColors.join(' and ')} superhero capes with fabric markers and stickers.`, category: "ACTIVITIES_GAMES", emoji: "🦸" },
      { title: "Power-Up Energy Bars", description: `Create colorful energy bars shaped like lightning bolts in ${context.favoriteColors.join(' and ')} colors.`, category: "CAKES_DESSERTS", emoji: "⚡" },
      { title: "Comic Book Backdrop", description: `Design a photo booth with comic book action bubbles featuring ${context.favoriteColors.join(' and ')} backgrounds.`, category: "DECORATIONS", emoji: "💥" },
      { title: "Hero Badge Collection", description: `Custom superhero badges with each guest's name and their chosen superpower.`, category: "PARTY_FAVORS", emoji: "🏅" },
      { title: "Villain Freeze Dance", description: "Dance party where kids freeze like statues when the 'villain alarm' sounds.", category: "ENTERTAINMENT", emoji: "🎵" }
    ],
    princess: [
      { title: "Royal Tiara Decorating", description: `Princess tiara craft station with ${context.favoriteColors.join(' and ')} gems and glitter.`, category: "ACTIVITIES_GAMES", emoji: "👑" },
      { title: "Castle Layer Cake", description: `Multi-tier castle cake decorated in ${context.favoriteColors.join(' and ')} with edible pearls.`, category: "CAKES_DESSERTS", emoji: "🏰" },
      { title: "Enchanted Balloon Garden", description: `Create a magical balloon garden with ${context.favoriteColors.join(' and ')} balloons and fairy lights.`, category: "DECORATIONS", emoji: "🌸" },
      { title: "Glass Slipper Treats", description: "Clear candy 'glass slippers' filled with colorful sprinkles as party favors.", category: "PARTY_FAVORS", emoji: "👠" },
      { title: "Royal Ball Dance Party", description: "Elegant dance party with classical music and princess dance moves.", category: "ENTERTAINMENT", emoji: "💃" }
    ],
    dinosaur: [
      { title: "Dino Dig Excavation", description: `Sandbox archaeology dig to find buried dinosaur eggs in ${context.favoriteColors.join(' and ')} colors.`, category: "ACTIVITIES_GAMES", emoji: "🦕" },
      { title: "Volcanic Eruption Cake", description: `Volcano-shaped cake with ${context.favoriteColors.join(' and ')} lava frosting and chocolate rocks.`, category: "CAKES_DESSERTS", emoji: "🌋" },
      { title: "Prehistoric Jungle Setup", description: `Transform space into a prehistoric jungle with ${context.favoriteColors.join(' and ')} foliage and dinosaur cutouts.`, category: "DECORATIONS", emoji: "🌿" },
      { title: "Dinosaur Fossil Kits", description: "Take-home fossil excavation kits with mini dinosaurs and digging tools.", category: "PARTY_FAVORS", emoji: "🦴" },
      { title: "Roaring Contest", description: "Fun dinosaur roaring competition with different dinosaur sound challenges.", category: "ENTERTAINMENT", emoji: "📢" }
    ]
  };

  // Get theme-specific ideas or generate generic ones
  const baseIdeas = themeIdeas[context.theme.toLowerCase()] || [
    { title: "Themed Decoration Station", description: `DIY decoration making with ${context.favoriteColors.join(' and ')} supplies.`, category: "DECORATIONS", emoji: "🎨" },
    { title: "Custom Birthday Cake", description: `Special ${context.theme} themed cake in ${context.favoriteColors.join(' and ')} colors.`, category: "CAKES_DESSERTS", emoji: "🎂" },
    { title: "Party Game Marathon", description: "Age-appropriate games that match the party theme.", category: "ACTIVITIES_GAMES", emoji: "🎯" },
    { title: "Themed Party Bags", description: "Take-home bags filled with theme-related goodies.", category: "PARTY_FAVORS", emoji: "🎁" },
    { title: "Music & Dance Party", description: "Themed playlist with dancing and sing-along activities.", category: "ENTERTAINMENT", emoji: "🎵" }
  ];

  // Repeat and shuffle ideas to reach the requested count
  const extendedIdeas: any[] = [];
  while (extendedIdeas.length < count) {
    extendedIdeas.push(...baseIdeas);
  }

  return extendedIdeas.slice(0, count);
}