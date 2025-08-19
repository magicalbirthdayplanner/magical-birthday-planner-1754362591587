"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Heart, HeartOff, Loader2, Wand2, Palette, Star, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  isFavorite?: boolean;
  isCustom?: boolean;
}

interface PartyData {
  childName: string;
  childAge: string;
  interests?: string[];
  favoriteColors?: string[];
  selectedTheme?: string | null;
}

interface ThemesTabProps {
  partyData: PartyData;
  onThemeSelect: (themeId: string | null) => void;
}

const classicThemes = [
  { 
    id: "dinosaur", 
    name: "Dinosaur Adventure", 
    emoji: "🦕", 
    color: "bg-gradient-to-r from-green-500 to-emerald-600",
    description: "A prehistoric party adventure with dinosaurs from all eras! Perfect for little paleontologists.",
    decorations: [
      "Dinosaur footprint path leading to party area",
      "Large inflatable dinosaurs and fossils",
      "Jungle backdrop with prehistoric plants",
      "Volcano centerpiece with dry ice effect"
    ],
    activities: [
      "Dinosaur fossil dig in sandbox",
      "Pin the tail on the T-Rex",
      "Dinosaur egg hunt with surprise toys",
      "Create-your-own dinosaur craft station"
    ],
    colorPalette: ["#32CD32", "#228B22", "#8FBC8F", "#6B8E23"]
  },
  { 
    id: "space", 
    name: "Space Explorer Mission", 
    emoji: "🚀", 
    color: "bg-gradient-to-r from-purple-600 to-indigo-800",
    description: "Blast off to an intergalactic celebration among the stars! Mission: Fun activated.",
    decorations: [
      "Silver balloon archway as space station entrance",
      "Hanging planets and stars from ceiling",
      "Rocket ship photo booth backdrop",
      "Galaxy tablecloth with LED lights"
    ],
    activities: [
      "Build and launch paper rockets",
      "Space trivia and alien encounter games",
      "Astronaut training obstacle course",
      "Design your own planet art activity"
    ],
    colorPalette: ["#4169E1", "#8A2BE2", "#191970", "#483D8B"]
  },
  { 
    id: "safari", 
    name: "African Safari Adventure", 
    emoji: "🦁", 
    color: "bg-gradient-to-r from-yellow-500 to-orange-600",
    description: "Join the wild adventure through African savanna with majestic animals!",
    decorations: [
      "Jungle vine entrance with animal sounds",
      "Safari jeep cardboard cutout",
      "Animal print tablecloth and napkins",
      "Stuffed safari animals throughout venue"
    ],
    activities: [
      "Animal charades and sounds game",
      "Safari scavenger hunt",
      "Face painting with animal designs",
      "Make binoculars craft for exploration"
    ],
    colorPalette: ["#FFD700", "#FF8C00", "#DAA520", "#B8860B"]
  },
  { 
    id: "ocean", 
    name: "Under the Sea Adventure", 
    emoji: "🐠", 
    color: "bg-gradient-to-r from-blue-500 to-cyan-600",
    description: "Dive deep into an underwater world filled with colorful sea creatures and treasures!",
    decorations: [
      "Blue streamers as ocean waves",
      "Hanging jellyfish made from paper lanterns",
      "Treasure chest filled with party favors",
      "Coral reef backdrop with sea creatures"
    ],
    activities: [
      "Fishing game with magnetic rods",
      "Mermaid tail craft making",
      "Musical sea creatures game",
      "Ocean slime making station"
    ],
    colorPalette: ["#4169E1", "#00CED1", "#20B2AA", "#87CEEB"]
  },
  { 
    id: "princess", 
    name: "Royal Princess Castle", 
    emoji: "👸", 
    color: "bg-gradient-to-r from-pink-400 to-purple-600",
    description: "A magical royal celebration fit for princesses and princes in an enchanted castle!",
    decorations: [
      "Castle entrance archway with towers",
      "Pink and purple balloon bouquets",
      "Royal throne chair for birthday child",
      "Sparkling tiara centerpieces on tables"
    ],
    activities: [
      "Princess dress-up and photo session",
      "Royal treasure hunt for jewels",
      "Decorate your own crown craft",
      "Princess etiquette tea party games"
    ],
    colorPalette: ["#FF69B4", "#DA70D6", "#DDA0DD", "#F0E68C"]
  },
  { 
    id: "superhero", 
    name: "Superhero Training Academy", 
    emoji: "🦸‍♂️", 
    color: "bg-gradient-to-r from-red-500 to-blue-600",
    description: "Calling all heroes! Train to become the ultimate superhero and save the day!",
    decorations: [
      "City skyline backdrop with buildings",
      "Comic book action bubble decorations",
      "Superhero cape station entrance",
      "POW! BAM! table centerpieces"
    ],
    activities: [
      "Design your own superhero cape",
      "Superhero training obstacle course",
      "Villain freeze dance battle",
      "Create comic book covers activity"
    ],
    colorPalette: ["#FF6347", "#4169E1", "#FFD700", "#DC143C"]
  },
  { 
    id: "sports", 
    name: "Championship Sports Day", 
    emoji: "⚽", 
    color: "bg-gradient-to-r from-orange-500 to-red-600",
    description: "Game on! A championship celebration with sports challenges and victory fun!",
    decorations: [
      "Sports equipment garland banners",
      "Trophy and medal centerpieces",
      "Team pennant flags hanging",
      "Goal post entrance archway"
    ],
    activities: [
      "Mini sports tournament stations",
      "Medal ceremony and awards",
      "Sports trivia championship",
      "Design team jersey craft"
    ],
    colorPalette: ["#FF8C00", "#FF6347", "#32CD32", "#4169E1"]
  },
  { 
    id: "unicorn", 
    name: "Magical Unicorn Kingdom", 
    emoji: "🦄", 
    color: "bg-gradient-to-r from-pink-500 to-violet-600",
    description: "Enter a mystical realm where unicorns roam and rainbow magic fills the air!",
    decorations: [
      "Rainbow balloon archway entrance",
      "Unicorn horn and tail photo props",
      "Glittery cloud and star hanging decorations",
      "Pastel rainbow tablecloth settings"
    ],
    activities: [
      "Unicorn horn decorating craft",
      "Rainbow parachute play time",
      "Pin the horn on the unicorn",
      "Magical unicorn slime making"
    ],
    colorPalette: ["#FF69B4", "#9370DB", "#87CEEB", "#F0E68C"]
  }
];

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

export default function ThemesTab({ partyData, onThemeSelect }: ThemesTabProps) {
  // Persist active tab in localStorage to maintain state across navigation
  const [activeTab, setActiveTab] = useState<'classic' | 'custom'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('themesTabActiveTab');
      return (saved as 'classic' | 'custom') || 'classic';
    }
    return 'classic';
  });
  
  const [favoriteThemes, setFavoriteThemes] = useState<string[]>([]);
  // Persist AI themes in localStorage to maintain state across navigation
  const [aiThemes, setAiThemes] = useState<ThemeRecommendation[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aiGeneratedThemes');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (error) {
          console.error('Error parsing saved AI themes:', error);
        }
      }
    }
    return [];
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(partyData.interests || []);
  const [selectedColors, setSelectedColors] = useState<string[]>(partyData.favoriteColors || []);
  
  // Persist theme generation form data
  const [childDetails, setChildDetails] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('themeGenChildDetails') || "";
    }
    return "";
  });
  
  const [currentFavorites, setCurrentFavorites] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('themeGenCurrentFavorites') || "";
    }
    return "";
  });
  
  const [selectedThemeDetails, setSelectedThemeDetails] = useState<any>(null);

  // Load favorites from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('themesFavorites');
    if (saved) {
      setFavoriteThemes(JSON.parse(saved));
    }
  }, []);

  // Persist active tab to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('themesTabActiveTab', activeTab);
    }
  }, [activeTab]);

  // Persist AI themes to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined' && aiThemes.length > 0) {
      localStorage.setItem('aiGeneratedThemes', JSON.stringify(aiThemes));
    }
  }, [aiThemes]);

  // Persist form data to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('themeGenChildDetails', childDetails);
    }
  }, [childDetails]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('themeGenCurrentFavorites', currentFavorites);
    }
  }, [currentFavorites]);

  // Update selected theme details when theme changes
  useEffect(() => {
    if (partyData.selectedTheme) {
      const classicTheme = classicThemes.find(t => t.id === partyData.selectedTheme);
      const aiTheme = aiThemes.find(t => t.id === partyData.selectedTheme);
      setSelectedThemeDetails(classicTheme || aiTheme || null);
    } else {
      setSelectedThemeDetails(null);
    }
  }, [partyData.selectedTheme, aiThemes]);

  // Save favorites to localStorage
  const saveFavorites = (favorites: string[]) => {
    setFavoriteThemes(favorites);
    localStorage.setItem('themesFavorites', JSON.stringify(favorites));
  };

  const toggleFavorite = (themeId: string) => {
    const newFavorites = favoriteThemes.includes(themeId)
      ? favoriteThemes.filter(id => id !== themeId)
      : [...favoriteThemes, themeId];
    saveFavorites(newFavorites);
  };

  const generateAIThemes = async () => {
    if (selectedInterests.length === 0) {
      alert("Please select at least one interest to generate AI themes");
      return;
    }

    setIsGenerating(true);
    
    try {
      const response = await fetch('/api/theme-recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          childName: partyData.childName,
          age: parseInt(partyData.childAge),
          interests: selectedInterests,
          favoriteColors: selectedColors,
          childDetails,
          currentFavorites
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate themes');
      }

      const data = await response.json();
      const newThemes = data.recommendations || [];
      setAiThemes(newThemes);
      // Save to localStorage immediately
      if (typeof window !== 'undefined') {
        localStorage.setItem('aiGeneratedThemes', JSON.stringify(newThemes));
      }
    } catch (error) {
      console.error('Error generating AI themes:', error);
      // Fallback themes
      const fallbackThemes = [
        {
          id: 'ai-magical-adventure',
          name: 'Magical Adventure Quest',
          description: 'An enchanting journey through mystical lands with treasures to discover!',
          whyRecommended: `Perfect for ${partyData.childName} based on their interests in ${selectedInterests.slice(0, 2).join(' and ')}`,
          colorPalette: selectedColors.length > 0 ? selectedColors : ['#FF69B4', '#9370DB', '#4169E1'],
          decorations: ['Treasure map backdrop', 'Magic wand station', 'Enchanted forest corner'],
          activities: ['Treasure hunt', 'Magic potion making', 'Quest challenges'],
          printableIdeas: ['Quest certificates', 'Magic spell cards'],
          emoji: '🧙‍♀️',
          ageAppropriate: true,
          matchScore: 95,
          isCustom: true
        }
      ];
      setAiThemes(fallbackThemes);
      // Save fallback themes to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('aiGeneratedThemes', JSON.stringify(fallbackThemes));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInterestToggle = (interest: string) => {
    setSelectedInterests(prev => 
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const handleColorToggle = (color: string) => {
    setSelectedColors(prev => 
      prev.includes(color)
        ? prev.filter(c => c !== color)
        : [...prev, color]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Choose Your Perfect Theme
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Select from classic themes or create personalized AI-generated themes
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('classic')}
          className={cn(
            "flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors",
            activeTab === 'classic'
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          )}
        >
          <Palette className="w-4 h-4 inline mr-2" />
          Classic Themes
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={cn(
            "flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors",
            activeTab === 'custom'
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          )}
        >
          <Wand2 className="w-4 h-4 inline mr-2" />
          AI Custom Themes
        </button>
      </div>

      {/* Classic Themes Tab */}
      {activeTab === 'classic' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {classicThemes.map((theme) => (
              <Card
                key={theme.id}
                className={cn(
                  "cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg relative group",
                  partyData.selectedTheme === theme.id
                    ? "ring-2 ring-purple-500 shadow-lg"
                    : "hover:shadow-md"
                )}
                onClick={() => onThemeSelect(partyData.selectedTheme === theme.id ? null : theme.id)}
              >
                <div className={cn("absolute inset-0 rounded-lg opacity-20", theme.color)} />
                <CardContent className="p-6 text-center relative">
                  <div className="text-4xl mb-2">{theme.emoji}</div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    {theme.name}
                  </h3>
                  
                  {/* Add to Party / Deselect Button */}
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onThemeSelect(partyData.selectedTheme === theme.id ? null : theme.id);
                    }}
                    variant={partyData.selectedTheme === theme.id ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "w-full mb-2 transition-all duration-200",
                      partyData.selectedTheme === theme.id 
                        ? "bg-purple-600 hover:bg-purple-700 text-white shadow-md" 
                        : "border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-600 dark:text-purple-300 dark:hover:bg-purple-900/20"
                    )}
                  >
                    {partyData.selectedTheme === theme.id ? (
                      <>
                        <Trash2 className="w-3 h-3 mr-1" />
                        Remove Theme
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3 mr-1" />
                        Add to Party
                      </>
                    )}
                  </Button>

                  {partyData.selectedTheme === theme.id && (
                    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                      <Star className="w-3 h-3 mr-1" />
                      Current Theme
                    </Badge>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 p-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(theme.id);
                    }}
                  >
                    {favoriteThemes.includes(theme.id) ? (
                      <Heart className="w-4 h-4 text-red-500 fill-current" />
                    ) : (
                      <Heart className="w-4 h-4 text-gray-400" />
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* AI Custom Themes Tab */}
      {activeTab === 'custom' && (
        <div className="space-y-6">
          {/* Interest & Color Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Personalize Your Theme
              </CardTitle>
              <CardDescription>
                Tell us about {partyData.childName}'s interests to create the perfect theme
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Interests */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Child's Interests</Label>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {interestOptions.map((interest) => (
                    <Badge
                      key={interest}
                      variant={selectedInterests.includes(interest) ? "default" : "outline"}
                      className="cursor-pointer justify-center py-2"
                      onClick={() => handleInterestToggle(interest)}
                    >
                      {interest}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Favorite Colors */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Favorite Colors</Label>
                <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                  {colorOptions.map((color) => (
                    <div
                      key={color.value}
                      className={cn(
                        "w-12 h-12 rounded-full cursor-pointer border-4 transition-all",
                        selectedColors.includes(color.value)
                          ? "border-purple-500 scale-110"
                          : "border-gray-200 dark:border-gray-600 hover:scale-105"
                      )}
                      style={{ 
                        background: color.value === 'rainbow' ? color.color : color.color 
                      }}
                      onClick={() => handleColorToggle(color.value)}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              {/* Additional Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="childDetails" className="text-sm font-medium">
                    Tell us more about {partyData.childName}
                  </Label>
                  <Textarea
                    id="childDetails"
                    placeholder="Any specific interests, hobbies, or favorite characters?"
                    value={childDetails}
                    onChange={(e) => setChildDetails(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="currentFavorites" className="text-sm font-medium">
                    Current favorites (movies, shows, characters)
                  </Label>
                  <Textarea
                    id="currentFavorites"
                    placeholder="What does your child love right now?"
                    value={currentFavorites}
                    onChange={(e) => setCurrentFavorites(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Generate Button */}
              <Button
                onClick={generateAIThemes}
                disabled={isGenerating || selectedInterests.length === 0}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Magical Themes...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Generate AI Themes
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* AI Generated Themes */}
          {aiThemes.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                AI-Generated Themes for {partyData.childName}
              </h3>
              <div className="grid gap-4">
                {aiThemes.map((theme) => (
                  <Card
                    key={theme.id}
                    className={cn(
                      "cursor-pointer transition-all duration-200 hover:shadow-lg relative",
                      partyData.selectedTheme === theme.id
                        ? "ring-2 ring-purple-500 shadow-lg"
                        : "hover:shadow-md"
                    )}
                    onClick={() => onThemeSelect(partyData.selectedTheme === theme.id ? null : theme.id)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="text-3xl">{theme.emoji}</div>
                          <div>
                            <h4 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                              {theme.name}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {theme.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800">
                            {theme.matchScore}% match
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(theme.id);
                            }}
                          >
                            {favoriteThemes.includes(theme.id) ? (
                              <Heart className="w-4 h-4 text-red-500 fill-current" />
                            ) : (
                              <Heart className="w-4 h-4 text-gray-400" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Add to Party / Deselect Button for AI Themes */}
                      <div className="mb-4">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            onThemeSelect(partyData.selectedTheme === theme.id ? null : theme.id);
                          }}
                          variant={partyData.selectedTheme === theme.id ? "default" : "outline"}
                          size="sm"
                          className={cn(
                            "transition-all duration-200",
                            partyData.selectedTheme === theme.id 
                              ? "bg-purple-600 hover:bg-purple-700 text-white shadow-md" 
                              : "border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-600 dark:text-purple-300 dark:hover:bg-purple-900/20"
                          )}
                        >
                          {partyData.selectedTheme === theme.id ? (
                            <>
                              <Trash2 className="w-3 h-3 mr-1" />
                              Remove Theme
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3 mr-1" />
                              Add to Party
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Decorations</h5>
                          <ul className="text-gray-600 dark:text-gray-400 space-y-1">
                            {theme.decorations.map((item, index) => (
                              <li key={index}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Activities</h5>
                          <ul className="text-gray-600 dark:text-gray-400 space-y-1">
                            {theme.activities.map((item, index) => (
                              <li key={index}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Color Palette</h5>
                          <div className="flex gap-2 flex-wrap">
                            {theme.colorPalette.map((color, index) => (
                              <div
                                key={index}
                                className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-600"
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {partyData.selectedTheme === theme.id && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                            <Star className="w-3 h-3 mr-1" />
                            Current Theme
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selected Theme Details */}
      {selectedThemeDetails && (
        <Card className="border-2 border-purple-200 dark:border-purple-700 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="text-3xl">{selectedThemeDetails.emoji}</div>
              <div>
                <h3 className="text-xl font-bold text-purple-800 dark:text-purple-200">
                  {selectedThemeDetails.name}
                </h3>
                <p className="text-sm text-purple-600 dark:text-purple-300 font-medium">
                  Selected Theme
                </p>
              </div>
              <Badge className="ml-auto bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100">
                <Star className="w-3 h-3 mr-1" />
                Current Theme
              </Badge>
            </CardTitle>
            <CardDescription className="text-gray-700 dark:text-gray-300">
              {selectedThemeDetails.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedThemeDetails.whyRecommended && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Why This Theme?
                </h4>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  {selectedThemeDetails.whyRecommended}
                </p>
                {selectedThemeDetails.matchScore && (
                  <Badge variant="secondary" className="mt-2 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800">
                    {selectedThemeDetails.matchScore}% perfect match
                  </Badge>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Decorations */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  Decorations
                </h4>
                <ul className="space-y-2">
                  {(selectedThemeDetails.decorations || []).map((item: string, index: number) => (
                    <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                      <span className="text-purple-500 mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Activities */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                  Activities
                </h4>
                <ul className="space-y-2">
                  {(selectedThemeDetails.activities || []).map((item: string, index: number) => (
                    <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                      <span className="text-pink-500 mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Color Palette */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-3 flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Color Palette
                </h4>
                <div className="grid grid-cols-4 gap-2">
                  {(selectedThemeDetails.colorPalette || []).map((color: string, index: number) => (
                    <div key={index} className="flex flex-col items-center">
                      <div
                        className="w-8 h-8 rounded-lg border-2 border-gray-200 dark:border-gray-600 shadow-sm"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {color.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Additional Theme Information for AI Themes */}
            {selectedThemeDetails.printableIdeas && selectedThemeDetails.printableIdeas.length > 0 && (
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-700">
                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-3 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Printable Ideas & Extras
                </h4>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {selectedThemeDetails.printableIdeas.map((item: string, index: number) => (
                    <li key={index} className="text-sm text-yellow-700 dark:text-yellow-300 flex items-start gap-2">
                      <span className="text-yellow-600 mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}