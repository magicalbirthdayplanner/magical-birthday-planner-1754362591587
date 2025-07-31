"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, ArrowRight, ArrowLeft, PartyPopper, X, Sparkles, Loader2, Heart } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  childAge: string;
  childInterests: string[];
  favoriteColors: string[];
  partyDate: Date | undefined;
  selectedTheme: string;
  aiRecommendations?: ThemeRecommendation[];
  isLoadingAI?: boolean;
}

// AI Theme Recommendation Logic with OpenAI Integration
const getAIRecommendations = async (
  childName: string,
  age: string,
  interests: string[],
  favoriteColors: string[]
): Promise<ThemeRecommendation[]> => {
  try {
    const response = await fetch('/api/theme-recommendations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        childName,
        age: parseInt(age),
        interests,
        favoriteColors,
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
    return getFallbackRecommendations(childName, age, interests);
  }
};

// Fallback recommendations when AI is unavailable
const getFallbackRecommendations = (childName: string, age: string, interests: string[]): ThemeRecommendation[] => {
  const ageNum = parseInt(age);
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
    childAge: "",
    childInterests: [],
    favoriteColors: [],
    partyDate: undefined,
    selectedTheme: "",
    aiRecommendations: [],
    isLoadingAI: false
  });

  const handleNext = async () => {
    if (step === 1 && partyData.childAge && partyData.childInterests.length > 0) {
      // Generate AI recommendations when moving from step 1 to step 2
      setPartyData(prev => ({ ...prev, isLoadingAI: true }));
      try {
        const recommendations = await getAIRecommendations(
          partyData.childName,
          partyData.childAge,
          partyData.childInterests,
          partyData.favoriteColors
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
    }
    if (step < 3) setStep(step + 1);
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
        return partyData.childName.trim() !== "" && partyData.childAge !== "" && partyData.childInterests.length > 0;
      case 2:
        return partyData.partyDate !== undefined;
      case 3:
        return partyData.selectedTheme !== "";
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
            Create Your Party
          </h1>
          <p className="text-gray-600">Let's plan the perfect birthday celebration for your child!</p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            {[1, 2, 3].map((stepNumber) => (
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
                {stepNumber < 3 && (
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
              {step === 2 && "When's the party?"}
              {step === 3 && "Choose a theme"}
            </CardTitle>
            <CardDescription>
              {step === 1 && "We'll personalize everything based on your child's age and preferences"}
              {step === 2 && "Pick the perfect date for your celebration"}
              {step === 3 && "Select a theme that your child will absolutely love"}
            </CardDescription>
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
                    className="text-lg py-6"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="childAge" className="text-sm font-medium">
                    Child's Age
                  </Label>
                  <Select value={partyData.childAge} onValueChange={(value) => setPartyData({ ...partyData, childAge: value })}>
                    <SelectTrigger className="text-lg py-6">
                      <SelectValue placeholder="Select age" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 13 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {i === 0 ? "Under 1 year" : `${i} year${i > 1 ? 's' : ''} old`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Child's Interests (Select at least one)
                  </Label>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {interestOptions.map((interest) => (
                        <Badge
                          key={interest}
                          variant={partyData.childInterests.includes(interest) ? "default" : "outline"}
                          className={cn(
                            "cursor-pointer px-3 py-1 text-sm",
                            partyData.childInterests.includes(interest)
                              ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700"
                              : "hover:bg-gray-100"
                          )}
                          onClick={() => {
                            const newInterests = partyData.childInterests.includes(interest)
                              ? partyData.childInterests.filter(i => i !== interest)
                              : [...partyData.childInterests, interest];
                            setPartyData({ ...partyData, childInterests: newInterests });
                          }}
                        >
                          {interest}
                        </Badge>
                      ))}
                    </div>
                    {partyData.childInterests.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        <span className="text-sm text-gray-600">Selected:</span>
                        {partyData.childInterests.map((interest) => (
                          <Badge
                            key={interest}
                            className="bg-purple-100 text-purple-800 hover:bg-purple-200"
                          >
                            {interest}
                            <X
                              className="ml-1 h-3 w-3 cursor-pointer"
                              onClick={() => {
                                const newInterests = partyData.childInterests.filter(i => i !== interest);
                                setPartyData({ ...partyData, childInterests: newInterests });
                              }}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Favorite Colors (Optional - helps personalize themes)
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {colorOptions.map((color) => (
                      <div
                        key={color.value}
                        className={cn(
                          "flex items-center space-x-2 p-2 rounded-lg border-2 cursor-pointer transition-all",
                          partyData.favoriteColors.includes(color.value)
                            ? "border-purple-500 bg-purple-50"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                        onClick={() => {
                          const newColors = partyData.favoriteColors.includes(color.value)
                            ? partyData.favoriteColors.filter(c => c !== color.value)
                            : [...partyData.favoriteColors, color.value];
                          setPartyData({ ...partyData, favoriteColors: newColors });
                        }}
                      >
                        <div
                          className="w-4 h-4 rounded-full border border-gray-300"
                          style={{
                            background: color.value === 'rainbow' 
                              ? 'linear-gradient(90deg, #FF6B6B, #4ECDC4, #45B7D1, #96CEB4, #FFEAA7, #DDA0DD)'
                              : color.color
                          }}
                        />
                        <span className="text-sm">{color.name}</span>
                        {partyData.favoriteColors.includes(color.value) && (
                          <Heart className="h-3 w-3 text-purple-600 fill-current" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Party Date */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Party Date</Label>
                  <Popover>
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
                        onSelect={(date) => setPartyData({ ...partyData, partyDate: date })}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {/* Step 3: Theme Selection */}
            {step === 3 && (
              <div className="space-y-6">
                {/* Loading State */}
                {partyData.isLoadingAI && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-600 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      Creating Personalized Themes for {partyData.childName}...
                    </h3>
                    <p className="text-sm text-gray-500 text-center">
                      Our AI is analyzing {partyData.childName}'s interests and creating magical theme suggestions
                    </p>
                  </div>
                )}

                {/* AI Recommendations Section */}
                {!partyData.isLoadingAI && partyData.aiRecommendations && partyData.aiRecommendations.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center space-x-2 mb-4">
                      <Sparkles className="h-5 w-5 text-purple-600" />
                      <h3 className="text-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                        Personalized Themes for {partyData.childName}
                      </h3>
                      <Sparkles className="h-5 w-5 text-purple-600" />
                    </div>
                    <p className="text-center text-sm text-gray-600 mb-4">
                      Based on {partyData.childName}'s age ({partyData.childAge === "0" ? "Under 1 year" : `${partyData.childAge} year${parseInt(partyData.childAge) > 1 ? 's' : ''} old`}), interests: {partyData.childInterests.join(", ")}
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

                {/* Traditional Themes Section */}
                {!partyData.isLoadingAI && (
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

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={step === 1}
                className="px-8"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              
              {step < 3 ? (
                <Button
                  onClick={handleNext}
                  disabled={!isStepValid()}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8"
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!isStepValid()}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8"
                >
                  Create My Party Plan
                  <PartyPopper className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}