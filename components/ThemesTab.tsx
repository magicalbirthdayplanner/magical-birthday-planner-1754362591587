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
  selectedTheme?: string;
}

interface ThemesTabProps {
  partyData: PartyData;
  onThemeSelect: (themeId: string) => void;
}

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
  const [activeTab, setActiveTab] = useState<'classic' | 'custom'>('classic');
  const [favoriteThemes, setFavoriteThemes] = useState<string[]>([]);
  const [aiThemes, setAiThemes] = useState<ThemeRecommendation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(partyData.interests || []);
  const [selectedColors, setSelectedColors] = useState<string[]>(partyData.favoriteColors || []);
  const [childDetails, setChildDetails] = useState("");
  const [currentFavorites, setCurrentFavorites] = useState("");

  // Load favorites from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('themesFavorites');
    if (saved) {
      setFavoriteThemes(JSON.parse(saved));
    }
  }, []);

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
      setAiThemes(data.recommendations || []);
    } catch (error) {
      console.error('Error generating AI themes:', error);
      // Fallback themes
      setAiThemes([
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
      ]);
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
                onClick={() => onThemeSelect(theme.id)}
              >
                <div className={cn("absolute inset-0 rounded-lg opacity-20", theme.color)} />
                <CardContent className="p-6 text-center relative">
                  <div className="text-4xl mb-2">{theme.emoji}</div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {theme.name}
                  </h3>
                  {partyData.selectedTheme === theme.id && (
                    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                      <Star className="w-3 h-3 mr-1" />
                      Selected
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
                    onClick={() => onThemeSelect(theme.id)}
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
                            Selected Theme
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

      {/* Favorites Section */}
      {favoriteThemes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500" />
              Your Favorite Themes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {favoriteThemes.map((themeId) => {
                const classicTheme = classicThemes.find(t => t.id === themeId);
                const aiTheme = aiThemes.find(t => t.id === themeId);
                const theme = classicTheme || aiTheme;
                
                if (!theme) return null;
                
                return (
                  <Card
                    key={themeId}
                    className="cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg relative"
                    onClick={() => onThemeSelect(themeId)}
                  >
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl mb-2">
                        {classicTheme ? classicTheme.emoji : aiTheme?.emoji}
                      </div>
                      <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">
                        {classicTheme ? classicTheme.name : aiTheme?.name}
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-1 right-1 p-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(themeId);
                        }}
                      >
                        <Heart className="w-3 h-3 text-red-500 fill-current" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}