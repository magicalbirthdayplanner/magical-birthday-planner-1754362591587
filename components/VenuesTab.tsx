"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  MapPin, 
  Search, 
  Star, 
  Phone, 
  ExternalLink,
  Loader2,
  Bookmark,
  BookmarkCheck,
  AlertTriangle,
  PartyPopper
} from "lucide-react";

interface Venue {
  id: string;
  title: string;
  address: string;
  rating: number;
  reviewsCount: number;
  price?: string;
  phone?: string;
  website?: string;
  imageUrl?: string;
  coordinates?: { lat: number; lng: number };
  category?: string;
  isFavorite?: boolean;
}

interface VenuesTabProps {
  partyData?: {
    zipCode?: string;
    theme?: string | null;
    selectedTheme?: string | null;
  };
}

export default function VenuesTab({ partyData }: VenuesTabProps) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  
  // Search controls
  const [location, setLocation] = useState(partyData?.zipCode || "");
  const [radius, setRadius] = useState("10");
  const [keyword, setKeyword] = useState("party hall");

  // Load favorites from localStorage on mount
  useEffect(() => {
    const savedFavorites = localStorage.getItem('venueFavorites');
    if (savedFavorites) {
      try {
        const favoritesArray = JSON.parse(savedFavorites);
        setFavorites(new Set(favoritesArray));
      } catch (error) {
        console.error('Error loading favorites:', error);
      }
    }
  }, []);

  // Save favorites to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('venueFavorites', JSON.stringify(Array.from(favorites)));
  }, [favorites]);

  // Set default keyword based on theme
  useEffect(() => {
    if (partyData?.theme || partyData?.selectedTheme) {
      const theme = partyData.theme || partyData.selectedTheme;
      if (theme) {
        setKeyword(`${theme.toLowerCase()} birthday venue`);
      }
    }
  }, [partyData?.theme, partyData?.selectedTheme]);

  const searchVenues = async (isNewSearch = false) => {
    if (!location.trim()) {
      setError("Please enter a location");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const searchTerms = [keyword, "kids birthday venue"];
      const radiusKm = Math.round(parseInt(radius) * 1.609); // Convert miles to km

      const response = await fetch('/api/venues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location: location.trim(),
          searchTerms,
          radiusKm,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch venues');
      }

      const data = await response.json();
      
      if (data.success && data.venues) {
        const venuesWithFavorites = data.venues.map((venue: any) => ({
          ...venue,
          isFavorite: favorites.has(venue.id)
        }));

        if (isNewSearch) {
          setVenues(venuesWithFavorites);
          setPage(1);
        } else {
          setVenues(prev => [...prev, ...venuesWithFavorites]);
        }

        // Cache venue data for FavoritesTab
        try {
          const existingCache = localStorage.getItem('cachedVenues');
          const cachedVenues = existingCache ? JSON.parse(existingCache) : [];
          const updatedCache = [...cachedVenues];
          
          // Add new venues to cache if they don't exist
          venuesWithFavorites.forEach((venue: Venue) => {
            const existingIndex = updatedCache.findIndex((cached: Venue) => cached.id === venue.id);
            if (existingIndex === -1) {
              updatedCache.push(venue);
            } else {
              updatedCache[existingIndex] = venue; // Update existing
            }
          });
          
          localStorage.setItem('cachedVenues', JSON.stringify(updatedCache));
        } catch (error) {
          console.error('Error caching venue data:', error);
        }

        // For demo purposes, assume we have more if we got venues
        setHasMore(data.venues.length >= 12);
      } else {
        setVenues([]);
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error searching venues:', error);
      setError(error instanceof Error ? error.message : 'Failed to load venues');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    searchVenues(true);
  };

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
      searchVenues(false);
    }
  }, [loading, hasMore]);

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 1000
      ) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore]);

  const toggleFavorite = (venueId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(venueId)) {
        newFavorites.delete(venueId);
      } else {
        newFavorites.add(venueId);
      }
      return newFavorites;
    });

    // Update venues list to reflect favorite status
    setVenues(prev => prev.map(venue => 
      venue.id === venueId 
        ? { ...venue, isFavorite: !venue.isFavorite }
        : venue
    ));
  };

  const formatAddress = (address: string) => {
    // Shorten address to show city + ZIP
    const parts = address.split(',');
    if (parts.length >= 2) {
      const lastTwo = parts.slice(-2).join(',').trim();
      return lastTwo;
    }
    return address;
  };

  // Load initial venues if location is provided
  useEffect(() => {
    if (location) {
      searchVenues(true);
    }
  }, []); // Only run on mount

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          🏢 Find Perfect Venues
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Discover amazing venues for your child's birthday party
        </p>
      </div>

      {/* Search Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🔍 Search Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Location */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                📍 Location
              </label>
              <Input
                placeholder="ZIP code or city"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Radius */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                📏 Radius
              </label>
              <Select value={radius} onValueChange={setRadius}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 miles</SelectItem>
                  <SelectItem value="10">10 miles</SelectItem>
                  <SelectItem value="20">20 miles</SelectItem>
                  <SelectItem value="50">50 miles</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Keyword */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                🎯 Keywords
              </label>
              <Input
                placeholder="party hall, indoor play center"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          {/* Search Button */}
          <Button 
            onClick={handleSearch} 
            disabled={loading || !location.trim()}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                🔍 Search Venues
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            ⚠️ {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Empty State */}
      {!loading && venues.length === 0 && !error && (
        <Card className="text-center py-12">
          <CardContent>
            <PartyPopper className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              🎈 No venues found nearby
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Try widening your search radius or adjusting your keywords!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Venues Grid */}
      {venues.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {venues.map((venue) => (
            <Card key={venue.id} className="group hover:shadow-lg transition-all duration-200 border-2 hover:border-purple-200 dark:hover:border-purple-700">
              <CardHeader className="pb-3">
                {/* Venue Image */}
                {venue.imageUrl && (
                  <div className="w-full h-48 mb-3 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                    <img 
                      src={venue.imageUrl} 
                      alt={venue.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&h=300&fit=crop&crop=center';
                      }}
                    />
                  </div>
                )}

                {/* Venue Title */}
                <CardTitle className="text-lg font-bold text-gray-900 dark:text-gray-100 line-clamp-2">
                  📍 {venue.title}
                </CardTitle>

                {/* Rating */}
                {venue.rating && venue.reviewsCount && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold">{venue.rating}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      ({venue.reviewsCount} reviews)
                    </span>
                  </div>
                )}
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Address */}
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    🗺 {formatAddress(venue.address)}
                  </span>
                </div>

                {/* Phone */}
                {venue.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      📞 {venue.phone}
                    </span>
                  </div>
                )}

                {/* Category */}
                {venue.category && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                    {venue.category}
                  </Badge>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  {/* Save/Favorite Button */}
                  <Button
                    onClick={() => toggleFavorite(venue.id)}
                    variant={venue.isFavorite ? "default" : "outline"}
                    size="sm"
                    className={`flex-1 ${venue.isFavorite 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white' 
                      : 'hover:bg-purple-50 dark:hover:bg-purple-900'
                    }`}
                  >
                    {venue.isFavorite ? (
                      <>
                        <BookmarkCheck className="mr-1 h-4 w-4" />
                        Saved
                      </>
                    ) : (
                      <>
                        <Bookmark className="mr-1 h-4 w-4" />
                        ⭐ Save
                      </>
                    )}
                  </Button>

                  {/* Website Button */}
                  {venue.website && (
                    <Button
                      onClick={() => window.open(venue.website, '_blank')}
                      variant="outline"
                      size="sm"
                      className="hover:bg-blue-50 dark:hover:bg-blue-900"
                    >
                      <ExternalLink className="mr-1 h-4 w-4" />
                      🌐 Website
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Loading More */}
      {loading && venues.length > 0 && (
        <div className="text-center py-6">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-400">Loading more venues...</p>
        </div>
      )}

      {/* No More Results */}
      {!hasMore && venues.length > 0 && (
        <div className="text-center py-6">
          <p className="text-gray-500 dark:text-gray-400">
            🎉 You've seen all venues in this area!
          </p>
        </div>
      )}
    </div>
  );
}