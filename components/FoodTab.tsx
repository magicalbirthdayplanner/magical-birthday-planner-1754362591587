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
  UtensilsCrossed, 
  Search, 
  Star, 
  MapPin, 
  ExternalLink,
  Filter,
  Heart,
  Phone,
  Clock,
  Loader2,
  Bookmark,
  Mail,
  Leaf,
  AlertTriangle,
  ShieldCheck
} from "lucide-react";

interface FoodVendor {
  id: string;
  name: string;
  cuisineType: string[];
  rating: number;
  reviews: number;
  priceRange: '$' | '$$' | '$$$' | '$$$$';
  address: string;
  phone: string;
  website?: string;
  email?: string;
  description: string;
  specialties: string[];
  dietaryOptions: string[];
  distance?: number; // Distance in miles
  popularity?: number; // AI-powered popularity score
  images: string[];
  isAIRecommended?: boolean;
  isBookmarked?: boolean;
  deliveryAvailable?: boolean;
  cateringAvailable?: boolean;
  minOrder?: number;
}

interface FoodTabProps {
  zipCode?: string;
  partyId: string;
  guestCount?: number;
}

const CUISINE_TYPES = [
  'Italian', 'Indian', 'Chinese', 'Mexican', 'American', 'Japanese', 
  'Thai', 'Mediterranean', 'French', 'Korean', 'Vietnamese', 'Greek',
  'BBQ', 'Pizza', 'Burgers', 'Sandwiches', 'Desserts', 'Bakery'
];

const DIETARY_RESTRICTIONS = [
  'Vegetarian', 'Vegan', 'Gluten Free', 'Nut Free', 'Dairy Free', 
  'Kosher', 'Halal', 'Keto', 'Low Carb', 'Organic'
];

export default function FoodTab({ zipCode, partyId, guestCount = 0 }: FoodTabProps) {
  const [vendors, setVendors] = useState<FoodVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<string[]>([]);
  const [minRating, setMinRating] = useState([3]);
  const [sortBy, setSortBy] = useState<'distance' | 'popularity' | 'reviews'>('popularity');
  const [bookmarkedVendors, setBookmarkedVendors] = useState<Set<string>>(new Set());

  // Fetch vendors data
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetchVendors();
  }, [zipCode]);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/food-vendors?zipCode=${zipCode || ''}&guestCount=${guestCount}`);
      if (response.ok) {
        const data = await response.json();
        setVendors(data.vendors || []);
        setLoadError(false);
      } else {
        // Never show invented restaurants: surface the failure instead.
        setVendors([]);
        setLoadError(true);
      }
    } catch (error) {
      console.error('Error fetching food vendors:', error);
      setVendors([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  // Mock data for demonstration
  const getMockVendors = (): FoodVendor[] => [
    {
      id: '1',
      name: 'Mario\'s Pizza Palace',
      cuisineType: ['Italian', 'Pizza'],
      rating: 4.8,
      reviews: 203,
      priceRange: '$$',
      address: '123 Main St, Your City',
      phone: '(555) 123-4567',
      website: 'https://mariospizza.com',
      email: 'catering@mariospizza.com',
      description: 'Authentic Italian pizza with fresh ingredients. Perfect for birthday parties with kid-friendly options and custom party platters.',
      specialties: ['Margherita Pizza', 'Pepperoni', 'Custom Party Platters', 'Garlic Bread'],
      dietaryOptions: ['Vegetarian', 'Gluten Free', 'Vegan'],
      distance: 1.8,
      popularity: 96,
      images: ['https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400'],
      isAIRecommended: true,
      deliveryAvailable: true,
      cateringAvailable: true,
      minOrder: 50
    },
    {
      id: '2',
      name: 'Spice Garden Indian Cuisine',
      cuisineType: ['Indian'],
      rating: 4.7,
      reviews: 156,
      priceRange: '$$',
      address: '456 Spice Ave, Your City',
      phone: '(555) 987-6543',
      website: 'https://spicegarden.com',
      description: 'Authentic Indian cuisine with mild options perfect for children. Specializes in party catering with customizable spice levels.',
      specialties: ['Butter Chicken', 'Biryani', 'Samosas', 'Naan Bread', 'Mango Lassi'],
      dietaryOptions: ['Vegetarian', 'Vegan', 'Gluten Free', 'Dairy Free'],
      distance: 2.4,
      popularity: 89,
      images: ['https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400'],
      isAIRecommended: true,
      deliveryAvailable: true,
      cateringAvailable: true,
      minOrder: 75
    },
    {
      id: '3',
      name: 'Burger Haven',
      cuisineType: ['American', 'Burgers'],
      rating: 4.5,
      reviews: 189,
      priceRange: '$',
      address: '789 Burger Blvd, Your City',
      phone: '(555) 456-7890',
      description: 'Classic American burgers and fries. Kid-friendly menu with mini burgers and fun sides perfect for birthday celebrations.',
      specialties: ['Classic Cheeseburger', 'Mini Sliders', 'Sweet Potato Fries', 'Milkshakes'],
      dietaryOptions: ['Vegetarian', 'Gluten Free'],
      distance: 3.2,
      popularity: 85,
      images: ['https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400'],
      deliveryAvailable: true,
      cateringAvailable: true,
      minOrder: 40
    },
    {
      id: '4',
      name: 'Golden Dragon Chinese',
      cuisineType: ['Chinese'],
      rating: 4.6,
      reviews: 167,
      priceRange: '$$',
      address: '321 Dragon Way, Your City',
      phone: '(555) 321-9876',
      email: 'orders@goldendragon.com',
      description: 'Traditional Chinese cuisine with party-friendly options. Offers family-style platters perfect for sharing at celebrations.',
      specialties: ['Sweet & Sour Chicken', 'Fried Rice', 'Dumplings', 'Lo Mein', 'Fortune Cookies'],
      dietaryOptions: ['Vegetarian', 'Gluten Free'],
      distance: 4.1,
      popularity: 87,
      images: ['https://images.unsplash.com/photo-1576704020880-b54e46bb6cbb?w=400'],
      deliveryAvailable: true,
      cateringAvailable: true,
      minOrder: 60
    },
    {
      id: '5',
      name: 'Sweet Dreams Bakery',
      cuisineType: ['Desserts', 'Bakery'],
      rating: 4.9,
      reviews: 134,
      priceRange: '$$$',
      address: '555 Sweet St, Your City',
      phone: '(555) 555-0123',
      website: 'https://sweetdreamsbakery.com',
      email: 'orders@sweetdreams.com',
      description: 'Custom birthday cakes and dessert platters. Specializes in themed cakes and allergy-friendly options for children\'s parties.',
      specialties: ['Custom Birthday Cakes', 'Cupcakes', 'Cookies', 'Cake Pops', 'Themed Desserts'],
      dietaryOptions: ['Vegetarian', 'Vegan', 'Gluten Free', 'Nut Free', 'Dairy Free'],
      distance: 2.7,
      popularity: 94,
      images: ['https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400'],
      isAIRecommended: true,
      deliveryAvailable: true,
      cateringAvailable: true,
      minOrder: 30
    }
  ];

  // Filter and sort vendors
  const filteredVendors = vendors
    .filter(vendor => {
      if (searchTerm && !vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !vendor.description.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !vendor.cuisineType.some(cuisine => cuisine.toLowerCase().includes(searchTerm.toLowerCase()))) {
        return false;
      }
      if (selectedCuisines.length > 0 && !selectedCuisines.some(cuisine => vendor.cuisineType.includes(cuisine))) {
        return false;
      }
      if (selectedDietary.length > 0 && !selectedDietary.some(dietary => vendor.dietaryOptions.includes(dietary))) {
        return false;
      }
      if (priceRange.length > 0 && !priceRange.includes(vendor.priceRange)) {
        return false;
      }
      if (vendor.rating < minRating[0]) {
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

  const toggleBookmark = (vendorId: string) => {
    const newBookmarks = new Set(bookmarkedVendors);
    if (newBookmarks.has(vendorId)) {
      newBookmarks.delete(vendorId);
    } else {
      newBookmarks.add(vendorId);
    }
    setBookmarkedVendors(newBookmarks);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(`food_bookmarks_${partyId}`, JSON.stringify(Array.from(newBookmarks)));
    }
  };

  const toggleCuisine = (cuisine: string) => {
    setSelectedCuisines(prev => 
      prev.includes(cuisine) 
        ? prev.filter(c => c !== cuisine)
        : [...prev, cuisine]
    );
  };

  const toggleDietary = (dietary: string) => {
    setSelectedDietary(prev => 
      prev.includes(dietary) 
        ? prev.filter(d => d !== dietary)
        : [...prev, dietary]
    );
  };

  const togglePriceRange = (price: string) => {
    setPriceRange(prev => 
      prev.includes(price) 
        ? prev.filter(p => p !== price)
        : [...prev, price]
    );
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

  const getDietaryIcon = (dietary: string) => {
    switch (dietary) {
      case 'Vegetarian':
      case 'Vegan':
        return <Leaf className="h-3 w-3 text-green-600" />;
      case 'Gluten Free':
      case 'Nut Free':
      case 'Dairy Free':
        return <ShieldCheck className="h-3 w-3 text-blue-600" />;
      default:
        return <AlertTriangle className="h-3 w-3 text-orange-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-2">
          Food Vendor Recommendations
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Find the best food options for your party with cuisine variety and dietary accommodations
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
              placeholder="Search by restaurant name, cuisine, or specialty..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Cuisine Type Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Cuisine Types</label>
              <div className="max-h-32 overflow-y-auto space-y-2 pr-2">
                {CUISINE_TYPES.map(cuisine => (
                  <div key={cuisine} className="flex items-center space-x-2">
                    <Checkbox
                      id={`cuisine-${cuisine}`}
                      checked={selectedCuisines.includes(cuisine)}
                      onCheckedChange={() => toggleCuisine(cuisine)}
                    />
                    <label 
                      htmlFor={`cuisine-${cuisine}`}
                      className="text-sm cursor-pointer"
                    >
                      {cuisine}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Dietary Restrictions Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Dietary Options</label>
              <div className="max-h-32 overflow-y-auto space-y-2 pr-2">
                {DIETARY_RESTRICTIONS.map(dietary => (
                  <div key={dietary} className="flex items-center space-x-2">
                    <Checkbox
                      id={`dietary-${dietary}`}
                      checked={selectedDietary.includes(dietary)}
                      onCheckedChange={() => toggleDietary(dietary)}
                    />
                    <label 
                      htmlFor={`dietary-${dietary}`}
                      className="text-sm cursor-pointer flex items-center gap-1"
                    >
                      {getDietaryIcon(dietary)}
                      {dietary}
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
                      {price} {price === '$' && '(Budget)'}
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
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-orange-600" />
              <p className="text-gray-600 dark:text-gray-300">Finding delicious food options for your party...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {filteredVendors.length} food vendors found
              {zipCode && ` near ${zipCode}`}
            </h3>
            {filteredVendors.some(v => v.isAIRecommended) && (
              <Badge className="bg-gradient-to-r from-orange-600 to-red-600">
                ✨ AI Recommended
              </Badge>
            )}
          </div>

          <div className="grid gap-6">
            {filteredVendors.map((vendor) => (
              <Card key={vendor.id} className={`border-0 shadow-lg dark:bg-slate-800/90 hover:shadow-xl transition-shadow ${vendor.isAIRecommended ? 'ring-2 ring-orange-500/20' : ''}`}>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Image */}
                    <div className="relative">
                      {vendor.images[0] ? (
                        <img
                          src={vendor.images[0]}
                          alt={vendor.name}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-full h-48 rounded-lg bg-gradient-to-br from-orange-100 to-pink-100 flex items-center justify-center text-5xl" role="img" aria-label={`${vendor.name} (no photo available)`}>🍽️</div>
                      )}
                      {vendor.isAIRecommended && (
                        <Badge className="absolute top-2 left-2 bg-gradient-to-r from-orange-600 to-red-600">
                          ✨ AI Pick
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 bg-white/80 hover:bg-white"
                        onClick={() => toggleBookmark(vendor.id)}
                      >
                        <Heart className={`h-4 w-4 ${bookmarkedVendors.has(vendor.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>

                    {/* Details */}
                    <div className="lg:col-span-2 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-semibold mb-2">{vendor.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300 mb-2">
                            <div className="flex items-center gap-1">
                              <UtensilsCrossed className="h-4 w-4" />
                              {vendor.cuisineType.join(', ')}
                            </div>
                            {vendor.distance && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {vendor.distance} miles away
                              </div>
                            )}
                            {vendor.minOrder && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs">Min order: ${vendor.minOrder}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {vendor.deliveryAvailable && (
                              <Badge variant="outline" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                Delivery
                              </Badge>
                            )}
                            {vendor.cateringAvailable && (
                              <Badge variant="outline" className="text-xs">
                                Catering
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 mb-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-medium">{vendor.rating}</span>
                            <span className="text-sm text-gray-500">({vendor.reviews} reviews)</span>
                          </div>
                          <div className={`font-bold text-lg ${getPriceColor(vendor.priceRange)}`}>
                            {vendor.priceRange}
                          </div>
                        </div>
                      </div>

                      <p className="text-gray-600 dark:text-gray-300">{vendor.description}</p>

                      {/* Specialties */}
                      <div>
                        <h4 className="font-medium mb-2">Specialties</h4>
                        <div className="flex flex-wrap gap-2">
                          {vendor.specialties.map((specialty, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {specialty}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Dietary Options */}
                      {vendor.dietaryOptions.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Dietary Options</h4>
                          <div className="flex flex-wrap gap-2">
                            {vendor.dietaryOptions.map((dietary, index) => (
                              <Badge key={index} variant="outline" className="text-xs flex items-center gap-1">
                                {getDietaryIcon(dietary)}
                                {dietary}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Contact & Actions */}
                      <div className="flex items-center justify-between pt-4 border-t">
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {vendor.address}
                          </div>
                          <div className="flex items-center gap-1">
                            <Phone className="h-4 w-4" />
                            {vendor.phone}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleBookmark(vendor.id)}
                          >
                            <Bookmark className={`h-4 w-4 mr-1 ${bookmarkedVendors.has(vendor.id) ? 'fill-current' : ''}`} />
                            {bookmarkedVendors.has(vendor.id) ? 'Saved' : 'Save'}
                          </Button>
                          {vendor.email && (
                            <Button variant="outline" size="sm">
                              <Mail className="h-4 w-4 mr-1" />
                              Contact
                            </Button>
                          )}
                          {vendor.website && (
                            <Button size="sm" className="bg-gradient-to-r from-orange-600 to-red-600">
                              <ExternalLink className="h-4 w-4 mr-1" />
                              Order Online
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

          {filteredVendors.length === 0 && (
            <Card className="border-0 shadow-lg dark:bg-slate-800/90">
              <CardContent className="text-center py-12">
                <UtensilsCrossed className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold mb-2">{loadError ? "We couldn't load food vendors" : 'No food vendors found'}</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  {loadError ? 'Please check your connection and try again in a moment.' : 'Try adjusting your filters or search terms to find more food options.'}
                </p>
                <Button onClick={() => {
                  setSearchTerm("");
                  setSelectedCuisines([]);
                  setSelectedDietary([]);
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