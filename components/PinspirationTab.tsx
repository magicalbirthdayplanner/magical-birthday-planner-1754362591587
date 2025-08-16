"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Sparkles, ExternalLink, Heart, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PinterestPin {
  id: string;
  title: string;
  image_url?: string;
  url?: string;
  category?: string;
  description?: string;
}

interface PinspirationTabProps {
  partyData: {
    selectedTheme?: string;
    theme?: string;
    interests?: string[];
    favoriteColors?: string[];
    childAge?: string;
    venue?: string;
    guestCount?: number;
  };
}

const FILTER_CATEGORIES = [
  { id: 'all', label: 'All Ideas', color: 'bg-purple-100 text-purple-800 hover:bg-purple-200' },
  { id: 'decorations', label: 'Decorations', color: 'bg-blue-100 text-blue-800 hover:bg-blue-200' },
  { id: 'cakes', label: 'Cakes', color: 'bg-pink-100 text-pink-800 hover:bg-pink-200' },
  { id: 'games', label: 'Games', color: 'bg-green-100 text-green-800 hover:bg-green-200' },
  { id: 'invitations', label: 'Invitations', color: 'bg-orange-100 text-orange-800 hover:bg-orange-200' },
  { id: 'costumes', label: 'Costumes', color: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200' },
];

export default function PinspirationTab({ partyData }: PinspirationTabProps) {
  const [pins, setPins] = useState<PinterestPin[]>([]);
  const [filteredPins, setFilteredPins] = useState<PinterestPin[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [baseQuery, setBaseQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Generate base query from wizard data
  useEffect(() => {
    if (partyData) {
      const generateBaseQuery = () => {
        const theme = partyData.selectedTheme || partyData.theme || '';
        const age = partyData.childAge || '';
        const venue = partyData.venue || '';
        const interests = partyData.interests || [];
        const colors = partyData.favoriteColors || [];

        let query = `${theme} birthday party`;
        
        if (age) query += ` for ${age} year old`;
        if (venue) query += ` ${venue}`;
        if (interests.length > 0) query += ` ${interests.slice(0, 2).join(' ')}`;
        if (colors.length > 0) query += ` ${colors.slice(0, 2).join(' ')} colors`;

        return query.trim();
      };

      const generatedQuery = generateBaseQuery();
      setBaseQuery(generatedQuery);
      
      // Load initial inspiration based on wizard data
      if (generatedQuery) {
        loadPinterestInspiration(generatedQuery);
      }
    }
  }, [partyData]);

  // Filter pins by category
  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredPins(pins);
    } else {
      const filtered = pins.filter(pin => {
        const category = pin.category?.toLowerCase() || '';
        const title = pin.title?.toLowerCase() || '';
        const description = pin.description?.toLowerCase() || '';
        
        switch (selectedCategory) {
          case 'decorations':
            return category.includes('decoration') || title.includes('decor') || 
                   title.includes('balloon') || title.includes('banner');
          case 'cakes':
            return category.includes('cake') || category.includes('food') || 
                   title.includes('cake') || title.includes('dessert');
          case 'games':
            return category.includes('game') || category.includes('activity') || 
                   title.includes('game') || title.includes('activity');
          case 'invitations':
            return category.includes('invitation') || title.includes('invitation') || 
                   title.includes('invite');
          case 'costumes':
            return category.includes('costume') || title.includes('costume') || 
                   title.includes('outfit');
          default:
            return true;
        }
      });
      setFilteredPins(filtered);
    }
  }, [pins, selectedCategory]);

  const loadPinterestInspiration = async (query: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/pinterest/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query,
          theme: partyData.selectedTheme || partyData.theme 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Pinterest inspiration');
      }

      const data = await response.json();
      setPins(data.results || []);
    } catch (error) {
      console.error('Error loading Pinterest inspiration:', error);
      setError('Unable to load Pinterest inspiration. Please try again.');
      // Load demo data as fallback
      loadDemoData();
    } finally {
      setLoading(false);
    }
  };

  const loadDemoData = () => {
    const theme = partyData.selectedTheme || partyData.theme || 'princess';
    
    const demoData: PinterestPin[] = [
      {
        id: '1',
        title: `${theme.charAt(0).toUpperCase() + theme.slice(1)} Party Decorations`,
        image_url: `https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400`,
        category: 'decorations',
        description: `Beautiful ${theme} themed party decorations`
      },
      {
        id: '2',
        title: `${theme.charAt(0).toUpperCase() + theme.slice(1)} Birthday Cake Ideas`,
        image_url: `https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=400`,
        category: 'cake',
        description: `Amazing ${theme} birthday cake designs`
      },
      {
        id: '3',
        title: `${theme.charAt(0).toUpperCase() + theme.slice(1)} Party Games`,
        image_url: `https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400`,
        category: 'games',
        description: `Fun ${theme} themed party games and activities`
      }
    ];
    
    setPins(demoData);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    const enhancedQuery = baseQuery ? `${baseQuery} ${searchQuery}` : searchQuery;
    await loadPinterestInspiration(enhancedQuery);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-purple-600" />
          Pinterest Inspiration
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          AI-enhanced Pinterest board and pin search using your party details
        </p>
      </div>

      {/* Search Section */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Search for More Ideas</CardTitle>
          <CardDescription>
            {baseQuery && (
              <span className="text-sm text-purple-600 dark:text-purple-400">
                Based on your party: "{baseQuery}"
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Add keywords to personalize results..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button 
              onClick={handleSearch} 
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filter by Category */}
      <div className="space-y-3">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100">Filter by Category</h4>
        <div className="flex flex-wrap gap-2">
          {FILTER_CATEGORIES.map((category) => (
            <Badge
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "secondary"}
              className={`cursor-pointer transition-all duration-200 px-3 py-1 ${
                selectedCategory === category.id 
                  ? 'bg-purple-600 text-white' 
                  : category.color
              }`}
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
          <AlertDescription className="text-red-700 dark:text-red-400">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-600" />
            <p className="text-gray-600 dark:text-gray-400">
              Finding inspiration for your party...
            </p>
          </div>
        </div>
      )}

      {/* Results Grid */}
      {!loading && filteredPins.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPins.map((pin) => (
            <Card 
              key={pin.id} 
              className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-0 shadow-lg overflow-hidden"
            >
              <div className="relative">
                <img
                  src={pin.image_url || 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400'}
                  alt={pin.title}
                  className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="secondary" className="h-8 w-8 p-0">
                    <Heart className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 line-clamp-2">
                  {pin.title}
                </h4>
                {pin.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                    {pin.description}
                  </p>
                )}
                {pin.category && (
                  <Badge variant="outline" className="text-xs mb-2">
                    {pin.category}
                  </Badge>
                )}
                {pin.url && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-2"
                    onClick={() => window.open(pin.url, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-2" />
                    View on Pinterest
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredPins.length === 0 && (
        <div className="text-center py-12 space-y-4">
          <div className="relative">
            <Sparkles className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <Sparkles className="h-4 w-4 absolute top-0 left-1/2 transform -translate-x-8 -translate-y-2 text-purple-400" />
            <Sparkles className="h-3 w-3 absolute top-2 right-1/2 transform translate-x-10 -translate-y-1 text-pink-400" />
            <Sparkles className="h-5 w-5 absolute bottom-2 left-1/2 transform -translate-x-12 translate-y-2 text-blue-400" />
          </div>
          <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            No inspiration found
          </h4>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Try adjusting your search terms or category filter to discover amazing party ideas.
          </p>
          <Button 
            onClick={() => loadPinterestInspiration(baseQuery)} 
            variant="outline"
            className="mt-4"
          >
            <Search className="h-4 w-4 mr-2" />
            Search Again
          </Button>
        </div>
      )}
    </div>
  );
}