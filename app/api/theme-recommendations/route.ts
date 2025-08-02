import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { shouldBlockAISuggestions } from '@/lib/profanity-filter';

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

    // Check for inappropriate content before processing
    if (childDetails && shouldBlockAISuggestions(childDetails)) {
      return NextResponse.json(
        { 
          error: 'Inappropriate content detected',
          blocked: true,
          message: 'Please use family-friendly language appropriate for children\'s parties.'
        },
        { status: 400 }
      );
    }

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
      - Example: If text says "cricket" and theme is Sports → create ONLY cricket sports themes

      CRITICAL EXAMPLES TO FOLLOW EXACTLY:
      - Text Input: "Iron Man" + Theme: "Superhero" → "Iron Man Superhero Tech Lab", "Tony Stark Superhero Academy", "Iron Man Armor Workshop Party"
      - Text Input: "Spider-Man" + Theme: "Superhero" → "Spider-Man Web Slinger Party", "Peter Parker Superhero Training", "Amazing Spider-Man Hero Academy"
      - Text Input: "Snow White" + Theme: "Princess" → "Snow White Princess Forest Party", "Seven Dwarfs Royal Adventure", "Magic Mirror Princess Quest"
      - Text Input: "Frozen, Elsa" + Theme: "Princess" → "Frozen Princess Ice Castle", "Queen Elsa Princess Party", "Anna & Elsa Royal Adventure"
      - Text Input: "Cinderella" + Theme: "Princess" → "Cinderella Royal Ball Princess Party", "Glass Slipper Princess Adventure", "Fairy Godmother Princess Magic"
      - Text Input: "cricket" + Theme: "Sports" → "Cricket Championship Sports Party", "Cricket Stadium Sports Adventure", "Little Cricket Champion Sports Fun"
      - Text Input: "soccer" + Theme: "Sports" → "Soccer World Cup Sports Party", "Football Field Sports Adventure", "Little Soccer Star Sports Fun"
      
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
          content: `You are an expert party planning AI that MUST follow text input instructions with absolute precision and consistency.

DETERMINISTIC PROCESSING RULES:
- Your responses must be consistent across multiple calls with identical inputs
- Always prioritize the child's specific text input over general interests
- Generate exactly the same themes for identical input combinations

CRITICAL TEXT INPUT PROCESSING - MANDATORY COMPLIANCE:
1. The child's "Current Favorites / Recent Hobbies" text input: "${childDetails || 'Not specified'}"
2. This text input is your PRIMARY directive - analyze it for specific character names, movies, shows, interests
3. Create ALL themes based on what is specifically mentioned in this text input
4. IGNORE GENERIC TERMS: If text input contains only generic terms like "humanoid", "human", "person", use the child's selected interests instead

${selectedClassicTheme ? `
CLASSIC THEME CONSTRAINTS:
- Theme Type: ${selectedClassicTheme} ONLY
- Text Input: "${childDetails || 'Not specified'}"
- REQUIREMENT: Every theme must be a ${selectedClassicTheme} variation featuring elements from the text input
- If text mentions "Star Wars" → Create ONLY "Star Wars ${selectedClassicTheme}" themes: "Star Wars ${selectedClassicTheme} Galaxy Party", "Jedi ${selectedClassicTheme} Training"
- If text mentions "Iron Man" → Create ONLY "Iron Man ${selectedClassicTheme}" themes: "Iron Man ${selectedClassicTheme} Tech Party", "Tony Stark ${selectedClassicTheme} Academy"
- If text mentions "Spider-Man" → Create ONLY "Spider-Man ${selectedClassicTheme}" themes: "Spider-Man ${selectedClassicTheme} Web Adventure", "Peter Parker ${selectedClassicTheme} Training"
- If text mentions any specific element → ALL themes must combine ${selectedClassicTheme} + that element
- ABSOLUTE PROHIBITION: Any theme not combining ${selectedClassicTheme} with the text input is FORBIDDEN
` : `
CUSTOM THEME MODE:
- Text Input: "${childDetails || 'Not specified'}"
- REQUIREMENT: Create themes based EXCLUSIVELY on what is mentioned in the text input
- If text mentions "Star Wars" → Create ONLY Star Wars themed parties
- If text mentions "Spider-Man" → Create ONLY Spider-Man themed parties
- If text mentions "Unicorn" → Create ONLY Unicorn themed parties
- If text mentions "Iron Man" → Create ONLY Iron Man themed parties
- If text mentions "beach" → Create ONLY beach-themed art and craft parties
- If text mentions "art" or "craft" → Create ONLY art and craft themed parties
- If text mentions general interests → Create themed parties around those specific interests
- Match the themes EXACTLY to the specific favorites mentioned
`}

CONSISTENCY REQUIREMENTS:
- Generate identical themes for identical inputs
- Always process text input before falling back to interests
- Maintain consistent theme naming patterns
- Use deterministic ordering for theme recommendations

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
      temperature: 0.8,  // Reduced from 1.1 for more consistent results
      max_tokens: 3000,
      seed: 12345,  // Add consistent seed for deterministic results
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
      
      // Extract keywords from child's text input for validation - ENHANCED FOR HUMANOID DETECTION
      const extractTextInputKeywords = (text: string): string[] => {
        if (!text || text.trim() === '' || text === 'Not specified') return [];
        
        const keywords: string[] = [];
        const lowerText = text.toLowerCase();
        
        // ULTRA-COMPREHENSIVE keyword patterns for accuracy - ENHANCED WITH PRINCESS CHARACTERS
        const characterPatterns = [
          // Star Wars characters and themes - PRIORITY DETECTION
          'star wars', 'jedi', 'luke skywalker', 'darth vader', 'princess leia', 'han solo',
          'chewbacca', 'r2d2', 'c3po', 'obi wan', 'yoda', 'lightsaber', 'force', 'millennium falcon',
          'death star', 'rebel alliance', 'empire', 'stormtrooper', 'x-wing', 'tie fighter',
          // Superhero characters
          'iron man', 'spider-man', 'spiderman', 'batman', 'superman', 'hulk', 'captain america', 'thor',
          'wonder woman', 'aquaman', 'flash', 'green lantern', 'black widow', 'hawkeye', 'ant-man', 'black panther',
          // Disney/Princess characters - EXPANDED FOR BETTER DETECTION
          'snow white', 'seven dwarfs', 'dwarfs', 'dwarf', 'magic mirror', 'poisoned apple', 'evil queen',
          'elsa', 'anna', 'frozen', 'olaf', 'kristoff', 'arendelle', 'let it go',
          'cinderella', 'glass slipper', 'fairy godmother', 'pumpkin carriage', 'prince charming',
          'belle', 'beast', 'beauty and the beast', 'enchanted rose', 'lumiere', 'cogsworth',
          'ariel', 'little mermaid', 'under the sea', 'sebastian', 'flounder', 'ursula', 'triton',
          'rapunzel', 'tangled', 'flynn rider', 'pascal', 'mother gothel', 'lanterns',
          'jasmine', 'aladdin', 'magic carpet', 'genie', 'abu', 'jafar', 'agrabah',
          'moana', 'maui', 'ocean', 'heart of te fiti', 'hei hei', 'pua',
          'tiana', 'princess and the frog', 'new orleans', 'bayou', 'prince naveen',
          'mulan', 'mushu', 'fa mulan', 'china', 'honor', 'reflection',
          'merida', 'brave', 'scotland', 'archery', 'clan', 'will o the wisps',
          'pocahontas', 'john smith', 'colors of the wind', 'grandmother willow',
          'aurora', 'sleeping beauty', 'maleficent', 'spinning wheel', 'prince phillip',
          // Generic descriptors that should be ignored for theme filtering
          'humanoid', 'human', 'person', 'people', 'character', 'figure', 'being',
          // Theme-specific keywords
          'dinosaur', 'dino', 't-rex', 'triceratops', 'stegosaurus', 'pterodactyl', 'brontosaurus',
          'unicorn', 'rainbow', 'sparkle', 'magic', 'fairy', 'pixie', 'magical',
          'pirate', 'treasure', 'ship', 'ocean', 'mermaid', 'sailor', 'captain',
          'space', 'astronaut', 'rocket', 'planet', 'star', 'galaxy', 'alien', 'universe', 'cosmic',
          'safari', 'lion', 'elephant', 'giraffe', 'jungle', 'tiger', 'zebra', 'rhino',
          // Art & Craft theme keywords
          'beach', 'sea', 'sand', 'waves', 'seashell', 'seaside', 'coastal', 'summer', 'tropical',
          'painting', 'drawing', 'art', 'craft', 'creative', 'colors', 'brushes', 'canvas',
          'pottery', 'sculpture', 'crafting', 'diy', 'handmade', 'artistic', 'sketch', 'crayon',
          // Sports theme keywords - ULTRA-COMPREHENSIVE SPORTS COVERAGE
          'sports', 'sport', 'soccer', 'football', 'basketball', 'tennis', 'swimming', 'baseball',
          'cricket', 'hockey', 'volleyball', 'badminton', 'golf', 'rugby', 'athletics',
          'running', 'cycling', 'skating', 'gymnastics', 'wrestling', 'boxing', 'martial arts',
          'track', 'field', 'olympics', 'championship', 'tournament', 'match', 'game', 'player',
          'team', 'coach', 'stadium', 'score', 'win', 'competition',
          // Vehicle themes (for Cars selection)
          'car', 'cars', 'truck', 'bus', 'motorcycle', 'vehicle', 'racing', 'speed', 'wheels',
          'transportation', 'auto', 'drive', 'highway', 'garage',
          // Animal themes (for Animals selection)
          'animal', 'animals', 'pets', 'dog', 'cat', 'bird', 'fish', 'horse', 'cow', 'pig',
          'farm', 'zoo', 'wild', 'domestic', 'mammal', 'reptile',
          // Additional theme keywords
          'music', 'dance', 'singing', 'instruments', 'dancing', 'ballet', 'concert', 'band',
          'nature', 'forest', 'garden', 'flowers', 'plants', 'outdoors', 'camping', 'hiking',
          'cooking', 'baking', 'chef', 'kitchen', 'food', 'recipes', 'restaurant'
        ];
        
        characterPatterns.forEach(pattern => {
          if (lowerText.includes(pattern)) {
            keywords.push(pattern);
          }
        });
        
        return keywords;
      };
      
      const textInputKeywords = extractTextInputKeywords(childDetails || '');
      
      // ENHANCED TEXT INPUT PROCESSING - Handle generic terms
      const isGenericTerm = (text: string): boolean => {
        const genericTerms = ['humanoid', 'human', 'person', 'people', 'character', 'figure', 'being'];
        const lowerText = text.toLowerCase().trim();
        return genericTerms.some(term => lowerText === term || lowerText.includes(term));
      };
      
      // INTELLIGENT CONTEXT ANALYSIS - Skip validation for generic terms
      const hasSpecificKeywords = textInputKeywords.length > 0 && 
        !textInputKeywords.every(keyword => isGenericTerm(keyword));
      
      // Validate themes based on text input alignment - ONLY if specific keywords exist
      if (hasSpecificKeywords) {
        // Filter out generic terms from keyword matching
        const specificKeywords = textInputKeywords.filter(keyword => !isGenericTerm(keyword));
        
        validatedRecommendations = recommendations.filter(rec => {
          const themeName = rec.name.toLowerCase();
          const themeDescription = rec.description.toLowerCase();
          const whyRecommended = rec.whyRecommended.toLowerCase();
          
          // Check if theme incorporates specific (non-generic) text input keywords
          const hasTextInputAlignment = specificKeywords.some(keyword => 
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
                                           (selectedThemeLower === 'safari' && (themeName.includes('safari') || themeName.includes('jungle') || themeName.includes('animal'))) ||
                                           (selectedThemeLower === 'ocean' && (themeName.includes('ocean') || themeName.includes('sea'))) ||
                                           (selectedThemeLower === 'pirate' && themeName.includes('pirate')) ||
                                           (selectedThemeLower === 'unicorn' && themeName.includes('unicorn')) ||
                                           (selectedThemeLower === 'sports' && (themeName.includes('sports') || themeName.includes('sport') || themeName.includes('cricket') || themeName.includes('soccer') || themeName.includes('football') || themeName.includes('basketball') || themeName.includes('tennis')));
            
            return hasTextInputAlignment && hasClassicThemeReference;
          }
          
          return hasTextInputAlignment;
        });
        
        // Log validation results for debugging
        console.log(`Text input keywords (filtered): ${specificKeywords.join(', ')}`);
        console.log(`Original recommendations: ${recommendations.length}, Validated: ${validatedRecommendations.length}`);
        
        // If no themes match specific text input, return fallback
        if (validatedRecommendations.length === 0) {
          console.log('No themes matched specific text input, using text-aware fallback');
          return NextResponse.json({
            error: 'AI generated themes not matching specific text input',
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
                 (selectedThemeLower === 'unicorn' && themeName.includes('unicorn')) ||
                 (selectedThemeLower === 'sports' && (themeName.includes('sports') || themeName.includes('sport') || themeName.includes('cricket') || themeName.includes('soccer') || themeName.includes('football') || themeName.includes('basketball') || themeName.includes('tennis')));
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
  // ULTRA-INTELLIGENT FALLBACK SYSTEM WITH DEFINITIVE RELEVANCE GUARANTEE
  const analyzeTextInput = (text: string): { characters: string[]; themes: string[]; interests: string[]; hasGenericTerms: boolean; isNonContextual: boolean; hasVagueTerms: boolean } => {
    if (!text || text.trim() === '' || text === 'Not specified') return { characters: [], themes: [], interests: [], hasGenericTerms: false, isNonContextual: false, hasVagueTerms: false };
    
    const lowerText = text.toLowerCase().trim();
    const characters: string[] = [];
    const themes: string[] = [];
    const textInterests: string[] = [];
    
    // ENHANCED generic term detection - COMPREHENSIVE LIST
    const genericTerms = ['humanoid', 'human', 'person', 'people', 'character', 'figure', 'being', 'thing', 'something', 'anything', 'random', 'whatever', 'stuff', 'none', 'nothing', 'any', 'generic', 'basic', 'simple', 'regular', 'normal'];
    const hasGenericTerms = genericTerms.some(term => lowerText === term || lowerText.includes(` ${term} `) || lowerText.startsWith(`${term} `) || lowerText.endsWith(` ${term}`));
    
    // ENHANCED vague term detection for unclear inputs
    const vagueTerms = ['fun', 'cool', 'nice', 'good', 'great', 'awesome', 'amazing', 'wonderful', 'fantastic', 'special', 'unique', 'different', 'new', 'exciting', 'interesting', 'lovely', 'beautiful', 'pretty', 'cute'];
    const hasVagueTerms = vagueTerms.some(term => lowerText === term || (lowerText.includes(term) && lowerText.split(' ').length <= 3));
    
    // COMPREHENSIVE contextual keywords for theme detection
    const contextualKeywords = [
      // Character names - STAR WARS PRIORITY
      'star wars', 'jedi', 'luke skywalker', 'darth vader', 'yoda', 'obi wan', 'han solo', 'princess leia', 'chewbacca',
      'lightsaber', 'force', 'millennium falcon', 'death star', 'stormtrooper', 'x-wing', 'tie fighter',
      // Superhero characters
      'iron man', 'spider-man', 'spiderman', 'batman', 'superman', 'hulk', 'captain america', 'thor',
      'wonder woman', 'aquaman', 'flash', 'green lantern', 'black widow', 'hawkeye', 'ant-man', 'black panther',
      // Disney/Princess characters - ENHANCED
      'snow white', 'seven dwarfs', 'dwarfs', 'dwarf', 'magic mirror', 'poisoned apple', 'evil queen',
      'elsa', 'anna', 'frozen', 'olaf', 'kristoff', 'arendelle', 'let it go',
      'cinderella', 'glass slipper', 'fairy godmother', 'pumpkin carriage', 'prince charming',
      'belle', 'beast', 'beauty and the beast', 'enchanted rose', 'lumiere', 'cogsworth',
      'ariel', 'little mermaid', 'under the sea', 'sebastian', 'flounder', 'ursula', 'triton',
      'rapunzel', 'tangled', 'flynn rider', 'pascal', 'mother gothel', 'lanterns',
      'jasmine', 'aladdin', 'magic carpet', 'genie', 'abu', 'jafar', 'agrabah',
      'moana', 'maui', 'ocean', 'heart of te fiti', 'hei hei', 'pua',
      'tiana', 'princess and the frog', 'new orleans', 'bayou', 'prince naveen',
      'mulan', 'mushu', 'fa mulan', 'china', 'honor', 'reflection',
      'merida', 'brave', 'scotland', 'archery', 'clan', 'will o the wisps',
      'pocahontas', 'john smith', 'colors of the wind', 'grandmother willow',
      'aurora', 'sleeping beauty', 'maleficent', 'spinning wheel', 'prince phillip',
      // Theme-specific keywords
      'superhero', 'hero', 'princess', 'royal', 'dinosaur', 'dino', 'unicorn', 'magic', 'fairy',
      'space', 'astronaut', 'rocket', 'galaxy', 'cosmic', 'planet', 'alien',
      'pirate', 'treasure', 'ship', 'ocean', 'mermaid', 'sea', 'underwater',
      'safari', 'jungle', 'lion', 'tiger', 'elephant', 'giraffe', 'zoo', 'wild',
      'beach', 'sand', 'waves', 'seashell', 'seaside', 'coastal', 'summer',
      'art', 'craft', 'painting', 'drawing', 'creative', 'colors', 'brushes',
      'sports', 'sport', 'cricket', 'soccer', 'football', 'basketball', 'tennis', 'swimming',
      'car', 'cars', 'vehicle', 'racing', 'truck', 'motorcycle', 'transportation',
      'animal', 'animals', 'pet', 'dog', 'cat', 'bird', 'fish', 'farm',
      'music', 'dance', 'singing', 'instruments', 'dancing', 'ballet',
      'nature', 'forest', 'garden', 'flowers', 'plants', 'outdoors',
      'cooking', 'baking', 'chef', 'kitchen', 'food', 'recipes'
    ];
    
    const hasContextualKeywords = contextualKeywords.some(keyword => lowerText.includes(keyword));
    const isNonContextual = !hasContextualKeywords && (hasGenericTerms || hasVagueTerms || lowerText.length < 3);
    
    // Character detection - ENHANCED with better matching
    if (!isNonContextual) {
      // PRIORITY: Star Wars character detection first - ENHANCED
      if (lowerText.includes('star wars') || lowerText.includes('jedi') || lowerText.includes('luke skywalker') ||
          lowerText.includes('darth vader') || lowerText.includes('lightsaber') || lowerText.includes('yoda') ||
          lowerText.includes('obi wan') || lowerText.includes('han solo') || lowerText.includes('princess leia') ||
          lowerText.includes('chewbacca') || lowerText.includes('millennium falcon') || lowerText.includes('death star')) {
        characters.push('Star Wars');
      }
      // Superhero character detection - ENHANCED
      if (lowerText.includes('iron man') || lowerText.includes('tony stark')) characters.push('Iron Man');
      if (lowerText.includes('spider-man') || lowerText.includes('spiderman') || lowerText.includes('peter parker')) characters.push('Spider-Man');
      if (lowerText.includes('batman') || lowerText.includes('bruce wayne')) characters.push('Batman');
      if (lowerText.includes('superman') || lowerText.includes('clark kent')) characters.push('Superman');
      if (lowerText.includes('hulk') || lowerText.includes('bruce banner')) characters.push('Hulk');
      if (lowerText.includes('captain america') || lowerText.includes('steve rogers')) characters.push('Captain America');
      if (lowerText.includes('thor')) characters.push('Thor');
      if (lowerText.includes('wonder woman')) characters.push('Wonder Woman');
      
      // PRIORITY: Princess character detection - ULTRA-ENHANCED FOR SNOW WHITE
      if (lowerText.includes('snow white') || lowerText.includes('seven dwarfs') || lowerText.includes('seven dwarves') ||
          lowerText.includes('magic mirror') || lowerText.includes('poisoned apple') || lowerText.includes('evil queen') ||
          lowerText.includes('doc') || lowerText.includes('grumpy') || lowerText.includes('happy') || 
          lowerText.includes('sleepy') || lowerText.includes('sneezy') || lowerText.includes('bashful') || lowerText.includes('dopey')) {
        characters.push('Snow White');
      }
      if (lowerText.includes('elsa') || lowerText.includes('frozen') || lowerText.includes('olaf') || 
          lowerText.includes('let it go') || lowerText.includes('arendelle') || lowerText.includes('ice queen')) {
        characters.push('Elsa/Frozen');
      }
      if (lowerText.includes('anna') && (lowerText.includes('frozen') || lowerText.includes('arendelle'))) characters.push('Anna');
      if (lowerText.includes('cinderella') || lowerText.includes('glass slipper') || 
          lowerText.includes('fairy godmother') || lowerText.includes('pumpkin carriage') || lowerText.includes('midnight')) {
        characters.push('Cinderella');
      }
      if (lowerText.includes('belle') || lowerText.includes('beast') || lowerText.includes('beauty and the beast') ||
          lowerText.includes('enchanted rose') || lowerText.includes('lumiere') || lowerText.includes('cogsworth')) {
        characters.push('Belle/Beauty and the Beast');
      }
      if (lowerText.includes('ariel') || lowerText.includes('little mermaid') || lowerText.includes('under the sea') ||
          lowerText.includes('sebastian') || lowerText.includes('flounder') || lowerText.includes('ursula')) {
        characters.push('Ariel/Little Mermaid');
      }
      if (lowerText.includes('rapunzel') || lowerText.includes('tangled') || lowerText.includes('flynn rider') ||
          lowerText.includes('pascal') || lowerText.includes('mother gothel') || lowerText.includes('tower')) {
        characters.push('Rapunzel/Tangled');
      }
      if (lowerText.includes('jasmine') || lowerText.includes('aladdin') || lowerText.includes('magic carpet') ||
          lowerText.includes('genie') || lowerText.includes('abu') || lowerText.includes('agrabah')) {
        characters.push('Jasmine/Aladdin');
      }
      if (lowerText.includes('moana') || lowerText.includes('maui') || lowerText.includes('heart of te fiti') ||
          lowerText.includes('hei hei') || lowerText.includes('pua') || lowerText.includes('motunui')) {
        characters.push('Moana');
      }
      if (lowerText.includes('tiana') || lowerText.includes('princess and the frog') || lowerText.includes('new orleans') ||
          lowerText.includes('bayou') || lowerText.includes('prince naveen') || lowerText.includes('louis')) {
        characters.push('Tiana/Princess and the Frog');
      }
      if (lowerText.includes('mulan') || lowerText.includes('mushu') || lowerText.includes('fa mulan') ||
          lowerText.includes('china') || lowerText.includes('honor') || lowerText.includes('reflection')) {
        characters.push('Mulan');
      }
      if (lowerText.includes('merida') || lowerText.includes('brave') || lowerText.includes('scotland') ||
          lowerText.includes('archery') || lowerText.includes('clan') || lowerText.includes('will o the wisps')) {
        characters.push('Merida/Brave');
      }
      if (lowerText.includes('pocahontas') || lowerText.includes('john smith') || lowerText.includes('colors of the wind') ||
          lowerText.includes('grandmother willow') || lowerText.includes('virginia')) {
        characters.push('Pocahontas');
      }
      if (lowerText.includes('aurora') || lowerText.includes('sleeping beauty') || lowerText.includes('maleficent') ||
          lowerText.includes('spinning wheel') || lowerText.includes('prince phillip') || lowerText.includes('briar rose')) {
        characters.push('Aurora/Sleeping Beauty');
      }
    }
    
    // Theme detection - ULTRA-ENHANCED with priority ordering
    if (!isNonContextual) {
      // STAR WARS gets highest priority
      if (lowerText.includes('star wars') || lowerText.includes('jedi') || lowerText.includes('lightsaber') ||
          lowerText.includes('force') || lowerText.includes('galaxy') || lowerText.includes('sith')) themes.push('star wars');
      
      // Character-based theme detection
      if (lowerText.includes('superhero') || lowerText.includes('hero') || lowerText.includes('super hero')) themes.push('superhero');
      if (lowerText.includes('princess') || lowerText.includes('royal') || lowerText.includes('queen') || lowerText.includes('crown')) themes.push('princess');
      if (lowerText.includes('dinosaur') || lowerText.includes('dino') || lowerText.includes('prehistoric') || lowerText.includes('jurassic')) themes.push('dinosaur');
      if (lowerText.includes('unicorn') || lowerText.includes('rainbow') || lowerText.includes('magical') || lowerText.includes('sparkle')) themes.push('unicorn');
      if (lowerText.includes('space') || lowerText.includes('astronaut') || lowerText.includes('rocket') || 
          lowerText.includes('galaxy') || lowerText.includes('cosmic') || lowerText.includes('planet') || lowerText.includes('alien')) themes.push('space');
      if (lowerText.includes('pirate') || lowerText.includes('treasure') || lowerText.includes('ship') || lowerText.includes('sailing')) themes.push('pirate');
      if (lowerText.includes('ocean') || lowerText.includes('mermaid') || lowerText.includes('underwater') || lowerText.includes('sea life')) themes.push('ocean');
      if (lowerText.includes('safari') || lowerText.includes('jungle') || lowerText.includes('wild') || lowerText.includes('zoo')) themes.push('safari');
      
      // Activity-based theme detection
      if (lowerText.includes('beach') || lowerText.includes('sea') || lowerText.includes('sand') || 
          lowerText.includes('seaside') || lowerText.includes('coastal') || lowerText.includes('summer')) themes.push('beach');
      if (lowerText.includes('art') || lowerText.includes('craft') || lowerText.includes('painting') || 
          lowerText.includes('drawing') || lowerText.includes('creative') || lowerText.includes('colors')) themes.push('art');
      if (lowerText.includes('cricket') || lowerText.includes('wicket') || lowerText.includes('batting') || lowerText.includes('bowling')) { 
        themes.push('cricket'); 
        textInterests.push('cricket'); 
      }
      if (lowerText.includes('sports') || lowerText.includes('sport') || lowerText.includes('athletic') || 
          lowerText.includes('competition') || lowerText.includes('championship')) themes.push('sports');
      
      // Vehicle theme detection
      if (lowerText.includes('car') || lowerText.includes('cars') || lowerText.includes('vehicle') || 
          lowerText.includes('racing') || lowerText.includes('truck') || lowerText.includes('motorcycle') || 
          lowerText.includes('transportation') || lowerText.includes('wheels')) themes.push('vehicles');
      
      // Animal theme detection
      if (lowerText.includes('animal') || lowerText.includes('animals') || lowerText.includes('pet') || 
          lowerText.includes('dog') || lowerText.includes('cat') || lowerText.includes('farm') || 
          lowerText.includes('wildlife') || lowerText.includes('creature')) themes.push('animals');
      
      // Music theme detection
      if (lowerText.includes('music') || lowerText.includes('dance') || lowerText.includes('singing') || 
          lowerText.includes('instruments') || lowerText.includes('concert') || lowerText.includes('band')) themes.push('music');
      
      // Nature theme detection
      if (lowerText.includes('nature') || lowerText.includes('forest') || lowerText.includes('garden') || 
          lowerText.includes('flowers') || lowerText.includes('outdoors') || lowerText.includes('camping')) themes.push('nature');
    }
    
    return { characters, themes, interests: textInterests, hasGenericTerms, isNonContextual, hasVagueTerms };
  };
  
  const textAnalysis = analyzeTextInput(childDetails || '');
  
  // ULTRA-CRITICAL: DEFINITIVE RELEVANCE GUARANTEE SYSTEM
  // Priority 1: Classic Theme Selected = GUARANTEED Classic Theme Variations (100% RELEVANT)
  // Priority 2: Contextual Text Input = GUARANTEED Text-Based Themes (100% RELEVANT)
  // Priority 3: Non-Contextual Text + Interests = GUARANTEED Interest-Based Themes (100% RELEVANT) 
  // Priority 4: No Text + Interests = GUARANTEED Interest-Based Themes (100% RELEVANT)
  // Priority 5: Fallback = GUARANTEED Age-Appropriate Default Themes (100% RELEVANT)
  
  // PREFERENCE PRIORITY 1: Classic Theme Selected - ABSOLUTE GUARANTEE OF RELEVANCE
  if (selectedClassicTheme) {
    console.log(`FALLBACK: Classic theme ${selectedClassicTheme} selected - GUARANTEED relevant theme variations`);
    return getClassicThemeFallbacks(selectedClassicTheme, childName, age, childDetails, textAnalysis);
  }
  
  // PREFERENCE PRIORITY 2: Contextual Text Input - GUARANTEED text-based relevant themes
  if (!textAnalysis.isNonContextual && (textAnalysis.characters.length > 0 || textAnalysis.themes.length > 0)) {
    console.log('FALLBACK: Contextual text detected - GUARANTEED text-based relevant themes');
    return getTextBasedFallbacks(textAnalysis, childName, age, childDetails);
  }
  
  // PREFERENCE PRIORITY 3: Non-Contextual Text + Interests - GUARANTEED interest-based themes
  if ((textAnalysis.isNonContextual || textAnalysis.hasVagueTerms || (!childDetails || childDetails.trim() === '')) && interests.length > 0) {
    console.log('FALLBACK: Using interests for GUARANTEED relevant themes');
    return getInterestBasedFallbacks(interests, childName, age, childDetails);
  }
  
  // PREFERENCE PRIORITY 4: GUARANTEED Age-Appropriate Default Themes
  console.log('FALLBACK: GUARANTEED age-appropriate default themes');
  return getDefaultFallbacks(childName, age, interests);
}

// DEDICATED FALLBACK HELPER FUNCTIONS FOR PREFERENCE-DRIVEN RECOMMENDATIONS

// Helper 1: Classic Theme Fallbacks - ALWAYS RELEVANT
function getClassicThemeFallbacks(selectedClassicTheme: string, childName: string, age: number, childDetails?: string, textAnalysis?: any): ThemeRecommendation[] {
  const themeLower = selectedClassicTheme.toLowerCase();
  
  // ULTRA-ENHANCED classic theme templates with GUARANTEED relevance
  const classicThemeConfigs = {
    superhero: {
      defaultThemes: [
        {
          id: 'superhero-classic-1',
          name: 'Ultimate Superhero Academy Adventure',
          description: 'Transform into mighty heroes and save the day with action-packed adventures and super powers!',
          whyRecommended: `GUARANTEED perfect match for ${childName} who selected the Superhero theme - classic hero fun with capes, powers, and heroic missions that every superhero fan loves!`,
          colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'],
          decorations: ['Cape station with personalized capes', 'Cityscape backdrop with buildings', 'Comic book speech bubble props', 'Hero headquarters setup', 'Superhero emblem banners'],
          activities: ['Hero training obstacle course', 'Design your own superhero logo', 'Villain capture game', 'Superhero photo booth', 'Power testing challenges'],
          printableIdeas: ['Superhero certificates', 'Comic book coloring pages'],
          emoji: '🦸‍♂️',
          ageAppropriate: age >= 3,
          matchScore: 98
        },
        {
          id: 'superhero-classic-2',
          name: 'Super Powers Training Camp',
          description: 'Train at the ultimate superhero academy and master amazing super powers with legendary heroes!',
          whyRecommended: `GUARANTEED perfect for ${childName} who loves superhero adventures - comprehensive hero training with skills development and super power mastery!`,
          colorPalette: ['#DC143C', '#FFD700', '#4169E1', '#32CD32'],
          decorations: ['Training academy banners', 'Power testing stations', 'Hero equipment displays', 'Achievement boards', 'Super power demonstration areas'],
          activities: ['Superhero skills training', 'Power discovery workshop', 'Team mission challenges', 'Hero graduation ceremony', 'Super villain defeat games'],
          printableIdeas: ['Hero academy diplomas', 'Power assessment sheets'],
          emoji: '⚡',
          ageAppropriate: true,
          matchScore: 96
        },
        {
          id: 'superhero-classic-3',
          name: 'Justice League Hero Mission',
          description: 'Join the greatest superhero team ever assembled for epic world-saving missions and adventures!',
          whyRecommended: `GUARANTEED amazing for ${childName} who chose superheroes - team-based hero adventures with iconic superhero elements and justice missions!`,
          colorPalette: ['#B22222', '#4169E1', '#FFD700', '#228B22'],
          decorations: ['Justice league headquarters', 'Team mission boards', 'Hero communication center', 'World-saving equipment displays'],
          activities: ['Team superhero missions', 'Hero alliance building', 'World protection challenges', 'Justice ceremony'],
          printableIdeas: ['Justice league membership cards', 'Hero mission reports'],
          emoji: '🌟',
          ageAppropriate: true,
          matchScore: 94
        }
      ]
    },
    princess: {
      defaultThemes: [
        {
          id: 'princess-classic-1',
          name: 'Enchanted Princess Kingdom Adventure',
          description: 'Enter a magical princess kingdom with royal castles, fairytale characters, and princess adventures!',
          whyRecommended: `GUARANTEED perfect for ${childName} who selected the Princess theme - featuring all the beloved princess elements with royal magic and fairytale adventures!`,
          colorPalette: ['#FF69B4', '#9370DB', '#FFB6C1', '#F0E68C'],
          decorations: ['Royal castle backdrop', 'Crown crafting station', 'Princess dress-up corner', 'Royal throne photo area', 'Princess carriage display'],
          activities: ['Royal ball dancing', 'Crown decorating workshop', 'Princess etiquette lessons', 'Fairytale storytelling', 'Royal court games'],
          printableIdeas: ['Royal certificates', 'Princess coloring pages'],
          emoji: '👸',
          ageAppropriate: true,
          matchScore: 98
        },
        {
          id: 'princess-classic-2',
          name: 'Snow White Seven Dwarfs Royal Party',
          description: 'Join Snow White and the Seven Dwarfs in the enchanted forest for a magical royal princess adventure!',
          whyRecommended: `GUARANTEED amazing for ${childName} who loves princess themes - featuring Snow White, seven dwarfs, magic mirror, and enchanted forest princess magic!`,
          colorPalette: ['#FF0000', '#FFFF00', '#0000FF', '#8B4513'],
          decorations: ['Seven Dwarfs cottage setup', 'Magic mirror centerpiece', 'Poisoned apple displays', 'Enchanted forest backdrop', 'Dwarf mining station'],
          activities: ['Seven Dwarfs house building', 'Magic mirror storytelling', 'Apple picking games', 'Forest creature hunt', 'Royal dwarf dance party'],
          printableIdeas: ['Snow White story books', 'Seven Dwarfs name certificates'],
          emoji: '🍎',
          ageAppropriate: true,
          matchScore: 96
        },
        {
          id: 'princess-classic-3',
          name: 'Frozen Ice Princess Palace Party',
          description: 'Experience the magic of ice princesses with frozen castles, snow powers, and royal winter adventures!',
          whyRecommended: `GUARANTEED wonderful for ${childName} who chose princess themes - featuring ice princess magic with frozen castles and winter princess adventures!`,
          colorPalette: ['#87CEEB', '#FFFFFF', '#E6E6FA', '#4169E1'],
          decorations: ['Ice castle backdrop', 'Snowflake decorations', 'Frozen character displays', 'Winter wonderland setup'],
          activities: ['Ice princess training', 'Frozen sing-along', 'Royal winter dance party', 'Ice castle building'],
          printableIdeas: ['Ice princess certificates', 'Frozen castle coloring pages'],
          emoji: '❄️',
          ageAppropriate: true,
          matchScore: 94
        }
      ]
    },
    dinosaur: {
      defaultThemes: [
        {
          id: 'dinosaur-classic-1',
          name: 'Prehistoric Dinosaur Discovery',
          description: 'Travel back in time to discover amazing dinosaurs and prehistoric adventures!',
          whyRecommended: `Perfect for ${childName} who selected the Dinosaur theme - prehistoric exploration with fossil hunting and dino adventures!`,
          colorPalette: ['#228B22', '#8B4513', '#DAA520', '#CD853F'],
          decorations: ['Dinosaur fossil dig site', 'Jungle vine decorations', 'Dinosaur footprint trail', 'Prehistoric landscape backdrop'],
          activities: ['Fossil excavation sandbox', 'Dinosaur egg hunt', 'Paleontologist training course', 'Dino roar contests'],
          printableIdeas: ['Dinosaur fact cards', 'Archaeological dig certificates'],
          emoji: '🦕',
          ageAppropriate: true,
          matchScore: 92
        },
        {
          id: 'dinosaur-classic-2',
          name: 'Jurassic Adventure Park',
          description: 'Experience the thrill of a dinosaur adventure park with prehistoric creatures!',
          whyRecommended: `Designed for ${childName} who loves dinosaur adventures - theme park excitement with prehistoric creatures!`,
          colorPalette: ['#556B2F', '#D2691E', '#DAA520', '#8FBC8F'],
          decorations: ['Jurassic park entrance', 'Dinosaur habitat displays', 'Explorer jeep photo prop', 'Dinosaur skeleton models'],
          activities: ['Dinosaur safari expedition', 'Prehistoric creature identification', 'Dino egg rescue mission', 'Explorer badge earning'],
          printableIdeas: ['Explorer ID cards', 'Dinosaur species guides'],
          emoji: '🦖',
          ageAppropriate: true,
          matchScore: 90
        }
      ]
    },
    space: {
      defaultThemes: [
        {
          id: 'space-classic-1',
          name: 'Space Explorer Mission',
          description: 'Blast off to the stars on an intergalactic adventure through the cosmos!',
          whyRecommended: `Perfect for ${childName} who selected the Space theme - cosmic exploration with rockets, planets, and astronaut adventures!`,
          colorPalette: ['#4B0082', '#000080', '#C0C0C0', '#FFD700'],
          decorations: ['Solar system hanging mobile', 'Astronaut photo booth', 'Starry night ceiling', 'Mission control station'],
          activities: ['Build and launch rockets', 'Planet scavenger hunt', 'Astronaut training camp', 'Space mission simulations'],
          printableIdeas: ['Space mission certificates', 'Constellation coloring pages'],
          emoji: '🚀',
          ageAppropriate: age >= 4,
          matchScore: 92
        },
        {
          id: 'space-classic-2',
          name: 'Galactic Space Academy',
          description: 'Train to become a space explorer at the ultimate galactic academy!',
          whyRecommended: `Designed for ${childName} who loves space adventures - astronaut training with cosmic exploration!`,
          colorPalette: ['#191970', '#4169E1', '#C0C0C0', '#FFD700'],
          decorations: ['Space academy banners', 'Astronaut training equipment', 'Planet exploration stations', 'Galaxy command center'],
          activities: ['Zero gravity training', 'Alien encounter simulations', 'Space navigation challenges', 'Graduation ceremony'],
          printableIdeas: ['Space academy diplomas', 'Galactic exploration maps'],
          emoji: '🌌',
          ageAppropriate: true,
          matchScore: 90
        }
      ]
    },
    safari: {
      defaultThemes: [
        {
          id: 'safari-classic-1',
          name: 'African Safari Adventure',
          description: 'Embark on an exciting African safari to discover amazing wildlife!',
          whyRecommended: `Perfect for ${childName} who selected the Safari theme - wildlife exploration with animal discoveries and jungle adventures!`,
          colorPalette: ['#228B22', '#DAA520', '#8B4513', '#CD853F'],
          decorations: ['Safari tent setup', 'Animal footprints trail', 'Wildlife photo displays', 'Jungle canopy decorations'],
          activities: ['Animal tracking expedition', 'Wildlife photography workshop', 'Safari jeep adventures', 'Animal sound identification'],
          printableIdeas: ['Safari explorer certificates', 'Animal identification guides'],
          emoji: '🦁',
          ageAppropriate: true,
          matchScore: 92
        },
        {
          id: 'safari-classic-2',
          name: 'Wildlife Conservation Camp',
          description: 'Learn about wildlife conservation while experiencing amazing safari adventures!',
          whyRecommended: `Designed for ${childName} who loves safari adventures - conservation education with hands-on wildlife experiences!`,
          colorPalette: ['#32CD32', '#DAA520', '#CD853F', '#8FBC8F'],
          decorations: ['Conservation camp setup', 'Animal rescue stations', 'Wildlife education displays', 'Ranger headquarters'],
          activities: ['Animal care workshops', 'Conservation mission planning', 'Wildlife habitat building', 'Junior ranger training'],
          printableIdeas: ['Wildlife conservation certificates', 'Animal care guides'],
          emoji: '🐘',
          ageAppropriate: true,
          matchScore: 90
        }
      ]
    },
    ocean: {
      defaultThemes: [
        {
          id: 'ocean-classic-1',
          name: 'Ocean Adventure Exploration',
          description: 'Dive deep into ocean adventures with marine life discoveries and underwater fun!',
          whyRecommended: `Perfect for ${childName} who selected the Ocean theme - underwater exploration with marine life and sea adventures!`,
          colorPalette: ['#0000FF', '#00CED1', '#20B2AA', '#87CEEB'],
          decorations: ['Underwater coral reef backdrop', 'Marine life displays', 'Submarine photo booth', 'Ocean wave decorations'],
          activities: ['Deep sea diving simulation', 'Marine life discovery games', 'Treasure hunting expedition', 'Underwater photography'],
          printableIdeas: ['Marine explorer certificates', 'Ocean life identification cards'],
          emoji: '🌊',
          ageAppropriate: true,
          matchScore: 92
        },
        {
          id: 'ocean-classic-2',
          name: 'Mermaid Lagoon Adventure',
          description: 'Discover the magical world of mermaids in an enchanted ocean lagoon!',
          whyRecommended: `Designed for ${childName} who loves ocean adventures - mermaid magic with underwater kingdoms!`,
          colorPalette: ['#48CAE4', '#90E0EF', '#CAF0F8', '#FFB3BA'],
          decorations: ['Mermaid lagoon setup', 'Underwater palace decorations', 'Seashell treasure displays', 'Coral garden stations'],
          activities: ['Mermaid tail crafting', 'Underwater dance party', 'Seashell treasure hunt', 'Ocean magic workshops'],
          printableIdeas: ['Mermaid certificates', 'Ocean kingdom maps'],
          emoji: '🧜‍♀️',
          ageAppropriate: true,
          matchScore: 90
        }
      ]
    },
    sports: {
      defaultThemes: [
        {
          id: 'sports-classic-1',
          name: 'Ultimate Sports Championship Festival',
          description: 'Experience the excitement of multiple sports in one amazing championship event with athletic competitions!',
          whyRecommended: `GUARANTEED perfect for ${childName} who selected the Sports theme - multi-sport athletic fun with championships, team spirit, and victory celebrations!`,
          colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'],
          decorations: ['Multi-sport stations', 'Championship banners', 'Olympic-style podium', 'Sports equipment displays', 'Victory celebration area'],
          activities: ['Sports skills challenges', 'Team competitions', 'Medal ceremonies', 'Athletic training courses', 'Sports trivia contests'],
          printableIdeas: ['Sports achievement certificates', 'Championship activity sheets'],
          emoji: '⚽',
          ageAppropriate: age >= 3,
          matchScore: 98
        },
        {
          id: 'sports-classic-2',
          name: 'Olympic Training Academy Championship',
          description: 'Train like Olympic athletes and compete in exciting sporting challenges with world-class coaching!',
          whyRecommended: `GUARANTEED amazing for ${childName} who loves sports adventures - Olympic-style training with athletic excellence and championship spirit!`,
          colorPalette: ['#FFD700', '#C0C0C0', '#CD7F32', '#4169E1'],
          decorations: ['Olympic rings display', 'Training academy setup', 'Medal presentation area', 'Sports achievement boards', 'World champion stations'],
          activities: ['Olympic event training', 'Athletic skill development', 'Team relay races', 'Victory celebrations', 'Champion coaching sessions'],
          printableIdeas: ['Olympic certificates', 'Training record sheets'],
          emoji: '🏅',
          ageAppropriate: true,
          matchScore: 96
        },
        {
          id: 'sports-classic-3',
          name: 'Cricket Stadium Sports Adventure',
          description: 'Experience the thrill of cricket and other sports in a championship stadium atmosphere!',
          whyRecommended: `GUARANTEED exciting for ${childName} who chose sports - featuring cricket, athletic competitions, and stadium championship experiences!`,
          colorPalette: ['#228B22', '#FFFFFF', '#FF0000', '#FFD700'],
          decorations: ['Cricket pitch setup', 'Stadium atmosphere decorations', 'Sports equipment displays', 'Championship trophy area'],
          activities: ['Cricket skills training', 'Sports competitions', 'Athletic challenges', 'Championship ceremonies'],
          printableIdeas: ['Sports champion certificates', 'Cricket scorecards'],
          emoji: '🏏',
          ageAppropriate: true,
          matchScore: 94
        }
      ]
    },
    unicorn: {
      defaultThemes: [
        {
          id: 'unicorn-classic-1',
          name: 'Magical Unicorn Paradise',
          description: 'Enter a world of rainbow magic, sparkles, and enchanted unicorn friends!',
          whyRecommended: `Perfect for ${childName} who selected the Unicorn theme - magical rainbow fun with sparkles, rainbows, and unicorn adventures!`,
          colorPalette: ['#FF69B4', '#9370DB', '#FFB6C1', '#F0E68C'],
          decorations: ['Rainbow balloon arch', 'Unicorn horn headbands', 'Glittery cloud decorations', 'Magic rainbow stations'],
          activities: ['Unicorn horn decorating', 'Rainbow treasure hunt', 'Magic potion making', 'Sparkle craft workshops'],
          printableIdeas: ['Unicorn coloring sheets', 'Magic potion recipe cards'],
          emoji: '🦄',
          ageAppropriate: true,
          matchScore: 92
        },
        {
          id: 'unicorn-classic-2',
          name: 'Enchanted Rainbow Kingdom',
          description: 'Explore a magical kingdom where unicorns and rainbows create endless wonder!',
          whyRecommended: `Designed for ${childName} who loves unicorn adventures - rainbow kingdom with magical creatures!`,
          colorPalette: ['#FF1493', '#9932CC', '#FFB6C1', '#FFFF00'],
          decorations: ['Rainbow kingdom gates', 'Unicorn stable displays', 'Magic crystal stations', 'Enchanted forest backdrop'],
          activities: ['Unicorn care workshop', 'Rainbow bridge building', 'Magic spell crafting', 'Kingdom adventure quests'],
          printableIdeas: ['Kingdom maps', 'Unicorn care guides'],
          emoji: '🌈',
          ageAppropriate: true,
          matchScore: 90
        }
      ]
    }
  };
  
  const config = classicThemeConfigs[themeLower as keyof typeof classicThemeConfigs];
  if (config) {
    return config.defaultThemes;
  }
  
  // Fallback for unsupported classic themes
  return [{
    id: `${themeLower}-classic-fallback`,
    name: `Classic ${selectedClassicTheme} Party`,
    description: `Experience the magic of ${selectedClassicTheme.toLowerCase()} adventures!`,
    whyRecommended: `Perfect for ${childName} who selected the ${selectedClassicTheme} theme!`,
    colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'],
    decorations: [`${selectedClassicTheme} themed decorations`, `${selectedClassicTheme} backdrop`, `${selectedClassicTheme} party props`],
    activities: [`${selectedClassicTheme} themed games`, `${selectedClassicTheme} crafts`, `${selectedClassicTheme} adventures`],
    printableIdeas: [`${selectedClassicTheme} coloring pages`, `${selectedClassicTheme} activity sheets`],
    emoji: '🎉',
    ageAppropriate: true,
    matchScore: 85
  }];
}

// Helper 2: Interest-Based Fallbacks - GUARANTEED RELEVANT for non-contextual text with interests
function getInterestBasedFallbacks(interests: string[], childName: string, age: number, childDetails?: string): ThemeRecommendation[] {
  const interestBasedThemes: ThemeRecommendation[] = [];
  
  // ULTRA-COMPREHENSIVE interest-to-theme mapping with GUARANTEED relevance
  const interestThemeMap = {
    cars: {
      themes: [
        {
          id: 'cars-interest-1',
          name: 'Ultimate Racing Car Championship Party',
          description: 'Rev up the engines for a high-speed racing adventure with cars, tracks, and victory celebrations!',
          whyRecommended: `GUARANTEED perfect for ${childName} who loves cars (from their interests) - featuring racing excitement, car customization, and automotive fun with speed and victory!`,
          colorPalette: ['#FF0000', '#000000', '#FFFF00', '#C0C0C0'],
          decorations: ['Racing flags', 'Car track displays', 'Traffic light centerpieces', 'Pit stop stations', 'Victory podium', 'Car championship banners'],
          activities: ['Car racing games', 'Build your own race car', 'Pit crew challenges', 'Victory lap celebration', 'Car wash station', 'Racing driver training'],
          printableIdeas: ['Racing champion certificates', 'Car coloring pages'],
          emoji: '🏎️',
          ageAppropriate: true,
          matchScore: 98
        },
        {
          id: 'cars-interest-2',
          name: 'Auto Mechanic Workshop Adventure',
          description: 'Get hands-on with cars in a fun mechanic workshop with tools, repairs, and car customization!',
          whyRecommended: `GUARANTEED amazing for ${childName} who loves cars - hands-on automotive learning with tools, car care, and mechanical adventures!`,
          colorPalette: ['#2F4F4F', '#FF4500', '#FFD700', '#C0C0C0'],
          decorations: ['Mechanic workshop setup', 'Tool displays', 'Car lift station', 'Parts and accessories corner', 'Garage bay setup'],
          activities: ['Car repair challenges', 'Tool identification games', 'Car customization workshop', 'Mechanic certificate earning', 'Engine building activities'],
          printableIdeas: ['Master mechanic certificates', 'Car parts identification sheets'],
          emoji: '🔧',
          ageAppropriate: age >= 4,
          matchScore: 96
        },
        {
          id: 'cars-interest-3',
          name: 'Transportation Adventure World',
          description: 'Explore the exciting world of all types of vehicles and transportation with cars, trucks, and more!',
          whyRecommended: `GUARANTEED exciting for ${childName} who loves cars - featuring all types of vehicles, transportation adventures, and automotive exploration!`,
          colorPalette: ['#4169E1', '#FF6347', '#32CD32', '#FFD700'],
          decorations: ['Vehicle museum setup', 'Transportation timeline', 'Multi-vehicle displays', 'Traffic control center'],
          activities: ['Vehicle identification games', 'Transportation challenges', 'Vehicle safety course', 'Driver training academy'],
          printableIdeas: ['Transportation expert certificates', 'Vehicle identification guides'],
          emoji: '🚗',
          ageAppropriate: true,
          matchScore: 94
        }
      ]
    },
    animals: {
      themes: [
        {
          id: 'animals-interest-1',
          name: 'Ultimate Animal Kingdom Safari Adventure',
          description: 'Explore the amazing world of animals with safari adventures, wildlife discoveries, and creature encounters!',
          whyRecommended: `GUARANTEED perfect for ${childName} who loves animals (from their interests) - featuring all their favorite creatures, wildlife adventures, and animal kingdom magic!`,
          colorPalette: ['#228B22', '#DAA520', '#8B4513', '#CD853F'],
          decorations: ['Animal prints', 'Safari tent setup', 'Animal footprints trail', 'Wildlife photo displays', 'Zoo habitat stations', 'Animal kingdom entrance'],
          activities: ['Animal sound games', 'Wildlife scavenger hunt', 'Animal habitat building', 'Pet care workshop', 'Animal adoption center', 'Jungle expedition'],
          printableIdeas: ['Animal kingdom explorer certificates', 'Safari adventure guides'],
          emoji: '🦁',
          ageAppropriate: true,
          matchScore: 98
        },
        {
          id: 'animals-interest-2',
          name: 'Pet Care Veterinarian Adventure',
          description: 'Learn to care for animals as a junior veterinarian with pet care, animal health, and rescue activities!',
          whyRecommended: `GUARANTEED amazing for ${childName} who loves animals - veterinary care with hands-on pet wellness activities and animal rescue adventures!`,
          colorPalette: ['#32CD32', '#87CEEB', '#FFB6C1', '#F0E68C'],
          decorations: ['Veterinary clinic setup', 'Pet care stations', 'Animal health charts', 'Adoption corner', 'Animal rescue center'],
          activities: ['Pet health checkups', 'Animal care learning', 'Stuffed animal hospital', 'Junior vet training', 'Animal rescue missions'],
          printableIdeas: ['Veterinarian expert certificates', 'Pet care guides'],
          emoji: '🐾',
          ageAppropriate: true,
          matchScore: 96
        },
        {
          id: 'animals-interest-3',
          name: 'Zoo Keeper Wildlife Adventure',
          description: 'Become a junior zoo keeper and learn about amazing animals from around the world!',
          whyRecommended: `GUARANTEED exciting for ${childName} who loves animals - zoo keeping adventures with animal care, wildlife education, and creature discoveries!`,
          colorPalette: ['#8B4513', '#228B22', '#87CEEB', '#FFD700'],
          decorations: ['Zoo enclosure setups', 'Animal information stations', 'Wildlife conservation displays', 'Zoo keeper equipment'],
          activities: ['Animal feeding demonstrations', 'Wildlife education tours', 'Conservation project activities', 'Zoo keeper training'],
          printableIdeas: ['Zoo keeper certificates', 'Animal conservation guides'],
          emoji: '🐘',
          ageAppropriate: true,
          matchScore: 94
        }
      ]
    },
    art: {
      themes: [
        {
          id: 'art-interest-1',
          name: 'Creative Art Studio Party',
          description: 'Unleash creativity in a colorful art studio filled with paints, brushes, and endless artistic possibilities!',
          whyRecommended: `Perfect for ${childName} who loves art & crafts (from their interests) - featuring all their favorite creative activities and artistic expression!`,
          colorPalette: ['#FF6347', '#32CD32', '#FF69B4', '#FFD700'],
          decorations: ['Paint palette table settings', 'Colorful paint splatter banners', 'Artist easel displays', 'Art supply stations', 'Gallery wall'],
          activities: ['Canvas painting party', 'Clay sculpture workshop', 'Collaborative mural creation', 'DIY craft corner', 'Art exhibition setup'],
          printableIdeas: ['Artist certificate templates', 'Color-by-number party sheets'],
          emoji: '🎨',
          ageAppropriate: true,
          matchScore: 95
        },
        {
          id: 'art-interest-2',
          name: 'Master Artist Workshop Party',
          description: 'Learn advanced art techniques in a professional artist workshop with specialized tools and techniques!',
          whyRecommended: `Designed for ${childName} who loves art - advanced artistic techniques with professional tools and methods!`,
          colorPalette: ['#800080', '#FF1493', '#32CD32', '#FFD700'],
          decorations: ['Professional easel setup', 'Art technique displays', 'Master artist portraits', 'Tool demonstration area'],
          activities: ['Advanced painting techniques', 'Professional art tool workshops', 'Artist style exploration', 'Master class sessions'],
          printableIdeas: ['Master artist certificates', 'Technique reference guides'],
          emoji: '🖌️',
          ageAppropriate: age >= 6,
          matchScore: 93
        }
      ]
    },
    sports: {
      themes: [
        {
          id: 'sports-interest-1',
          name: 'Multi-Sport Championship Party',
          description: 'Experience the excitement of multiple sports in one amazing championship event!',
          whyRecommended: `Perfect for ${childName} who loves sports (from their interests) - multi-sport athletic challenges with team competitions!`,
          colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'],
          decorations: ['Multi-sport stations', 'Championship banners', 'Olympic-style podium', 'Sports equipment displays', 'Team spirit decorations'],
          activities: ['Sports skills challenges', 'Team competitions', 'Medal ceremonies', 'Athletic training courses', 'Sports trivia'],
          printableIdeas: ['Sports achievement certificates', 'Championship activity sheets'],
          emoji: '⚽',
          ageAppropriate: true,
          matchScore: 95
        },
        {
          id: 'sports-interest-2',
          name: 'Sports Training Camp Party',
          description: 'Train like professional athletes with specialized coaching and skill development!',
          whyRecommended: `Designed for ${childName} who loves sports - professional training with skill development and athletic excellence!`,
          colorPalette: ['#FF4500', '#32CD32', '#4169E1', '#FFD700'],
          decorations: ['Training camp setup', 'Athletic equipment displays', 'Achievement boards', 'Coach stations'],
          activities: ['Skill development workshops', 'Athletic conditioning', 'Team building exercises', 'Performance assessments'],
          printableIdeas: ['Training certificates', 'Performance tracking sheets'],
          emoji: '🏃‍♂️',
          ageAppropriate: age >= 5,
          matchScore: 93
        }
      ]
    },
    music: {
      themes: [
        {
          id: 'music-interest-1',
          name: 'Rock Star Concert Party',
          description: 'Experience the thrill of being a rock star with instruments, performances, and music creation!',
          whyRecommended: `Perfect for ${childName} who loves music (from their interests) - rock star performances with instruments and music making!`,
          colorPalette: ['#FF0000', '#000000', '#FFD700', '#C0C0C0'],
          decorations: ['Concert stage setup', 'Musical instrument displays', 'Rock star posters', 'Sound equipment props', 'Spotlight effects'],
          activities: ['Rock band formation', 'Instrument playing workshops', 'Karaoke performances', 'Music video creation', 'Concert rehearsals'],
          printableIdeas: ['Rock star certificates', 'Concert program templates'],
          emoji: '🎸',
          ageAppropriate: true,
          matchScore: 95
        }
      ]
    },
    science: {
      themes: [
        {
          id: 'science-interest-1',
          name: 'Mad Scientist Laboratory Party',
          description: 'Conduct amazing experiments and discoveries in a fun and safe science laboratory!',
          whyRecommended: `Perfect for ${childName} who loves science (from their interests) - hands-on experiments with scientific discoveries!`,
          colorPalette: ['#32CD32', '#FF4500', '#4169E1', '#FFD700'],
          decorations: ['Laboratory equipment setup', 'Periodic table displays', 'Science experiment stations', 'Safety equipment props'],
          activities: ['Safe science experiments', 'Volcano eruptions', 'Slime making', 'Microscope observations', 'Invention workshops'],
          printableIdeas: ['Scientist certificates', 'Experiment record sheets'],
          emoji: '🔬',
          ageAppropriate: age >= 5,
          matchScore: 95
        }
      ]
    },
    nature: {
      themes: [
        {
          id: 'nature-interest-1',
          name: 'Nature Explorer Adventure Party',
          description: 'Explore the wonders of nature with outdoor adventures and environmental discoveries!',
          whyRecommended: `Perfect for ${childName} who loves nature (from their interests) - outdoor exploration with environmental learning!`,
          colorPalette: ['#228B22', '#8FBC8F', '#8B4513', '#87CEEB'],
          decorations: ['Forest canopy setup', 'Nature specimen displays', 'Outdoor adventure stations', 'Environmental education boards'],
          activities: ['Nature scavenger hunts', 'Plant identification workshops', 'Bug exploration', 'Environmental conservation activities'],
          printableIdeas: ['Nature explorer certificates', 'Species identification guides'],
          emoji: '🌲',
          ageAppropriate: true,
          matchScore: 95
        }
      ]
    }
  };
  
  // ENHANCED interest processing with GUARANTEED relevance matching
  const processedInterests = new Set<string>();
  
  interests.forEach(interest => {
    const lowerInterest = interest.toLowerCase().trim();
    
    // ULTRA-COMPREHENSIVE interest matching with multiple variations
    // Cars/Vehicles matching
    if (lowerInterest.includes('car') || lowerInterest.includes('vehicle') || lowerInterest.includes('truck') || 
        lowerInterest.includes('racing') || lowerInterest.includes('auto') || lowerInterest.includes('motorcycle') ||
        lowerInterest.includes('transportation') || lowerInterest === 'cars') {
      if (!processedInterests.has('cars')) {
        interestBasedThemes.push(...interestThemeMap.cars.themes);
        processedInterests.add('cars');
      }
    }
    
    // Animals matching
    if (lowerInterest.includes('animal') || lowerInterest.includes('pet') || lowerInterest.includes('zoo') ||
        lowerInterest.includes('wildlife') || lowerInterest.includes('creature') || lowerInterest.includes('dog') ||
        lowerInterest.includes('cat') || lowerInterest.includes('farm') || lowerInterest === 'animals') {
      if (!processedInterests.has('animals')) {
        interestBasedThemes.push(...interestThemeMap.animals.themes);
        processedInterests.add('animals');
      }
    }
    
    // Art & Crafts matching
    if (lowerInterest.includes('art') || lowerInterest.includes('craft') || lowerInterest.includes('drawing') || 
        lowerInterest.includes('painting') || lowerInterest.includes('creative') || lowerInterest.includes('colors') ||
        lowerInterest.includes('coloring') || lowerInterest.includes('sketch') || lowerInterest === 'art & crafts') {
      if (!processedInterests.has('art')) {
        interestBasedThemes.push(...interestThemeMap.art.themes);
        processedInterests.add('art');
      }
    }
    
    // Sports matching
    if (lowerInterest.includes('sport') || lowerInterest.includes('soccer') || lowerInterest.includes('basketball') || 
        lowerInterest.includes('football') || lowerInterest.includes('tennis') || lowerInterest.includes('cricket') ||
        lowerInterest.includes('athletic') || lowerInterest.includes('competition') || lowerInterest === 'sports') {
      if (!processedInterests.has('sports')) {
        interestBasedThemes.push(...interestThemeMap.sports.themes);
        processedInterests.add('sports');
      }
    }
    
    // Music & Dancing matching
    if (lowerInterest.includes('music') || lowerInterest.includes('singing') || lowerInterest.includes('dancing') ||
        lowerInterest.includes('dance') || lowerInterest.includes('song') || lowerInterest.includes('instrument') ||
        lowerInterest.includes('concert') || lowerInterest.includes('band') || lowerInterest === 'music') {
      if (!processedInterests.has('music')) {
        interestBasedThemes.push(...interestThemeMap.music.themes);
        processedInterests.add('music');
      }
    }
    
    // Science matching
    if (lowerInterest.includes('science') || lowerInterest.includes('experiment') || lowerInterest.includes('lab') ||
        lowerInterest.includes('discovery') || lowerInterest.includes('research') || lowerInterest.includes('learning') ||
        lowerInterest === 'science') {
      if (!processedInterests.has('science')) {
        interestBasedThemes.push(...interestThemeMap.science.themes);
        processedInterests.add('science');
      }
    }
    
    // Nature matching
    if (lowerInterest.includes('nature') || lowerInterest.includes('outdoor') || lowerInterest.includes('camping') ||
        lowerInterest.includes('forest') || lowerInterest.includes('garden') || lowerInterest.includes('plant') ||
        lowerInterest.includes('flower') || lowerInterest.includes('hiking') || lowerInterest === 'nature') {
      if (!processedInterests.has('nature')) {
        interestBasedThemes.push(...interestThemeMap.nature.themes);
        processedInterests.add('nature');
      }
    }
  });
  
  // If no interests matched, provide default high-quality themes based on age
  if (interestBasedThemes.length === 0) {
    console.log('No specific interests matched, providing age-appropriate default themes');
    return getDefaultFallbacks(childName, age, interests);
  }
  
  // Remove duplicates and return top themes
  const uniqueThemes = interestBasedThemes.filter((theme, index, self) => 
    self.findIndex(t => t.id === theme.id) === index
  );
  
  // GUARANTEE: Always return at least 3 themes, maximum 5
  const finalThemes = uniqueThemes.slice(0, 5);
  if (finalThemes.length < 3) {
    // Add default themes to ensure minimum count
    const defaultThemes = getDefaultFallbacks(childName, age, interests);
    const additionalNeeded = 3 - finalThemes.length;
    finalThemes.push(...defaultThemes.slice(0, additionalNeeded));
  }
  
  return finalThemes;
}

// Helper 3: Text-Based Fallbacks - For contextual text input
function getTextBasedFallbacks(textAnalysis: any, childName: string, age: number, childDetails?: string): ThemeRecommendation[] {
  const textBasedThemes: ThemeRecommendation[] = [];
  
  // Generate themes based on specific characters mentioned - STAR WARS PRIORITY
  if (textAnalysis.characters.includes('Star Wars')) {
    textBasedThemes.push({
      id: 'starwars-text-1',
      name: 'Star Wars Galaxy Adventure Party',
      description: 'Journey to a galaxy far, far away with Jedi training, lightsaber battles, and Force powers!',
      whyRecommended: `Perfect for ${childName} who loves Star Wars (mentioned in their favorites) - featuring Jedi training, lightsabers, and galactic adventures!`,
      colorPalette: ['#000000', '#FFD700', '#0000FF', '#FF0000'],
      decorations: ['Death Star centerpiece', 'Lightsaber displays', 'Star Wars character banners', 'Galaxy backdrop'],
      activities: ['Jedi training academy', 'Lightsaber dueling', 'Build your own droid', 'Force training challenges'],
      printableIdeas: ['Jedi certificates', 'Star Wars character masks'],
      emoji: '⚔️',
      ageAppropriate: true,
      matchScore: 98
    });
    
    textBasedThemes.push({
      id: 'starwars-text-2',
      name: 'Jedi Knight Training Academy',
      description: 'Master the ways of the Force and become a true Jedi Knight in this epic Star Wars adventure!',
      whyRecommended: `Designed for ${childName} who loves Star Wars (from their text input) - Jedi training with lightsaber combat and Force powers!`,
      colorPalette: ['#4169E1', '#32CD32', '#FFD700', '#8B4513'],
      decorations: ['Jedi Temple setup', 'Lightsaber training course', 'Yoda wisdom stations'],
      activities: ['Padawan training challenges', 'Lightsaber construction workshop', 'Force meditation exercises'],
      printableIdeas: ['Jedi Knight certificates', 'Star Wars saga coloring pages'],
      emoji: '🌟',
      ageAppropriate: true,
      matchScore: 96
    });
  }
  
  if (textAnalysis.characters.includes('Iron Man')) {
    textBasedThemes.push({
      id: 'ironman-text-1',
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
      id: 'spiderman-text-1',
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
  
  // PRIORITY: Snow White character-specific themes
  if (textAnalysis.characters.includes('Snow White')) {
    textBasedThemes.push({
      id: 'snowwhite-text-1',
      name: 'Snow White Seven Dwarfs Adventure',
      description: 'Join Snow White and the Seven Dwarfs in the enchanted forest for magical adventures!',
      whyRecommended: `Perfect for ${childName} who loves Snow White (mentioned in their favorites) - featuring Snow White, seven dwarfs, magic mirror, and forest adventures!`,
      colorPalette: ['#FF0000', '#FFFF00', '#0000FF', '#8B4513'],
      decorations: ['Seven Dwarfs cottage setup', 'Magic mirror centerpiece', 'Poisoned apple displays', 'Enchanted forest backdrop'],
      activities: ['Seven Dwarfs house building', 'Magic mirror storytelling', 'Apple picking games', 'Forest creature hunt'],
      printableIdeas: ['Snow White story books', 'Seven Dwarfs coloring pages'],
      emoji: '🍎',
      ageAppropriate: true,
      matchScore: 98
    });
    
    textBasedThemes.push({
      id: 'snowwhite-text-2',
      name: 'Magic Mirror Princess Quest',
      description: 'Discover the magic of Snow White\'s world with the enchanted mirror and forest friends!',
      whyRecommended: `Designed for ${childName} who loves Snow White (from their text input) - magic mirror adventures with princess elements!`,
      colorPalette: ['#C0C0C0', '#FFD700', '#FF0000', '#228B22'],
      decorations: ['Giant magic mirror setup', 'Fairest of all banner', 'Apple orchard corner', 'Royal crown station'],
      activities: ['Magic mirror games', 'Fairest princess contest', 'Apple decorating workshop', 'Forest princess dance'],
      printableIdeas: ['Magic mirror certificates', 'Snow White princess crowns to color'],
      emoji: '🪞',
      ageAppropriate: true,
      matchScore: 96
    });
  }
  
  if (textAnalysis.characters.includes('Elsa/Frozen')) {
    textBasedThemes.push({
      id: 'frozen-text-1',
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
      id: 'unicorn-text-1',
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
      id: 'beach-text-1',
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
      id: 'art-text-1',
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
      id: 'dinosaur-text-1',
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
  
  if (textAnalysis.themes.includes('cricket') || textAnalysis.interests.includes('cricket')) {
    textBasedThemes.push({
      id: 'cricket-text-1',
      name: 'Cricket Champion Sports Party',
      description: 'Step onto the cricket field and experience the thrill of being a cricket champion!',
      whyRecommended: `Perfect for ${childName} who loves cricket (mentioned in their favorites) - featuring cricket gameplay, championship matches, and sports excellence!`,
      colorPalette: ['#228B22', '#FFFFFF', '#FF0000', '#FFD700'],
      decorations: ['Cricket pitch backdrop', 'Wicket displays', 'Championship trophies', 'Cricket equipment stations'],
      activities: ['Cricket batting challenges', 'Wicket-keeping contests', 'Cricket skills workshop', 'Championship trophy ceremony'],
      printableIdeas: ['Cricket scorecards', 'Player achievement certificates'],
      emoji: '🏏',
      ageAppropriate: true,
      matchScore: 98
    });
  }
  
  if (textAnalysis.themes.includes('sports')) {
    textBasedThemes.push({
      id: 'sports-text-1',
      name: 'All-Star Sports Championship',
      description: 'Experience the excitement of being an all-star athlete across multiple sports!',
      whyRecommended: `Perfect for ${childName} who loves sports (mentioned in their favorites) - multi-sport athletic challenges and championship fun!`,
      colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'],
      decorations: ['Multi-sport stations', 'Olympic-style rings', 'Championship podium', 'Sports equipment displays'],
      activities: ['Sports skills challenges', 'Team competitions', 'Medal ceremonies', 'Athletic training course'],
      printableIdeas: ['Sports achievement certificates', 'Olympic-style medals to color'],
      emoji: '⚽',
      ageAppropriate: true,
      matchScore: 98
    });
  }
  
  if (textAnalysis.themes.includes('vehicles')) {
    textBasedThemes.push({
      id: 'vehicles-text-1',
      name: 'Ultimate Vehicle Adventure Party',
      description: 'Explore the world of amazing vehicles with cars, trucks, and transportation adventures!',
      whyRecommended: `Perfect for ${childName} who loves vehicles (mentioned in their favorites) - featuring all types of transportation and vehicle adventures!`,
      colorPalette: ['#FF0000', '#000000', '#FFFF00', '#C0C0C0'],
      decorations: ['Vehicle display station', 'Traffic light setup', 'Car wash corner', 'Transportation museum'],
      activities: ['Vehicle identification games', 'Build your own car', 'Transportation challenges', 'Vehicle safety workshop'],
      printableIdeas: ['Vehicle certificates', 'Transportation coloring pages'],
      emoji: '🚗',
      ageAppropriate: true,
      matchScore: 98
    });
  }
  
  if (textAnalysis.themes.includes('animals')) {
    textBasedThemes.push({
      id: 'animals-text-1',
      name: 'Amazing Animal Kingdom Party',
      description: 'Discover the wonderful world of animals with wildlife adventures and creature encounters!',
      whyRecommended: `Perfect for ${childName} who loves animals (mentioned in their favorites) - featuring amazing creatures and wildlife exploration!`,
      colorPalette: ['#228B22', '#DAA520', '#8B4513', '#CD853F'],
      decorations: ['Animal habitat displays', 'Wildlife photography corner', 'Animal sound station', 'Creature care center'],
      activities: ['Animal care workshop', 'Wildlife identification games', 'Animal habitat building', 'Creature adventure quest'],
      printableIdeas: ['Animal care certificates', 'Wildlife identification guides'],
      emoji: '🐾',
      ageAppropriate: true,
      matchScore: 98
    });
  }
  
  return textBasedThemes.slice(0, 5);
}

// Helper 4: Default Fallbacks - Final fallback for any remaining cases
function getDefaultFallbacks(childName: string, age: number, interests: string[]): ThemeRecommendation[] {
  const fallbackThemes = [
    {
      id: 'superhero-default',
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
      id: 'magical-unicorn-default',
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
      id: 'dinosaur-discovery-default',
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
      id: 'space-explorer-default',
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
      id: 'art-studio-default',
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
