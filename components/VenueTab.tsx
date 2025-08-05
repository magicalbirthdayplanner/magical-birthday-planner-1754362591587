"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { 
  MapPin, 
  Search, 
  Star, 
  DollarSign, 
  ExternalLink,
  Filter,
  Home,
  TreePine,
  Shield,
  Heart,
  Phone,
  Clock,
  Users,
  Loader2,
  Bookmark,
  Mail
} from "lucide-react";

interface Venue {
  id: string;
  name: string;
  category: 'Outdoor' | 'Indoor' | 'Sports Arena';
  rating: number;
  reviews: number;
  priceRange: '$' | '$$' | '$$$' | '$$$$';
  address: string;
  phone: string;
  website?: string;
  email?: string;
  description: string;
  capacity: number;
  amenities: string[];
  distance?: number; // Distance in miles
  popularity?: number; // AI-powered popularity score
  images: string[];
  isAIRecommended?: boolean;
  isBookmarked?: boolean;
}

interface VenueTabProps {
  zipCode?: string;
  partyId: string;
  guestCount?: number;
}

export default function VenueTab({ zipCode, partyId, guestCount = 0 }: VenueTabProps) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<string[]>([]);
  const [minRating, setMinRating] = useState([3]);
  const [sortBy, setSortBy] = useState<'distance' | 'popularity' | 'reviews'>('popularity');
  const [bookmarkedVenues, setBookmarkedVenues] = useState<Set<string>>(new Set());

  // Fetch venues data
  useEffect(() => {
    fetchVenues();
  }, [zipCode]);

  const fetchVenues = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/venues?zipCode=${zipCode || ''}&guestCount=${guestCount}`);
      if (response.ok) {
        const data = await response.json();
        setVenues(data.venues || []);
      } else {
        // Fallback to mock data if API not available
        setVenues(getMockVenues());
      }
    } catch (error) {
      console.error('Error fetching venues:', error);
      setVenues(getMockVenues());
    } finally {
      setLoading(false);
    }
  };

  // Mock data for demonstration
  const getMockVenues = (): Venue[] => [
    {
      id: '1',
      name: 'Sunny Parks Community Center',
      category: 'Indoor',
      rating: 4.8,
      reviews: 156,
      priceRange: '$$',
      address: '123 Park Ave, Your City',
      phone: '(555) 123-4567',
      website: 'https://sunnyparks.com',
      email: 'events@sunnyparks.com',
      description: 'Beautiful community center with large indoor spaces perfect for birthday parties. Features kitchen facilities, sound system, and party decorations.',
      capacity: 80,
      amenities: ['Kitchen', 'Sound System', 'Parking', 'AC/Heating', 'Tables & Chairs'],
      distance: 2.3,
      popularity: 95,
      images: ['https://images.unsplash.com/photo-1511795409834-432f7b54b4b4?w=400'],
      isAIRecommended: true
    },
    {
      id: '2',
      name: 'Adventure Park Pavilion',
      category: 'Outdoor',
      rating: 4.6,
      reviews: 89,
      priceRange: '$',
      address: '456 Adventure Rd, Your City',
      phone: '(555) 987-6543',
      description: 'Outdoor pavilion with playground, picnic tables, and beautiful nature views. Perfect for outdoor birthday celebrations.',
      capacity: 120,
      amenities: ['Playground', 'Picnic Tables', 'BBQ Grills', 'Restrooms', 'Parking'],
      distance: 4.1,
      popularity: 88,
      images: ['https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400'],
      isAIRecommended: true
    },
    {
      id: '3',
      name: 'SportZone Arena',
      category: 'Sports Arena',
      rating: 4.4,
      reviews: 234,
      priceRange: '$$$',
      address: '789 Sports Complex Dr, Your City',
      phone: '(555) 456-7890',
      website: 'https://sportzone.com',
      description: 'Indoor sports arena with basketball courts, party rooms, and arcade games. Great for active birthday parties.',
      capacity: 60,
      amenities: ['Basketball Court', 'Arcade', 'Party Room', 'Catering', 'Parking'],
      distance: 5.8,
      popularity: 92,
      images: ['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400']
    },
    {
      id: '4',
      name: 'Lakeside Event Center',
      category: 'Outdoor',
      rating: 4.9,
      reviews: 78,
      priceRange: '$$$$',
      address: '321 Lakeside Dr, Your City',
      phone: '(555) 321-9876',
      email: 'info@lakesidecenter.com',
      description: 'Premium lakeside venue with stunning water views, elegant facilities, and full-service catering options.',
      capacity: 150,
      amenities: ['Lake View', 'Full Catering', 'Dance Floor', 'Bar Service', 'Valet Parking'],
      distance: 8.2,
      popularity: 97,
      images: ['https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=400'],
      isAIRecommended: true
    }
  ];

  // Filter and sort venues
  const filteredVenues = venues
    .filter(venue => {
      if (searchTerm && !venue.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !venue.description.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (selectedCategories.length > 0 && !selectedCategories.includes(venue.category)) {
        return false;
      }
      if (priceRange.length > 0 && !priceRange.includes(venue.priceRange)) {
        return false;
      }
      if (venue.rating < minRating[0]) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'distance':
          return (a.distance || 0) - (b.distance || 0);
        case 'popularity':
          return (b.popularity || 0) - (a.popularity || 0);
        case 'reviews':
          return b.reviews - a.reviews;
        default:
          return 0;
      }
    });

  const toggleBookmark = (venueId: string) => {
    const newBookmarks = new Set(bookmarkedVenues);
    if (newBookmarks.has(venueId)) {
      newBookmarks.delete(venueId);
    } else {
      newBookmarks.add(venueId);
    }
    setBookmarkedVenues(newBookmarks);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(`venue_bookmarks_${partyId}`, JSON.stringify(Array.from(newBookmarks)));
    }
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const togglePriceRange = (price: string) => {
    setPriceRange(prev => 
      prev.includes(price) 
        ? prev.filter(p => p !== price)
        : [...prev, price]
    );
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Outdoor': return <TreePine className="h-4 w-4" />;
      case 'Indoor': return <Home className="h-4 w-4" />;
      case 'Sports Arena': return <Shield className="h-4 w-4" />;
      default: return <Home className="h-4 w-4" />;
    }
  };

  const getPriceColor = (priceRange: string) => {
    switch (priceRange) {
      case '$': return 'text-green-600';
      case '$$': return 'text-blue-600';
      case '$$$': return 'text-orange-600';
      case '$$$$': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          AI-Powered Venue Recommendations
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Find the perfect venue for your party based on location, preferences, and guest count
        </p>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-lg dark:bg-slate-800/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search venues by name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Venue Type</label>
              <div className="space-y-2">
                {['Outdoor', 'Indoor', 'Sports Arena'].map(category => (
                  <div key={category} className="flex items-center space-x-2">
                    <Checkbox
                      id={`category-${category}`}
                      checked={selectedCategories.includes(category)}
                      onCheckedChange={() => toggleCategory(category)}
                    />
                    <label 
                      htmlFor={`category-${category}`}
                      className="text-sm flex items-center gap-2 cursor-pointer"
                    >
                      {getCategoryIcon(category)}
                      {category}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Price Range Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Price Range</label>
              <div className="space-y-2">
                {['$', '$$', '$$$', '$$$$'].map(price => (
                  <div key={price} className="flex items-center space-x-2">
                    <Checkbox
                      id={`price-${price}`}
                      checked={priceRange.includes(price)}
                      onCheckedChange={() => togglePriceRange(price)}
                    />
                    <label 
                      htmlFor={`price-${price}`}
                      className={`text-sm cursor-pointer font-medium ${getPriceColor(price)}`}
                    >
                      {price} {price === '$' && '(Budget-friendly)'}
                      {price === '$$' && '(Moderate)'}
                      {price === '$$$' && '(Premium)'}
                      {price === '$$$$' && '(Luxury)'}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Rating & Sort */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Minimum Rating: {minRating[0]} stars
                </label>
                <Slider
                  value={minRating}
                  onValueChange={setMinRating}
                  max={5}
                  min={1}
                  step={0.5}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Sort By</label>
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="popularity">Popularity</SelectItem>
                    <SelectItem value="distance">Distance</SelectItem>
                    <SelectItem value="reviews">Most Reviews</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {loading ? (
        <Card className="border-0 shadow-lg dark:bg-slate-800/90">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600 dark:text-gray-300">Finding perfect venues for your party...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {filteredVenues.length} venues found
              {zipCode && ` near ${zipCode}`}
            </h3>
            {filteredVenues.some(v => v.isAIRecommended) && (
              <Badge className="bg-gradient-to-r from-purple-600 to-pink-600">
                ✨ AI Recommended
              </Badge>
            )}
          </div>

          <div className="grid gap-6">
            {filteredVenues.map((venue) => (
              <Card key={venue.id} className={`border-0 shadow-lg dark:bg-slate-800/90 hover:shadow-xl transition-shadow ${venue.isAIRecommended ? 'ring-2 ring-purple-500/20' : ''}`}>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Image */}
                    <div className="relative">
                      <img
                        src={venue.images[0]}
                        alt={venue.name}
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      {venue.isAIRecommended && (
                        <Badge className="absolute top-2 left-2 bg-gradient-to-r from-purple-600 to-pink-600">
                          ✨ AI Pick
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 bg-white/80 hover:bg-white"
                        onClick={() => toggleBookmark(venue.id)}
                      >
                        <Heart className={`h-4 w-4 ${bookmarkedVenues.has(venue.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>

                    {/* Details */}
                    <div className="lg:col-span-2 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-semibold mb-2">{venue.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                            <div className="flex items-center gap-1">
                              {getCategoryIcon(venue.category)}
                              {venue.category}
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              Up to {venue.capacity} guests
                            </div>
                            {venue.distance && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {venue.distance} miles away
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 mb-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-medium">{venue.rating}</span>
                            <span className="text-sm text-gray-500">({venue.reviews} reviews)</span>
                          </div>
                          <div className={`font-bold text-lg ${getPriceColor(venue.priceRange)}`}>
                            {venue.priceRange}
                          </div>
                        </div>
                      </div>

                      <p className="text-gray-600 dark:text-gray-300">{venue.description}</p>

                      {/* Amenities */}
                      <div>
                        <h4 className="font-medium mb-2">Amenities</h4>
                        <div className="flex flex-wrap gap-2">
                          {venue.amenities.map((amenity, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {amenity}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Contact & Actions */}
                      <div className="flex items-center justify-between pt-4 border-t">
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {venue.address}
                          </div>
                          <div className="flex items-center gap-1">
                            <Phone className="h-4 w-4" />
                            {venue.phone}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleBookmark(venue.id)}
                          >
                            <Bookmark className={`h-4 w-4 mr-1 ${bookmarkedVenues.has(venue.id) ? 'fill-current' : ''}`} />
                            {bookmarkedVenues.has(venue.id) ? 'Saved' : 'Save'}
                          </Button>
                          {venue.email && (
                            <Button variant="outline" size="sm">
                              <Mail className="h-4 w-4 mr-1" />
                              Contact
                            </Button>
                          )}
                          {venue.website && (
                            <Button size="sm" className="bg-gradient-to-r from-blue-600 to-purple-600">
                              <ExternalLink className="h-4 w-4 mr-1" />
                              Visit Website
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredVenues.length === 0 && (
            <Card className="border-0 shadow-lg dark:bg-slate-800/90">
              <CardContent className="text-center py-12">
                <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold mb-2">No venues found</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Try adjusting your filters or search terms to find more venues.
                </p>
                <Button onClick={() => {
                  setSearchTerm("");
                  setSelectedCategories([]);
                  setPriceRange([]);
                  setMinRating([3]);
                }}>
                  Clear All Filters
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}