"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, ArrowRight, ArrowLeft, PartyPopper, X, Sparkles, Loader2, Heart, User, UserCheck, Users, Baby, AlertTriangle, DollarSign, MapPin, Globe, CreditCard, CheckCircle, Home, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { checkProfanity, getProfanityWarning, shouldBlockAISuggestions } from "@/lib/profanity-filter";
import Fireworks from "react-canvas-confetti/dist/presets/fireworks";
import { useAuth } from "@/contexts/AuthContext";
import AuthModal from "@/components/AuthModal";

const interestOptions = [
  "Animals", "Art & Crafts", "Cars", "Dancing", "Music", "Sports", "Science",
  "Books", "Movies", "Games", "Building", "Nature", "Cooking", "Magic",
  "Dinosaurs", "Space", "Superheroes", "Princesses", "Pirates", "Dragons",
  "Unicorns", "Robots", "Adventures", "Drawing"
];

const colorOptions = [
  { name: "Pink", value: "pink", color: "#FF69B4" },
  { name: "Purple", value: "purple", color: "#9370DB" },
  { name: "Blue", value: "blue", color: "#4169E1" },
  { name: "Green", value: "green", color: "#32CD32" },
  { name: "Yellow", value: "yellow", color: "#FFD700" },
  { name: "Orange", value: "orange", color: "#FF8C00" },
  { name: "Red", value: "red", color: "#FF6347" },
  { name: "Rainbow", value: "rainbow", color: "linear-gradient(90deg, #FF6B6B, #4ECDC4, #45B7D1, #96CEB4, #FFEAA7, #DDA0DD)" }
];

const currencyOptions = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "CAD", symbol: "$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "$", name: "Australian Dollar" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "KRW", symbol: "₩", name: "South Korean Won" },
  { code: "SGD", symbol: "$", name: "Singapore Dollar" },
  { code: "HKD", symbol: "$", name: "Hong Kong Dollar" },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
  { code: "DKK", symbol: "kr", name: "Danish Krone" },
  { code: "MXN", symbol: "$", name: "Mexican Peso" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "SAR", symbol: "ر.س", name: "Saudi Riyal" },
  { code: "ZAR", symbol: "R", name: "South African Rand" }
];

const countryOptions = [
  { code: "US", name: "United States", flag: "🇺🇸", postalFormat: "Zip Code", example: "12345 or 12345-6789" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", postalFormat: "Postcode", example: "SW1A 1AA" },
  { code: "CA", name: "Canada", flag: "🇨🇦", postalFormat: "Postal Code", example: "K1A 0A6" },
  { code: "AU", name: "Australia", flag: "🇦🇺", postalFormat: "Postcode", example: "2000" },
  { code: "DE", name: "Germany", flag: "🇩🇪", postalFormat: "Postleitzahl", example: "10115" },
  { code: "FR", name: "France", flag: "🇫🇷", postalFormat: "Code Postal", example: "75001" },
  { code: "JP", name: "Japan", flag: "🇯🇵", postalFormat: "Postal Code", example: "100-0001" },
  { code: "IN", name: "India", flag: "🇮🇳", postalFormat: "PIN Code", example: "110001" },
  { code: "CN", name: "China", flag: "🇨🇳", postalFormat: "Postal Code", example: "100000" },
  { code: "KR", name: "South Korea", flag: "🇰🇷", postalFormat: "Postal Code", example: "03001" },
  { code: "SG", name: "Singapore", flag: "🇸🇬", postalFormat: "Postal Code", example: "018956" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", postalFormat: "Postcode", example: "1012 JS" },
  { code: "IT", name: "Italy", flag: "🇮🇹", postalFormat: "CAP", example: "00118" },
  { code: "ES", name: "Spain", flag: "🇪🇸", postalFormat: "Código Postal", example: "28001" },
  { code: "SE", name: "Sweden", flag: "🇸🇪", postalFormat: "Postnummer", example: "11122" },
  { code: "NO", name: "Norway", flag: "🇳🇴", postalFormat: "Postnummer", example: "0010" },
  { code: "DK", name: "Denmark", flag: "🇩🇰", postalFormat: "Postnummer", example: "1050" },
  { code: "MX", name: "Mexico", flag: "🇲🇽", postalFormat: "Código Postal", example: "01000" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", postalFormat: "CEP", example: "01310-100" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", postalFormat: "Postal Code", example: "8001" }
];

const classicThemes = [
  { id: "dinosaur", name: "Dinosaur", emoji: "🦕", color: "bg-gradient-to-r from-green-500 to-emerald-600" },
  { id: "space", name: "Space", emoji: "🚀", color: "bg-gradient-to-r from-purple-600 to-indigo-800" },
  { id: "safari", name: "Safari", emoji: "🦁", color: "bg-gradient-to-r from-yellow-500 to-orange-600" },
  { id: "ocean", name: "Ocean", emoji: "🐠", color: "bg-gradient-to-r from-blue-500 to-cyan-600" },
  { id: "princess", name: "Princess", emoji: "👸", color: "bg-gradient-to-r from-pink-400 to-purple-600" },
  { id: "superhero", name: "Superhero", emoji: "🦸‍♂️", color: "bg-gradient-to-r from-red-500 to-blue-600" },
  { id: "sports", name: "Sports", emoji: "⚽", color: "bg-gradient-to-r from-orange-500 to-red-600" },
  { id: "unicorn", name: "Unicorn", emoji: "🦄", color: "bg-gradient-to-r from-pink-500 to-violet-600" }
];

// Emoji rotation arrays for each theme to show variety
const themeEmojiVariations = {
  dinosaur: ["🦕", "🦖", "🌿", "🥚"],
  space: ["🚀", "🛸", "🌟", "👨‍🚀"],
  safari: ["🦁", "🐘", "🦒", "🌍"],
  ocean: ["🐠", "🐋", "🦈", "🏖️"],
  princess: ["👸", "👑", "🏰", "🦄"],
  superhero: ["🦸‍♂️", "🦸‍♀️", "⚡", "🚁"],
  sports: ["⚽", "🏀", "🏈", "🎾"],
  unicorn: ["🦄", "🌈", "✨", "🎀"]
};

const themes = [
  { 
    id: "superhero", 
    name: "Superhero", 
    color: "bg-gradient-to-r from-red-500 to-blue-600", 
    emoji: "🦸‍♂️",
    description: "Action-packed adventure with capes and powers!",
    preview: {
      decorations: ["Cape photo booth", "Comic book cutouts", "City skyline backdrop"],
      activities: ["Hero training course", "Design superhero logos", "Rescue missions"],
      food: ["Power-up fruit kabobs", "Hero sandwiches", "Lightning bolt cookies"]
    }
  },
  { 
    id: "princess", 
    name: "Princess", 
    color: "bg-gradient-to-r from-pink-400 to-purple-600", 
    emoji: "👸",
    description: "Royal elegance with crowns and magical moments",
    preview: {
      decorations: ["Castle entrance arch", "Tiaras and jewels display", "Pink and gold balloons"],
      activities: ["Crown decorating", "Royal dance lessons", "Princess makeover station"],
      food: ["Royal tea sandwiches", "Crown-shaped cookies", "Pink lemonade"]
    }
  },
  { 
    id: "dinosaur", 
    name: "Dinosaur", 
    color: "bg-gradient-to-r from-green-500 to-emerald-600", 
    emoji: "🦕",
    description: "Prehistoric adventure with roaring fun!",
    preview: {
      decorations: ["Jungle vines and plants", "Dino footprint trail", "Volcano centerpiece"],
      activities: ["Fossil dig excavation", "Dino egg hunt", "Paleontologist training"],
      food: ["Dino nuggets", "Prehistoric fruit salad", "Volcano punch"]
    }
  },
  { 
    id: "space", 
    name: "Space", 
    color: "bg-gradient-to-r from-purple-600 to-indigo-800", 
    emoji: "🚀",
    description: "Blast off to the stars for cosmic celebration",
    preview: {
      decorations: ["Galaxy backdrop", "Hanging planets", "LED star ceiling"],
      activities: ["Build rocket ships", "Planet exploration", "Astronaut training"],
      food: ["Galaxy smoothies", "Rocket sandwiches", "Moon rock candy"]
    }
  },
  { 
    id: "safari", 
    name: "Safari", 
    color: "bg-gradient-to-r from-yellow-500 to-orange-600", 
    emoji: "🦁",
    description: "Wild adventure with jungle animals",
    preview: {
      decorations: ["Jungle canopy", "Animal print tablecloths", "Safari tent entrance"],
      activities: ["Animal mask making", "Safari photo shoot", "Wildlife scavenger hunt"],
      food: ["Animal crackers", "Jungle juice", "Safari trail mix"]
    }
  },
  { 
    id: "ocean", 
    name: "Ocean", 
    color: "bg-gradient-to-r from-blue-400 to-cyan-600", 
    emoji: "🐙",
    description: "Underwater exploration with sea creatures",
    preview: {
      decorations: ["Blue streamers waves", "Hanging jellyfish", "Treasure chest props"],
      activities: ["Seashell painting", "Mermaid tail crafts", "Underwater dance party"],
      food: ["Fish-shaped sandwiches", "Blue punch", "Seaweed snacks"]
    }
  },
  { 
    id: "pirate", 
    name: "Pirate", 
    color: "bg-gradient-to-r from-amber-600 to-red-700", 
    emoji: "🏴‍☠️",
    description: "Treasure hunting adventure on the high seas",
    preview: {
      decorations: ["Pirate ship backdrop", "Treasure chests", "Skull and crossbones flags"],
      activities: ["Treasure hunt", "Walk the plank game", "Pirate hat decorating"],
      food: ["Pirate ship cake", "Gold coin chocolates", "Grog (fruit punch)"]
    }
  },
  { 
    id: "unicorn", 
    name: "Unicorn", 
    color: "bg-gradient-to-r from-pink-500 to-violet-600", 
    emoji: "🦄",
    description: "Magical rainbows and sparkly dreams",
    preview: {
      decorations: ["Rainbow balloon arch", "Glittery unicorn horns", "Pastel cloud backdrop"],
      activities: ["Unicorn horn decorating", "Rainbow slime making", "Magical dance party"],
      food: ["Rainbow cake", "Unicorn hot chocolate", "Sparkly cupcakes"]
    }
  }
];

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

interface PartyData {
  childName: string;
  childAge: number;
  childGender: string;
  childInterests: string[];
  favoriteColors: string[];
  childDetails?: string;
  partyDate: Date | undefined;
  selectedTheme: string;
  aiRecommendations?: ThemeRecommendation[];
  isLoadingAI?: boolean;
  classicTheme?: string; // New field for classic theme selection
  budget?: number; // New field for party budget
  currency?: string; // New field for selected currency
  country?: string; // New field for selected country
  zipCode?: string; // New field for zip code
  guestCount?: number; // New field for number of guests
  zipCodeError?: string; // New field for zip code validation error
  partyId?: string; // Track party ID for updates and continuity
  venue?: 'indoor' | 'outdoor' | 'mixed'; // New field for venue type
  duration?: string; // New field for party duration
  themeActivities?: string; // Activities from selected theme
}

// Profanity detection state interface
interface ProfanityState {
  hasProfanity: boolean;
  detectedWords: string[];
  warningMessage: string;
}

// AI Theme Recommendation Logic with OpenAI Integration
const getAIRecommendations = async (
  childName: string,
  age: number,
  interests: string[],
  favoriteColors: string[],
  childGender: string,
  childDetails?: string,
  selectedClassicTheme?: string
): Promise<ThemeRecommendation[]> => {
  try {
    const response = await fetch('/api/theme-recommendations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        childName,
        age,
        interests,
        favoriteColors,
        childGender,
        childDetails,
        selectedClassicTheme,
        activities: interests // Use interests as activities for now
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch recommendations');
    }

    const data = await response.json();
    return data.recommendations || [];
  } catch (error) {
    console.error('Error fetching AI recommendations:', error);
    // Return fallback recommendations on error
    return getFallbackRecommendations(childName, age, interests, selectedClassicTheme);
  }
};

// Fallback recommendations when AI is unavailable
const getFallbackRecommendations = (childName: string, age: number, interests: string[], selectedClassicTheme?: string): ThemeRecommendation[] => {  
  // If a classic theme is selected, return contextual variations
  if (selectedClassicTheme) {
    const themeLower = selectedClassicTheme.toLowerCase();
    
    if (themeLower === 'superhero') {
      return [
        {
          id: 'superhero-contextual-1',
          name: 'Superhero Action Adventure',
          description: 'Transform into mighty heroes and save the day with action-packed adventures!',
          whyRecommended: `Perfect for ${childName} who selected the Superhero theme - experience epic hero adventures!`,
          colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'],
          decorations: ['Hero cape station', 'City skyline backdrop', 'Comic book props'],
          activities: ['Hero training course', 'Superhero logo design', 'Villain capture missions'],
          printableIdeas: ['Superhero certificates', 'Hero comic pages'],
          emoji: '🦸‍♂️',
          ageAppropriate: true,
          matchScore: 95
        }
      ];
    }
    
    // Return contextual fallback for the selected classic theme
    return [
      {
        id: `${themeLower}-contextual`,
        name: `${selectedClassicTheme} Adventure`,
        description: `Experience an amazing ${selectedClassicTheme.toLowerCase()} themed party adventure!`,
        whyRecommended: `Perfect for ${childName} who chose the ${selectedClassicTheme} theme!`,
        colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'],
        decorations: [`${selectedClassicTheme} decorations`, `${selectedClassicTheme} backdrop`, 'Themed party props'],
        activities: [`${selectedClassicTheme} games`, `${selectedClassicTheme} activities`, 'Theme exploration'],
        printableIdeas: [`${selectedClassicTheme} coloring pages`, `${selectedClassicTheme} activity sheets`],
        emoji: '🎉',
        ageAppropriate: true,
        matchScore: 90
      }
    ];
  }
  
  const ageNum = age;
  const fallbackThemes: ThemeRecommendation[] = [
    {
      id: 'superhero-local',
      name: 'Superhero Adventure',
      description: 'Transform into mighty heroes and save the day with action-packed adventures!',
      whyRecommended: `Perfect for ${childName} who loves action and adventure!`,
      colorPalette: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'],
      decorations: ['Cape station', 'Cityscape backdrop', 'Comic speech bubbles'],
      activities: ['Hero training course', 'Design superhero logos', 'Villain capture game'],
      printableIdeas: ['Superhero certificates', 'Comic coloring pages'],
      emoji: '🦸‍♂️',
      ageAppropriate: ageNum >= 3,
      matchScore: 90
    },
    {
      id: 'unicorn-local',
      name: 'Magical Unicorn Paradise',
      description: 'Enter a world of rainbow magic, sparkles, and enchanted unicorn friends!',
      whyRecommended: `Chosen for ${childName} because unicorns represent magic and wonder!`,
      colorPalette: ['#FF69B4', '#9370DB', '#FFB6C1', '#F0E68C'],
      decorations: ['Rainbow balloon arch', 'Unicorn horn headbands', 'Glittery clouds'],
      activities: ['Unicorn slime making', 'Rainbow treasure hunt', 'Horn decorating'],
      printableIdeas: ['Unicorn coloring sheets', 'Magic potion cards'],
      emoji: '🦄',
      ageAppropriate: true,
      matchScore: 85
    },
    {
      id: 'space-local',
      name: 'Space Explorer Mission',
      description: 'Blast off to the stars on an intergalactic adventure through the cosmos!',
      whyRecommended: `Perfect for ${childName} who dreams big and loves exploration!`,
      colorPalette: ['#4B0082', '#000080', '#C0C0C0', '#FFD700'],
      decorations: ['Solar system mobile', 'Astronaut photo booth', 'Starry ceiling'],
      activities: ['Build rockets', 'Planet hunt', 'Astronaut training'],
      printableIdeas: ['Mission certificates', 'Constellation pages'],
      emoji: '🚀',
      ageAppropriate: ageNum >= 4,
      matchScore: 88
    }
  ];

  return fallbackThemes;
};

export default function CreatePartyPage() {
  const { user, session } = useAuth();

  // Clear demo data when user signs in
  useEffect(() => {
    if (user && localStorage.getItem('demoPartyData')) {
      // User has signed in, clear demo data
      localStorage.removeItem('demoPartyData');
    }
  }, [user]);
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [partyData, setPartyData] = useState<PartyData>({
    childName: "",
    childAge: 0,
    childGender: "",
    childInterests: [],
    favoriteColors: [],
    partyDate: undefined,
    selectedTheme: "",
    aiRecommendations: [],
    isLoadingAI: false,
    classicTheme: "",
    budget: undefined,
    currency: "USD", // Initialize with default USD currency
    zipCode: "",
    country: "",
    zipCodeError: undefined,
    venue: 'mixed', // Default venue type
    duration: '2-3 hours', // Default party duration
    guestCount: undefined
  });
  const [isNavigating, setIsNavigating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStep, setSubmissionStep] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [customThemeMode, setCustomThemeMode] = useState(false);
  const [showClassicThemes, setShowClassicThemes] = useState(false);
  const [showCustomOptions, setShowCustomOptions] = useState(false);
  
  // Profanity detection state
  const [profanityState, setProfanityState] = useState<ProfanityState>({
    hasProfanity: false,
    detectedWords: [],
    warningMessage: ''
  });
  
  // Emoji animation state
  const [currentEmojiIndex, setCurrentEmojiIndex] = useState(0);

  // Dynamic placeholder examples
  const placeholderExamples = [
    "She's obsessed with Frozen and unicorns this month...",
    "He talks about astronauts and loves Pokémon.",
    "Spiderman, magic tricks, and football!",
    "Loves painting, fairy tales, and her pet hamster.",
    "Always building with Legos and watching Minecraft videos.",
    "Dinosaurs, dragons, and playing dress-up as a knight.",
    "Dancing to Taylor Swift and collecting sparkly things."
  ];

  const [currentPlaceholderIndex, setCurrentPlaceholderIndex] = useState(0);
  const [currentPlaceholder, setCurrentPlaceholder] = useState(placeholderExamples[0]);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Restore from localStorage on component mount
  useEffect(() => {
    const savedData = localStorage.getItem('partyData');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        // Ensure required fields are initialized if missing from saved data
        const restoredData = {
          ...parsedData,
          currency: parsedData.currency || "USD",
          country: parsedData.country || "",
          zipCodeError: parsedData.zipCodeError || undefined,
          // Convert partyDate back to Date object if it exists
          partyDate: parsedData.partyDate ? new Date(parsedData.partyDate) : undefined
        };
        setPartyData(restoredData);
      } catch (error) {
        console.error('Error parsing saved party data:', error);
        // If parsing fails, start fresh
        localStorage.removeItem('partyData');
      }
    }
  }, []);

  // Auto-save functionality - only save to localStorage during wizard
  useEffect(() => {
    // Only save to localStorage during the wizard process
    localStorage.setItem('partyData', JSON.stringify(partyData));
  }, [partyData]);


  // Rotate placeholder text every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPlaceholderIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % placeholderExamples.length;
        setCurrentPlaceholder(placeholderExamples[nextIndex]);
        return nextIndex;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Trigger confetti when AI recommendations are loaded
  useEffect(() => {
    if (!partyData.isLoadingAI && partyData.aiRecommendations && partyData.aiRecommendations.length > 0 && !showConfetti) {
      setShowConfetti(true);
      // Hide confetti after 4 seconds
      const confettiTimer = setTimeout(() => {
        setShowConfetti(false);
      }, 4000);
      return () => clearTimeout(confettiTimer);
    }
  }, [partyData.isLoadingAI, partyData.aiRecommendations, showConfetti]);

  // Emoji rotation animation - cycle through all theme emojis every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentEmojiIndex((prevIndex) => {
        // Get all emojis from all themes
        const allEmojis = Object.values(themeEmojiVariations).flat();
        return (prevIndex + 1) % allEmojis.length;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Profanity validation function
  const handleTextInputChange = (input: string) => {
    const profanityResult = checkProfanity(input);
    
    setProfanityState({
      hasProfanity: profanityResult.hasProfanity,
      detectedWords: profanityResult.detectedWords,
      warningMessage: profanityResult.hasProfanity ? getProfanityWarning(profanityResult.detectedWords) : ''
    });

    return profanityResult;
  };

  // Auto-detect country from zip code format
  const detectCountryFromZipCode = (zipCode: string) => {
    const cleanZip = zipCode.replace(/[\s\-]/g, '');
    
    // Test original zipCode for patterns that require spaces/hyphens first (UK, CA, NL)
    if (/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(zipCode)) return 'GB';
    if (/^[A-Z]\d[A-Z]\s*\d[A-Z]\d$/i.test(zipCode)) return 'CA';
    if (/^\d{4}\s*[A-Z]{2}$/i.test(zipCode)) return 'NL';
    
    // For 5-digit zip codes, use intelligent detection based on actual ranges
    if (/^\d{5}$/.test(cleanZip)) {
      const zipNum = parseInt(cleanZip, 10);
      
      // US ZIP code ranges (00501-99950) - prioritize US first as most common
      if (zipNum >= 501 && zipNum <= 99950) {
        // Additional US validation - exclude known non-US ranges
        // Germany uses 01000-99999, but US has wider coverage and priority
        return 'US';
      }
      
      // If not in US range, check other countries with 5-digit codes
      // German postal codes: 01000-99999
      if (zipNum >= 1000 && zipNum <= 99999) return 'DE';
      
      // Default to US for any 5-digit code (US has broadest coverage)
      return 'US';
    }
    
    // Extended ZIP+4 codes (US only)
    if (/^\d{5}-?\d{4}$/.test(cleanZip)) return 'US';
    
    // Other specific patterns
    if (/^\d{3}-?\d{4}$/.test(cleanZip)) return 'JP';
    if (/^\d{5}-?\d{3}$/.test(cleanZip)) return 'BR';
    
    // 6-digit codes
    if (/^\d{6}$/.test(cleanZip)) {
      // India: 100000-999999
      if (cleanZip.length === 6 && parseInt(cleanZip.substring(0, 1)) >= 1) return 'IN';
      // China: 100000-999999  
      return 'CN';
    }
    
    // 4-digit codes
    if (/^\d{4}$/.test(cleanZip)) {
      const zipNum = parseInt(cleanZip, 10);
      // Australia: 0200-9999
      if (zipNum >= 200) return 'AU';
      // Norway: 0010-9999
      if (zipNum >= 10) return 'NO';
      // Default to Denmark for other 4-digit codes
      return 'DK';
    }
    
    return null;
  };

  // Enhanced zip code validation with auto-detection
  const validateZipCodeWithDetection = (zipCode: string) => {
    if (!zipCode || zipCode.trim() === '') {
      return { error: 'Zip code is required', detectedCountry: null };
    }
    
    const detectedCountry = detectCountryFromZipCode(zipCode);
    const cleanZip = zipCode.replace(/[\s\-]/g, '');
    
    if (!detectedCountry) {
      return { error: 'Invalid zip code format - please check your entry', detectedCountry: null };
    }
    
    // Country-specific validation patterns
    const patterns: { [key: string]: { pattern: RegExp; format: string } } = {
      US: { pattern: /^\d{5}(\d{4})?$/, format: '12345 or 12345-6789' },
      GB: { pattern: /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i, format: 'SW1A 1AA' },
      CA: { pattern: /^[A-Z]\d[A-Z]\s*\d[A-Z]\d$/i, format: 'K1A 0A6' },
      AU: { pattern: /^\d{4}$/, format: '2000' },
      DE: { pattern: /^\d{5}$/, format: '10115' },
      FR: { pattern: /^\d{5}$/, format: '75001' },
      JP: { pattern: /^\d{3}-?\d{4}$/, format: '100-0001' },
      IN: { pattern: /^\d{6}$/, format: '110001' },
      CN: { pattern: /^\d{6}$/, format: '100000' },
      KR: { pattern: /^\d{5}$/, format: '03001' },
      SG: { pattern: /^\d{6}$/, format: '018956' },
      NL: { pattern: /^\d{4}\s*[A-Z]{2}$/i, format: '1012 JS' },
      IT: { pattern: /^\d{5}$/, format: '00118' },
      ES: { pattern: /^\d{5}$/, format: '28001' },
      SE: { pattern: /^\d{5}$/, format: '11122' },
      NO: { pattern: /^\d{4}$/, format: '0010' },
      DK: { pattern: /^\d{4}$/, format: '1050' },
      MX: { pattern: /^\d{5}$/, format: '01000' },
      BR: { pattern: /^\d{5}-?\d{3}$/, format: '01310-100' },
      ZA: { pattern: /^\d{4}$/, format: '8001' }
    };
    
    const countryPattern = patterns[detectedCountry];
    if (!countryPattern) {
      return { error: 'Unsupported country format', detectedCountry };
    }
    
    // For UK and Canada, use original zipCode (with spaces) for validation
    const testValue = (detectedCountry === 'GB' || detectedCountry === 'CA' || detectedCountry === 'NL') ? zipCode : cleanZip;
    
    if (!countryPattern.pattern.test(testValue)) {
      const countryName = countryOptions.find(c => c.code === detectedCountry)?.name || detectedCountry;
      return { error: `Please enter a valid ${countryName} zip code (e.g., ${countryPattern.format})`, detectedCountry };
    }
    
    return { error: null, detectedCountry };
  };

  // Handle zip code input with auto-detection and validation
  const handleZipCodeChange = (value: string) => {
    const result = validateZipCodeWithDetection(value);
    setPartyData({ 
      ...partyData, 
      zipCode: value,
      country: result.detectedCountry || partyData.country,
      zipCodeError: result.error || undefined 
    });
  };

  // Handle currency change from dropdown
  const handleCurrencyChange = (currencyCode: string) => {
    setPartyData({ 
      ...partyData, 
      currency: currencyCode
    });
  };

  const handleNext = async () => {
    // Simple navigation for the new 3-step workflow
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Validation checks
      if (!partyData.childName?.trim()) {
        throw new Error('Please enter your child\'s name');
      }
      if (!partyData.childAge || partyData.childAge < 1) {
        throw new Error('Please select your child\'s age');
      }
      if (!partyData.partyDate) {
        throw new Error('Please select a party date');
      }

      // Create robust authentication and party creation system
      setSubmissionStep('Preparing party data...');
      
      const createPayload = {
        childName: partyData.childName,
        childAge: partyData.childAge,
        childGender: partyData.childGender,
        partyDate: partyData.partyDate!,
        theme: partyData.selectedTheme || partyData.classicTheme || null,
        interests: partyData.childInterests,
        favoriteColors: partyData.favoriteColors,
        guestCount: partyData.guestCount,
        budget: partyData.budget || undefined,
        location: partyData.zipCode,
        venue: partyData.venue,
        duration: partyData.duration,
        status: 'PLANNING' as const,
      };

      console.log('Creating party with robust authentication...');
      setSubmissionStep('Creating your magical party plan...');

      // Multi-layered authentication approach
      const result = await createPartyWithRobustAuth(createPayload);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create party');
      }

      if (!result.party?.id) {
        throw new Error('Party created but no ID returned');
      }

      const partyId = result.party.id;
      console.log('Party created successfully with ID:', partyId);

      // Save the party ID for continuity
      setPartyData(prev => ({ ...prev, partyId }));

      // Store party data for continuity
      const continuityData = {
        partyId,
        childName: partyData.childName,
        theme: partyData.selectedTheme || partyData.classicTheme,
        partyDate: partyData.partyDate?.toISOString(),
        timestamp: Date.now()
      };
      
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('currentParty', JSON.stringify(continuityData));
        } catch (error) {
          console.warn('Failed to save party continuity data:', error);
        }
      }

      // Show success state
      setSubmissionStep('Party created successfully! 🎉');
      setShowConfetti(true);
      
      // Navigate to the party plan page
      setTimeout(() => {
        router.push(`/party-plan?id=${partyId}`);
      }, 2000);

    } catch (error) {
      console.error('Error creating party:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to create party. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('timed out')) {
          errorMessage = 'The request is taking longer than expected. This might be due to network connectivity issues. Please check your internet connection and try again.';
        } else if (error.message.includes('database') || error.message.includes('connection')) {
          errorMessage = 'There seems to be a temporary server issue. Please wait a moment and try again.';
        } else if (error.message.includes('authentication')) {
          errorMessage = 'Please sign in again to continue.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setSubmitError(errorMessage);
      
      // Clear any potentially stale localStorage data on error
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('partyData');
          localStorage.removeItem('partyChecklist');
          localStorage.removeItem('partyGuests');
          localStorage.removeItem('partyInvitations');
        } catch (e) {
          console.warn('Failed to clear localStorage:', e);
        }
      }
    } finally {
      setIsSubmitting(false);
      setSubmissionStep('');
    }
  };

  // Robust authentication and party creation system
  const createPartyWithRobustAuth = async (partyData: any) => {
    // Method 1: Try with current session from context
    try {
      console.log('Method 1: Using session from auth context');
      if (session && user) {
        const response = await fetch('/api/parties', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(partyData),
          credentials: 'include',
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('Method 1 successful');
          return result;
        }
        
        console.log('Method 1 failed, trying method 2');
      }
    } catch (error) {
      console.log('Method 1 error:', error);
    }

    // Method 2: Refresh session and retry
    try {
      console.log('Method 2: Refreshing session and retrying');
      const { createClientComponentClient } = await import('@/lib/supabase');
      const supabase = createClientComponentClient();
      
      const { data: { session: freshSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error('Session refresh failed: ' + sessionError.message);
      }
      
      if (!freshSession) {
        throw new Error('No session available after refresh');
      }
      
      console.log('Fresh session obtained, making API call');
      const response = await fetch('/api/parties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${freshSession.access_token}`,
          'X-Supabase-Auth': 'true',
        },
        body: JSON.stringify(partyData),
        credentials: 'include',
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Method 2 successful');
        return result;
      }
      
      console.log('Method 2 failed, trying method 3');
    } catch (error) {
      console.log('Method 2 error:', error);
    }

    // Method 3: Direct Supabase client call
    try {
      console.log('Method 3: Direct Supabase client call');
      const { createClientComponentClient } = await import('@/lib/supabase');
      const supabase = createClientComponentClient();
      
      // Verify user is authenticated
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !currentUser) {
        throw new Error('User not authenticated: ' + (userError?.message || 'No user found'));
      }
      
      console.log('Direct Supabase call - user verified:', currentUser.id);
      
      // Prepare insert data
      const insertData = {
        user_id: currentUser.id,
        child_name: partyData.childName,
        child_age: partyData.childAge,
        child_gender: partyData.childGender || null,
        party_date: new Date(partyData.partyDate).toISOString(),
        theme: partyData.theme || null,
        guest_count: partyData.guestCount || 0,
        budget: partyData.budget || null,
        zip_code: partyData.location || null,
        venue_type: partyData.venue || null,
        status: partyData.status || 'PLANNING'
      };
      
      console.log('Inserting party data directly:', insertData);
      
      const { data: party, error: insertError } = await supabase
        .from('parties')
        .insert(insertData)
        .select()
        .single();
      
      if (insertError) {
        throw new Error('Database insert failed: ' + insertError.message);
      }
      
      if (!party) {
        throw new Error('No data returned from insert');
      }
      
      console.log('Method 3 successful - party created:', party.id);
      return { success: true, party };
      
    } catch (error) {
      console.log('Method 3 error:', error);
    }

    // Method 4: Force re-authentication
    try {
      console.log('Method 4: Force re-authentication');
      const { createClientComponentClient } = await import('@/lib/supabase');
      const supabase = createClientComponentClient();
      
      // Force a token refresh
      const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !newSession) {
        throw new Error('Authentication required. Please sign out and sign in again.');
      }
      
      console.log('Token refreshed, retrying API call');
      const response = await fetch('/api/parties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${newSession.access_token}`,
          'X-Auth-Refresh': 'true',
        },
        body: JSON.stringify(partyData),
        credentials: 'include',
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Method 4 successful');
        return result;
      }
      
      // If we get here, extract error details
      const errorData = await response.json().catch(() => ({ error: 'Unknown API error' }));
      throw new Error('API call failed: ' + (errorData.error || response.statusText));
      
    } catch (error) {
      console.log('Method 4 error:', error);
      throw new Error('All authentication methods failed. Please sign out and sign in again.');
    }
  };

  const isStepValid = () => {
    switch (step) {
      case 1:
        return partyData.childName.trim() !== "" && partyData.childAge > 0 && partyData.childGender !== "" && partyData.partyDate !== undefined;
      case 2:
        return partyData.zipCode && !partyData.zipCodeError && partyData.guestCount && partyData.guestCount > 0; // Require zip code and guest count
      case 3:
        return true; // Summary step - no additional validation needed
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 py-4 sm:py-6 lg:py-8">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex justify-center mb-3 sm:mb-4">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-2 sm:p-3 rounded-full">
              <PartyPopper className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-yellow-600 bg-clip-text text-transparent mb-2 leading-tight">
            Plan your Magical Birthday Party
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 px-2">Plan your child's dream birthday in just 3 simple steps!</p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-6 sm:mb-8 overflow-x-auto">
          <div className="flex items-center space-x-2 sm:space-x-4 px-4">
            {[1, 2, 3].map((stepNumber) => (
              <div key={stepNumber} className="flex items-center flex-shrink-0">
                <div
                  className={cn(
                    "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-colors",
                    step >= stepNumber 
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                      : "bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400"
                  )}
                >
                    {stepNumber}
                  </div>
                {stepNumber < 3 && (
                  <div
                    className={cn(
                      "w-8 sm:w-16 h-0.5 sm:h-1 mx-1 sm:mx-2 transition-colors",
                      step > stepNumber ? "bg-gradient-to-r from-purple-600 to-pink-600" : "bg-gray-200 dark:bg-slate-700"
                    )}
                  />
                  )}
                </div>
              ))}
          </div>
            </div>
            
        {/* Step Content */}
        <Card className="border-0 shadow-xl dark:bg-slate-800/90 dark:backdrop-blur-sm">
          <CardHeader className="text-center px-4 sm:px-6 py-4 sm:py-6">
            <CardTitle className="text-xl sm:text-2xl">
              {step === 1 && "Tell us about your child"}
              {step === 2 && "Optional Theme Selection"}
              {step === 3 && "Party Summary"}
            </CardTitle>
            <CardDescription className="text-sm sm:text-base px-2">
              {step === 1 && "Name, gender, and date of birth"}
              {step === 2 && "Zip code, guests, budget, and optional theme selection"}
              {step === 3 && "Review all your party details before creating your plan"}
            </CardDescription>
            
            {/* Navigation Buttons at Top */}
            <div className="flex justify-between pt-3 sm:pt-4 border-t border-gray-100 dark:border-slate-700 mt-3 sm:mt-4">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={step === 1}
                className="px-4 sm:px-8 text-sm sm:text-base"
              >
                <ArrowLeft className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                Back
              </Button>
              
              {step < 3 ? (
                <Button
                  onClick={handleNext}
                  disabled={!isStepValid() || isNavigating}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 sm:px-8 text-sm sm:text-base relative overflow-hidden"
                >
                  {isNavigating && step === 2 ? (
                    <>
                      <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                      <span className="animate-pulse text-sm sm:text-base">Creating Magic...</span>
                      <Sparkles className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4 animate-pulse" />
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                    </>
                  )}
                </Button>
              ) : (
                // For step 5, show Create My Party Plan button aligned with Back button
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 sm:px-8 text-sm sm:text-base shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                      <span className="animate-pulse text-sm sm:text-base">
                        {submissionStep || 'Creating Party Plan...'}
                      </span>
                      <Sparkles className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4 animate-pulse" />
                    </>
                  ) : (
                    <>
                      <PartyPopper className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Create My Party Plan</span>
                      <span className="sm:hidden">Create Plan</span>
                      <Sparkles className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
            
            {/* Error Message Display */}
            {submitError && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <div className="flex items-center mb-3">
                  <AlertTriangle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
                  <p className="text-sm text-red-700 dark:text-red-300">{submitError}</p>
                </div>
                <div className="flex gap-3">
                      <Button 
                        onClick={() => {
                          setSubmitError(null);
                          setStep(1);
                          // Reset form data
                          setPartyData({
                            childName: "",
                            childAge: 0,
                            childGender: "",
                            childInterests: [],
                            favoriteColors: [],
                            partyDate: undefined,
                            selectedTheme: "",
                        aiRecommendations: [],
                        isLoadingAI: false,
                        classicTheme: "",
                            budget: undefined,
                            currency: "",
                            zipCode: "",
                            country: "",
                            zipCodeError: undefined,
                        guestCount: undefined
                          });
                        }}
                        size="sm"
                        variant="outline"
                        className="text-red-700 border-red-300 hover:bg-red-100"
                      >
                        Start Over
                      </Button>
                      <Button 
                        onClick={() => setSubmitError(null)}
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        Try Again
                      </Button>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
            {/* Step 1: Child Information */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="childName" className="text-sm font-medium dark:text-gray-200">
                    Child's Name
                  </Label>
                  <Input
                    id="childName"
                    placeholder="Enter your child's name"
                    value={partyData.childName}
                    onChange={(e) => setPartyData({ ...partyData, childName: e.target.value })}
                    className="text-lg h-12 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium dark:text-gray-200">
                    Gender
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
                    <Button
                      type="button"
                      variant={partyData.childGender === "boy" ? "default" : "outline"}
                      onClick={() => setPartyData({ ...partyData, childGender: "boy" })}
                      className={cn(
                        "h-12 flex items-center justify-center space-x-2 text-sm relative overflow-hidden group transition-all duration-300 transform hover:scale-105",
                        partyData.childGender === "boy"
                          ? "bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-600 hover:from-blue-600 hover:via-blue-700 hover:to-cyan-700 text-white shadow-lg border-2 border-blue-400"
                          : "hover:bg-gradient-to-br hover:from-blue-50 hover:to-cyan-50 hover:border-blue-300 hover:shadow-md"
                      )}
                    >
                      <div className={cn(
                        "absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transition-transform duration-700",
                        partyData.childGender === "boy" 
                          ? "translate-x-full group-hover:translate-x-[-200%]" 
                          : "translate-x-[-200%]"
                      )} />
                      <User className={cn(
                        "h-5 w-5 transition-transform duration-200",
                        partyData.childGender === "boy" ? "scale-110" : "group-hover:scale-110"
                      )} />
                      <span className="font-medium">Boy</span>
                      {partyData.childGender === "boy" && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant={partyData.childGender === "girl" ? "default" : "outline"}
                      onClick={() => setPartyData({ ...partyData, childGender: "girl" })}
                      className={cn(
                        "h-12 flex items-center justify-center space-x-2 text-sm relative overflow-hidden group transition-all duration-300 transform hover:scale-105",
                        partyData.childGender === "girl"
                          ? "bg-gradient-to-br from-pink-500 via-pink-600 to-rose-600 hover:from-pink-600 hover:via-pink-700 hover:to-rose-700 text-white shadow-lg border-2 border-pink-400"
                          : "hover:bg-gradient-to-br hover:from-pink-50 hover:to-rose-50 hover:border-pink-300 hover:shadow-md"
                      )}
                    >
                      <div className={cn(
                        "absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transition-transform duration-700",
                        partyData.childGender === "girl" 
                          ? "translate-x-full group-hover:translate-x-[-200%]" 
                          : "translate-x-[-200%]"
                      )} />
                      <Users className={cn(
                        "h-5 w-5 transition-transform duration-200",
                        partyData.childGender === "girl" ? "scale-110" : "group-hover:scale-110"
                      )} />
                      <span className="font-medium">Girl</span>
                      {partyData.childGender === "girl" && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium dark:text-gray-200">When is the party?</Label>
                  <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal text-lg py-6",
                          !partyData.partyDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {partyData.partyDate ? format(partyData.partyDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={partyData.partyDate}
                        onSelect={(date) => {
                          setPartyData({ ...partyData, partyDate: date });
                          setIsDatePickerOpen(false);
                        }}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-4">
                  <Label htmlFor="childAge" className="text-sm font-medium dark:text-gray-200">
                    Child's Age: {`${partyData.childAge} year${partyData.childAge > 1 ? 's' : ''} old`}
                  </Label>
                  <div className="px-3">
                    <Slider
                      value={[partyData.childAge]}
                      onValueChange={(value) => setPartyData({ ...partyData, childAge: value[0] })}
                      max={12}
                      min={1}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                      <span>1</span>
                      <span>2</span>
                      <span>3</span>
                      <span>4</span>
                      <span>5</span>
                      <span>6</span>
                      <span>7</span>
                      <span>8</span>
                      <span>9</span>
                      <span>10</span>
                      <span>11</span>
                      <span>12</span>
                    </div>
                  </div>
                  
                  {/* Individual Age Cards */}
                  <div className="mt-6 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
                      {[
                        { age: 1, label: "Little One", emoji: "🍼" },
                        { age: 2, label: "Toddler", emoji: "🧸" },
                        { age: 3, label: "Preschooler", emoji: "🎈" },
                        { age: 4, label: "Big Kid", emoji: "🎒" },
                        { age: 5, label: "Kindergarten", emoji: "🎒" },
                        { age: 6, label: "School Star", emoji: "📚" },
                        { age: 7, label: "Explorer", emoji: "🔍" },
                        { age: 8, label: "Adventurer", emoji: "🚀" },
                        { age: 9, label: "Tween", emoji: "⭐" },
                        { age: 10, label: "Double Digits", emoji: "🎉" },
                        { age: 11, label: "Pre-teen", emoji: "🎯" },
                        { age: 12, label: "Almost Teen", emoji: "🎮" }
                      ].map((ageCard) => {
                        const isActive = partyData.childAge === ageCard.age;

                        return (
                          <div
                            key={ageCard.age}
                            onClick={() => setPartyData({ ...partyData, childAge: ageCard.age })}
                            className={cn(
                              "p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:scale-105 text-center",
                              isActive 
                                ? "border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 shadow-md" 
                                : "border-gray-200 dark:border-slate-600 hover:border-purple-300 hover:bg-purple-25 dark:hover:bg-purple-900/20"
                            )}
                          >
                            <div className="text-2xl mb-1">{ageCard.emoji}</div>
                            <div className={cn(
                              "text-lg font-bold",
                              isActive ? "text-purple-700 dark:text-purple-400" : "text-gray-600 dark:text-gray-300"
                            )}>
                              {ageCard.age}
                            </div>
                            <div className={cn(
                              "text-xs font-medium mt-1",
                              isActive ? "text-purple-600 dark:text-purple-400" : "text-gray-500 dark:text-gray-400"
                            )}>
                              {ageCard.label}
                            </div>
                            {isActive && (
                              <div className="text-xs text-purple-500 mt-1 italic">
                                ✨ Selected
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Current Selection Display */}
                    <div className="mt-4 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center justify-center space-x-2">
                        <span className="text-lg">
                          {partyData.childAge === 1 ? "🍼" :
                           partyData.childAge === 2 ? "🧸" :
                           partyData.childAge === 3 ? "🎈" :
                           partyData.childAge === 4 ? "🎒" :
                           partyData.childAge === 5 ? "🎒" :
                           partyData.childAge === 6 ? "📚" :
                           partyData.childAge === 7 ? "🔍" :
                           partyData.childAge === 8 ? "🚀" :
                           partyData.childAge === 9 ? "⭐" :
                           partyData.childAge === 10 ? "🎉" :
                           partyData.childAge === 11 ? "🎯" :
                           partyData.childAge === 12 ? "🎮" : "🎈"}
                        </span>
                        <span className="text-sm font-medium text-gray-700">
                          Perfect for a{" "}
                          <span className="font-bold text-orange-600">
                            {partyData.childAge === 1 ? "Little One" :
                             partyData.childAge === 2 ? "Toddler" :
                             partyData.childAge === 3 ? "Preschooler" :
                             partyData.childAge === 4 ? "Big Kid" :
                             partyData.childAge === 5 ? "Kindergarten" :
                             partyData.childAge === 6 ? "School Star" :
                             partyData.childAge === 7 ? "Explorer" :
                             partyData.childAge === 8 ? "Adventurer" :
                             partyData.childAge === 9 ? "Tween" :
                             partyData.childAge === 10 ? "Double Digits" :
                             partyData.childAge === 11 ? "Pre-teen" :
                             partyData.childAge === 12 ? "Almost Teen" : "Young Child"}
                          </span>{" "}
                          celebration! 🎉
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Personalized Themes */}
            {step === 2 && (
              <div className="space-y-6">
                {/* Header Section */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 text-center">
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">🎨 Party Details for {partyData.childName || 'your child'}</h3>
                  <p className="text-sm text-gray-600">
                    Tell us your location and guest details. Theme selection will be available in the party planning section.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Zip Code Input with Auto Country Detection */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium flex items-center gap-2 dark:text-gray-200">
                      <MapPin className="h-4 w-4 text-blue-600" />
                      Zip Code
                    </Label>
                    <div className="relative">
                      {/* Country Flag Display (Auto-detected) */}
                      {partyData.country && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-lg">
                          {countryOptions.find(c => c.code === partyData.country)?.flag}
                        </div>
                      )}
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Enter zip code (any country)"
                        value={partyData.zipCode || ''}
                        onChange={(e) => handleZipCodeChange(e.target.value)}
                        className={cn(
                          "pl-10 pr-12 text-lg h-12 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200",
                          partyData.zipCodeError && "border-red-500 focus:border-red-500 focus:ring-red-500",
                          partyData.country && !partyData.zipCodeError && "border-green-500 focus:border-green-500"
                        )}
                        maxLength={15}
                      />
                    </div>
                    {partyData.zipCodeError && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {partyData.zipCodeError}
                      </p>
                    )}
                    {partyData.country && !partyData.zipCodeError && partyData.zipCode && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Valid {countryOptions.find(c => c.code === partyData.country)?.name} zip code detected
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      Country auto-detected from format • Helps us suggest local vendors
                    </p>
                  </div>

                  {/* Guest Count Input */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium flex items-center gap-2 dark:text-gray-200">
                      <Users className="h-4 w-4 text-purple-600" />
                      Number of Guests
                    </Label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="number"
                        placeholder="Expected guests (adults + children)"
                        value={partyData.guestCount || ''}
                        onChange={(e) => setPartyData({ ...partyData, guestCount: e.target.value ? parseInt(e.target.value) : undefined })}
                        className="pl-10 text-lg h-12 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200"
                        min="1"
                        max="200"
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      Include both adults and children in the total count
                    </p>
                  </div>
                </div>

                {/* Budget Input (Optional) */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2 dark:text-gray-200">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    Party Budget (Optional)
                  </Label>
                  <div className="flex gap-2 max-w-md">
                    {/* Currency Selector Button */}
                    <Select value={partyData.currency || 'USD'} onValueChange={handleCurrencyChange}>
                      <SelectTrigger className="w-20 h-12 text-lg font-semibold dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200">
                        <SelectValue>
                          {partyData.currency ? currencyOptions.find(c => c.code === partyData.currency)?.symbol || '$' : '$'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {currencyOptions.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-semibold">{currency.symbol}</span>
                              <span className="text-sm">{currency.code}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {/* Budget Input */}
                    <Input
                      type="number"
                      placeholder="Enter budget amount"
                      value={partyData.budget || ''}
                      onChange={(e) => setPartyData({ ...partyData, budget: e.target.value ? parseFloat(e.target.value) : undefined })}
                      className="flex-1 text-lg h-12 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200"
                      min="0"
                      step="10"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Budget helps us recommend the right options for your party
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Party Summary */}
            {step === 3 && (
              <div className="space-y-6">
                {/* Header Section */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 text-center border-2 border-purple-200 shadow-lg">
                  <div className="text-4xl mb-3">🎉</div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">Party Summary for {partyData.childName}</h3>
                  <p className="text-sm text-gray-600">
                    Review all the details before creating your magical party plan
                  </p>
                </div>

                {/* Summary Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Child Information Card */}
                  <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 shadow-lg hover:shadow-xl transition-shadow">
                    <CardHeader className="pb-3 text-center">
                      <div className="text-3xl mb-2">
                        {partyData.childGender === 'boy' ? '👦' : partyData.childGender === 'girl' ? '👧' : '🧒'}
                      </div>
                      <CardTitle className="text-lg flex items-center justify-center gap-2">
                        <User className="h-5 w-5 text-purple-600" />
                        Child Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg">
                        <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                          <span className="text-lg">👶</span>
                          Name:
                        </span>
                        <span className="text-sm font-semibold text-gray-800">{partyData.childName}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg">
                        <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                          <span className="text-lg">🎂</span>
                          Age:
                        </span>
                        <span className="text-sm font-semibold text-gray-800">{partyData.childAge} years old</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg">
                        <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                          <span className="text-lg">{partyData.childGender === 'boy' ? '♂️' : '♀️'}</span>
                          Gender:
                        </span>
                        <span className="text-sm font-semibold text-gray-800 capitalize">{partyData.childGender}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg">
                        <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                          <span className="text-lg">📅</span>
                          Party Date:
                        </span>
                        <span className="text-sm font-semibold text-gray-800">
                          {partyData.partyDate ? format(partyData.partyDate, "PPP") : "Not selected"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Party Details Card */}
                  <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-lg hover:shadow-xl transition-shadow">
                    <CardHeader className="pb-3 text-center">
                      <div className="text-3xl mb-2">🏠</div>
                      <CardTitle className="text-lg flex items-center justify-center gap-2">
                        <MapPin className="h-5 w-5 text-blue-600" />
                        Party Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg">
                        <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                          <span className="text-lg">📍</span>
                          Location:
                        </span>
                        <span className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                          {partyData.zipCode}
                          {partyData.country && (
                            <span className="text-lg">
                              {countryOptions.find(c => c.code === partyData.country)?.flag}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg">
                        <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                          <span className="text-lg">👥</span>
                          Guests:
                        </span>
                        <span className="text-sm font-semibold text-gray-800">{partyData.guestCount || 0} expected</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg">
                        <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                          <span className="text-lg">💰</span>
                          Budget:
                        </span>
                        <span className="text-sm font-semibold text-gray-800">
                          {partyData.budget ? (
                            <>
                              {currencyOptions.find(c => c.code === partyData.currency)?.symbol || '$'}
                              {partyData.budget}
                            </>
                          ) : (
                            "Not specified"
                          )}
                        </span>
                      </div>
                      {partyData.country && (
                        <div className="flex justify-between items-center p-3 bg-white/60 rounded-lg">
                          <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                            <span className="text-lg">🌍</span>
                            Country:
                          </span>
                          <span className="text-sm font-semibold text-gray-800">
                            {countryOptions.find(c => c.code === partyData.country)?.name}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Enhanced Summary Overview Card */}
                <div className="bg-gradient-to-r from-yellow-50 via-orange-50 to-red-50 rounded-xl p-6 border-2 border-orange-200 shadow-lg">
                  <div className="text-center">
                    <div className="text-4xl mb-3">🎨</div>
                    <h4 className="text-lg font-semibold text-orange-800 mb-2">Ready to Create Your Party Plan!</h4>
                    <p className="text-sm text-orange-700 mb-4">
                      All theme creation and AI recommendations will happen in the party management section. 
                      Click "Create My Party Plan" to continue and start customizing your magical celebration!
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                      <div className="flex items-center justify-center gap-2 p-3 bg-white/60 rounded-lg">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-xs font-medium text-green-700">✨ Child details saved</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 p-3 bg-white/60 rounded-lg">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-xs font-medium text-green-700">📍 Party location set</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 p-3 bg-white/60 rounded-lg">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-xs font-medium text-green-700">👥 Guest count confirmed</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </div>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Save Your Party Plan"
        description="Sign in to save your party plan, access AI-powered recommendations, and keep your celebrations safe and organized."
      />
    </div>
  );
}