// Profanity filter utility for child safety
// This utility detects inappropriate language and prevents AI suggestions

export interface ProfanityResult {
  hasProfanity: boolean;
  detectedWords: string[];
  sanitizedText: string;
}

// Comprehensive list of inappropriate words to filter
// Includes general profanity, offensive language, and inappropriate content
const PROFANITY_LIST = [
  // Explicit sexual content
  'sex', 'fuck', 'fucking', 'fucked', 'shit', 'shit', 'damn', 'hell',
  'dick', 'penis', 'cock', 'pussy', 'vagina', 'boob', 'boobs', 'breast', 'breasts',
  'ass', 'asshole', 'bitch', 'bastard', 'slut', 'whore', 'porn', 'porno',
  
  // Inappropriate body parts and sexual references
  'nude', 'naked', 'horny', 'sexy', 'orgasm', 'masturbate', 'rape',
  'tits', 'titties', 'nipple', 'nipples', 'butt', 'butthole', 'anus',
  
  // Violence and harmful content
  'kill', 'murder', 'suicide', 'bomb', 'gun', 'weapon', 'violence', 'hurt',
  'pain', 'torture', 'abuse', 'harm', 'dangerous', 'threat',
  
  // Drugs and substances
  'drugs', 'weed', 'marijuana', 'cocaine', 'heroin', 'meth', 'alcohol', 'beer',
  'wine', 'drunk', 'high', 'smoke', 'smoking', 'cigarette',
  
  // Hate speech and discrimination
  'hate', 'racist', 'racism', 'nazi', 'terrorist', 'extremist',
  
  // Other inappropriate content
  'stupid', 'idiot', 'moron', 'retard', 'loser', 'ugly', 'fat', 'skinny',
  'gay' // when used inappropriately
];

// Additional variations and common misspellings
const PROFANITY_VARIATIONS = [
  'f*ck', 'f**k', 'fck', 'fuk', 'fook', 'phuck',
  's*it', 's**t', 'sh1t', 'sht',
  'd*ck', 'd**k', 'dik', 'dck',
  'b*tch', 'b**ch', 'btch', 'bich',
  'a*s', 'a**', 'azz', '@ss',
  'h*ll', 'h**l', 'hel', 'heck' // borderline but in children's context
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