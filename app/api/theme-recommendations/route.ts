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
      ? `ULTRA CRITICAL INSTRUCTION: You MUST create ONLY ${selectedClassicTheme} theme variations that DIRECTLY incorporate the child's specific text input from "Current Favorites / Recent Hobbies". 

      ABSOLUTE MANDATORY REQUIREMENTS - ZERO TOLERANCE FOR VIOLATIONS:
      1. ALL themes MUST be ${selectedClassicTheme} variations - NO OTHER THEME TYPES WHATSOEVER
      2. Each theme name MUST explicitly combine ${selectedClassicTheme} with elements from the child's text input
      3. If child's text input mentions specific characters, movies, shows, or interests, ALL themes must incorporate those EXACT elements within the ${selectedClassicTheme} context
      4. The child's text input is THE PRIMARY SOURCE for personalization - it takes absolute precedence over everything else
      5. Ignore any contradictory information - focus ONLY on ${selectedClassicTheme} + child's specific text input

      TEXT INPUT PROCESSING RULES:
      - Parse the "Current Favorites / Recent Hobbies" field for specific mentions
      - Extract character names, movie titles, show names, specific interests
      - Create ${selectedClassicTheme} themes that feature these exact elements
      - Example: If text says "loves Spider-Man" and theme is Superhero → create ONLY Spider-Man superhero themes
      - Example: If text says "obsessed with Iron Man" and theme is Superhero → create ONLY Iron Man superhero themes

      CRITICAL EXAMPLES TO FOLLOW EXACTLY:
      - Text Input: "Iron Man" + Theme: "Superhero" → "Iron Man Superhero Tech Lab", "Tony Stark Superhero Academy", "Iron Man Armor Workshop Party"
      - Text Input: "Spider-Man" + Theme: "Superhero" → "Spider-Man Web Slinger Party", "Peter Parker Superhero Training", "Amazing Spider-Man Hero Academy"
      - Text Input: "Frozen, Elsa" + Theme: "Princess" → "Frozen Princess Ice Castle", "Queen Elsa Princess Party", "Anna & Elsa Royal Adventure"
      
      ABSOLUTELY FORBIDDEN: Any themes that don't combine ${selectedClassicTheme} with the child's specific text input. NO generic themes allowed.`
      : `ULTRA CRITICAL INSTRUCTION: Create themes that DIRECTLY incorporate the child's specific text input from "Current Favorites / Recent Hobbies".

      TEXT INPUT PRIORITY RULES:
      1. The child's text input is THE PRIMARY source for theme creation
      2. Extract specific character names, movies, shows, interests, and general themes from the text
      3. Create themes that feature these EXACT elements prominently
      4. If text mentions "Spider-Man", create Spider-Man themed parties
      5. If text mentions "Unicorn", create Unicorn themed parties
      6. If text mentions "beach", create beach-themed art and craft parties
      7. If text mentions general themes like "art", "music", "sports", create themed parties around those interests
      8. Match the themes EXACTLY to what the child currently loves, including both specific characters AND general interests

      Based on the following inputs, suggest 3-5 creative and trending kids' birthday party themes that DIRECTLY reflect the child's specific text input about their current favorites.`

    const prompt = `${baseInstructions} For each theme, include: (1) theme name and short fun description, (2) why it matches this child (cite details!), (3) suggested activities or games for that theme, (4) suggested color palette and decorations, and (5) one or two printable ideas. Here are the child's details:
- Name: ${childName}
- Gender: ${childGender || 'Not specified'}  
- Age / DOB: ${age} years old
- Interests: ${interests.join(', ') || 'Not specified'}
- Favorite Color: ${favoriteColors.length > 0 ? favoriteColors.join(', ') : 'Not specified'}
- Theme Selected: ${selectedClassicTheme ? 'Classic theme' : 'Custom Theme'}
- Current Favorites / Recent Hobbies: ${childDetails || 'Not specified'}
${selectedClassicTheme ? `- Selected Classic Theme: ${selectedClassicTheme} (create personalized variations of this theme)` : ''}

ULTRA CRITICAL TEXT INPUT ADHERENCE RULES - FOLLOW EXACTLY:
${selectedClassicTheme ? `
- MANDATORY: Parse the child's text input "${childDetails || 'Not specified'}" and extract ALL specific mentions
- You are ONLY creating ${selectedClassicTheme} variations that incorporate these EXACT text input elements
- If text input mentions "Iron Man", create ONLY Iron Man ${selectedClassicTheme} variations: "Iron Man ${selectedClassicTheme} Tech Lab", "Tony Stark ${selectedClassicTheme} Academy"
- If text input mentions "Spider-Man", create ONLY Spider-Man ${selectedClassicTheme} variations: "Spider-Man ${selectedClassicTheme} Web Party", "Peter Parker ${selectedClassicTheme} Training"
- If text input mentions any character/movie/show, ALL themes must feature that EXACT element within ${selectedClassicTheme} context
- Theme names must combine ${selectedClassicTheme} + specific text input mentions
- ZERO TOLERANCE: Any theme not directly incorporating the child's text input is FORBIDDEN
- Example: If text says "loves Iron Man" + Superhero theme → ONLY Iron Man superhero themes allowed
` : `
- MANDATORY: Parse the child's text input "${childDetails || 'Not specified'}" and extract ALL specific mentions
- Create themes that DIRECTLY feature what the child mentioned in their text input
- If text mentions "Spider-Man", create ONLY Spider-Man themed parties
- If text mentions "Unicorn", create ONLY Unicorn themed parties  
- If text mentions "Iron Man", create ONLY Iron Man themed parties
- Every theme must prominently feature elements from the child's specific text input
- NO generic themes - only themes based on the child's actual stated favorites
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
          content: `You are an expert party planning AI that MUST follow text input instructions with absolute precision.

CRITICAL TEXT INPUT PROCESSING - MANDATORY COMPLIANCE:
1. The child's "Current Favorites / Recent Hobbies" text input: "${childDetails || 'Not specified'}"
2. This text input is your PRIMARY directive - analyze it for specific character names, movies, shows, interests
3. Create ALL themes based on what is specifically mentioned in this text input

${selectedClassicTheme ? `
CLASSIC THEME CONSTRAINTS:
- Theme Type: ${selectedClassicTheme} ONLY
- Text Input: "${childDetails || 'Not specified'}"
- REQUIREMENT: Every theme must be a ${selectedClassicTheme} variation featuring elements from the text input
- If text mentions "Iron Man" → Create ONLY "Iron Man ${selectedClassicTheme}" themes: "Iron Man ${selectedClassicTheme} Tech Party", "Tony Stark ${selectedClassicTheme} Academy"
- If text mentions "Spider-Man" → Create ONLY "Spider-Man ${selectedClassicTheme}" themes: "Spider-Man ${selectedClassicTheme} Web Adventure", "Peter Parker ${selectedClassicTheme} Training"
- If text mentions any specific element → ALL themes must combine ${selectedClassicTheme} + that element
- ABSOLUTE PROHIBITION: Any theme not combining ${selectedClassicTheme} with the text input is FORBIDDEN
` : `
CUSTOM THEME MODE:
- Text Input: "${childDetails || 'Not specified'}"
- REQUIREMENT: Create themes based EXCLUSIVELY on what is mentioned in the text input
- If text mentions "Spider-Man" → Create ONLY Spider-Man themed parties
- If text mentions "Unicorn" → Create ONLY Unicorn themed parties
- If text mentions "Iron Man" → Create ONLY Iron Man themed parties
- If text mentions "beach" → Create ONLY beach-themed art and craft parties
- If text mentions "art" or "craft" → Create ONLY art and craft themed parties
- If text mentions general interests → Create themed parties around those specific interests
- Match the themes EXACTLY to the specific favorites mentioned
`}

VALIDATION RULES:
- Every theme name must contain elements from the text input
- Every "whyRecommended" must reference specific text input mentions
- Activities and decorations must relate to the text input elements
- Match scores must reflect text input alignment (90+ for direct matches)
- Respond ONLY with valid JSON array, no additional text`
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

      // TEXT INPUT VALIDATION - ULTRA STRICT FILTERING BASED ON USER INPUT
      let validatedRecommendations = recommendations;
      
      // Extract keywords from child's text input for validation
      const extractTextInputKeywords = (text: string): string[] => {
        if (!text || text.trim() === '' || text === 'Not specified') return [];
        
        const keywords: string[] = [];
        const lowerText = text.toLowerCase();
        
        // Common character names, franchises, and theme keywords
        const characterPatterns = [
          'iron man', 'spider-man', 'spiderman', 'batman', 'superman', 'hulk', 'captain america', 'thor',
          'elsa', 'anna', 'frozen', 'moana', 'belle', 'ariel', 'cinderella', 'rapunzel',
          'dinosaur', 'dino', 't-rex', 'triceratops', 'stegosaurus',
          'unicorn', 'rainbow', 'sparkle', 'magic',
          'pirate', 'treasure', 'ship', 'ocean', 'mermaid',
          'space', 'astronaut', 'rocket', 'planet', 'star',
          'safari', 'lion', 'elephant', 'giraffe', 'jungle',
          // Art & Craft theme keywords
          'beach', 'sea', 'sand', 'waves', 'seashell', 'seaside', 'coastal', 'summer',
          'painting', 'drawing', 'art', 'craft', 'creative', 'colors', 'brushes', 'canvas',
          'pottery', 'sculpture', 'crafting', 'diy', 'handmade', 'artistic',
          // Additional theme keywords
          'music', 'dance', 'singing', 'instruments', 'dancing', 'ballet',
          'sports', 'soccer', 'football', 'basketball', 'tennis', 'swimming',
          'nature', 'forest', 'garden', 'flowers', 'plants', 'outdoors',
          'cooking', 'baking', 'chef', 'kitchen', 'food', 'recipes'
        ];
        
        characterPatterns.forEach(pattern => {
          if (lowerText.includes(pattern)) {
            keywords.push(pattern);
          }
        });
        
        return keywords;
      };
      
      const textInputKeywords = extractTextInputKeywords(childDetails || '');
      
      // Validate themes based on text input alignment
      if (textInputKeywords.length > 0) {
        validatedRecommendations = recommendations.filter(rec => {
          const themeName = rec.name.toLowerCase();
          const themeDescription = rec.description.toLowerCase();
          const whyRecommended = rec.whyRecommended.toLowerCase();
          
          // Check if theme incorporates text input keywords
          const hasTextInputAlignment = textInputKeywords.some(keyword => 
            themeName.includes(keyword) || 
            themeDescription.includes(keyword) || 
            whyRecommended.includes(keyword)
          );
          
          // For classic themes, also validate theme type
          if (selectedClassicTheme) {
            const selectedThemeLower = selectedClassicTheme.toLowerCase();
            const hasClassicThemeReference = themeName.includes(selectedThemeLower) || 
                                           themeDescription.includes(selectedThemeLower) ||
                                           (selectedThemeLower === 'superhero' && (themeName.includes('hero') || themeName.includes('super'))) ||
                                           (selectedThemeLower === 'princess' && (themeName.includes('princess') || themeName.includes('royal'))) ||
                                           (selectedThemeLower === 'dinosaur' && themeName.includes('dino')) ||
                                           (selectedThemeLower === 'space' && (themeName.includes('space') || themeName.includes('astronaut'))) ||
                                           (selectedThemeLower === 'safari' && (themeName.includes('safari') || themeName.includes('jungle'))) ||
                                           (selectedThemeLower === 'ocean' && (themeName.includes('ocean') || themeName.includes('sea'))) ||
                                           (selectedThemeLower === 'pirate' && themeName.includes('pirate')) ||
                                           (selectedThemeLower === 'unicorn' && themeName.includes('unicorn'));
            
            return hasTextInputAlignment && hasClassicThemeReference;
          }
          
          return hasTextInputAlignment;
        });
        
        // Log validation results for debugging
        console.log(`Text input keywords: ${textInputKeywords.join(', ')}`);
        console.log(`Original recommendations: ${recommendations.length}, Validated: ${validatedRecommendations.length}`);
        
        // If no themes match text input, return fallback
        if (validatedRecommendations.length === 0) {
          console.log('No themes matched text input, using text-aware fallback');
          return NextResponse.json({
            error: 'AI generated themes not matching text input',
            fallback: true,
            recommendations: getFallbackRecommendations(childName, age, interests, selectedClassicTheme, childDetails)
          });
        }
      } else if (selectedClassicTheme) {
        // Standard classic theme validation when no text input provided
        validatedRecommendations = recommendations.filter(rec => {
          const themeName = rec.name.toLowerCase();
          const themeDescription = rec.description.toLowerCase();
          const selectedThemeLower = selectedClassicTheme.toLowerCase();
          
          return themeName.includes(selectedThemeLower) || 
                 themeDescription.includes(selectedThemeLower) ||
                 (selectedThemeLower === 'superhero' && (themeName.includes('hero') || themeName.includes('super'))) ||
                 (selectedThemeLower === 'princess' && (themeName.includes('princess') || themeName.includes('royal'))) ||
                 (selectedThemeLower === 'dinosaur' && themeName.includes('dino')) ||
                 (selectedThemeLower === 'space' && (themeName.includes('space') || themeName.includes('astronaut'))) ||
                 (selectedThemeLower === 'safari' && (themeName.includes('safari') || themeName.includes('jungle'))) ||
                 (selectedThemeLower === 'ocean' && (themeName.includes('ocean') || themeName.includes('sea'))) ||
                 (selectedThemeLower === 'pirate' && themeName.includes('pirate')) ||
                 (selectedThemeLower === 'unicorn' && themeName.includes('unicorn'));
        });
        
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
  // Enhanced text input analysis for fallback recommendations
  const analyzeTextInput = (text: string): { characters: string[]; themes: string[]; interests: string[] } => {
    if (!text || text.trim() === '' || text === 'Not specified') return { characters: [], themes: [], interests: [] };
    
    const lowerText = text.toLowerCase();
    const characters: string[] = [];
    const themes: string[] = [];
    const textInterests: string[] = [];
    
    // Character detection
    if (lowerText.includes('iron man')) characters.push('Iron Man');
    if (lowerText.includes('spider-man') || lowerText.includes('spiderman')) characters.push('Spider-Man');
    if (lowerText.includes('batman')) characters.push('Batman');
    if (lowerText.includes('superman')) characters.push('Superman');
    if (lowerText.includes('hulk')) characters.push('Hulk');
    if (lowerText.includes('elsa') || lowerText.includes('frozen')) characters.push('Elsa/Frozen');
    if (lowerText.includes('anna')) characters.push('Anna');
    if (lowerText.includes('moana')) characters.push('Moana');
    
    // Theme detection
    if (lowerText.includes('superhero') || lowerText.includes('hero')) themes.push('superhero');
    if (lowerText.includes('princess')) themes.push('princess');
    if (lowerText.includes('dinosaur') || lowerText.includes('dino')) themes.push('dinosaur');
    if (lowerText.includes('unicorn')) themes.push('unicorn');
    if (lowerText.includes('space') || lowerText.includes('astronaut')) themes.push('space');
    if (lowerText.includes('pirate')) themes.push('pirate');
    if (lowerText.includes('ocean') || lowerText.includes('mermaid')) themes.push('ocean');
    if (lowerText.includes('safari') || lowerText.includes('jungle')) themes.push('safari');
    if (lowerText.includes('beach') || lowerText.includes('sea') || lowerText.includes('sand') || lowerText.includes('seaside')) themes.push('beach');
    if (lowerText.includes('art') || lowerText.includes('craft') || lowerText.includes('painting') || lowerText.includes('drawing')) themes.push('art');
    
    return { characters, themes, interests: textInterests };
  };
  
  const textAnalysis = analyzeTextInput(childDetails || '');
  
  // If a classic theme is selected, return fallback variations of that specific theme
  if (selectedClassicTheme) {
    const themeLower = selectedClassicTheme.toLowerCase();
    
    if (themeLower === 'superhero') {
      // Check for specific superhero characters in text input
      if (textAnalysis.characters.includes('Iron Man')) {
        return [
          {
            id: 'ironman-superhero-1',
            name: 'Iron Man Tech Superhero Party',
            description: 'Step into Tony Stark\'s workshop and become a high-tech superhero with Iron Man!',
            whyRecommended: `Perfect for ${childName} who loves Iron Man (mentioned in their favorites) - featuring Tony Stark's amazing technology and superhero adventures!`,
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
            whyRecommended: `Designed for ${childName} who loves Iron Man (from their text input) - combines superhero training with high-tech adventures!`,
            colorPalette: ['#FF0000', '#FFD700', '#4169E1', '#C0C0C0'],
            decorations: ['Stark Industries logo displays', 'High-tech training equipment', 'Iron Man workshop station'],
            activities: ['Superhero tech training', 'Iron Man flight simulator', 'Arc reactor power tests'],
            printableIdeas: ['Superhero tech certificates', 'Iron Man blueprint coloring pages'],
            emoji: '⚡',
            ageAppropriate: true,
            matchScore: 96
          }
        ];
      }
      
      if (textAnalysis.characters.includes('Spider-Man')) {
        return [
          {
            id: 'spiderman-superhero-1',
            name: 'Spider-Man Web Slinger Party',
            description: 'Swing into action with Spider-Man and experience amazing web-slinging adventures!',
            whyRecommended: `Perfect for ${childName} who loves Spider-Man (mentioned in their favorites) - featuring web-slinging action and superhero fun!`,
            colorPalette: ['#FF0000', '#0000FF', '#FFFFFF', '#000000'],
            decorations: ['Spider web decorations', 'New York City skyline', 'Spider-Man suit displays', 'Web shooter stations'],
            activities: ['Web shooter practice', 'Spider-Man obstacle course', 'Superhero photo booth'],
            printableIdeas: ['Spider-Man mask templates', 'Web pattern coloring pages'],
            emoji: '🕷️',
            ageAppropriate: age >= 3,
            matchScore: 98
          },
          {
            id: 'spiderman-superhero-2',
            name: 'Amazing Spider-Man Hero Academy',
            description: 'Train with Spider-Man at the amazing superhero academy!',
            whyRecommended: `Designed for ${childName} who loves Spider-Man (from their text input) - superhero training with web-slinging action!`,
            colorPalette: ['#DC143C', '#0000FF', '#FFD700', '#FFFFFF'],
            decorations: ['Spider web training course', 'Hero academy banners', 'Spider-Man equipment'],
            activities: ['Web-slinging training', 'Spider sense games', 'Superhero team missions'],
            printableIdeas: ['Spider-Man certificates', 'Superhero training sheets'],
            emoji: '🦸‍♂️',
            ageAppropriate: true,
            matchScore: 96
          }
        ];
      }
      
      // Default superhero fallbacks if no specific character mentioned
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
  
  // For custom themes, prioritize text input analysis for fallback recommendations
  if (textAnalysis.characters.length > 0 || textAnalysis.themes.length > 0) {
    const textBasedThemes: ThemeRecommendation[] = [];
    
    // Generate themes based on specific characters mentioned
    if (textAnalysis.characters.includes('Iron Man')) {
      textBasedThemes.push({
        id: 'ironman-custom-1',
        name: 'Iron Man Tech Hero Party',
        description: 'Step into Tony Stark\'s high-tech world with arc reactors and superhero engineering!',
        whyRecommended: `Perfect for ${childName} who loves Iron Man (mentioned in their favorites) - featuring all their favorite tech superhero elements!`,
        colorPalette: ['#DC143C', '#FFD700', '#C0C0C0', '#000000'],
        decorations: ['Arc reactor centerpieces', 'Stark Industries banners', 'Iron Man suit displays'],
        activities: ['Build arc reactors', 'Iron Man suit design workshop', 'Tech inventor challenges'],
        printableIdeas: ['Iron Man mask templates', 'Stark Industries certificates'],
        emoji: '🤖',
        ageAppropriate: true,
        matchScore: 98
      });
    }
    
    if (textAnalysis.characters.includes('Spider-Man')) {
      textBasedThemes.push({
        id: 'spiderman-custom-1',
        name: 'Spider-Man Web Adventure',
        description: 'Swing through New York City with your friendly neighborhood Spider-Man!',
        whyRecommended: `Perfect for ${childName} who loves Spider-Man (mentioned in their favorites) - web-slinging action and superhero fun!`,
        colorPalette: ['#FF0000', '#0000FF', '#FFFFFF', '#000000'],
        decorations: ['Giant spider webs', 'NYC skyline backdrop', 'Spider-Man photo booth'],
        activities: ['Web shooter games', 'Spider obstacle course', 'Hero training challenges'],
        printableIdeas: ['Spider-Man masks', 'Web pattern activity sheets'],
        emoji: '🕷️',
        ageAppropriate: true,
        matchScore: 98
      });
    }
    
    if (textAnalysis.characters.includes('Elsa/Frozen')) {
      textBasedThemes.push({
        id: 'frozen-custom-1',
        name: 'Frozen Ice Palace Adventure',
        description: 'Join Elsa and Anna in the magical kingdom of Arendelle with ice powers and royal fun!',
        whyRecommended: `Perfect for ${childName} who loves Frozen (mentioned in their favorites) - featuring Elsa, Anna, and magical ice adventures!`,
        colorPalette: ['#87CEEB', '#FFFFFF', '#E6E6FA', '#4169E1'],
        decorations: ['Ice castle backdrop', 'Snowflake decorations', 'Frozen character displays'],
        activities: ['Ice power games', 'Frozen sing-along', 'Royal dance party'],
        printableIdeas: ['Elsa crown templates', 'Frozen coloring pages'],
        emoji: '❄️',
        ageAppropriate: true,
        matchScore: 98
      });
    }
    
    // Generate themes based on theme mentions in text
    if (textAnalysis.themes.includes('unicorn')) {
      textBasedThemes.push({
        id: 'unicorn-custom-1',
        name: 'Magical Unicorn Rainbow Party',
        description: 'Enter a world of unicorn magic with rainbows, sparkles, and enchanted adventures!',
        whyRecommended: `Perfect for ${childName} who loves unicorns (mentioned in their favorites) - magical rainbow fun with sparkles and wonder!`,
        colorPalette: ['#FF69B4', '#9370DB', '#FFB6C1', '#F0E68C'],
        decorations: ['Rainbow balloon arches', 'Unicorn horn stations', 'Sparkly cloud decorations'],
        activities: ['Unicorn horn decorating', 'Rainbow treasure hunt', 'Magic potion making'],
        printableIdeas: ['Unicorn coloring pages', 'Magic spell certificates'],
        emoji: '🦄',
        ageAppropriate: true,
        matchScore: 98
      });
    }
    
    if (textAnalysis.themes.includes('beach')) {
      textBasedThemes.push({
        id: 'beach-custom-1',
        name: 'Beach Paradise Art & Craft Party',
        description: 'Create amazing beach-themed art and crafts inspired by seaside adventures!',
        whyRecommended: `Perfect for ${childName} who loves the beach (mentioned in their favorites) - combining beach themes with creative art and craft activities!`,
        colorPalette: ['#00CED1', '#FFE4B5', '#F0E68C', '#87CEEB'],
        decorations: ['Seashell art stations', 'Beach umbrella decorations', 'Sand castle displays', 'Ocean wave backdrops'],
        activities: ['Seashell painting workshop', 'Sand art bottles crafting', 'Beach scene canvas painting', 'Driftwood sculpture making'],
        printableIdeas: ['Beach coloring pages', 'Seashell identification charts'],
        emoji: '🏖️',
        ageAppropriate: true,
        matchScore: 98
      });
    }
    
    if (textAnalysis.themes.includes('art')) {
      textBasedThemes.push({
        id: 'art-custom-1',
        name: 'Creative Art & Craft Studio Party',
        description: 'Unleash creativity in a colorful art studio with endless artistic possibilities!',
        whyRecommended: `Perfect for ${childName} who loves art and crafts (mentioned in their favorites) - featuring all their favorite creative activities!`,
        colorPalette: ['#FF6347', '#32CD32', '#FF69B4', '#FFD700'],
        decorations: ['Paint palette table settings', 'Colorful paint splatter banners', 'Artist easel displays', 'Craft supply stations'],
        activities: ['Canvas painting party', 'Clay sculpture workshop', 'Collaborative mural creation', 'DIY craft corner'],
        printableIdeas: ['Artist certificate templates', 'Color-by-number party sheets'],
        emoji: '🎨',
        ageAppropriate: true,
        matchScore: 98
      });
    }
    
    if (textAnalysis.themes.includes('dinosaur')) {
      textBasedThemes.push({
        id: 'dinosaur-custom-1',
        name: 'Prehistoric Dinosaur Discovery',
        description: 'Travel back in time to discover amazing dinosaurs and prehistoric adventures!',
        whyRecommended: `Perfect for ${childName} who loves dinosaurs (mentioned in their favorites) - prehistoric fun with fossil hunting and dino adventures!`,
        colorPalette: ['#228B22', '#8B4513', '#DAA520', '#CD853F'],
        decorations: ['Jungle vines', 'Dinosaur footprints', 'Fossil dig stations'],
        activities: ['Fossil excavation', 'Dinosaur egg hunt', 'Paleontologist training'],
        printableIdeas: ['Dinosaur fact cards', 'Fossil dig certificates'],
        emoji: '🦕',
        ageAppropriate: true,
        matchScore: 98
      });
    }
    
    if (textBasedThemes.length > 0) {
      return textBasedThemes.slice(0, 5);
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