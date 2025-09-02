"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Heart, HeartOff, Loader2, Wand2, Palette, Star, Plus, Trash2, Search, Filter, Grid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { classicThemes, themeCategories, type ClassicTheme, type ThemeCategory } from "../data/themes-data";
import ReactCanvasConfetti from 'react-canvas-confetti';
import ThemeSelectionSplash from './ThemeSelectionSplash';

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
  childGender?: string;
  interests?: string[];
  favoriteColors?: string[];
  selectedTheme?: string | null;
  classicTheme?: string;
  partyDate?: Date;
  zipCode?: string;
  country?: string;
  guestCount?: number;
  budget?: number;
  currency?: string;
  duration?: string;
  venue?: string;
}

interface ThemesTabProps {
  partyData: PartyData;
  onThemeSelect: (themeId: string | null) => void;
}

// Theme filtering and search state
type ViewMode = 'grid' | 'list';
type SortBy = 'name' | 'popularity' | 'category';

export default function ThemesTab({ partyData, onThemeSelect }: ThemesTabProps) {
  // Confetti setup
  const refAnimationInstance = useRef<any>(null);
  
  const getInstance = useCallback((instance: any) => {
    refAnimationInstance.current = instance;
  }, []);
  
  const triggerConfetti = useCallback(() => {
    console.log('🎉 Triggering confetti animation...');
    const confetti = refAnimationInstance.current;
    if (confetti && typeof confetti === 'function') {
      console.log('✅ Confetti instance is valid, starting animation');
      // Enhanced multiple bursts for maximum visibility celebration effect
      // First central burst - high particle count
      confetti({
        particleCount: 250, // Increased particle count
        spread: 120, // Wider spread
        origin: { y: 0.6 },
        colors: ['#FF69B4', '#9370DB', '#4169E1', '#32CD32', '#FFD700', '#FF8C00', '#FF1493', '#00CED1'],
        scalar: 1.5, // Larger particles
        drift: 0,
        gravity: 0.8,
        ticks: 400 // Longer duration
      });
      
      // Second burst from left side
      setTimeout(() => {
        if (confetti && typeof confetti === 'function') {
          confetti({
            particleCount: 150,
            angle: 60,
            spread: 100,
            origin: { x: 0.1, y: 0.7 },
            colors: ['#FF69B4', '#9370DB', '#4169E1', '#32CD32', '#FFD700', '#FF8C00'],
            scalar: 1.3,
            drift: 0.1,
            gravity: 0.9,
            ticks: 300
          });
        }
      }, 150);
      
      // Third burst from right side
      setTimeout(() => {
        if (confetti && typeof confetti === 'function') {
          confetti({
            particleCount: 150,
            angle: 120,
            spread: 100,
            origin: { x: 0.9, y: 0.7 },
            colors: ['#FF69B4', '#9370DB', '#4169E1', '#32CD32', '#FFD700', '#FF8C00'],
            scalar: 1.3,
            drift: -0.1,
            gravity: 0.9,
            ticks: 300
          });
        }
      }, 300);
      
      // Fourth burst from top center for shower effect
      setTimeout(() => {
        if (confetti && typeof confetti === 'function') {
          confetti({
            particleCount: 100,
            spread: 140,
            origin: { x: 0.5, y: 0.1 },
            colors: ['#FFD700', '#FF69B4', '#9370DB', '#32CD32'],
            scalar: 1.0,
            drift: 0,
            gravity: 0.6,
            ticks: 500
          });
        }
      }, 450);
      
      console.log('🎊 Confetti animation sequence started!');
    } else {
      console.warn('❌ Confetti instance not available or not a function:', confetti);
      console.warn('Confetti ref state:', refAnimationInstance.current);
    }
  }, []);
  // Persist active tab in localStorage to maintain state across navigation
  const [activeTab, setActiveTab] = useState<'classic' | 'custom'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('themesTabActiveTab');
      return (saved as 'classic' | 'custom') || 'classic';
    }
    return 'classic';
  });
  
  // Theme filtering and search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAgeRange, setSelectedAgeRange] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('popularity');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  
  const [favoriteThemes, setFavoriteThemes] = useState<string[]>([]);
  
  // Splash screen state
  const [showSplash, setShowSplash] = useState(false);
  const [splashTheme, setSplashTheme] = useState<any>(null);
  
  // Constants moved from old implementation
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

  // Age range options for filtering
  const ageRangeOptions = [
    { label: 'All Ages', value: 'all' },
    { label: '0-3 years', value: '0-3' },
    { label: '3-6 years', value: '3-6' },
    { label: '6-9 years', value: '6-9' },
    { label: '9-12 years', value: '9-12' }
  ];

  // Filtered and sorted themes computation
  const filteredThemes = useMemo(() => {
    let filtered = classicThemes.filter(theme => {
      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          theme.name.toLowerCase().includes(query) ||
          theme.description.toLowerCase().includes(query) ||
          theme.keywords.some(keyword => keyword.toLowerCase().includes(query)) ||
          theme.category.toLowerCase().includes(query);
        
        if (!matchesSearch) return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && theme.category !== selectedCategory) {
        return false;
      }

      // Age range filter
      if (selectedAgeRange !== 'all') {
        const childAge = parseInt(partyData.childAge) || 5;
        const [minAge, maxAge] = theme.ageRange.split('-').map(age => parseInt(age.trim()));
        
        switch (selectedAgeRange) {
          case '0-3':
            return childAge <= 3 && minAge <= 3;
          case '3-6':
            return childAge >= 3 && childAge <= 6 && maxAge >= 3 && minAge <= 6;
          case '6-9':
            return childAge >= 6 && childAge <= 9 && maxAge >= 6 && minAge <= 9;
          case '9-12':
            return childAge >= 9 && childAge <= 12 && maxAge >= 9;
          default:
            return true;
        }
      }

      return true;
    });

    // Sort themes
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'popularity':
          return b.popularity - a.popularity;
        case 'category':
          return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return filtered;
  }, [classicThemes, searchQuery, selectedCategory, selectedAgeRange, sortBy, partyData.childAge]);
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

  // Clean slate initialization - ensure no pre-selected themes from localStorage interference
  useEffect(() => {
    // If partyData.selectedTheme is empty string (not null), clean it up
    if (partyData.selectedTheme === '') {
      console.log('Cleaning up empty string selectedTheme for clean slate');
      onThemeSelect(null);
    }
  }, [partyData.selectedTheme, onThemeSelect]);

  // Clear AI themes when a classic theme is selected and vice versa
  const handleThemeSelection = (themeId: string | null) => {
    if (themeId) {
      // Check if it's a classic theme
      const isClassicTheme = classicThemes.some(t => t.id === themeId);
      const isAiTheme = aiThemes.some(t => t.id === themeId);
      
      // Only show splash and confetti if we're actually selecting a theme (not deselecting)
      const isNewSelection = partyData.selectedTheme !== themeId;
      
      if (isNewSelection) {
        // Find the selected theme details for splash screen
        const selectedThemeDetails = isClassicTheme 
          ? classicThemes.find(t => t.id === themeId)
          : aiThemes.find(t => t.id === themeId);
        
        if (selectedThemeDetails) {
          // Set splash screen data
          setSplashTheme(selectedThemeDetails);
          setShowSplash(true);
          
          // Trigger confetti effect with 50ms delay as per specification
          setTimeout(() => {
            try {
              triggerConfetti();
            } catch (confettiError) {
              console.warn('Confetti animation failed:', confettiError);
            }
          }, 50);
        }
      }
      
      // If selecting a classic theme, clear any selected AI theme
      if (isClassicTheme && partyData.selectedTheme && aiThemes.some(t => t.id === partyData.selectedTheme)) {
        // Switch from AI to classic theme
        onThemeSelect(themeId);
      }
      // If selecting an AI theme, clear any selected classic theme  
      else if (isAiTheme && partyData.selectedTheme && classicThemes.some(t => t.id === partyData.selectedTheme)) {
        // Switch from classic to AI theme
        onThemeSelect(themeId);
      }
      else {
        // Normal selection/deselection
        onThemeSelect(partyData.selectedTheme === themeId ? null : themeId);
      }
    } else {
      onThemeSelect(null);
    }
  };

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
      // Gather ALL wizard data from steps 1-3
      const comprehensivePartyData = {
        // Step 1: Child Information
        childName: partyData.childName,
        age: parseInt(partyData.childAge),
        childGender: partyData.childGender,
        
        // Step 2: Theme Preferences (current AI tab)
        interests: selectedInterests,
        favoriteColors: selectedColors,
        childDetails,
        currentFavorites,
        
        // Step 3: Party Details (if available)
        partyDate: partyData.partyDate?.toISOString(),
        zipCode: partyData.zipCode,
        country: partyData.country,
        guestCount: partyData.guestCount,
        budget: partyData.budget,
        currency: partyData.currency,
        duration: partyData.duration,
        venue: partyData.venue,
        
        // Additional context
        selectedClassicTheme: partyData.selectedTheme || partyData.classicTheme
      };

      console.log('Sending comprehensive wizard data to GPT-4.1:', comprehensivePartyData);

      const response = await fetch('/api/theme-recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(comprehensivePartyData),
      });

      if (!response.ok) {
        throw new Error('Failed to generate themes');
      }

      const data = await response.json();
      const newThemes = data.recommendations || [];
      
      // Set AI themes first
      setAiThemes(newThemes);
      
      // Save to localStorage immediately
      if (typeof window !== 'undefined') {
        localStorage.setItem('aiGeneratedThemes', JSON.stringify(newThemes));
      }
      
      // Trigger confetti effect after themes are generated
      if (newThemes.length > 0) {
        // Immediate confetti for better visibility
        setTimeout(() => {
          try {
            triggerConfetti();
          } catch (confettiError) {
            console.warn('Confetti animation failed:', confettiError);
          }
        }, 50);
      }
    } catch (error) {
      console.error('Error generating AI themes:', error);
      // Enhanced fallback themes with 3-4 variations to ensure multiple options
      const primaryInterest = selectedInterests[0] || 'adventure';
      const secondaryInterest = selectedInterests[1] || 'games';
      const primaryColor = selectedColors[0] || '#FF69B4';
      const secondaryColor = selectedColors[1] || '#9370DB';
      
      const fallbackThemes = [
        {
          id: 'ai-magical-adventure',
          name: `${partyData.childName}'s Magical ${primaryInterest.charAt(0).toUpperCase() + primaryInterest.slice(1)} Quest`,
          description: 'An enchanting journey through mystical lands with treasures to discover!',
          whyRecommended: `Perfect for ${partyData.childName}, age ${partyData.childAge}, based on their love of ${primaryInterest}${partyData.guestCount ? ` - designed for ${partyData.guestCount} guests` : ''}`,
          colorPalette: selectedColors.length > 0 ? selectedColors.slice(0, 4) : ['#FF69B4', '#9370DB', '#4169E1', '#32CD32'],
          decorations: ['Treasure map backdrop', 'Magic wand station', 'Enchanted forest corner', 'Quest checkpoint signs'],
          activities: ['Treasure hunt adventure', 'Magic potion making', 'Quest challenges', 'Mystical creature encounters'],
          printableIdeas: ['Quest certificates', 'Magic spell cards'],
          emoji: '🧙‍♀️',
          ageAppropriate: true,
          matchScore: 95,
          isCustom: true
        },
        {
          id: 'ai-creative-celebration',
          name: `${partyData.childName}'s Creative ${secondaryInterest.charAt(0).toUpperCase() + secondaryInterest.slice(1)} Celebration`,
          description: 'A vibrant celebration filled with creativity, fun, and personalized activities!',
          whyRecommended: `Specially designed for ${partyData.childName} who enjoys ${secondaryInterest} and creative activities - perfect for age ${partyData.childAge}!`,
          colorPalette: [primaryColor, secondaryColor, '#FFD700', '#32CD32'],
          decorations: ['Creative corner setup', 'Personalized banners', 'Activity stations', 'Photo booth props'],
          activities: ['Creative workshops', 'Fun challenges', 'Interactive games', 'Celebration activities'],
          printableIdeas: ['Activity guides', 'Celebration certificates'],
          emoji: '🎨',
          ageAppropriate: true,
          matchScore: 90,
          isCustom: true
        },
        {
          id: 'ai-adventure-party',
          name: `${partyData.childName}'s Ultimate Adventure Party`,
          description: 'An action-packed adventure with exciting challenges and surprises at every turn!',
          whyRecommended: `Tailored for ${partyData.childName}'s adventurous spirit and interests in ${selectedInterests.slice(0, 2).join(' and ')} - age-perfect for ${partyData.childAge}-year-olds!`,
          colorPalette: ['#FF6347', '#4169E1', '#32CD32', '#FFD700'],
          decorations: ['Adventure trail markers', 'Challenge station setups', 'Victory celebration corner', 'Adventure gear displays'],
          activities: ['Adventure challenges', 'Team quests', 'Skill competitions', 'Victory celebrations'],
          printableIdeas: ['Adventure maps', 'Achievement certificates'],
          emoji: '🏕️',
          ageAppropriate: true,
          matchScore: 88,
          isCustom: true
        },
        {
          id: 'ai-dream-party',
          name: `${partyData.childName}'s Dream Come True Party`,
          description: 'A magical party where dreams come alive with personalized touches and special moments!',
          whyRecommended: `Created especially for ${partyData.childName} combining their favorite things: ${selectedInterests.join(', ')} - making this ${partyData.childAge}th birthday unforgettable!`,
          colorPalette: [primaryColor, '#E6E6FA', '#FFB6C1', '#F0E68C'],
          decorations: ['Dream cloud displays', 'Personalized memory corner', 'Wish fulfillment station', 'Special moments backdrop'],
          activities: ['Dream crafting', 'Wish making activities', 'Memory creation games', 'Special celebration moments'],
          printableIdeas: ['Dream journals', 'Wish cards'],
          emoji: '✨',
          ageAppropriate: true,
          matchScore: 93,
          isCustom: true
        }
      ];
      setAiThemes(fallbackThemes);
      // Save fallback themes to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('aiGeneratedThemes', JSON.stringify(fallbackThemes));
      }
      // Trigger confetti for fallback themes with immediate effect
      setTimeout(() => {
        try {
          triggerConfetti();
        } catch (confettiError) {
          console.warn('Confetti animation failed for fallback themes:', confettiError);
        }
      }, 50);
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
          {/* Search and Filter Controls */}
          <Card className="border-gray-200 dark:border-gray-700">
            <CardContent className="p-6">
              <div className="space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search themes by name, keywords, or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4"
                  />
                </div>

                {/* Filter Controls Row */}
                <div className="flex flex-wrap gap-4 items-center justify-between">
                  <div className="flex flex-wrap gap-4 items-center">
                    {/* Category Filter */}
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium whitespace-nowrap">Category:</Label>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {themeCategories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.emoji} {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Age Range Filter */}
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium whitespace-nowrap">Age Range:</Label>
                      <Select value={selectedAgeRange} onValueChange={setSelectedAgeRange}>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="All Ages" />
                        </SelectTrigger>
                        <SelectContent>
                          {ageRangeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Sort By */}
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium whitespace-nowrap">Sort by:</Label>
                      <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="popularity">Popularity</SelectItem>
                          <SelectItem value="name">Name A-Z</SelectItem>
                          <SelectItem value="category">Category</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                    >
                      <Grid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category Overview */}
          {selectedCategory === 'all' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Theme Categories</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {themeCategories.map((category) => {
                  const categoryThemeCount = classicThemes.filter(theme => theme.category === category.id).length;
                  return (
                    <Card
                      key={category.id}
                      className="cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg"
                      onClick={() => setSelectedCategory(category.id)}
                    >
                      <CardContent className="p-4 text-center">
                        <div className={`text-3xl mb-2 p-3 rounded-full bg-gradient-to-r ${category.color} text-white inline-block`}>
                          {category.emoji}
                        </div>
                        <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-1">
                          {category.name}
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {categoryThemeCount} themes
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Themes Display */}
          <div className="space-y-4">
            {/* Results Count */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {filteredThemes.length} of {classicThemes.length} themes
                {searchQuery && ` for "${searchQuery}"`}
                {selectedCategory !== 'all' && (
                  <> in {themeCategories.find(c => c.id === selectedCategory)?.name}</>
                )}
              </p>
              {(searchQuery || selectedCategory !== 'all' || selectedAgeRange !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setSelectedAgeRange('all');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Themes Grid/List */}
            {filteredThemes.length > 0 ? (
              <div className={cn(
                viewMode === 'grid' 
                  ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                  : "space-y-4"
              )}>
                {filteredThemes.map((theme) => (
                  viewMode === 'grid' ? (
                    <Card
                      key={theme.id}
                      className={cn(
                        "cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg relative group",
                        partyData.selectedTheme === theme.id
                          ? "ring-2 ring-purple-500 shadow-lg"
                          : "hover:shadow-md"
                      )}
                      onClick={() => handleThemeSelection(partyData.selectedTheme === theme.id ? null : theme.id)}
                    >
                      <div className={cn("absolute inset-0 rounded-lg opacity-20", theme.color)} />
                      <CardContent className="p-4 text-center relative">
                        <div className="text-3xl mb-2">{theme.emoji}</div>
                        <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-2 line-clamp-2">
                          {theme.name}
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                          {theme.description}
                        </p>
                        
                        {/* Action Buttons */}
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
                              Remove
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3 mr-1" />
                              Select
                            </>
                          )}
                        </Button>

                        {partyData.selectedTheme === theme.id && (
                          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                            <Star className="w-3 h-3 mr-1" />
                            Current
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
                  ) : (
                    <Card
                      key={theme.id}
                      className={cn(
                        "cursor-pointer transition-all duration-200 hover:shadow-lg relative",
                        partyData.selectedTheme === theme.id
                          ? "ring-2 ring-purple-500 shadow-lg"
                          : "hover:shadow-md"
                      )}
                      onClick={() => handleThemeSelection(partyData.selectedTheme === theme.id ? null : theme.id)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="text-4xl flex-shrink-0">{theme.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-1">
                                  {theme.name}
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                  {theme.description}
                                </p>
                                <div className="flex items-center gap-2 mb-3">
                                  <Badge variant="outline">
                                    Ages {theme.ageRange}
                                  </Badge>
                                  <div className="flex items-center gap-1">
                                    {Array.from({ length: theme.popularity }).map((_, i) => (
                                      <Star key={i} className="w-3 h-3 text-yellow-400 fill-current" />
                                    ))}
                                  </div>
                                </div>
                              </div>
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
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
                              <div>
                                <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Decorations</h5>
                                <ul className="text-gray-600 dark:text-gray-400 space-y-1">
                                  {theme.decorations.slice(0, 2).map((item, index) => (
                                    <li key={index}>• {item}</li>
                                  ))}
                                  {theme.decorations.length > 2 && (
                                    <li className="text-purple-600 dark:text-purple-400">+ {theme.decorations.length - 2} more...</li>
                                  )}
                                </ul>
                              </div>
                              <div>
                                <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Activities</h5>
                                <ul className="text-gray-600 dark:text-gray-400 space-y-1">
                                  {theme.activities.slice(0, 2).map((item, index) => (
                                    <li key={index}>• {item}</li>
                                  ))}
                                  {theme.activities.length > 2 && (
                                    <li className="text-purple-600 dark:text-purple-400">+ {theme.activities.length - 2} more...</li>
                                  )}
                                </ul>
                              </div>
                              <div>
                                <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Colors</h5>
                                <div className="flex gap-1 flex-wrap">
                                  {theme.colorPalette.slice(0, 4).map((color, index) => (
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
                            
                            <div className="flex items-center gap-2">
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
                                    Select Theme
                                  </>
                                )}
                              </Button>
                              
                              {partyData.selectedTheme === theme.id && (
                                <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                  <Star className="w-3 h-3 mr-1" />
                                  Current Theme
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-400 dark:text-gray-600 mb-4">
                  <Search className="h-12 w-12 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No themes found</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Try adjusting your search or filter criteria
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setSelectedAgeRange('all');
                  }}
                >
                  Clear All Filters
                </Button>
              </div>
            )}
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
                    onClick={() => handleThemeSelection(partyData.selectedTheme === theme.id ? null : theme.id)}
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

      {/* Theme Selection Splash Screen */}
      <ThemeSelectionSplash
        isOpen={showSplash}
        onClose={() => setShowSplash(false)}
        theme={splashTheme}
        childName={partyData.childName}
      />

      {/* Confetti Component - Enhanced Visibility */}
      <ReactCanvasConfetti
        onInit={getInstance}
        style={{
          position: 'fixed',
          pointerEvents: 'none',
          width: '100vw',
          height: '100vh',
          top: 0,
          left: 0,
          zIndex: 99999, // Extremely high z-index to ensure visibility
          backgroundColor: 'transparent'
        }}
      />
    </div>
  );
}