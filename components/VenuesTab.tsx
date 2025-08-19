"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { 
  MapPin, 
  Search, 
  Star, 
  Users,
  Heart,
  Plus,
  Eye,
  DollarSign,
  Clock,
  Zap
} from "lucide-react";

interface Venue {
  venue_id: string;
  name: string;
  location: string;
  capacity: number;
  price_range: string;
  rating: number;
  reviews: string;
  tags: string[];
  ai_note: string;
}

interface VenuesTabProps {
  partyId?: string;
  childName?: string;
  childAge?: number;
  selectedTheme?: string;
  interests?: string[];
  favoriteColors?: string[];
  guestCount?: number;
  venue?: 'indoor' | 'outdoor' | 'mixed';
}

export default function VenuesTab({ 
  partyId,
  childName,
  childAge,
  selectedTheme,
  interests,
  favoriteColors,
  guestCount,
  venue
}: VenuesTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [favoriteVenues, setFavoriteVenues] = useState<Set<string>>(new Set());
  const [comparisonList, setComparisonList] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);

  // Static demo data as provided
  const demoVenues: Venue[] = [
    {
      venue_id: "v001",
      name: "Rainbow Playhouse",
      location: "Brooklyn, NY",
      capacity: 25,
      price_range: "$150/hr",
      rating: 4.7,
      reviews: "Colorful indoor space with slides, ball pits, and flexible décor options.",
      tags: ["indoor", "kids", "play area"],
      ai_note: "Perfect for a Unicorn-themed party with 20 kids — lots of color and safe indoor play."
    },
    {
      venue_id: "v002",
      name: "Dino Jungle Park",
      location: "Austin, TX",
      capacity: 40,
      price_range: "$500/day",
      rating: 4.5,
      reviews: "Outdoor park with dinosaur statues, picnic areas, and a birthday pavilion.",
      tags: ["outdoor", "themed", "picnic"],
      ai_note: "Amazing choice for a Dinosaur Party — plenty of space for games and adventurous play."
    },
    {
      venue_id: "v003",
      name: "Royal Banquet Hall",
      location: "San Jose, CA",
      capacity: 60,
      price_range: "$1200/day",
      rating: 4.8,
      reviews: "Elegant hall with chandeliers, catering services, and custom décor packages.",
      tags: ["indoor", "formal", "catering"],
      ai_note: "Perfect fit for a Cinderella or Princess party — ballroom vibe and catering included."
    },
    {
      venue_id: "v004",
      name: "Galaxy Bowling Alley",
      location: "Chicago, IL",
      capacity: 35,
      price_range: "$300/2 hrs",
      rating: 4.6,
      reviews: "Glow-in-the-dark lanes, arcade games, and birthday packages with food.",
      tags: ["indoor", "entertainment", "games"],
      ai_note: "Great for a Space or Superhero party — glowing lights and fun activities for older kids."
    },
    {
      venue_id: "v005",
      name: "Garden Picnic Pavilion",
      location: "Orlando, FL",
      capacity: 50,
      price_range: "$200/day",
      rating: 4.4,
      reviews: "Shaded outdoor pavilion in a park with BBQs, tables, and play areas.",
      tags: ["outdoor", "budget-friendly", "nature"],
      ai_note: "Ideal for a Sports or Nature-themed birthday — budget-friendly and spacious."
    }
  ];

  // Load favorites and comparison list from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && partyId) {
      const savedFavorites = localStorage.getItem(`venue_favorites_${partyId}`);
      const savedComparison = localStorage.getItem(`venue_comparison_${partyId}`);
      
      if (savedFavorites) {
        setFavoriteVenues(new Set(JSON.parse(savedFavorites)));
      }
      if (savedComparison) {
        setComparisonList(new Set(JSON.parse(savedComparison)));
      }
    }
  }, [partyId]);

  // Filter venues based on search term
  const filteredVenues = demoVenues.filter(venue =>
    venue.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    venue.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    venue.reviews.toLowerCase().includes(searchTerm.toLowerCase()) ||
    venue.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const toggleFavorite = (venueId: string) => {
    const newFavorites = new Set(favoriteVenues);
    if (newFavorites.has(venueId)) {
      newFavorites.delete(venueId);
    } else {
      newFavorites.add(venueId);
    }
    setFavoriteVenues(newFavorites);
    
    // Save to localStorage
    if (typeof window !== 'undefined' && partyId) {
      localStorage.setItem(`venue_favorites_${partyId}`, JSON.stringify(Array.from(newFavorites)));
    }
  };

  const toggleComparison = (venueId: string) => {
    const newComparison = new Set(comparisonList);
    if (newComparison.has(venueId)) {
      newComparison.delete(venueId);
    } else if (newComparison.size < 3) {
      // Limit to 3 venues for comparison
      newComparison.add(venueId);
    }
    setComparisonList(newComparison);
    
    // Save to localStorage
    if (typeof window !== 'undefined' && partyId) {
      localStorage.setItem(`venue_comparison_${partyId}`, JSON.stringify(Array.from(newComparison)));
    }
  };

  const getComparedVenues = () => {
    return demoVenues.filter(venue => comparisonList.has(venue.venue_id));
  };

  const getPriceColor = (priceRange: string) => {
    if (priceRange.includes('$150') || priceRange.includes('$200')) return 'text-green-600';
    if (priceRange.includes('$300') || priceRange.includes('$500')) return 'text-blue-600';
    if (priceRange.includes('$1200')) return 'text-orange-600';
    return 'text-gray-600';
  };

  const getTagColor = (tag: string) => {
    switch (tag) {
      case 'indoor': return 'bg-blue-100 text-blue-800';
      case 'outdoor': return 'bg-green-100 text-green-800';
      case 'themed': return 'bg-purple-100 text-purple-800';
      case 'entertainment': return 'bg-pink-100 text-pink-800';
      case 'budget-friendly': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            🎪 Magical Venues
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Discover perfect birthday party venues tailored to your celebration
          </p>
          {childName && (
            <p className="text-sm text-purple-600 dark:text-purple-400">
              Finding venues for {childName}'s special day
              {selectedTheme && ` • ${selectedTheme} theme`}
              {guestCount && ` • ${guestCount} guests`}
            </p>
          )}
        </div>
      </div>

      {/* Search and Comparison Bar */}
      <Card className="border-0 shadow-lg dark:bg-slate-800/90">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search venues by name, location, or features..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex items-center gap-2">
              {comparisonList.size > 0 && (
                <Button
                  variant={showComparison ? "default" : "outline"}
                  onClick={() => setShowComparison(!showComparison)}
                  className="flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  Compare ({comparisonList.size})
                </Button>
              )}
              <Badge variant="secondary" className="flex items-center gap-1">
                <Heart className="h-3 w-3 fill-red-500 text-red-500" />
                {favoriteVenues.size} Favorites
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison View */}
      {showComparison && comparisonList.size > 0 && (
        <Card className="border-0 shadow-lg dark:bg-slate-800/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Venue Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getComparedVenues().map((venue) => (
                <div key={venue.venue_id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold text-sm">{venue.name}</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleComparison(venue.venue_id)}
                      className="h-6 w-6 p-0"
                    >
                      ×
                    </Button>
                  </div>
                  <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {venue.location}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {venue.capacity} guests
                    </div>
                    <div className={`flex items-center gap-1 font-medium ${getPriceColor(venue.price_range)}`}>
                      <DollarSign className="h-3 w-3" />
                      {venue.price_range}
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      {venue.rating}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Venues Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {filteredVenues.length} venues found
          </h3>
          <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
            <Zap className="h-3 w-3 mr-1" />
            AI Matched
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredVenues.map((venue) => (
            <Card key={venue.venue_id} className="border-0 shadow-lg dark:bg-slate-800/90 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-semibold mb-1">{venue.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <MapPin className="h-4 w-4" />
                        {venue.location}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">{venue.rating}</span>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-4 py-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">{venue.capacity} guests</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className={`h-4 w-4 ${getPriceColor(venue.price_range)}`} />
                      <span className={`text-sm font-medium ${getPriceColor(venue.price_range)}`}>
                        {venue.price_range}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                    {venue.reviews}
                  </p>

                  {/* AI Contextual Note */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-3 border border-purple-100 dark:border-purple-800">
                    <div className="flex items-start gap-2">
                      <Zap className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-purple-800 dark:text-purple-200">
                        <span className="font-medium">AI Match:</span> {venue.ai_note}
                      </p>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    {venue.tags.map((tag, index) => (
                      <Badge key={index} className={`text-xs ${getTagColor(tag)}`}>
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <Separator />

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleFavorite(venue.venue_id)}
                      className={`flex items-center gap-2 ${
                        favoriteVenues.has(venue.venue_id) 
                          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300' 
                          : ''
                      }`}
                    >
                      <Heart className={`h-4 w-4 ${favoriteVenues.has(venue.venue_id) ? 'fill-red-500 text-red-500' : ''}`} />
                      {favoriteVenues.has(venue.venue_id) ? 'Favorited' : 'Favorite'}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleComparison(venue.venue_id)}
                      disabled={comparisonList.size >= 3 && !comparisonList.has(venue.venue_id)}
                      className={`flex items-center gap-2 ${
                        comparisonList.has(venue.venue_id) 
                          ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300' 
                          : ''
                      }`}
                    >
                      <Plus className="h-4 w-4" />
                      {comparisonList.has(venue.venue_id) ? 'Added' : 'Compare'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {filteredVenues.length === 0 && (
        <Card className="border-0 shadow-lg dark:bg-slate-800/90">
          <CardContent className="text-center py-12">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">No venues found</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Try adjusting your search terms to find more venues.
            </p>
            <Button onClick={() => setSearchTerm("")} variant="outline">
              Clear Search
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}