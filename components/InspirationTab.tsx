"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Filter,
  Star,
  Heart,
  ExternalLink,
  Sparkles,
  Palette,
  Utensils,
  Cake,
  PartyPopper,
  Home,
  Music,
  Scissors,
  Gift,
  Mail,
  Shirt,
  Camera,
  TrendingUp,
  Clock,
  Users,
  RefreshCw,
  BookmarkPlus,
  Bookmark
} from "lucide-react";

interface PartyData {
  id?: string;
  childName: string;
  childAge: string;
  partyDate: Date;
  selectedTheme: string;
  theme?: string;
  interests?: string[];
  favoriteColors?: string[];
  budget?: number;
  zipCode?: string;
  guestCount?: number;
  venue?: 'indoor' | 'outdoor' | 'mixed';
  duration?: string;
}

interface Inspiration {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  pinterestUrl: string;
  category?: string;
  aiMatchScore?: number;
  aiAnalysis?: string;
  pinCount?: number;
  boardFollowers?: number;
  isSaved?: boolean;
  viewCount?: number;
  createdAt?: string | Date;
}

interface MashupIdea {
  id: string;
  title: string;
  description: string;
  mashupSuggestion: string;
  confidence: number;
  sourceInspirations: string[];
}

interface InspirationTabProps {
  partyData: PartyData;
}

const categoryIcons: Record<string, any> = {
  GAMES: PartyPopper,
  FOOD: Utensils,
  CAKE: Cake,
  DECORATIONS: Palette,
  VENUE_STYLING: Home,
  ENTERTAINMENT: Music,
  ACTIVITIES: PartyPopper,
  CRAFTS: Scissors,
  FAVORS: Gift,
  INVITATIONS: Mail,
  OUTFITS: Shirt,
  PHOTOGRAPHY: Camera
};

const categoryColors: Record<string, string> = {
  GAMES: 'bg-orange-100 text-orange-800 border-orange-200',
  FOOD: 'bg-green-100 text-green-800 border-green-200',
  CAKE: 'bg-pink-100 text-pink-800 border-pink-200',
  DECORATIONS: 'bg-purple-100 text-purple-800 border-purple-200',
  VENUE_STYLING: 'bg-blue-100 text-blue-800 border-blue-200',
  ENTERTAINMENT: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  ACTIVITIES: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  CRAFTS: 'bg-teal-100 text-teal-800 border-teal-200',
  FAVORS: 'bg-rose-100 text-rose-800 border-rose-200',
  INVITATIONS: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  OUTFITS: 'bg-violet-100 text-violet-800 border-violet-200',
  PHOTOGRAPHY: 'bg-slate-100 text-slate-800 border-slate-200'
};

export default function InspirationTab({ partyData }: InspirationTabProps) {
  const [inspirations, setInspirations] = useState<Inspiration[]>([]);
  const [mashupIdeas, setMashupIdeas] = useState<MashupIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [mashupLoading, setMashupLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('best-match');
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [customSearchQuery, setCustomSearchQuery] = useState('');
  const [enhancedQuery, setEnhancedQuery] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isCustomSearch, setIsCustomSearch] = useState(false);

  // Fetch inspirations on component mount
  useEffect(() => {
    fetchInspirations();
  }, [partyData.id]);

  const fetchInspirations = async (query?: string) => {
    try {
      setLoading(true);
      setError(null);

      const partyId = partyData?.id || 'demo';
      const theme = partyData?.selectedTheme || partyData?.theme || 'princess';
      
      // Include theme parameter for demo mode and contextual data
      const url = query 
        ? `/api/pinterest-inspiration?partyId=${partyId}&query=${encodeURIComponent(query)}&theme=${encodeURIComponent(theme)}`
        : `/api/pinterest-inspiration?partyId=${partyId}&theme=${encodeURIComponent(theme)}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch inspirations');
      }

      const data = await response.json();
      setInspirations(data.inspirations || []);
      setIsDemo(data.isDemo || false);
      setIsCustomSearch(data.isCustomSearch || false);
      
    } catch (error) {
      console.error('Error fetching inspirations:', error);
      setError('Failed to load inspirations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const enhanceQueryWithAI = async (query: string) => {
    try {
      setIsEnhancing(true);
      
      const response = await fetch('/api/enhance-pinterest-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          partyTheme: partyData.selectedTheme || partyData.theme,
          childAge: partyData.childAge
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to enhance query');
      }

      const data = await response.json();
      setEnhancedQuery(data.enhancedQuery);
      return data.enhancedQuery;
      
    } catch (error) {
      console.error('Error enhancing query:', error);
      // Fallback to original query if enhancement fails
      return query;
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleCustomSearch = async () => {
    if (!customSearchQuery.trim()) return;
    
    try {
      // First enhance the query with AI
      const enhanced = await enhanceQueryWithAI(customSearchQuery);
      
      // Then search Pinterest with the enhanced query
      await fetchInspirations(enhanced);
      
    } catch (error) {
      console.error('Custom search failed:', error);
      setError('Search failed. Please try again.');
    }
  };

  const resetToDefaultInspirations = () => {
    setCustomSearchQuery('');
    setEnhancedQuery('');
    setIsCustomSearch(false);
    fetchInspirations(); // Fetch default inspirations
  };

  const generateMashupIdeas = async () => {
    try {
      setMashupLoading(true);
      
      const partyId = partyData?.id || 'demo';
      const response = await fetch('/api/ai-expand-inspiration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partyId,
          inspirations: inspirations.slice(0, 6), // Use top 6 inspirations
          partyTheme: partyData.selectedTheme || partyData.theme,
          action: 'generate-mashups'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate mashup ideas');
      }

      const data = await response.json();
      setMashupIdeas(data.mashupIdeas || []);
      
    } catch (error) {
      console.error('Error generating mashup ideas:', error);
      // Fallback to mock mashup ideas on error
      setMashupIdeas([]);
    } finally {
      setMashupLoading(false);
    }
  };

  const toggleSaveInspiration = async (inspiration: Inspiration) => {
    try {
      const partyId = partyData?.id || 'demo';
      const response = await fetch('/api/pinterest-inspiration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partyId,
          inspirationId: inspiration.id,
          action: inspiration.isSaved ? 'unsave' : 'save'
        }),
      });

      if (response.ok) {
        setInspirations(prev => 
          prev.map(insp => 
            insp.id === inspiration.id 
              ? { ...insp, isSaved: !insp.isSaved }
              : insp
          )
        );
      }
    } catch (error) {
      console.error('Error saving inspiration:', error);
    }
  };

  // Filter and sort inspirations
  const filteredInspirations = inspirations
    .filter(inspiration => {
      const matchesSearch = inspiration.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (inspiration.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || inspiration.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'best-match':
          return (b.aiMatchScore || 0) - (a.aiMatchScore || 0);
        case 'newest':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case 'most-pinned':
          return (b.pinCount || 0) - (a.pinCount || 0);
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-48 w-full" />
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Pinterest Inspiration
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Discover creative ideas for your {partyData.selectedTheme || partyData.theme} party
          </p>
        </div>
        <Button 
          onClick={generateMashupIdeas}
          disabled={mashupLoading || inspirations.length === 0}
          className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {mashupLoading ? 'Generating...' : 'Get AI Mashups'}
        </Button>
      </div>

      {/* Custom Search Section */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-700">
        <CardHeader>
          <CardTitle className="text-lg text-blue-900 dark:text-blue-100 flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI-Enhanced Pinterest Search
          </CardTitle>
          <CardDescription className="text-blue-700 dark:text-blue-300">
            Enter your own keywords and let AI enhance them for better Pinterest results
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="e.g., Cinderella birthday decor"
                value={customSearchQuery}
                onChange={(e) => setCustomSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCustomSearch()}
                className="border-blue-200 focus:border-blue-400"
              />
            </div>
            <Button 
              onClick={handleCustomSearch}
              disabled={!customSearchQuery.trim() || isEnhancing || loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isEnhancing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Enhancing...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>
          
          {enhancedQuery && (
            <div className="p-3 bg-white/70 dark:bg-gray-800/70 rounded-lg border border-blue-200 dark:border-blue-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">AI Enhanced Query:</p>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">"{enhancedQuery}"</p>
            </div>
          )}
          
          {isCustomSearch && (
            <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
              <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                <Search className="h-4 w-4" />
                <span className="text-sm font-medium">Showing custom search results</span>
              </div>
              <Button
                onClick={resetToDefaultInspirations}
                variant="outline"
                size="sm"
                className="border-yellow-300 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-600 dark:text-yellow-200"
              >
                Reset to Default
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isDemo && (
        <Alert>
          <AlertDescription>
            You're viewing demo Pinterest boards. Create an account to save your favorite inspirations!
          </AlertDescription>
        </Alert>
      )}

      {/* AI Mashup Ideas Section */}
      {mashupIdeas.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              AI Mashup Ideas
            </h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {mashupIdeas.map((mashup) => (
              <Card key={mashup.id} className="border-purple-200 bg-purple-50/50 dark:bg-purple-900/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-purple-900 dark:text-purple-100">
                      {mashup.title}
                    </CardTitle>
                    <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                      {mashup.confidence}% match
                    </Badge>
                  </div>
                  <CardDescription className="text-purple-700 dark:text-purple-300">
                    {mashup.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                    {mashup.mashupSuggestion}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400">
                    <Users className="h-3 w-3" />
                    Combines {mashup.sourceInspirations.length} inspirations
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Separator />
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search inspirations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="DECORATIONS">Decorations</SelectItem>
            <SelectItem value="FOOD">Food</SelectItem>
            <SelectItem value="CAKE">Cake</SelectItem>
            <SelectItem value="GAMES">Games</SelectItem>
            <SelectItem value="ACTIVITIES">Activities</SelectItem>
            <SelectItem value="CRAFTS">Crafts</SelectItem>
            <SelectItem value="FAVORS">Favors</SelectItem>
            <SelectItem value="PHOTOGRAPHY">Photography</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-48">
            <TrendingUp className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="best-match">Best Match</SelectItem>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="most-pinned">Most Pinned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Inspirations Grid */}
      {filteredInspirations.length === 0 ? (
        <div className="text-center py-12">
          <Palette className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No inspirations found
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Try adjusting your search or filters to find more ideas.
          </p>
          <Button onClick={() => fetchInspirations()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredInspirations.map((inspiration) => {
            const CategoryIcon = categoryIcons[inspiration.category || 'DECORATIONS'] || Palette;
            const categoryStyle = categoryColors[inspiration.category || 'DECORATIONS'] || categoryColors.DECORATIONS;
            
            return (
              <Card key={inspiration.id} className="overflow-hidden hover:shadow-lg transition-shadow group">
                <div className="relative">
                  <img
                    src={inspiration.imageUrl}
                    alt={inspiration.title}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute top-2 right-2 flex gap-2">
                    {inspiration.aiMatchScore && (
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        <Star className="h-3 w-3 mr-1" />
                        {inspiration.aiMatchScore}%
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 w-8 p-0 bg-white/90 hover:bg-white"
                      onClick={() => toggleSaveInspiration(inspiration)}
                    >
                      {inspiration.isSaved ? (
                        <Bookmark className="h-4 w-4 text-purple-600" />
                      ) : (
                        <BookmarkPlus className="h-4 w-4 text-gray-600" />
                      )}
                    </Button>
                  </div>
                  {inspiration.category && (
                    <div className="absolute bottom-2 left-2">
                      <Badge className={`${categoryStyle} flex items-center gap-1`}>
                        <CategoryIcon className="h-3 w-3" />
                        {inspiration.category}
                      </Badge>
                    </div>
                  )}
                </div>
                
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg line-clamp-2 group-hover:text-purple-600 transition-colors">
                    {inspiration.title}
                  </CardTitle>
                  {inspiration.description && (
                    <CardDescription className="line-clamp-2 text-sm">
                      {inspiration.description}
                    </CardDescription>
                  )}
                </CardHeader>
                
                <CardContent className="pt-0">
                  {inspiration.aiAnalysis && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                      💡 {inspiration.aiAnalysis}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {inspiration.pinCount && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {inspiration.pinCount} pins
                        </span>
                      )}
                      {inspiration.boardFollowers && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {inspiration.boardFollowers}
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(inspiration.pinterestUrl, '_blank')}
                      className="flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View on Pinterest
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}