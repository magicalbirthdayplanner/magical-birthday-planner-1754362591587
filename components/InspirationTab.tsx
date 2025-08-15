"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  Shuffle, 
  Heart, 
  ExternalLink, 
  Sparkles, 
  Filter, 
  RefreshCw,
  Cake,
  Palette,
  Gamepad2,
  Mail,
  Shirt,
  PartyPopper,
  Wand2,
  Timer,
  Star
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PartyData {
  id?: string;
  childName?: string;
  childAge?: string | number;
  theme?: string;
  interests?: string[];
  favoriteColors?: string[];
  [key: string]: any;
}

interface InspirationCategory {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  gradient: string;
  description: string;
}

interface PinterestPin {
  id: string;
  title: string;
  imageUrl: string;
  pinterestUrl: string;
  description?: string;
  category: string;
  keywords: string[];
  isSaved: boolean;
  aiExpanded?: string;
  aiMatchScore?: number;
  aiCategoryTag?: string;
  relevanceReason?: string;
}

interface AIMashupIdea {
  id: string;
  title: string;
  description: string;
  combinedElements: string[];
  inspiration: string[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
  estimatedTime: string;
  materials: string[];
}

interface InspirationTabProps {
  partyData: PartyData;
}

const INSPIRATION_CATEGORIES: InspirationCategory[] = [
  {
    id: 'GENERAL',
    name: 'All Ideas',
    icon: PartyPopper,
    gradient: 'from-purple-500 to-pink-500',
    description: 'General party inspiration'
  },
  {
    id: 'DECORATIONS',
    name: 'Decorations',
    icon: Palette,
    gradient: 'from-pink-500 to-rose-500',
    description: 'Party decorations and setup'
  },
  {
    id: 'CAKE',
    name: 'Cakes',
    icon: Cake,
    gradient: 'from-yellow-500 to-orange-500',
    description: 'Birthday cakes and desserts'
  },
  {
    id: 'GAMES',
    name: 'Games',
    icon: Gamepad2,
    gradient: 'from-green-500 to-emerald-500',
    description: 'Party games and activities'
  },
  {
    id: 'INVITATIONS',
    name: 'Invitations',
    icon: Mail,
    gradient: 'from-blue-500 to-cyan-500',
    description: 'Invitation designs'
  },
  {
    id: 'COSTUMES',
    name: 'Costumes',
    icon: Shirt,
    gradient: 'from-indigo-500 to-purple-500',
    description: 'Costume and outfit ideas'
  }
];

export default function InspirationTab({ partyData }: InspirationTabProps) {
  const [inspirations, setInspirations] = useState<PinterestPin[]>([]);
  const [filteredInspirations, setFilteredInspirations] = useState<PinterestPin[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('GENERAL');
  const [searchKeywords, setSearchKeywords] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [expandingId, setExpandingId] = useState<string | null>(null);
  const [expandedInspirations, setExpandedInspirations] = useState<Record<string, string>>({});
  const [aiMashups, setAiMashups] = useState<AIMashupIdea[]>([]);
  const [sortBy, setSortBy] = useState<'best-match' | 'newest' | 'most-pinned'>('best-match');
  const [mashupLoading, setMashupLoading] = useState(false);
  const { toast } = useToast();

  // Generate search query from party data
  const generateSearchQuery = useCallback(() => {
    const keywords: string[] = [];
    
    // Add theme
    if (partyData?.theme) {
      keywords.push(partyData.theme);
    }
    
    // Add age-appropriate terms
    if (partyData?.childAge) {
      keywords.push(`${partyData.childAge} year old birthday`);
    }
    
    // Add interests
    if (partyData?.interests && partyData.interests.length > 0) {
      keywords.push(...partyData.interests.slice(0, 2)); // Take first 2 interests
    }
    
    // Add favorite colors
    if (partyData?.favoriteColors && partyData.favoriteColors.length > 0) {
      keywords.push(...partyData.favoriteColors.slice(0, 1)); // Take first color
    }
    
    // Add category-specific terms
    const category = INSPIRATION_CATEGORIES.find(c => c.id === selectedCategory);
    if (category && category.id !== 'GENERAL') {
      keywords.push(category.name.toLowerCase());
    }
    
    // Add base party terms
    keywords.push('party', 'birthday');
    
    return keywords.join(' ');
  }, [partyData, selectedCategory]);

  // Fetch inspirations from API
  const fetchInspirations = async (isNewSearch = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const query = generateSearchQuery();
      const currentPage = isNewSearch ? 1 : page;
      
      const response = await fetch(
        `/api/pinterest-inspiration?query=${encodeURIComponent(query)}&category=${selectedCategory}&limit=20&partyId=${partyData?.id || 'demo'}&page=${currentPage}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch inspirations');
      }
      
      const data = await response.json();
      
      if (isNewSearch) {
        setInspirations(data.inspirations);
        setPage(2);
        // Set AI mashups if returned
        if (data.aiMashups) {
          setAiMashups(data.aiMashups);
        }
      } else {
        setInspirations(prev => [...prev, ...data.inspirations]);
        setPage(prev => prev + 1);
      }
      
      setHasMore(data.inspirations.length === 20);
      
    } catch (error) {
      console.error('Error fetching inspirations:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch inspiration images. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle saving/unsaving pins
  const handleSavePin = async (inspirationId: string, currentSaveState: boolean) => {
    try {
      const response = await fetch('/api/pinterest-inspiration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inspirationId,
          action: currentSaveState ? 'unsave' : 'save'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save inspiration');
      }

      // Update local state
      setInspirations(prev => 
        prev.map(pin => 
          pin.id === inspirationId 
            ? { ...pin, isSaved: !currentSaveState }
            : pin
        )
      );

      toast({
        title: currentSaveState ? "Removed from My Inspiration" : "Saved to My Inspiration",
        description: currentSaveState ? "Pin removed successfully" : "Pin saved for later reference"
      });

    } catch (error) {
      console.error('Error saving pin:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save pin. Please try again."
      });
    }
  };

  // Handle AI expansion
  const handleAIExpand = async (pin: PinterestPin) => {
    if (expandedInspirations[pin.id]) {
      // Already expanded, show the existing expansion
      toast({
        title: "AI Recreation Guide",
        description: "Detailed instructions are already available for this pin."
      });
      return;
    }

    setExpandingId(pin.id);
    
    try {
      const response = await fetch('/api/ai-expand-inspiration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inspirationId: pin.id,
          imageUrl: pin.imageUrl,
          title: pin.title,
          description: pin.description,
          partyTheme: partyData?.theme || 'party',
          childAge: typeof partyData?.childAge === 'string' ? parseInt(partyData.childAge) || 5 : partyData?.childAge || 5
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate AI expansion');
      }

      const data = await response.json();
      
      // Store the AI expansion
      setExpandedInspirations(prev => ({
        ...prev,
        [pin.id]: data.aiExpansion
      }));

      // Update the inspiration with AI expanded data
      setInspirations(prev => 
        prev.map(p => 
          p.id === pin.id 
            ? { ...p, aiExpanded: data.aiExpansion }
            : p
        )
      );

      toast({
        title: "AI Recreation Guide Generated!",
        description: data.cached ? "Using previously generated guide" : "New detailed instructions created"
      });

    } catch (error) {
      console.error('Error generating AI expansion:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate recreation guide. Please try again."
      });
    } finally {
      setExpandingId(null);
    }
  };

  // Generate new search with shuffled keywords
  const handleShuffleIdeas = () => {
    const synonyms = {
      'princess': ['fairy tale', 'royal', 'magical'],
      'superhero': ['hero', 'comic', 'action'],
      'dinosaur': ['prehistoric', 'jurassic', 'ancient'],
      'space': ['galaxy', 'astronaut', 'cosmic'],
      'safari': ['jungle', 'adventure', 'wild'],
      'ocean': ['underwater', 'sea', 'marine'],
      'pirate': ['treasure', 'adventure', 'nautical'],
      'unicorn': ['magical', 'rainbow', 'fantasy']
    };
    
    // Add some variety to the search
    const theme = partyData.theme?.toLowerCase();
    if (theme && synonyms[theme as keyof typeof synonyms]) {
      const randomSynonym = synonyms[theme as keyof typeof synonyms][Math.floor(Math.random() * synonyms[theme as keyof typeof synonyms].length)];
      // You could modify the search query here or just refetch
    }
    
    fetchInspirations(true);
  };

  // Generate more AI mashups
  const handleGetMoreMashups = async () => {
    if (mashupLoading || inspirations.length === 0) return;
    
    setMashupLoading(true);
    try {
      // Use the current top inspirations to generate new mashups
      const response = await fetch('/api/pinterest-inspiration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generate_mashups',
          topPins: inspirations.slice(0, 10),
          partyData: partyData
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.aiMashups) {
          setAiMashups(data.aiMashups);
        }
      }
    } catch (error) {
      console.error('Error generating new mashups:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate new mashup ideas. Please try again."
      });
    } finally {
      setMashupLoading(false);
    }
  };

  // Filter and sort inspirations based on category, saved status, and sort option
  useEffect(() => {
    let filtered = inspirations;
    
    if (showSavedOnly) {
      filtered = filtered.filter(pin => pin.isSaved);
    }
    
    if (searchKeywords.trim()) {
      const keywords = searchKeywords.toLowerCase().trim().split(' ');
      filtered = filtered.filter(pin => 
        keywords.some(keyword => 
          pin.title.toLowerCase().includes(keyword) ||
          pin.description?.toLowerCase().includes(keyword) ||
          pin.keywords.some(k => k.toLowerCase().includes(keyword))
        )
      );
    }
    
    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'best-match':
          return (b.aiMatchScore || 0) - (a.aiMatchScore || 0);
        case 'newest':
          // Assuming we have a createdAt field or use array order as proxy
          return filtered.indexOf(b) - filtered.indexOf(a);
        case 'most-pinned':
          // This would require actual Pinterest stats, using random for demo
          return Math.random() - 0.5;
        default:
          return 0;
      }
    });
    
    setFilteredInspirations(sorted);
  }, [inspirations, selectedCategory, showSavedOnly, searchKeywords, sortBy]);

  // Initial load
  useEffect(() => {
    if (partyData?.id) {
      fetchInspirations(true);
    }
  }, [partyData?.id, selectedCategory]);

  const LoadingSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              🎨 Pinterest Inspiration
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Discover amazing ideas for your {partyData?.theme || 'birthday'} party
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleShuffleIdeas}
              variant="outline"
              size="sm"
              disabled={loading}
            >
              <Shuffle className="h-4 w-4 mr-2" />
              Shuffle Ideas
            </Button>
            <Button
              onClick={() => setShowSavedOnly(!showSavedOnly)}
              variant={showSavedOnly ? "default" : "outline"}
              size="sm"
            >
              <Heart className={`h-4 w-4 mr-2 ${showSavedOnly ? 'fill-current' : ''}`} />
              My Inspiration ({inspirations.filter(p => p.isSaved).length})
            </Button>
          </div>
        </div>

        {/* Search and Keywords */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Add keywords to personalize results..."
              value={searchKeywords}
              onChange={(e) => setSearchKeywords(e.target.value)}
              className="pl-10"
              maxLength={100}
            />
          </div>
          <Button
            onClick={() => fetchInspirations(true)}
            disabled={loading}
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Search
          </Button>
        </div>
      </div>

      {/* Category Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <h3 className="font-medium text-gray-700 dark:text-gray-300">Filter by Category</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {INSPIRATION_CATEGORIES.map((category) => {
            const Icon = category.icon;
            const isSelected = selectedCategory === category.id;
            
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`relative p-4 rounded-xl border-2 transition-all duration-200 group ${
                  isSelected 
                    ? 'border-purple-300 bg-gradient-to-br ' + category.gradient + ' text-white shadow-lg' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-200 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                }`}
              >
                <div className="flex flex-col items-center text-center space-y-2">
                  <Icon className={`h-6 w-6 ${isSelected ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                  <div>
                    <div className={`font-medium text-sm ${isSelected ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                      {category.name}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* AI Mashup Ideas Section */}
      {aiMashups.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-purple-600" />
                AI Mashup Ideas
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Creative combinations of your top inspirations
              </p>
            </div>
            <Button
              onClick={handleGetMoreMashups}
              disabled={mashupLoading}
              variant="outline"
              size="sm"
            >
              {mashupLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Get More Ideas
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aiMashups.map((mashup) => (
              <Card key={mashup.id} className="overflow-hidden border-purple-200 dark:border-purple-700 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold text-gray-900 dark:text-white text-lg">
                        {mashup.title}
                      </h4>
                      <Badge 
                        variant={
                          mashup.difficulty === 'Easy' ? 'secondary' : 
                          mashup.difficulty === 'Medium' ? 'default' : 
                          'destructive'
                        }
                        className="text-xs"
                      >
                        {mashup.difficulty}
                      </Badge>
                    </div>
                    
                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                      {mashup.description}
                    </p>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Timer className="h-3 w-3" />
                        {mashup.estimatedTime}
                      </div>
                      
                      <div>
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Key Elements:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {mashup.combinedElements.slice(0, 3).map((element, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {element}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Inspired by:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {mashup.inspiration.slice(0, 2).map((source, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {source}
                            </Badge>
                          ))}
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

      {/* Results */}
      <div className="space-y-4">
        {loading && inspirations.length === 0 ? (
          <LoadingSkeleton />
        ) : filteredInspirations.length === 0 ? (
          <div className="text-center py-12">
            <PartyPopper className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {showSavedOnly ? 'No saved inspirations yet' : 'No inspirations found'}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {showSavedOnly 
                ? 'Start exploring and save pins you love!' 
                : 'Try adjusting your search terms or category filter.'
              }
            </p>
            {showSavedOnly && (
              <Button onClick={() => setShowSavedOnly(false)} variant="outline">
                <Search className="h-4 w-4 mr-2" />
                Browse All Inspirations
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Results count and sorting */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {filteredInspirations.length} inspiration{filteredInspirations.length !== 1 ? 's' : ''} found
                {showSavedOnly && ' in your collection'}
              </p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'best-match' | 'newest' | 'most-pinned')}
                    className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800"
                  >
                    <option value="best-match">Best Match</option>
                    <option value="newest">Newest First</option>
                    <option value="most-pinned">Most Pinned</option>
                  </select>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {selectedCategory.replace('_', ' ')}
                </Badge>
              </div>
            </div>

            {/* Pinterest Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredInspirations.map((pin) => (
                <Card key={pin.id} className="group overflow-hidden hover:shadow-lg transition-all duration-200 border-gray-200 dark:border-gray-700">
                  <div className="relative">
                    <div className="aspect-[3/4] relative overflow-hidden bg-gray-100 dark:bg-gray-800">
                      <img
                        src={pin.imageUrl}
                        alt={pin.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = `https://images.unsplash.com/400x600/?party,${partyData?.theme || 'birthday'}&sig=${pin.id}`;
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200" />
                      
                      {/* Action buttons */}
                      <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Button
                          size="sm"
                          variant={pin.isSaved ? "default" : "secondary"}
                          className="h-8 w-8 p-0"
                          onClick={() => handleSavePin(pin.id, pin.isSaved)}
                        >
                          <Heart className={`h-4 w-4 ${pin.isSaved ? 'fill-current' : ''}`} />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 w-8 p-0"
                          onClick={() => handleAIExpand(pin)}
                          disabled={expandingId === pin.id}
                        >
                          {expandingId === pin.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Wand2 className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 w-8 p-0"
                          onClick={() => window.open(pin.pinterestUrl, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Status indicators */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        {pin.isSaved && (
                          <Badge className="bg-red-500 text-white">
                            <Heart className="h-3 w-3 mr-1 fill-current" />
                            Saved
                          </Badge>
                        )}
                        {(pin.aiExpanded || expandedInspirations[pin.id]) && (
                          <Badge className="bg-purple-500 text-white">
                            <Wand2 className="h-3 w-3 mr-1" />
                            AI Guide
                          </Badge>
                        )}
                        {pin.aiMatchScore && pin.aiMatchScore > 80 && (
                          <Badge className="bg-green-500 text-white">
                            <Star className="h-3 w-3 mr-1 fill-current" />
                            {pin.aiMatchScore}%
                          </Badge>
                        )}
                        {pin.aiCategoryTag && (
                          <Badge className="bg-blue-500 text-white text-xs">
                            {pin.aiCategoryTag}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <CardContent className="p-3">
                      <h3 className="font-medium text-sm text-gray-900 dark:text-white line-clamp-2 mb-1">
                        {pin.title}
                      </h3>
                      {pin.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                          {pin.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {pin.keywords.slice(0, 3).map((keyword, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>

            {/* Load More */}
            {hasMore && filteredInspirations.length > 0 && !showSavedOnly && (
              <div className="text-center pt-6">
                <Button
                  onClick={() => fetchInspirations(false)}
                  disabled={loading}
                  variant="outline"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Loading More...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Load More Inspiration
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}