"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  MapPin, 
  Users, 
  DollarSign, 
  Star, 
  Heart, 
  Plus, 
  MoreHorizontal,
  Search,
  Filter,
  Sparkles,
  ArrowUpDown,
  Info,
  Loader2
} from "lucide-react";

export interface VenueData {
  id: string;
  name: string;
  location: string;
  address?: string;
  capacity: number;
  priceRange: string;
  pricePerHour?: number;
  rating: number;
  reviewCount: number;
  description: string;
  aiContextualNote: string;
  amenities: string[];
  venueType: 'indoor' | 'outdoor' | 'both';
  ageRecommendation?: string;
  imageUrl?: string;
  phone?: string;
  website?: string;
  availability?: string;
  isFavorited?: boolean;
  matchScore?: number;
}

interface PartyData {
  childName?: string;
  childAge?: string;
  selectedTheme?: string;
  theme?: string;
  interests?: string[];
  favoriteColors?: string[];
  budget?: number;
  zipCode?: string;
  guestCount?: number;
  venue?: 'indoor' | 'outdoor' | 'mixed';
  duration?: string;
}

interface VenuesTabProps {
  partyData: PartyData;
  onUpdateParty?: (updates: Partial<PartyData>) => void;
}

// Demo venue data - structured for later Apify integration
const DEMO_VENUES: VenueData[] = [
  {
    id: "venue-1",
    name: "Chuck E. Cheese's Fun Center",
    location: "Downtown Plaza",
    address: "123 Main St, City, State 12345",
    capacity: 50,
    priceRange: "$200-400",
    pricePerHour: 300,
    rating: 4.2,
    reviewCount: 287,
    description: "Classic family entertainment center with arcade games, pizza, and birthday party packages.",
    aiContextualNote: "Perfect for superhero themes with arcade games and energetic atmosphere. Great for ages 4-8.",
    amenities: ["Arcade Games", "Pizza & Snacks", "Party Host", "Private Party Room", "Cake Service"],
    venueType: "indoor",
    ageRecommendation: "3-12 years",
    phone: "(555) 123-4567",
    website: "https://chuckecheese.com",
    availability: "Weekends available",
    matchScore: 92
  },
  {
    id: "venue-2", 
    name: "Adventure Park & Playground",
    location: "Riverside District",
    address: "456 Park Ave, City, State 12345",
    capacity: 75,
    priceRange: "$150-300",
    pricePerHour: 225,
    rating: 4.5,
    reviewCount: 156,
    description: "Outdoor adventure playground with climbing structures, slides, and picnic areas.",
    aiContextualNote: "Excellent for dinosaur or safari themes with natural outdoor setting. Weather dependent.",
    amenities: ["Playground Equipment", "Picnic Tables", "BBQ Grills", "Parking", "Restrooms"],
    venueType: "outdoor",
    ageRecommendation: "2-10 years", 
    phone: "(555) 234-5678",
    availability: "Spring/Summer only",
    matchScore: 88
  },
  {
    id: "venue-3",
    name: "Princess Palace Party Hall",
    location: "Uptown Center",
    address: "789 Royal Rd, City, State 12345",
    capacity: 40,
    priceRange: "$250-450",
    pricePerHour: 350,
    rating: 4.7,
    reviewCount: 203,
    description: "Elegant themed party hall with princess decorations and royal party packages.",
    aiContextualNote: "Magical setting perfect for princess themes with royal decorations and dress-up activities.",
    amenities: ["Themed Decorations", "Costume Rentals", "Photo Booth", "Catering Kitchen", "Sound System"],
    venueType: "indoor",
    ageRecommendation: "3-8 years",
    phone: "(555) 345-6789",
    website: "https://princesspalace.com",
    availability: "Available all year",
    matchScore: 95
  },
  {
    id: "venue-4",
    name: "Sky Zone Trampoline Park",
    location: "Westside Mall",
    address: "321 Jump St, City, State 12345", 
    capacity: 60,
    priceRange: "$300-500",
    pricePerHour: 400,
    rating: 4.4,
    reviewCount: 342,
    description: "High-energy trampoline park with foam pits, dodgeball courts, and party packages.",
    aiContextualNote: "High-energy venue perfect for space or superhero themes. Great for active kids 6+.",
    amenities: ["Trampolines", "Foam Pits", "Dodgeball", "Private Party Room", "Safety Equipment"],
    venueType: "indoor",
    ageRecommendation: "6-16 years",
    phone: "(555) 456-7890",
    website: "https://skyzone.com",
    availability: "Year-round",
    matchScore: 85
  },
  {
    id: "venue-5",
    name: "Aquatic Adventure Center",
    location: "Marina District",
    address: "654 Ocean Way, City, State 12345",
    capacity: 80,
    priceRange: "$400-600",
    pricePerHour: 500,
    rating: 4.6,
    reviewCount: 198,
    description: "Water park facility with pools, slides, and aquatic party packages.",
    aiContextualNote: "Perfect for ocean themes with water activities. Ideal for summer birthdays.",
    amenities: ["Swimming Pool", "Water Slides", "Lazy River", "Pool Deck", "Changing Rooms"],
    venueType: "both",
    ageRecommendation: "4-14 years",
    phone: "(555) 567-8901",
    website: "https://aquaticadventure.com",
    availability: "Summer season",
    matchScore: 90
  }
];

export default function VenuesTab({ partyData, onUpdateParty }: VenuesTabProps) {
  const [venues, setVenues] = useState<VenueData[]>([]);
  const [favoritedVenues, setFavoritedVenues] = useState<VenueData[]>([]);
  const [compareVenues, setCompareVenues] = useState<VenueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("match-score");
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState("browse");
  const [compareDrawerOpen, setCompareDrawerOpen] = useState(false);
  const observer = useRef<IntersectionObserver>();

  const venuesPerPage = 5;

  // Load initial venues
  useEffect(() => {
    loadVenues();
  }, []);

  // Load favorites from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('venue-favorites');
    if (savedFavorites) {
      const favoriteIds = JSON.parse(savedFavorites);
      const favoriteVenuesData = DEMO_VENUES.filter(venue => favoriteIds.includes(venue.id));
      setFavoritedVenues(favoriteVenuesData);
    }
  }, []);

  const loadVenues = async (page = 1) => {
    try {
      setLoading(page === 1);
      setLoadingMore(page > 1);
      
      // Simulate API call - later replace with Apify integration
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate AI contextual notes based on party data
      const contextualizedVenues = await generateContextualNotes(DEMO_VENUES, partyData);
      
      const startIdx = (page - 1) * venuesPerPage;
      const endIdx = startIdx + venuesPerPage;
      const paginatedVenues = contextualizedVenues.slice(startIdx, endIdx);
      
      if (page === 1) {
        setVenues(paginatedVenues);
      } else {
        setVenues(prev => [...prev, ...paginatedVenues]);
      }
      
      setHasMore(endIdx < contextualizedVenues.length);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error loading venues:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const generateContextualNotes = async (venues: VenueData[], partyData: PartyData): Promise<VenueData[]> => {
    // AI contextual note generation based on party data
    return venues.map(venue => {
      let contextualNote = venue.aiContextualNote;
      
      // Customize based on child's age
      if (partyData.childAge) {
        const age = parseInt(partyData.childAge);
        if (age <= 4) {
          contextualNote = contextualNote.replace(/ages \d+-\d+/g, "perfect for toddlers and preschoolers");
        } else if (age <= 8) {
          contextualNote = contextualNote.replace(/ages \d+-\d+/g, "great for elementary school kids");
        }
      }
      
      // Match with theme
      if (partyData.selectedTheme || partyData.theme) {
        const theme = (partyData.selectedTheme || partyData.theme || '').toLowerCase();
        if (theme.includes('princess') && venue.name.toLowerCase().includes('princess')) {
          contextualNote = `🏰 ${contextualNote} Perfect match for your ${theme} theme!`;
        } else if (theme.includes('superhero') && venue.amenities.some(a => a.toLowerCase().includes('arcade'))) {
          contextualNote = `⚡ ${contextualNote} Superhero training ground with arcade adventures!`;
        } else if (theme.includes('ocean') && venue.name.toLowerCase().includes('aquatic')) {
          contextualNote = `🌊 ${contextualNote} Dive into your ocean adventure theme!`;
        }
      }
      
      // Match with venue preference
      if (partyData.venue && venue.venueType !== 'both') {
        const preference = partyData.venue === 'mixed' ? 'both' : partyData.venue;
        if (venue.venueType === preference) {
          contextualNote = `✨ ${contextualNote} Matches your ${preference} venue preference!`;
        }
      }
      
      return { ...venue, aiContextualNote: contextualNote };
    });
  };

  const handleFavorite = (venue: VenueData) => {
    const isFavorited = favoritedVenues.some(fav => fav.id === venue.id);
    
    if (isFavorited) {
      const updated = favoritedVenues.filter(fav => fav.id !== venue.id);
      setFavoritedVenues(updated);
      localStorage.setItem('venue-favorites', JSON.stringify(updated.map(v => v.id)));
    } else {
      const updated = [...favoritedVenues, venue];
      setFavoritedVenues(updated);
      localStorage.setItem('venue-favorites', JSON.stringify(updated.map(v => v.id)));
    }
  };

  const handleCompare = (venue: VenueData) => {
    if (compareVenues.length >= 3) {
      alert('You can only compare up to 3 venues at once.');
      return;
    }
    
    if (!compareVenues.some(comp => comp.id === venue.id)) {
      setCompareVenues([...compareVenues, venue]);
      setCompareDrawerOpen(true);
    }
  };

  const removeFromCompare = (venueId: string) => {
    setCompareVenues(compareVenues.filter(venue => venue.id !== venueId));
  };

  const lastVenueElementRef = useCallback((node: HTMLDivElement) => {
    if (loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadVenues(currentPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loadingMore, hasMore, currentPage]);

  const filteredVenues = venues.filter(venue => {
    const matchesSearch = venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         venue.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'all' || venue.venueType === filterType;
    return matchesSearch && matchesFilter;
  });

  const sortedVenues = [...filteredVenues].sort((a, b) => {
    switch (sortBy) {
      case 'match-score':
        return (b.matchScore || 0) - (a.matchScore || 0);
      case 'rating':
        return b.rating - a.rating;
      case 'price-low':
        return (a.pricePerHour || 0) - (b.pricePerHour || 0);
      case 'price-high':
        return (b.pricePerHour || 0) - (a.pricePerHour || 0);
      default:
        return 0;
    }
  });

  const isFavorited = (venueId: string) => favoritedVenues.some(fav => fav.id === venueId);
  const isInCompare = (venueId: string) => compareVenues.some(comp => comp.id === venueId);

  const VenueCard = ({ venue, ref }: { venue: VenueData; ref?: (node: HTMLDivElement) => void }) => (
    <Card ref={ref} className="group hover:shadow-lg transition-all duration-200 border-0 bg-gradient-to-br from-white to-purple-50/30 hover:from-purple-50/50 hover:to-pink-50/50">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <CardTitle className="text-lg font-bold text-purple-900 mb-1 line-clamp-1">
              {venue.name}
            </CardTitle>
            <div className="flex items-center text-gray-600 mb-2">
              <MapPin className="w-4 h-4 mr-1" />
              <span className="text-sm">{venue.location}</span>
            </div>
          </div>
          {venue.matchScore && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-700">
              {venue.matchScore}% match
            </Badge>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div className="flex items-center">
            <Users className="w-4 h-4 text-purple-600 mr-2" />
            <span className="text-sm font-medium">{venue.capacity} guests</span>
          </div>
          <div className="flex items-center">
            <DollarSign className="w-4 h-4 text-green-600 mr-2" />
            <span className="text-sm font-medium">{venue.priceRange}</span>
          </div>
        </div>

        <div className="flex items-center mb-3">
          <div className="flex items-center mr-4">
            <Star className="w-4 h-4 text-yellow-500 fill-current mr-1" />
            <span className="text-sm font-medium">{venue.rating}</span>
            <span className="text-xs text-gray-500 ml-1">({venue.reviewCount} reviews)</span>
          </div>
          <Badge variant="outline" className={venue.venueType === 'indoor' ? 'border-blue-200 text-blue-700' : venue.venueType === 'outdoor' ? 'border-green-200 text-green-700' : 'border-purple-200 text-purple-700'}>
            {venue.venueType === 'both' ? 'Indoor/Outdoor' : venue.venueType}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {venue.description}
        </p>
        
        <Alert className="mb-4 border-purple-200 bg-purple-50/50">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <AlertDescription className="text-sm text-purple-700 font-medium">
            {venue.aiContextualNote}
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap gap-1 mb-4">
          {venue.amenities.slice(0, 3).map((amenity, index) => (
            <Badge key={index} variant="secondary" className="text-xs bg-gray-100 text-gray-700">
              {amenity}
            </Badge>
          ))}
          {venue.amenities.length > 3 && (
            <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700">
              +{venue.amenities.length - 3} more
            </Badge>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant={isFavorited(venue.id) ? "default" : "outline"}
            size="sm"
            onClick={() => handleFavorite(venue)}
            className={isFavorited(venue.id) ? "bg-pink-500 hover:bg-pink-600 text-white" : "border-pink-200 text-pink-600 hover:bg-pink-50"}
          >
            <Heart className={`w-4 h-4 mr-2 ${isFavorited(venue.id) ? 'fill-current' : ''}`} />
            {isFavorited(venue.id) ? 'Favorited' : 'Favorite'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCompare(venue)}
            disabled={isInCompare(venue.id) || compareVenues.length >= 3}
            className="border-purple-200 text-purple-600 hover:bg-purple-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            {isInCompare(venue.id) ? 'Added' : 'Compare'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">Finding perfect venues for your party...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="browse">Browse Venues</TabsTrigger>
          <TabsTrigger value="favorites" className="relative">
            Favorites
            {favoritedVenues.length > 0 && (
              <Badge className="ml-2 bg-pink-500 text-white text-xs">
                {favoritedVenues.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search venues by name or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-32">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="indoor">Indoor</SelectItem>
                  <SelectItem value="outdoor">Outdoor</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="match-score">Best Match</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sortedVenues.map((venue, index) => (
              <VenueCard 
                key={venue.id} 
                venue={venue}
                ref={index === sortedVenues.length - 1 ? lastVenueElementRef : undefined}
              />
            ))}
          </div>

          {loadingMore && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            </div>
          )}

          {!hasMore && sortedVenues.length > 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>You've seen all available venues!</p>
            </div>
          )}

          {sortedVenues.length === 0 && !loading && (
            <div className="text-center py-12">
              <Info className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No venues found</h3>
              <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="favorites">
          {favoritedVenues.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No favorites yet</h3>
              <p className="text-gray-500">Start browsing venues and add your favorites!</p>
              <Button 
                onClick={() => setActiveTab("browse")} 
                className="mt-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                Browse Venues
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {favoritedVenues.map(venue => (
                <VenueCard key={venue.id} venue={venue} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Compare Drawer */}
      <Sheet open={compareDrawerOpen} onOpenChange={setCompareDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              Compare Venues
              <Badge variant="secondary">{compareVenues.length}/3</Badge>
            </SheetTitle>
          </SheetHeader>
          
          <div className="mt-6">
            {compareVenues.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No venues to compare yet. Add venues from the browse tab!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 min-w-fit">
                  {compareVenues.map(venue => (
                    <Card key={venue.id} className="min-w-80">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg">{venue.name}</CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromCompare(venue.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            ×
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="font-semibold text-gray-700 mb-1">Location</p>
                          <p className="text-sm text-gray-600">{venue.location}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="font-semibold text-gray-700 mb-1">Capacity</p>
                            <p className="text-sm">{venue.capacity} guests</p>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-700 mb-1">Price</p>
                            <p className="text-sm">{venue.priceRange}</p>
                          </div>
                        </div>
                        
                        <div>
                          <p className="font-semibold text-gray-700 mb-1">Rating</p>
                          <div className="flex items-center">
                            <Star className="w-4 h-4 text-yellow-500 fill-current mr-1" />
                            <span className="text-sm">{venue.rating} ({venue.reviewCount} reviews)</span>
                          </div>
                        </div>
                        
                        <div>
                          <p className="font-semibold text-gray-700 mb-1">Why it fits</p>
                          <p className="text-sm text-purple-700 bg-purple-50 p-2 rounded">
                            {venue.aiContextualNote}
                          </p>
                        </div>
                        
                        <div>
                          <p className="font-semibold text-gray-700 mb-2">Amenities</p>
                          <div className="flex flex-wrap gap-1">
                            {venue.amenities.map((amenity, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {amenity}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Floating Compare Button */}
      {compareVenues.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            onClick={() => setCompareDrawerOpen(true)}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg"
          >
            Compare ({compareVenues.length})
          </Button>
        </div>
      )}
    </div>
  );
}