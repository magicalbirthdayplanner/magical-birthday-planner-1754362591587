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
          recommendations: getFallbackRecommendations(childName, age, interests, selectedClassicTheme, childDetails)
        },
        { status: 200 }
      );
    }

    // Use the user's exact enhanced prompt specification for highly contextual recommendations
    const baseInstructions = selectedClassicTheme 
      ? `ULTRA CRITICAL INSTRUCTION: You are creating personalized variations of the ${selectedClassicTheme} theme ONLY. All 3-5 recommendations must be ${selectedClassicTheme}-based themes that incorporate this child's specific interests.

      MANDATORY REQUIREMENTS - NO EXCEPTIONS:
      1. ALL themes MUST be variations of ${selectedClassicTheme} - absolutely no other theme types allowed
      2. Each theme name MUST start with or clearly reference ${selectedClassicTheme} 
      3. Blend the ${selectedClassicTheme} theme with the child's specific interests from their current favorites
      4. If child mentions specific characters (e.g., Iron Man, Hulk, Batman, Spider-Man), create ${selectedClassicTheme} variations featuring ONLY those characters
      5. Keep all decorations, activities, and colors within the ${selectedClassicTheme} universe while adding personal touches

      SPECIFIC EXAMPLES - FOLLOW THESE PATTERNS EXACTLY:
      - If ${selectedClassicTheme} = "Superhero" and child loves "Iron Man": "Iron Man Superhero Tech Party", "Iron Man Hero Workshop", "Stark Industries Superhero Training", "Iron Man Armor Building Party", "Tony Stark Superhero Academy"
      - If ${selectedClassicTheme} = "Superhero" and child loves "Hulk": "Hulk Superhero Smash Party", "Green Guardian Superhero Adventure", "Incredible Hulk Hero Training", "Hulk Smash Superhero Academy"
      - If ${selectedClassicTheme} = "Princess" and child loves "Frozen": "Frozen Princess Ice Palace", "Elsa Princess Winter Wonderland", "Anna & Elsa Princess Adventure"
      
      ABSOLUTELY FORBIDDEN: Creating themes like unicorns, dinosaurs, space explorers, pirates, or any non-${selectedClassicTheme} themes. ONLY ${selectedClassicTheme} variations are allowed.`
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

ULTRA CRITICAL CONTEXT ADHERENCE RULES - FOLLOW EXACTLY:
${selectedClassicTheme ? `
- You are ONLY creating variations of ${selectedClassicTheme} theme - NO OTHER THEMES ALLOWED EVER
- If child loves Iron Man, create ONLY Iron Man superhero variations: "Iron Man Superhero Tech Lab", "Iron Man Armor Building Party", "Stark Industries Superhero Academy"
- If child loves Hulk, create ONLY Hulk superhero variations: "Hulk Superhero Smash Party", "Incredible Hulk Hero Training", "Green Guardian Superhero Adventure"
- If child loves Batman, create ONLY Batman superhero variations: "Batman Superhero Gotham Academy", "Dark Knight Hero Training", "Batman Cave Superhero Party"
- Theme names must clearly indicate they are ${selectedClassicTheme} variations with the child's favorite character
- All decorations, activities, and colors must stay within ${selectedClassicTheme} universe while incorporating child's favorites
- ABSOLUTELY FORBIDDEN: Creating unicorns, dinosaurs, space explorers, pirates, or any non-${selectedClassicTheme} themes - even if mentioned by child
- EXAMPLE VIOLATION: If superhero theme is selected, NEVER suggest "Unicorn Magic Party" or "Dinosaur Adventure" - these are completely forbidden
` : `
- Themes must be HIGHLY CONTEXTUAL and directly relate to the child's specific interests and current favorites
- If interests include specific characters, movies, or shows, EVERY theme must incorporate these elements
- DO NOT suggest unrelated themes unless they directly match the child's specific interests
`}
- Each theme name should reference the child's actual interests and favorites mentioned in their details
- Color palettes must incorporate the child's favorite colors where specified
- Activities must be directly related to the child's stated interests and the theme context
- Provide detailed explanations of why each theme matches this specific child's interests

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
          content: `You are an extremely creative and imaginative party planning expert specializing in personalized kids birthday parties. 

ABSOLUTE REQUIREMENTS - ZERO TOLERANCE FOR VIOLATIONS:
${selectedClassicTheme ? `
- You are creating ONLY ${selectedClassicTheme} theme variations - NO EXCEPTIONS WHATSOEVER
- If child mentions Iron Man, create ONLY superhero themes with Iron Man: "Iron Man Tech Superhero Party", "Tony Stark Superhero Lab", "Iron Man Armor Academy"
- If child mentions Hulk, create ONLY superhero themes with Hulk: "Hulk Smash Superhero Training", "Green Giant Superhero Academy", "Incredible Hulk Hero Party"
- Theme names must clearly show they are ${selectedClassicTheme} variations with the specific character
- All suggestions must stay within ${selectedClassicTheme} universe while adding personal touches
- ZERO TOLERANCE: Suggesting unicorns, dinosaurs, space explorers, or other themes is COMPLETELY FORBIDDEN - even if child mentions them
- VIOLATION EXAMPLES TO NEVER DO: "Unicorn Magic Party", "Dinosaur Discovery", "Space Explorer Mission" - these are banned when classic theme is selected
` : `
- Create themes that are HIGHLY CONTEXTUAL and directly related to the child's specific interests
- If child mentions specific characters, movies, or shows, incorporate those exact elements
- DO NOT suggest generic themes that don't match the child's stated interests
`}
- Always respond with valid JSON only, no additional text
- Be extremely creative with personalization while staying strictly within the specified context
- Match score should reflect how well the theme incorporates the child's specific interests`
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
      
      // Validate and ensure we have 3-5 recommendations
      if (!Array.isArray(recommendations) || recommendations.length < 3) {
        throw new Error('Invalid recommendations format');
      }

      // Additional validation for classic theme recommendations - ULTRA STRICT FILTERING
      let validatedRecommendations = recommendations;
      if (selectedClassicTheme) {
        validatedRecommendations = recommendations.filter(rec => {
          // Check if theme name contains the selected classic theme or related keywords
          const themeName = rec.name.toLowerCase();
          const themeDescription = rec.description.toLowerCase();
          const selectedThemeLower = selectedClassicTheme.toLowerCase();
          
          // STRICT VALIDATION: Must contain the classic theme or allowed variations
          const isValidTheme = themeName.includes(selectedThemeLower) || 
                              themeDescription.includes(selectedThemeLower) ||
                              (selectedThemeLower === 'superhero' && (
                                themeName.includes('hero') || 
                                themeName.includes('super') ||
                                themeName.includes('iron man') ||
                                themeName.includes('hulk') ||
                                themeName.includes('batman') ||
                                themeName.includes('spider') ||
                                themeName.includes('captain') ||
                                themeName.includes('avenger') ||
                                themeName.includes('stark') ||
                                themeName.includes('marvel') ||
                                themeName.includes('dc')
                              )) ||
                              (selectedThemeLower === 'princess' && (themeName.includes('princess') || themeName.includes('royal'))) ||
                              (selectedThemeLower === 'dinosaur' && themeName.includes('dino')) ||
                              (selectedThemeLower === 'space' && (themeName.includes('space') || themeName.includes('astronaut') || themeName.includes('rocket'))) ||
                              (selectedThemeLower === 'safari' && (themeName.includes('safari') || themeName.includes('jungle') || themeName.includes('animal'))) ||
                              (selectedThemeLower === 'ocean' && (themeName.includes('ocean') || themeName.includes('sea') || themeName.includes('mermaid'))) ||
                              (selectedThemeLower === 'pirate' && themeName.includes('pirate')) ||
                              (selectedThemeLower === 'unicorn' && themeName.includes('unicorn'));
          
          // AGGRESSIVE FILTERING: Remove any themes that contain forbidden keywords for the selected classic theme
          const forbiddenKeywords: string[] = [];
          if (selectedThemeLower === 'superhero') {
            forbiddenKeywords.push('unicorn', 'dinosaur', 'dino', 'pirate', 'safari', 'jungle', 'ocean', 'mermaid', 'princess', 'royal');
          } else if (selectedThemeLower === 'princess') {
            forbiddenKeywords.push('superhero', 'hero', 'dinosaur', 'dino', 'pirate', 'safari', 'jungle', 'ocean', 'unicorn');
          } else if (selectedThemeLower === 'dinosaur') {
            forbiddenKeywords.push('superhero', 'hero', 'princess', 'unicorn', 'pirate', 'ocean', 'mermaid');
          }
          
          const hasForbiddenKeywords = forbiddenKeywords.some(keyword => 
            themeName.includes(keyword) || themeDescription.includes(keyword)
          );
          
          return isValidTheme && !hasForbiddenKeywords;
        });

        // If no valid themes found, return fallback for classic theme
        if (validatedRecommendations.length === 0) {
          console.log(`No valid ${selectedClassicTheme} variations found, using fallback`);
          return NextResponse.json({
            error: `AI generated themes not matching ${selectedClassicTheme}`,
            fallback: true,
            recommendations: getFallbackRecommendations(childName, age, interests, selectedClassicTheme, childDetails)
          });
        }
      }

      // Sort by match score and take top 5
      const sortedRecommendations = validatedRecommendations
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
        recommendations: getFallbackRecommendations(childName, age, interests, undefined, childDetails)
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
      recommendations: getFallbackRecommendations(body.childName, body.age, body.interests, body.selectedClassicTheme, body.childDetails)
    });
  }
}

function getFallbackRecommendations(childName: string, age: number, interests: string[], selectedClassicTheme?: string, childDetails?: string): ThemeRecommendation[] {
  // If a classic theme is selected, return fallback variations of that specific theme
  if (selectedClassicTheme) {
    const themeLower = selectedClassicTheme.toLowerCase();
    
    if (themeLower === 'superhero') {
      // Check if Iron Man is mentioned in child details
      const hasIronMan = (childDetails && childDetails.toLowerCase().includes('iron man')) || 
                         interests.some(interest => interest.toLowerCase().includes('iron man'));
      
      if (hasIronMan) {
        return [
          {
            id: 'ironman-superhero-1',
            name: 'Iron Man Tech Superhero Party',
            description: 'Step into Tony Stark\'s workshop and become a high-tech superhero with Iron Man!',
            whyRecommended: `Perfect for ${childName} who loves Iron Man - featuring Tony Stark's amazing technology and superhero adventures!`,
            colorPalette: ['#DC143C', '#FFD700', '#C0C0C0', '#000000'],
            decorations: ['Arc reactor lights', 'Stark Industries banners', 'Iron Man suit displays', 'High-tech workshop setup'],
            activities: ['Build your own arc reactor', 'Iron Man suit design challenge', 'Tony Stark invention workshop'],
            printableIdeas: ['Iron Man mask templates', 'Stark Industries ID cards'],
            emoji: '🤖',
            ageAppropriate: age >= 3,
            matchScore: 98
          },
          {
            id: 'ironman-superhero-2',
            name: 'Stark Industries Superhero Academy',
            description: 'Train at Tony Stark\'s exclusive superhero academy and master Iron Man technology!',
            whyRecommended: `Designed for ${childName} who loves Iron Man - combines superhero training with high-tech adventures!`,
            colorPalette: ['#FF0000', '#FFD700', '#4169E1', '#C0C0C0'],
            decorations: ['Stark Industries logo displays', 'High-tech training equipment', 'Iron Man workshop station'],
            activities: ['Superhero tech training', 'Iron Man flight simulator', 'Arc reactor power tests'],
            printableIdeas: ['Superhero tech certificates', 'Iron Man blueprint coloring pages'],
            emoji: '⚡',
            ageAppropriate: true,
            matchScore: 96
          },
          {
            id: 'ironman-superhero-3',
            name: 'Iron Man Armor Building Party',
            description: 'Design and build your own Iron Man armor with superhero engineering!',
            whyRecommended: `Perfect for ${childName} who loves Iron Man - focuses on building and creating like Tony Stark!`,
            colorPalette: ['#DC143C', '#FFD700', '#000000', '#C0C0C0'],
            decorations: ['Iron Man armor displays', 'Building station setups', 'Superhero workshop theme'],
            activities: ['Design custom Iron Man suit', 'Arc reactor building challenge', 'Superhero armor testing'],
            printableIdeas: ['Iron Man suit blueprints', 'Superhero engineer certificates'],
            emoji: '🔧',
            ageAppropriate: true,
            matchScore: 94
          }
        ];
      }
      
      // Default superhero fallbacks if no Iron Man mentioned
      return [
        {
          id: 'superhero-classic-1',
          name: 'Classic Superhero Adventure',
          description: 'Transform into mighty heroes and save the day with action-packed adventures!',
          whyRecommended: `Perfect for ${childName} who selected the Superhero theme - classic hero fun!`,
          colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'],
          decorations: ['Cape station with personalized capes', 'Cityscape backdrop with buildings', 'Comic book speech bubble props'],
          activities: ['Hero training obstacle course', 'Design your own superhero logo', 'Villain capture game'],
          printableIdeas: ['Superhero certificates', 'Comic book coloring pages'],
          emoji: '🦸‍♂️',
          ageAppropriate: age >= 3,
          matchScore: 90
        },
        {
          id: 'superhero-classic-2',
          name: 'Super Hero Training Academy',
          description: 'Train to become the ultimate superhero at our special hero academy!',
          whyRecommended: `Designed for ${childName} who loves superhero adventures and wants to train like a real hero!`,
          colorPalette: ['#DC143C', '#4169E1', '#FFD700', '#32CD32'],
          decorations: ['Training course obstacles', 'Hero academy banners', 'Power-up stations'],
          activities: ['Superhero fitness challenges', 'Power discovery games', 'Hero team missions'],
          printableIdeas: ['Hero training certificates', 'Superhero ID cards'],
          emoji: '💪',
          ageAppropriate: true,
          matchScore: 88
        },
        {
          id: 'superhero-classic-3',
          name: 'Marvel & DC Heroes Unite',
          description: 'Celebrate with all your favorite superheroes from Marvel and DC universes!',
          whyRecommended: `Perfect for ${childName} who loves all kinds of superheroes and comic book adventures!`,
          colorPalette: ['#FF0000', '#0000FF', '#008000', '#FFFF00'],
          decorations: ['Mixed superhero logos', 'Comic book panels', 'Hero vs villain scenes'],
          activities: ['Design custom superhero', 'Save the city missions', 'Comic book creation'],
          printableIdeas: ['Mixed hero coloring pages', 'Create your superhero worksheet'],
          emoji: '🦸‍♀️',
          ageAppropriate: true,
          matchScore: 85
        }
      ];
    }
    
    // Add similar patterns for other classic themes
    const classicThemeTemplates = {
      princess: {
        name: 'Princess',
        emoji: '👸',
        colors: ['#FF69B4', '#9370DB', '#FFB6C1', '#F0E68C'],
        baseActivities: ['Royal ball dancing', 'Crown decorating', 'Princess etiquette lessons']
      },
      dinosaur: {
        name: 'Dinosaur',
        emoji: '🦕',
        colors: ['#228B22', '#8B4513', '#DAA520', '#CD853F'],
        baseActivities: ['Fossil dig adventure', 'Dinosaur discovery games', 'Prehistoric exploration']
      },
      space: {
        name: 'Space Explorer',
        emoji: '🚀',
        colors: ['#4B0082', '#000080', '#C0C0C0', '#FFD700'],
        baseActivities: ['Rocket building', 'Planet exploration', 'Astronaut training']
      },
      safari: {
        name: 'Safari Adventure',
        emoji: '🦁',
        colors: ['#228B22', '#DAA520', '#8B4513', '#CD853F'],
        baseActivities: ['Animal tracking', 'Jungle exploration', 'Wildlife photography']
      },
      ocean: {
        name: 'Ocean Adventure',
        emoji: '🌊',
        colors: ['#0000FF', '#00CED1', '#20B2AA', '#87CEEB'],
        baseActivities: ['Deep sea diving', 'Marine life discovery', 'Treasure hunting']
      },
      pirate: {
        name: 'Pirate Adventure',
        emoji: '🏴‍☠️',
        colors: ['#8B4513', '#FFD700', '#000000', '#FF0000'],
        baseActivities: ['Treasure hunt', 'Pirate ship sailing', 'Map reading adventure']
      },
      unicorn: {
        name: 'Unicorn Magic',
        emoji: '🦄',
        colors: ['#FF69B4', '#9370DB', '#FFB6C1', '#F0E68C'],
        baseActivities: ['Magic spell casting', 'Rainbow creation', 'Unicorn care workshop']
      }
    };
    
    const template = classicThemeTemplates[themeLower as keyof typeof classicThemeTemplates];
    if (template) {
      return [
        {
          id: `${themeLower}-classic-1`,
          name: `Classic ${template.name} Party`,
          description: `Experience the magic of ${template.name.toLowerCase()} adventures!`,
          whyRecommended: `Perfect for ${childName} who selected the ${selectedClassicTheme} theme!`,
          colorPalette: template.colors,
          decorations: [`${template.name} themed decorations`, `${template.name} backdrop`, `${template.name} party props`],
          activities: template.baseActivities,
          printableIdeas: [`${template.name} coloring pages`, `${template.name} activity sheets`],
          emoji: template.emoji,
          ageAppropriate: true,
          matchScore: 90
        }
      ];
    }
  }
  
  // Default fallback themes for custom theme mode
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