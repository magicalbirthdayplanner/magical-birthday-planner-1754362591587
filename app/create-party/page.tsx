"use client";

import { useState, useEffect } from "react";
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
import { CalendarIcon, ArrowRight, ArrowLeft, PartyPopper, X, Sparkles, Loader2, Heart, User, UserCheck, Users, Baby } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import Fireworks from "react-canvas-confetti/dist/presets/fireworks";

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

const classicThemes = [
  { id: "dinosaur", name: "Dinosaur", emoji: "🦕", color: "bg-gradient-to-r from-green-500 to-emerald-600" },
  { id: "space", name: "Space", emoji: "🚀", color: "bg-gradient-to-r from-purple-600 to-indigo-800" },
  { id: "safari", name: "Safari", emoji: "🦁", color: "bg-gradient-to-r from-yellow-500 to-orange-600" },
  { id: "ocean", name: "Ocean", emoji: "🐠", color: "bg-gradient-to-r from-blue-500 to-cyan-600" },
  { id: "princess", name: "Princess", emoji: "👸", color: "bg-gradient-to-r from-pink-400 to-purple-600" },
  { id: "superhero", name: "Superhero", emoji: "🦸‍♂️", color: "bg-gradient-to-r from-red-500 to-blue-600" },
  { id: "pirate", name: "Pirate", emoji: "🏴‍☠️", color: "bg-gradient-to-r from-amber-600 to-red-600" },
  { id: "unicorn", name: "Unicorn", emoji: "🦄", color: "bg-gradient-to-r from-pink-500 to-violet-600" }
];

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
  const [step, setStep] = useState(1);
  const [partyData, setPartyData] = useState<PartyData>({
    childName: "",
    childAge: 1,
    childGender: "",
    childInterests: [],
    favoriteColors: [],
    partyDate: undefined,
    selectedTheme: "",
    aiRecommendations: [],
    isLoadingAI: false,
    classicTheme: ""
  });
  const [isNavigating, setIsNavigating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [customThemeMode, setCustomThemeMode] = useState(false);
  const [showClassicThemes, setShowClassicThemes] = useState(false);
  const [showCustomOptions, setShowCustomOptions] = useState(false);

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


  const handleNext = async () => {
    if (step === 2) {
      // Check if we have child details (tell us more field) 
      const hasChildDetails = partyData.childDetails && partyData.childDetails.trim() !== "";
      
      // Generate AI recommendations for both custom and classic themes when possible
      // For custom themes: require interests
      // For classic themes: generate AI if child details provided, otherwise proceed without AI
      if ((partyData.childAge && partyData.childInterests.length > 0) || 
          (partyData.classicTheme && hasChildDetails)) {
        // Start navigation loading animation
        setIsNavigating(true);
        
        // Add a small delay to show the loading animation
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Generate AI recommendations when moving from step 2 to step 3
        setPartyData(prev => ({ ...prev, isLoadingAI: true }));
        setIsNavigating(false);
        setStep(3);
        
        try {
          // For classic themes, include the selected theme name in the request
          const selectedClassicTheme = partyData.classicTheme ? 
            classicThemes.find(t => t.id === partyData.classicTheme)?.name : undefined;
          
          const recommendations = await getAIRecommendations(
            partyData.childName,
            partyData.childAge,
            partyData.childInterests,
            partyData.favoriteColors,
            partyData.childGender,
            partyData.childDetails,
            selectedClassicTheme
          );
          setPartyData(prev => ({ 
            ...prev, 
            aiRecommendations: recommendations,
            isLoadingAI: false 
          }));
        } catch (error) {
          console.error('Error getting AI recommendations:', error);
          setPartyData(prev => ({ ...prev, isLoadingAI: false }));
        }
      } else {
        // For classic themes without child details, proceed directly to step 3 
        if (step < 4) setStep(step + 1);
      }
    } else {
      if (step < 4) setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = () => {
    // Save to localStorage for now
    localStorage.setItem('partyData', JSON.stringify(partyData));
    // Navigate to party plan page
    window.location.href = '/party-plan';
  };

  const isStepValid = () => {
    switch (step) {
      case 1:
        return partyData.childName.trim() !== "" && partyData.childAge >= 1 && partyData.childGender !== "" && partyData.partyDate !== undefined;
      case 2:
        // For classic themes, just require theme selection
        // For custom themes, require interests
        if (partyData.classicTheme !== "") {
          return true; // Classic theme selected is sufficient
        }
        if (customThemeMode) {
          return partyData.childInterests.length > 0; // Custom theme requires interests
        }
        return true; // Default state is valid
      case 3:
        return partyData.selectedTheme !== "";
      case 4:
        return true; // Step 4 is always valid since it's just the summary/creation step
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 rounded-full">
              <PartyPopper className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-yellow-600 bg-clip-text text-transparent mb-2">
            Plan your Magical Birthday Party
          </h1>
          <p className="text-gray-600">Plan your child's dream birthday in just 4 simple steps!</p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            {[1, 2, 3, 4].map((stepNumber) => (
              <div key={stepNumber} className="flex items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                    step >= stepNumber
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  )}
                >
                  {stepNumber}
                </div>
                {stepNumber < 4 && (
                  <div
                    className={cn(
                      "w-16 h-1 mx-2 transition-colors",
                      step > stepNumber ? "bg-gradient-to-r from-purple-600 to-pink-600" : "bg-gray-200"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {step === 1 && "Tell us about your child"}
              {step === 2 && "What does your child love?"}
              {step === 3 && "Choose a theme"}
              {step === 4 && "Create your party plan"}
            </CardTitle>
            <CardDescription>
              {step === 1 && "Basic information about your child and when the party will be"}
              {step === 2 && "Help us personalize themes based on your child's interests and favorite colors"}
              {step === 3 && "Select a theme that your child will absolutely love"}
              {step === 4 && "Ready to create your magical party plan?"}
            </CardDescription>
            
            {/* Navigation Buttons at Top */}
            <div className="flex justify-between pt-4 border-t border-gray-100 mt-4">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={step === 1}
                className="px-8"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              
              {step < 4 ? (
                <Button
                  onClick={handleNext}
                  disabled={!isStepValid() || isNavigating}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 relative overflow-hidden"
                >
                  {isNavigating && step === 2 ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span className="animate-pulse">Creating Magic...</span>
                      <Sparkles className="ml-2 h-4 w-4 animate-pulse" />
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              ) : (
                // For step 4, show Create My Party Plan button aligned with Back button
                <Button
                  onClick={handleSubmit}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  <PartyPopper className="mr-2 h-4 w-4" />
                  Create My Party Plan
                  <Sparkles className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Child Information */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="childName" className="text-sm font-medium">
                    Child's Name
                  </Label>
                  <Input
                    id="childName"
                    placeholder="Enter your child's name"
                    value={partyData.childName}
                    onChange={(e) => setPartyData({ ...partyData, childName: e.target.value })}
                    className="text-lg h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Gender
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
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
                  <Label className="text-sm font-medium">When is the party?</Label>
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
                  <Label htmlFor="childAge" className="text-sm font-medium">
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
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
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
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 gap-2">
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
                                ? "border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 shadow-md" 
                                : "border-gray-200 hover:border-purple-300 hover:bg-purple-25"
                            )}
                          >
                            <div className="text-2xl mb-1">{ageCard.emoji}</div>
                            <div className={cn(
                              "text-lg font-bold",
                              isActive ? "text-purple-700" : "text-gray-600"
                            )}>
                              {ageCard.age}
                            </div>
                            <div className={cn(
                              "text-xs font-medium mt-1",
                              isActive ? "text-purple-600" : "text-gray-500"
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

            {/* Step 2: Theme Selection Options */}
            {step === 2 && (
              <div className="space-y-6">
                {/* Theme Selection Header */}
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    Choose Your Theme Style
                  </h3>
                  <p className="text-gray-600">
                    Select Classic Themes for quick setup or Custom Themes for personalized recommendations
                  </p>
                </div>

                {/* Main Theme Selection Boxes - Show when no specific option is selected */}
                {!showClassicThemes && !showCustomOptions && (
                  <div className="grid md:grid-cols-2 gap-6 mb-8">
                    {/* Classic Themes Card */}
                    <div 
                      className="relative group h-80 w-full [perspective:1000px] cursor-pointer"
                      onClick={() => {
                        setShowClassicThemes(true);
                        setShowCustomOptions(false);
                        setCustomThemeMode(false);
                        setPartyData({ 
                          ...partyData, 
                          childInterests: [],
                          favoriteColors: [],
                          selectedTheme: "",
                          classicTheme: ""
                        });
                      }}
                    >
                      <div className="relative h-full w-full transition-transform duration-700 [transform-style:preserve-3d] group-hover:[transform:rotateY(10deg)]">
                        <div className="absolute inset-0 h-full w-full rounded-xl [backface-visibility:hidden] bg-gradient-to-br from-purple-600 to-pink-600 p-8 text-white shadow-2xl">
                          <div className="flex h-full flex-col justify-center text-center space-y-4">
                            <div className="text-6xl animate-bounce">🎭</div>
                            <h4 className="text-2xl font-bold">Classic Themes</h4>
                            <p className="text-purple-100">
                              Choose from our popular pre-designed themes. Perfect for quick party planning!
                            </p>
                            <div className="pt-4">
                              <div className="inline-block bg-white/20 backdrop-blur-sm rounded-lg px-6 py-3 text-white font-semibold hover:bg-white/30 transition-all">
                                Select Classic Themes →
                              </div>
                            </div>
                          </div>
                          <div className="absolute top-4 right-4 text-white/60">
                            <Sparkles className="h-6 w-6" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Custom Themes Card */}
                    <div 
                      className="relative group h-80 w-full [perspective:1000px] cursor-pointer"
                      onClick={() => {
                        setShowCustomOptions(true);
                        setShowClassicThemes(false);
                        setCustomThemeMode(true);
                        setPartyData({ 
                          ...partyData, 
                          classicTheme: "",
                          selectedTheme: ""
                        });
                      }}
                    >
                      <div className="relative h-full w-full transition-transform duration-700 [transform-style:preserve-3d] group-hover:[transform:rotateY(-10deg)]">
                        <div className="absolute inset-0 h-full w-full rounded-xl [backface-visibility:hidden] bg-gradient-to-br from-green-600 to-blue-600 p-8 text-white shadow-2xl">
                          <div className="flex h-full flex-col justify-center text-center space-y-4">
                            <div className="text-6xl animate-pulse">🎨</div>
                            <h4 className="text-2xl font-bold">Custom Themes</h4>
                            <p className="text-green-100">
                              Tell us about your child's interests and get AI-powered personalized recommendations!
                            </p>
                            <div className="pt-4">
                              <div className="inline-block bg-white/20 backdrop-blur-sm rounded-lg px-6 py-3 text-white font-semibold hover:bg-white/30 transition-all">
                                Select Custom Themes →
                              </div>
                            </div>
                          </div>
                          <div className="absolute top-4 right-4 text-white/60">
                            <Heart className="h-6 w-6" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Classic Themes Section - Show when classic theme card is flipped */}
                {showClassicThemes && (
                  <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                    {/* Back to selection button */}
                    <div className="flex items-center justify-between mb-6">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowClassicThemes(false);
                          setShowCustomOptions(false);
                          setCustomThemeMode(false);
                          setPartyData({ 
                            ...partyData, 
                            classicTheme: "",
                            selectedTheme: "",
                            childInterests: [],
                            favoriteColors: []
                          });
                        }}
                        className="flex items-center space-x-2 hover:bg-purple-50"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to Theme Selection</span>
                      </Button>
                      <div className="text-sm text-gray-500">Step 2 of 4</div>
                    </div>

                    <div className="text-center mb-8">
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                        🎭 Classic Themes
                      </h3>
                      <p className="text-gray-600">
                        Choose from our popular pre-designed themes and make them uniquely yours
                      </p>
                    </div>
                    
                    {/* Theme Cards with uniform styling */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                      {classicThemes.map((theme) => (
                        <div
                          key={theme.id}
                          onClick={() => {
                            setPartyData({ 
                              ...partyData, 
                              classicTheme: theme.id,
                              selectedTheme: theme.id
                            });
                          }}
                          className={cn(
                            "relative group p-6 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl",
                            partyData.classicTheme === theme.id
                              ? "border-purple-500 ring-2 ring-purple-200 shadow-lg bg-purple-50"
                              : "border-gray-200 hover:border-purple-300 hover:shadow-md bg-white"
                          )}
                        >
                          <div className={cn(
                            "absolute inset-0 rounded-xl opacity-10 transition-opacity group-hover:opacity-20",
                            theme.color.replace('bg-gradient-to-r', 'bg-gradient-to-br')
                          )}></div>
                          <div className="relative text-center space-y-3">
                            <div className="text-4xl group-hover:scale-110 transition-transform duration-200">{theme.emoji}</div>
                            <div className="text-sm font-semibold text-gray-800">
                              {theme.name}
                            </div>
                            {partyData.classicTheme === theme.id && (
                              <div className="inline-flex items-center space-x-1 text-xs text-purple-600 font-medium bg-purple-100 rounded-full px-2 py-1">
                                <Sparkles className="h-3 w-3" />
                                <span>Selected</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Tell us more section for classic themes */}
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 space-y-4">
                      <div className="text-center">
                        <h4 className="text-lg font-semibold text-gray-800 mb-2">Make It Extra Special! ✨</h4>
                        <p className="text-sm text-gray-600">
                          Tell us more about your child to get personalized theme variations
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                          What are your child's current favorites, movies, shows, or hobbies? (Optional)
                        </Label>
                        <Textarea
                          placeholder={currentPlaceholder}
                          value={partyData.childDetails || ''}
                          onChange={(e) => setPartyData({ ...partyData, childDetails: e.target.value })}
                          className="min-h-[100px] text-sm resize-none bg-white/80 backdrop-blur-sm border-purple-200 focus:border-purple-400"
                        />
                        <p className="text-xs text-gray-500">
                          This helps us create magical theme variations just for {partyData.childName || 'your child'}!
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Custom Theme Selection - Show when custom theme card is flipped */}
                {showCustomOptions && (
                  <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                    {/* Back to selection button */}
                    <div className="flex items-center justify-between mb-6">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowCustomOptions(false);
                          setShowClassicThemes(false);
                          setCustomThemeMode(false);
                          setPartyData({ 
                            ...partyData, 
                            selectedTheme: "",
                            childInterests: [],
                            favoriteColors: []
                          });
                        }}
                        className="flex items-center space-x-2 hover:bg-green-50"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to Theme Selection</span>
                      </Button>
                      <div className="text-sm text-gray-500">Step 2 of 4</div>
                    </div>

                    <div className="text-center mb-8">
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-2">
                        🎨 Custom Themes
                      </h3>
                      <p className="text-gray-600">
                        Tell us about your child's interests and we'll create personalized theme recommendations!
                      </p>
                    </div>

                    {/* Interests Selection - Card Style */}
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 space-y-4">
                      <div className="text-center">
                        <h4 className="text-lg font-semibold text-gray-800 mb-2">What Does Your Child Love? 💫</h4>
                        <p className="text-sm text-gray-600">
                          Select at least one interest to get started
                        </p>
                      </div>
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-3 justify-center">
                          {interestOptions.map((interest) => (
                            <div
                              key={interest}
                              onClick={() => {
                                const newInterests = partyData.childInterests.includes(interest)
                                  ? partyData.childInterests.filter(i => i !== interest)
                                  : [...partyData.childInterests, interest];
                                setPartyData({ ...partyData, childInterests: newInterests });
                              }}
                              className={cn(
                                "relative group px-4 py-3 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-md text-sm font-medium",
                                partyData.childInterests.includes(interest)
                                  ? "border-green-500 bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-lg ring-2 ring-green-200"
                                  : "border-gray-200 bg-white hover:border-green-300 hover:bg-green-50 text-gray-700"
                              )}
                            >
                              <span>{interest}</span>
                              {partyData.childInterests.includes(interest) && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                              )}
                            </div>
                          ))}
                        </div>
                        {partyData.childInterests.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-4 justify-center">
                            <span className="text-sm text-gray-600 font-medium">Selected:</span>
                            {partyData.childInterests.map((interest) => (
                              <div
                                key={interest}
                                className="inline-flex items-center space-x-1 bg-green-100 text-green-800 rounded-full px-3 py-1 text-xs font-medium"
                              >
                                <span>{interest}</span>
                                <X
                                  className="h-3 w-3 cursor-pointer hover:text-green-600"
                                  onClick={() => {
                                    const newInterests = partyData.childInterests.filter(i => i !== interest);
                                    setPartyData({ ...partyData, childInterests: newInterests });
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Favorite Colors - Card Style */}
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 space-y-4">
                      <div className="text-center">
                        <h4 className="text-lg font-semibold text-gray-800 mb-2">Favorite Colors 🌈</h4>
                        <p className="text-sm text-gray-600">
                          Optional - helps personalize your themes
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3 justify-center">
                        {colorOptions.map((color) => (
                          <div
                            key={color.value}
                            className={cn(
                              "relative group flex items-center space-x-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:scale-105 bg-white",
                              partyData.favoriteColors.includes(color.value)
                                ? "border-purple-500 ring-2 ring-purple-200 shadow-lg"
                                : "border-gray-200 hover:border-purple-300 hover:shadow-md"
                            )}
                            onClick={() => {
                              const newColors = partyData.favoriteColors.includes(color.value)
                                ? partyData.favoriteColors.filter(c => c !== color.value)
                                : [...partyData.favoriteColors, color.value];
                              setPartyData({ ...partyData, favoriteColors: newColors });
                            }}
                          >
                            <div
                              className="w-6 h-6 rounded-full border-2 border-gray-300 group-hover:scale-110 transition-transform"
                              style={{
                                background: color.value === 'rainbow' 
                                  ? 'linear-gradient(90deg, #FF6B6B, #4ECDC4, #45B7D1, #96CEB4, #FFEAA7, #DDA0DD)'
                                  : color.color
                              }}
                            />
                            <span className="text-sm font-medium text-gray-700">{color.name}</span>
                            {partyData.favoriteColors.includes(color.value) && (
                              <Heart className="h-4 w-4 text-red-600 fill-current animate-pulse" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tell us more section */}
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 space-y-4">
                      <div className="text-center">
                        <h4 className="text-lg font-semibold text-gray-800 mb-2">Tell Us More! ✨</h4>
                        <p className="text-sm text-gray-600">
                          Share more details to get even more personalized recommendations
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                          What are your child's current favorites, movies, shows, or hobbies? (Optional)
                        </Label>
                        <Textarea
                          placeholder={currentPlaceholder}
                          value={partyData.childDetails || ''}
                          onChange={(e) => setPartyData({ ...partyData, childDetails: e.target.value })}
                          className="min-h-[100px] text-sm resize-none bg-white/80 backdrop-blur-sm border-purple-200 focus:border-purple-400"
                        />
                        <p className="text-xs text-gray-500">
                          This helps us create magical theme variations just for {partyData.childName || 'your child'}!
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Theme Selection */}
            {step === 3 && (
              <div className="space-y-6">

                {/* Loading State for Custom Themes */}
                {!partyData.classicTheme && partyData.isLoadingAI && (
                  <div className="flex flex-col items-center justify-center py-12 relative">
                    <div className="animate-bounce mb-4">
                      <PartyPopper className="h-12 w-12 text-purple-600" />
                    </div>
                    <Loader2 className="h-8 w-8 animate-spin text-purple-600 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      🎉 Creating Personalized Themes for {partyData.childName}... 🎉
                    </h3>
                    <p className="text-sm text-gray-500 text-center max-w-md">
                      Our AI is analyzing {partyData.childName}'s interests and creating magical theme suggestions just for them!
                    </p>
                    <div className="mt-4 flex items-center space-x-2">
                      <Sparkles className="h-4 w-4 text-yellow-500 animate-pulse" />
                      <span className="text-xs text-purple-600 font-medium animate-pulse">Magic in progress...</span>
                      <Sparkles className="h-4 w-4 text-yellow-500 animate-pulse" />
                    </div>
                  </div>
                )}

                {/* Loading State for Classic Theme Personalization */}
                {partyData.classicTheme && partyData.isLoadingAI && (
                  <div className="flex flex-col items-center justify-center py-12 relative">
                    <div className="animate-bounce mb-4">
                      <div className="text-4xl">
                        {classicThemes.find(t => t.id === partyData.classicTheme)?.emoji || "🎊"}
                      </div>
                    </div>
                    <Loader2 className="h-8 w-8 animate-spin text-purple-600 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      ✨ Creating Magical {classicThemes.find(t => t.id === partyData.classicTheme)?.name} Variations for {partyData.childName}... ✨
                    </h3>
                    <p className="text-sm text-gray-500 text-center max-w-md">
                      Our AI is analyzing {partyData.childName}'s interests and creating magical theme suggestions just for them!
                    </p>
                    <div className="mt-4 flex items-center space-x-2">
                      <Sparkles className="h-4 w-4 text-yellow-500 animate-pulse" />
                      <span className="text-xs text-purple-600 font-medium animate-pulse">Personalizing your {classicThemes.find(t => t.id === partyData.classicTheme)?.name.toLowerCase()} theme...</span>
                      <Sparkles className="h-4 w-4 text-yellow-500 animate-pulse" />
                    </div>
                  </div>
                )}

                {/* AI Recommendations Section for Classic Themes */}
                {partyData.classicTheme && !partyData.isLoadingAI && partyData.aiRecommendations && partyData.aiRecommendations.length > 0 && (
                  <div className="space-y-4 relative">
                    {/* Confetti Effect */}
                    {showConfetti && (
                      <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                        zIndex: 50
                      }}>
                        <Fireworks autorun={{ speed: 1, duration: 4000 }} />
                      </div>
                    )}
                    
                    <div className="flex items-center justify-center space-x-2 mb-4">
                      <Sparkles className="h-6 w-6 text-purple-600" />
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                        Perfect Themes for {partyData.childName}
                      </h3>
                      <Sparkles className="h-6 w-6 text-purple-600" />
                    </div>
                    
                    <p className="text-center text-gray-600 mb-6">
                      🎯 Our AI created these magical {classicThemes.find(t => t.id === partyData.classicTheme)?.name.toLowerCase()} variations perfectly tailored to {partyData.childName}'s interests!
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {partyData.aiRecommendations.map((recommendation, index) => (
                        <Card
                          key={recommendation.id}
                          className={cn(
                            "cursor-pointer transition-all duration-300 border-2 hover:shadow-xl relative overflow-hidden",
                            partyData.selectedTheme === recommendation.id
                              ? "border-purple-500 bg-purple-50 ring-2 ring-purple-200 shadow-lg"
                              : "border-gray-200 hover:border-purple-300 hover:bg-gray-50"
                          )}
                          onClick={() => setPartyData({ ...partyData, selectedTheme: recommendation.id })}
                        >
                          {/* AI Badge */}
                          <div className="absolute top-3 right-3 z-10">
                            <Badge className="bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs font-semibold animate-pulse">
                              🎯 AI Recommended
                            </Badge>
                          </div>
                          
                          <CardContent className="p-6">
                            <div className="text-center mb-4">
                              <div className="text-4xl mb-2">{recommendation.emoji}</div>
                              <h4 className="text-lg font-bold text-gray-800 mb-2">
                                {recommendation.name}
                              </h4>
                              <p className="text-sm text-gray-600 leading-relaxed">
                                {recommendation.description}
                              </p>
                            </div>
                            
                            {/* Match Score */}
                            <div className="flex items-center justify-center mb-4">
                              <div className="bg-gradient-to-r from-green-100 to-emerald-100 rounded-full px-3 py-1 border border-green-200">
                                <span className="text-xs font-semibold text-green-700">
                                  {recommendation.matchScore}% Perfect Match! 🎯
                                </span>
                              </div>
                            </div>
                            
                            {/* Why Recommended */}
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 mb-4 border border-blue-100">
                              <h5 className="text-xs font-semibold text-blue-800 mb-1">
                                Why perfect for {partyData.childName}:
                              </h5>
                              <p className="text-xs text-blue-700 leading-relaxed">
                                {recommendation.whyRecommended}
                              </p>
                            </div>
                            
                            {/* Quick Preview */}
                            <div className="space-y-2">
                              <div className="text-xs text-gray-600">
                                <strong>Activities:</strong> {recommendation.activities.slice(0, 2).join(", ")}
                              </div>
                              <div className="text-xs text-gray-600">
                                <strong>Decorations:</strong> {recommendation.decorations.slice(0, 2).join(", ")}
                              </div>
                            </div>
                            
                            {/* Selection Indicator */}
                            {partyData.selectedTheme === recommendation.id && (
                              <div className="mt-4 text-center">
                                <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                                  ✓ Selected
                                </Badge>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                  </div>
                )}

                {/* AI Recommendations Section for Custom Themes */}
                {!partyData.classicTheme && !partyData.isLoadingAI && partyData.aiRecommendations && partyData.aiRecommendations.length > 0 && (
                  <div className="space-y-4 relative">
                    {/* Confetti Effect */}
                    {showConfetti && (
                      <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                        zIndex: 50
                      }}>
                        <Fireworks autorun={{ speed: 3, duration: 4000 }} />
                      </div>
                    )}
                    <div className="flex items-center justify-center space-x-2 mb-4">
                      <Sparkles className="h-5 w-5 text-purple-600" />
                      <h3 className="text-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                        Personalized Themes for {partyData.childName}
                      </h3>
                      <Sparkles className="h-5 w-5 text-purple-600" />
                    </div>
                    <p className="text-center text-sm text-gray-600 mb-4">
                      Based on {partyData.childName}'s age ({`${partyData.childAge} year${partyData.childAge > 1 ? 's' : ''} old`}), interests: {partyData.childInterests.join(", ")}
                      {partyData.favoriteColors.length > 0 && `, and favorite colors: ${partyData.favoriteColors.join(", ")}`}
                    </p>
                    <div className="grid grid-cols-1 gap-6">
                      {partyData.aiRecommendations.map((theme, index) => (
                        <Card
                          key={theme.id}
                          className={cn(
                            "cursor-pointer transition-all duration-200 hover:scale-102 relative",
                            partyData.selectedTheme === theme.id
                              ? "ring-2 ring-purple-500 shadow-lg bg-purple-50"
                              : "hover:shadow-lg border-2 border-purple-200"
                          )}
                          onClick={() => setPartyData({ ...partyData, selectedTheme: theme.id })}
                        >
                          <div className="absolute top-3 right-3 z-10 flex space-x-2">
                            <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              AI Recommended
                            </Badge>
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              {theme.matchScore}% Match
                            </Badge>
                          </div>
                          <CardContent className="p-6">
                            <div className="flex items-start space-x-4">
                              <div className="text-4xl">{theme.emoji}</div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <h3 className="font-bold text-xl text-gray-800">{theme.name}</h3>
                                  {partyData.selectedTheme === theme.id && (
                                    <Badge className="bg-purple-100 text-purple-700">Selected</Badge>
                                  )}
                                </div>
                                <p className="text-gray-600 mb-3">{theme.description}</p>
                                
                                {/* Why Recommended */}
                                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
                                  <p className="text-sm text-yellow-800">
                                    <strong>Why we picked this:</strong> {theme.whyRecommended}
                                  </p>
                                </div>

                                {/* Color Palette */}
                                <div className="mb-4">
                                  <h4 className="font-semibold text-sm text-gray-700 mb-2">Color Palette:</h4>
                                  <div className="flex space-x-2">
                                    {theme.colorPalette.map((color, colorIndex) => (
                                      <div
                                        key={colorIndex}
                                        className="w-6 h-6 rounded-full border border-gray-300"
                                        style={{ backgroundColor: color }}
                                        title={color}
                                      />
                                    ))}
                                  </div>
                                </div>

                                {/* Details Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                  <div>
                                    <h4 className="font-semibold text-gray-700 mb-1">Decorations:</h4>
                                    <ul className="text-gray-600 space-y-1">
                                      {theme.decorations.slice(0, 3).map((decoration, i) => (
                                        <li key={i}>• {decoration}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-gray-700 mb-1">Activities:</h4>
                                    <ul className="text-gray-600 space-y-1">
                                      {theme.activities.slice(0, 3).map((activity, i) => (
                                        <li key={i}>• {activity}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-gray-700 mb-1">Printables:</h4>
                                    <ul className="text-gray-600 space-y-1">
                                      {theme.printableIdeas.slice(0, 2).map((printable, i) => (
                                        <li key={i}>• {printable}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Classic Theme Display - Without AI Recommendations */}
                {partyData.classicTheme && !partyData.isLoadingAI && (!partyData.aiRecommendations || partyData.aiRecommendations.length === 0) && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center space-x-2 mb-6">
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                        Your {classicThemes.find(t => t.id === partyData.classicTheme)?.name} Theme
                      </h3>
                    </div>
                    
                    <p className="text-center text-gray-600 mb-6">
                      Perfect choice! Your {classicThemes.find(t => t.id === partyData.classicTheme)?.name.toLowerCase()} theme is ready to go.
                    </p>
                    
                    <div className="flex justify-center">
                      <Card
                        className={cn(
                          "cursor-pointer transition-all duration-200 hover:scale-105 max-w-md w-full",
                          partyData.selectedTheme === partyData.classicTheme
                            ? "ring-2 ring-purple-500 shadow-lg bg-purple-50"
                            : "hover:shadow-lg border-2 border-purple-200"
                        )}
                        onClick={() => setPartyData({ ...partyData, selectedTheme: partyData.classicTheme || "" })}
                      >
                        <CardContent className="p-0">
                          <div className={`${classicThemes.find(t => t.id === partyData.classicTheme)?.color} h-24 rounded-t-lg flex items-center justify-center text-4xl`}>
                            {classicThemes.find(t => t.id === partyData.classicTheme)?.emoji}
                          </div>
                          <div className="p-6">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="font-bold text-xl">{classicThemes.find(t => t.id === partyData.classicTheme)?.name}</h3>
                              {partyData.selectedTheme === partyData.classicTheme && (
                                <Badge className="bg-purple-100 text-purple-700">Selected</Badge>
                              )}
                            </div>
                            <p className="text-gray-600 mb-4">
                              {themes.find(t => t.id === partyData.classicTheme)?.description}
                            </p>
                            <div className="text-sm text-gray-600 space-y-2">
                              <div><strong>Popular Decorations:</strong> {themes.find(t => t.id === partyData.classicTheme)?.preview.decorations.slice(0, 2).join(", ")}</div>
                              <div><strong>Fun Activities:</strong> {themes.find(t => t.id === partyData.classicTheme)?.preview.activities.slice(0, 2).join(", ")}</div>
                              <div><strong>Themed Food:</strong> {themes.find(t => t.id === partyData.classicTheme)?.preview.food.slice(0, 2).join(", ")}</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Traditional Themes Section */}
                {!partyData.classicTheme && !partyData.isLoadingAI && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center space-x-2 mb-4">
                      <h3 className="text-lg font-semibold text-gray-700">
                        Or Choose from Classic Themes
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {themes.map((theme) => (
                        <Card
                          key={theme.id}
                          className={cn(
                            "cursor-pointer transition-all duration-200 hover:scale-105",
                            partyData.selectedTheme === theme.id
                              ? "ring-2 ring-purple-500 shadow-lg"
                              : "hover:shadow-lg"
                          )}
                          onClick={() => setPartyData({ ...partyData, selectedTheme: theme.id })}
                        >
                          <CardContent className="p-0">
                            <div className={`${theme.color} h-20 rounded-t-lg flex items-center justify-center text-3xl`}>
                              {theme.emoji}
                            </div>
                            <div className="p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold text-lg">{theme.name}</h3>
                                {partyData.selectedTheme === theme.id && (
                                  <Badge className="bg-purple-100 text-purple-700">Selected</Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-3">{theme.description}</p>
                              <div className="text-xs text-gray-500 space-y-1">
                                <div><strong>Decorations:</strong> {theme.preview.decorations.slice(0, 2).join(", ")}</div>
                                <div><strong>Activities:</strong> {theme.preview.activities.slice(0, 2).join(", ")}</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Create Party Plan */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <div className="flex justify-center mb-6">
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 rounded-full animate-pulse">
                      <PartyPopper className="h-12 w-12 text-white" />
                    </div>
                  </div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-yellow-600 bg-clip-text text-transparent mb-8">
                    Ready to Create Your Magical Party Plan? ✨
                  </h2>
                  
                  {/* Visual Party Summary Cards - All in Single Line */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 max-w-7xl mx-auto">
                    {/* Card 1: Child Info */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/30 p-6 rounded-xl border border-blue-200 dark:border-blue-700 shadow-lg transform hover:scale-105 transition-all duration-300">
                      <div className="text-5xl mb-4">
                        {partyData.childGender === 'boy' ? '👦' : partyData.childGender === 'girl' ? '👧' : '🎂'}
                      </div>
                      <h3 className="font-bold text-blue-800 dark:text-blue-200 mb-2 text-lg">Birthday Star</h3>
                      <div className="text-blue-700 dark:text-blue-300 font-semibold text-xl">{partyData.childName}</div>
                      <div className="text-blue-600 dark:text-blue-400 text-sm mt-2 flex items-center justify-center gap-2">
                        <span className="bg-blue-200 dark:bg-blue-800 px-2 py-1 rounded-full">{partyData.childAge} years old</span>
                      </div>
                    </div>

                    {/* Card 2: Party Date */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/30 p-6 rounded-xl border border-green-200 dark:border-green-700 shadow-lg transform hover:scale-105 transition-all duration-300">
                      <div className="text-5xl mb-4">📅</div>
                      <h3 className="font-bold text-green-800 dark:text-green-200 mb-2 text-lg">Party Date</h3>
                      <div className="text-green-700 dark:text-green-300 font-semibold text-lg">
                        {partyData.partyDate ? format(partyData.partyDate, "MMM d, yyyy") : "Not selected"}
                      </div>
                      <div className="text-green-600 dark:text-green-400 text-sm mt-2">
                        {partyData.partyDate ? (
                          <span className="bg-green-200 dark:bg-green-800 px-2 py-1 rounded-full">
                            {format(partyData.partyDate, "EEEE")}
                          </span>
                        ) : (
                          "Choose your date"
                        )}
                      </div>
                    </div>

                    {/* Card 3: Theme Selection Type */}
                    <div className="bg-gradient-to-br from-orange-50 to-yellow-100 dark:from-orange-900/20 dark:to-yellow-900/30 p-6 rounded-xl border border-orange-200 dark:border-orange-700 shadow-lg transform hover:scale-105 transition-all duration-300">
                      <div className="text-4xl mb-3 text-center">
                        {partyData.classicTheme ? "🎭" : "🎯"}
                      </div>
                      <h3 className="font-bold text-orange-800 dark:text-orange-200 mb-3 text-lg text-center">
                        {partyData.classicTheme ? "Classic Theme" : "Child's Interests & Colors"}
                      </h3>
                      
                      {partyData.classicTheme ? (
                        <div className="text-center">
                          <div className="bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 px-3 py-2 rounded-full text-sm font-bold inline-block">
                            {classicThemes.find(t => t.id === partyData.classicTheme)?.name} Theme
                          </div>
                          <div className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                            ✨ Ready to go!
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Interests Section */}
                          {partyData.childInterests.length > 0 && (
                            <div className="mb-3">
                              <div className="flex flex-wrap gap-1 justify-center">
                                {partyData.childInterests.slice(0, 2).map((interest, index) => (
                                  <span key={index} className="bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 px-2 py-1 rounded-full text-xs font-medium border border-orange-300 dark:border-orange-600">
                                    {interest}
                                  </span>
                                ))}
                                {partyData.childInterests.length > 2 && (
                                  <span className="bg-orange-300 dark:bg-orange-700 text-orange-800 dark:text-orange-200 px-2 py-1 rounded-full text-xs font-bold border border-orange-400 dark:border-orange-500">
                                    +{partyData.childInterests.length - 2}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Colors Section */}
                          {partyData.favoriteColors.length > 0 && (
                            <div className="flex flex-wrap gap-2 justify-center">
                              {partyData.favoriteColors.slice(0, 3).map((color, index) => (
                                <div key={index} className="flex items-center gap-1 bg-orange-100 dark:bg-orange-900 px-2 py-1 rounded-full text-xs">
                                  <div className={cn(
                                    "w-3 h-3 rounded-full border border-white shadow-sm",
                                    color === "Red" && "bg-red-500",
                                    color === "Blue" && "bg-blue-500",
                                    color === "Green" && "bg-green-500",
                                    color === "Yellow" && "bg-yellow-400",
                                    color === "Pink" && "bg-pink-500",
                                    color === "Purple" && "bg-purple-500",
                                    color === "Orange" && "bg-orange-500",
                                color === "Rainbow" && "bg-gradient-to-r from-red-400 via-yellow-400 to-blue-400"
                              )} />
                              <span className="text-orange-800 dark:text-orange-200 text-xs">{color}</span>
                            </div>
                          ))}
                          {partyData.favoriteColors.length > 3 && (
                            <span className="bg-orange-300 dark:bg-orange-700 text-orange-800 dark:text-orange-200 px-2 py-1 rounded-full text-xs font-bold">
                              +{partyData.favoriteColors.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Show message if no preferences and not classic theme */}
                      {!partyData.classicTheme && partyData.childInterests.length === 0 && partyData.favoriteColors.length === 0 && (
                        <div className="text-orange-700 dark:text-orange-300 text-sm text-center italic">
                          No preferences selected
                        </div>
                      )}
                      </>
                      )}
                    </div>

                    {/* Card 4: Chosen Theme - Always last */}
                    <div className="bg-gradient-to-br from-purple-50 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/30 p-6 rounded-xl border border-purple-200 dark:border-purple-700 shadow-lg transform hover:scale-105 transition-all duration-300">
                      <div className="text-5xl mb-4">
                        {(() => {
                          const aiTheme = partyData.aiRecommendations?.find(t => t.id === partyData.selectedTheme);
                          const classicTheme = themes.find(t => t.id === partyData.selectedTheme);
                          return aiTheme?.emoji || classicTheme?.emoji || "🎉";
                        })()}
                      </div>
                      <h3 className="font-bold text-purple-800 dark:text-purple-200 mb-2 text-lg">Chosen Theme</h3>
                      <div className="text-purple-700 dark:text-purple-300 font-semibold text-lg">
                        {(() => {
                          const aiTheme = partyData.aiRecommendations?.find(t => t.id === partyData.selectedTheme);
                          const classicTheme = themes.find(t => t.id === partyData.selectedTheme);
                          return aiTheme?.name || classicTheme?.name || "Not selected";
                        })()}
                      </div>
                      <div className="text-purple-600 dark:text-purple-400 text-sm mt-2">
                        <span className="bg-purple-200 dark:bg-purple-800 px-2 py-1 rounded-full">Perfect match! 🌟</span>
                      </div>
                    </div>
                  </div>

                  {/* What's Included Preview */}
                  <div className="bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-900/20 dark:to-yellow-900/30 p-8 rounded-xl border border-amber-200 dark:border-amber-700 shadow-lg mb-8 max-w-5xl mx-auto">
                    <h3 className="font-bold text-amber-800 dark:text-amber-200 mb-6 text-xl text-center">🎁 What's Included in Your Party Plan</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-amber-700 dark:text-amber-300">
                      <div className="flex flex-col items-center gap-2 p-3 bg-amber-100 dark:bg-amber-800/50 rounded-lg">
                        <span className="text-2xl">📋</span>
                        <span className="text-sm font-medium text-center">Smart Checklists</span>
                      </div>
                      <div className="flex flex-col items-center gap-2 p-3 bg-amber-100 dark:bg-amber-800/50 rounded-lg">
                        <span className="text-2xl">🎨</span>
                        <span className="text-sm font-medium text-center">Decorations Guide</span>
                      </div>
                      <div className="flex flex-col items-center gap-2 p-3 bg-amber-100 dark:bg-amber-800/50 rounded-lg">
                        <span className="text-2xl">🎮</span>
                        <span className="text-sm font-medium text-center">Fun Activities</span>
                      </div>
                      <div className="flex flex-col items-center gap-2 p-3 bg-amber-100 dark:bg-amber-800/50 rounded-lg">
                        <span className="text-2xl">👥</span>
                        <span className="text-sm font-medium text-center">Guest Management</span>
                      </div>
                      <div className="flex flex-col items-center gap-2 p-3 bg-amber-100 dark:bg-amber-800/50 rounded-lg">
                        <span className="text-2xl">📧</span>
                        <span className="text-sm font-medium text-center">Invitations</span>
                      </div>
                      <div className="flex flex-col items-center gap-2 p-3 bg-amber-100 dark:bg-amber-800/50 rounded-lg">
                        <span className="text-2xl">⏰</span>
                        <span className="text-sm font-medium text-center">Timeline Tracker</span>
                      </div>
                      <div className="flex flex-col items-center gap-2 p-3 bg-amber-100 dark:bg-amber-800/50 rounded-lg">
                        <span className="text-2xl">🍰</span>
                        <span className="text-sm font-medium text-center">Food Ideas</span>
                      </div>
                      <div className="flex flex-col items-center gap-2 p-3 bg-amber-100 dark:bg-amber-800/50 rounded-lg">
                        <span className="text-2xl">✨</span>
                        <span className="text-sm font-medium text-center">Much More!</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 p-6 rounded-xl border border-purple-300 dark:border-purple-600 max-w-3xl mx-auto">
                    <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
                      🎉 Everything is perfectly planned for <span className="font-bold text-purple-600 dark:text-purple-400 text-xl">{partyData.childName}'s</span> magical birthday celebration! 
                      <br />
                      <span className="text-purple-700 dark:text-purple-300 font-medium">Let's create your comprehensive party plan and make this birthday unforgettable! 🌟</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}