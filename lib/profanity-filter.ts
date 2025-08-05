// Profanity filter utility for child safety
// This utility detects inappropriate language and prevents AI suggestions

export interface ProfanityResult {
  hasProfanity: boolean;
  detectedWords: string[];
  sanitizedText: string;
}

// Restricted list focusing only on foul language, nudity, and violence
// Only includes truly inappropriate content for children's parties
const PROFANITY_LIST = [
  // Foul language / Explicit profanity
  'fuck', 'fucking', 'fucked', 'shit', 'damn', 'bitch', 'bastard', 'asshole',
  
  // Nudity and explicit sexual content
  'nude', 'naked', 'sex', 'penis', 'cock', 'pussy', 'vagina', 'porn', 'porno',
  'tits', 'titties', 'nipple', 'nipples', 'butthole', 'anus',
  'horny', 'sexy', 'orgasm', 'masturbate', 'rape', 'slut', 'whore',
  
  // Violence and harmful content
  'kill', 'murder', 'suicide', 'bomb', 'gun', 'weapon', 'violence',
  'torture', 'abuse', 'harm', 'dangerous', 'threat'
];

// Additional variations and common misspellings for restricted words only
const PROFANITY_VARIATIONS = [
  'f*ck', 'f**k', 'fck', 'fuk', 'fook', 'phuck',
  's*it', 's**t', 'sh1t', 'sht',
  'b*tch', 'b**ch', 'btch', 'bich',
  '@ss', 'azz'
];

// Combined profanity list
const ALL_PROFANITY = [...PROFANITY_LIST, ...PROFANITY_VARIATIONS];

/**
 * Checks if text contains profanity or inappropriate language
 * @param text - The text to check
 * @returns ProfanityResult with detection status and details
 */
export function checkProfanity(text: string): ProfanityResult {
  if (!text || typeof text !== 'string') {
    return {
      hasProfanity: false,
      detectedWords: [],
      sanitizedText: text || ''
    };
  }

  const normalizedText = text.toLowerCase().trim();
  const words = normalizedText.split(/\s+/);
  const detectedWords: string[] = [];

  // Check each word against profanity list
  for (const word of words) {
    // Remove punctuation and special characters for checking
    const cleanWord = word.replace(/[^\w]/g, '');
    
    if (ALL_PROFANITY.includes(cleanWord)) {
      detectedWords.push(word);
    }
    
    // Check for partial matches (words containing profanity)
    for (const profaneWord of ALL_PROFANITY) {
      if (cleanWord.includes(profaneWord) && cleanWord.length > profaneWord.length) {
        detectedWords.push(word);
        break;
      }
    }
  }

  // Remove duplicates
  const uniqueDetectedWords = Array.from(new Set(detectedWords));

  // Create sanitized text by replacing detected words with asterisks
  let sanitizedText = text;
  for (const word of uniqueDetectedWords) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    sanitizedText = sanitizedText.replace(regex, '*'.repeat(word.length));
  }

  return {
    hasProfanity: uniqueDetectedWords.length > 0,
    detectedWords: uniqueDetectedWords,
    sanitizedText
  };
}

/**
 * Generates a user-friendly warning message for inappropriate content
 * @param detectedWords - Array of detected inappropriate words
 * @returns Warning message string
 */
export function getProfanityWarning(detectedWords: string[]): string {
  if (detectedWords.length === 0) return '';
  
  if (detectedWords.length === 1) {
    return `The word "${detectedWords[0]}" is not appropriate for children's parties. Please use family-friendly language.`;
  } else {
    return `Some words in your input are not appropriate for children's parties. Please use family-friendly language.`;
  }
}

/**
 * Checks if AI suggestions should be blocked due to inappropriate content
 * @param text - The text to check
 * @returns boolean indicating if AI suggestions should be blocked
 */
export function shouldBlockAISuggestions(text: string): boolean {
  const result = checkProfanity(text);
  return result.hasProfanity;
}