"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  ShoppingBag, 
  ShoppingCart, 
  Heart, 
  MapPin, 
  Search, 
  Star, 
  DollarSign, 
  AlertTriangle, 
  Plus, 
  Minus, 
  ExternalLink,
  Filter,
  Sparkles,
  Cake,
  Home,
  Palette,
  UtensilsCrossed,
  Wine,
  Gift,
  CheckCircle2,
  Target,
  Banknote,
  TrendingUp
} from "lucide-react";

interface ShoppingItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating: number;
  reviews: number;
  category: string;
  platform: 'Amazon' | 'Walmart' | 'Temu' | 'Local';
  affiliateLink: string;
  isTopPick?: boolean;
  isBestDeal?: boolean;
  inWishlist?: boolean;
}

interface LocalVendor {
  id: string;
  name: string;
  rating: number;
  reviews: number;
  category: string;
  address: string;
  phone: string;
  website?: string;
  specialties: string[];
  priceRange: '$' | '$$' | '$$$' | '$$$$';
  description: string;
}

interface ShoppingSuiteProps {
  partyBudget?: number;
  zipCode?: string;
  childAge?: number;
  theme?: string;
  partyId: string;
}

const SHOPPING_CATEGORIES = [
  {
    id: 'cake',
    name: 'Cake & Bakeries',
    icon: <Cake className="h-6 w-6" />,
    color: 'from-pink-500 to-rose-500',
    bgColor: 'bg-pink-50 dark:bg-pink-900/20'
  },
  {
    id: 'venue',
    name: 'Venue Booking',
    icon: <Home className="h-6 w-6" />,
    color: 'from-blue-500 to-indigo-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20'
  },
  {
    id: 'decor',
    name: 'Decor/Balloons',
    icon: <Palette className="h-6 w-6" />,
    color: 'from-purple-500 to-violet-500',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20'
  },
  {
    id: 'food',
    name: 'Food & Pizza',
    icon: <UtensilsCrossed className="h-6 w-6" />,
    color: 'from-orange-500 to-amber-500',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20'
  },
  {
    id: 'beverages',
    name: 'Beverages',
    icon: <Wine className="h-6 w-6" />,
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20'
  },
  {
    id: 'gifts',
    name: 'Return Gifts',
    icon: <Gift className="h-6 w-6" />,
    color: 'from-yellow-500 to-orange-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20'
  }
];

export default function ShoppingSuite({ 
  partyBudget = 0, 
  zipCode = '', 
  childAge = 5, 
  theme = 'superhero',
  partyId 
}: ShoppingSuiteProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchZipCode, setSearchZipCode] = useState(zipCode);
  const [wishlist, setWishlist] = useState<ShoppingItem[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [localVendors, setLocalVendors] = useState<LocalVendor[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['Amazon', 'Walmart', 'Temu']);

  // Load wishlist from localStorage
  useEffect(() => {
    const savedWishlist = localStorage.getItem(`shopping_wishlist_${partyId}`);
    if (savedWishlist) {
      try {
        const parsed = JSON.parse(savedWishlist);
        setWishlist(parsed);
        const total = parsed.reduce((sum: number, item: ShoppingItem) => sum + item.price, 0);
        setTotalSpent(total);
      } catch (error) {
        console.error('Error loading wishlist:', error);
      }
    }
  }, [partyId]);

  // Mock data for products
  useEffect(() => {
    const mockProducts: ShoppingItem[] = [
      {
        id: '1',
        name: 'Superhero Party Decorations Kit',
        price: 24.99,
        originalPrice: 34.99,
        image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=300',
        rating: 4.5,
        reviews: 128,
        category: 'decor',
        platform: 'Amazon',
        affiliateLink: '#',
        isTopPick: true,
        isBestDeal: true
      },
      {
        id: '2',
        name: 'Custom Birthday Cake Topper',
        price: 12.99,
        image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=300',
        rating: 4.8,
        reviews: 89,
        category: 'cake',
        platform: 'Walmart',
        affiliateLink: '#',
        isTopPick: true
      },
      {
        id: '3',
        name: 'Party Favor Goodie Bags (24 pack)',
        price: 18.99,
        originalPrice: 28.99,
        image: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=300',
        rating: 4.3,
        reviews: 156,
        category: 'gifts',
        platform: 'Temu',
        affiliateLink: '#',
        isBestDeal: true
      },
      {
        id: '4',
        name: 'Colorful Balloon Arch Kit',
        price: 32.99,
        image: 'https://images.unsplash.com/photo-1464207687429-7505649dae38?w=300',
        rating: 4.6,
        reviews: 203,
        category: 'decor',
        platform: 'Amazon',
        affiliateLink: '#'
      },
      {
        id: '5',
        name: 'Princess Party Crown Set',
        price: 15.99,
        image: 'https://images.unsplash.com/photo-1485081669829-bacb8c7bb1f3?w=300',
        rating: 4.7,
        reviews: 94,
        category: 'gifts',
        platform: 'Walmart',
        affiliateLink: '#'
      }
    ];

    const mockVendors: LocalVendor[] = [
      {
        id: 'v1',
        name: 'Sweet Dreams Bakery',
        rating: 4.8,
        reviews: 342,
        category: 'cake',
        address: '123 Main St, Your City',
        phone: '(555) 123-4567',
        website: 'sweetdreamsbakery.com',
        specialties: ['Custom Birthday Cakes', 'Superhero Designs', 'Gluten-Free Options'],
        priceRange: '$$',
        description: 'Best custom birthday cakes in town! Specializing in superhero and princess themes.'
      },
      {
        id: 'v2',
        name: 'Mario\'s Pizza Palace',
        rating: 4.5,
        reviews: 578,
        category: 'food',
        address: '456 Oak Ave, Your City',
        phone: '(555) 987-6543',
        specialties: ['Party Pizza Packages', 'Kids Menu', 'Fast Delivery'],
        priceRange: '$',
        description: 'Perfect for birthday parties! Large group orders and kid-friendly atmosphere.'
      },
      {
        id: 'v3',
        name: 'Rainbow Event Center',
        rating: 4.6,
        reviews: 127,
        category: 'venue',
        address: '789 Party Blvd, Your City',
        phone: '(555) 456-7890',
        website: 'rainboweventcenter.com',
        specialties: ['Kids Birthday Parties', 'Indoor Playground', 'Full Catering'],
        priceRange: '$$$',
        description: 'Complete party venue with entertainment, decorations, and catering included.'
      }
    ];

    setShoppingItems(mockProducts);
    setLocalVendors(mockVendors);
  }, []);

  const addToWishlist = (item: ShoppingItem) => {
    const updatedWishlist = [...wishlist, { ...item, inWishlist: true }];
    setWishlist(updatedWishlist);
    setTotalSpent(prev => prev + item.price);
    
    // Save to localStorage
    localStorage.setItem(`shopping_wishlist_${partyId}`, JSON.stringify(updatedWishlist));
  };

  const removeFromWishlist = (itemId: string) => {
    const item = wishlist.find(i => i.id === itemId);
    if (item) {
      const updatedWishlist = wishlist.filter(i => i.id !== itemId);
      setWishlist(updatedWishlist);
      setTotalSpent(prev => prev - item.price);
      
      // Save to localStorage
      localStorage.setItem(`shopping_wishlist_${partyId}`, JSON.stringify(updatedWishlist));
    }
  };

  const isInWishlist = (itemId: string) => {
    return wishlist.some(item => item.id === itemId);
  };

  const getFilteredProducts = () => {
    return shoppingItems.filter(item => {
      const matchesCategory = !selectedCategory || item.category === selectedCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPlatform = selectedPlatforms.includes(item.platform);
      const matchesPrice = item.price >= priceRange[0] && item.price <= priceRange[1];
      
      return matchesCategory && matchesSearch && matchesPlatform && matchesPrice;
    });
  };

  const getFilteredVendors = () => {
    return localVendors.filter(vendor => {
      const matchesCategory = !selectedCategory || vendor.category === selectedCategory;
      const matchesSearch = vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           vendor.specialties.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return matchesCategory && matchesSearch;
    });
  };

  const budgetWarning = partyBudget > 0 && totalSpent > partyBudget;

  return (
    <div className="space-y-6">
      {/* Shopping Header with Budget Tracker */}
      <Card className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-2 rounded-full">
                <ShoppingBag className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Party Shopping Suite</CardTitle>
                <CardDescription>Find everything for your perfect party</CardDescription>
              </div>
            </div>
            
            {/* Budget Tracker */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm text-gray-600 dark:text-gray-300">Shopping Budget</div>
                <div className={`text-lg font-bold ${budgetWarning ? 'text-red-600' : 'text-green-600'}`}>
                  ${totalSpent.toFixed(2)} / ${partyBudget > 0 ? partyBudget.toFixed(2) : '∞'}
                </div>
                {budgetWarning && (
                  <div className="flex items-center gap-1 text-red-600 text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    Over budget!
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm">
                <Heart className="h-4 w-4 mr-2" />
                Wishlist ({wishlist.length})
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Category Selection */}
      <Card className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Shopping Categories
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {SHOPPING_CATEGORIES.map((category) => (
              <Card 
                key={category.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                  selectedCategory === category.id 
                    ? 'ring-2 ring-purple-500 border-purple-300' 
                    : 'hover:border-purple-200'
                } ${category.bgColor}`}
                onClick={() => setSelectedCategory(selectedCategory === category.id ? null : category.id)}
              >
                <CardContent className="p-4 text-center">
                  <div className={`bg-gradient-to-r ${category.color} p-3 rounded-full w-fit mx-auto mb-2`}>
                    <div className="text-white">
                      {category.icon}
                    </div>
                  </div>
                  <h3 className="font-semibold text-sm">{category.name}</h3>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Card className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search products, vendors, or specialties..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Zip code"
                  value={searchZipCode}
                  onChange={(e) => setSearchZipCode(e.target.value)}
                  className="pl-10 w-32"
                />
              </div>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-slate-700 rounded-lg space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Platforms</label>
                <div className="flex gap-2 flex-wrap">
                  {['Amazon', 'Walmart', 'Temu'].map(platform => (
                    <Button
                      key={platform}
                      variant={selectedPlatforms.includes(platform) ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (selectedPlatforms.includes(platform)) {
                          setSelectedPlatforms(prev => prev.filter(p => p !== platform));
                        } else {
                          setSelectedPlatforms(prev => [...prev, platform]);
                        }
                      }}
                    >
                      {platform}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Shopping Content */}
      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="products">Affiliate Products</TabsTrigger>
          <TabsTrigger value="local">Local Vendors</TabsTrigger>
          <TabsTrigger value="wishlist">Shopping List</TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {getFilteredProducts().map((item) => (
              <Card key={item.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow dark:bg-slate-800/90">
                <div className="relative">
                  <img 
                    src={item.image} 
                    alt={item.name}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                  {item.isTopPick && (
                    <Badge className="absolute top-2 left-2 bg-purple-600">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Top Pick
                    </Badge>
                  )}
                  {item.isBestDeal && (
                    <Badge className="absolute top-2 right-2 bg-red-600">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Best Deal
                    </Badge>
                  )}
                </div>
                
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-2 line-clamp-2">{item.name}</h3>
                  
                  <div className="flex items-center gap-1 mb-2">
                    <div className="flex text-yellow-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`h-3 w-3 ${i < Math.floor(item.rating) ? 'fill-current' : ''}`} />
                      ))}
                    </div>
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      ({item.reviews})
                    </span>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-lg font-bold text-green-600">${item.price}</span>
                      {item.originalPrice && (
                        <span className="text-sm text-gray-500 line-through ml-1">
                          ${item.originalPrice}
                        </span>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {item.platform}
                    </Badge>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
                      onClick={() => window.open(item.affiliateLink, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Shop Now
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => isInWishlist(item.id) ? removeFromWishlist(item.id) : addToWishlist(item)}
                    >
                      <Heart className={`h-3 w-3 ${isInWishlist(item.id) ? 'fill-current text-red-500' : ''}`} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {getFilteredProducts().length === 0 && (
            <Card className="border-0 shadow-lg dark:bg-slate-800/90">
              <CardContent className="p-8 text-center">
                <ShoppingBag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No products found</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Try adjusting your search terms or filters
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Local Vendors Tab */}
        <TabsContent value="local" className="space-y-4">
          <div className="space-y-4">
            {getFilteredVendors().map((vendor) => (
              <Card key={vendor.id} className="border-0 shadow-lg dark:bg-slate-800/90">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-1">{vendor.name}</h3>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex text-yellow-400">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className={`h-4 w-4 ${i < Math.floor(vendor.rating) ? 'fill-current' : ''}`} />
                          ))}
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {vendor.rating} ({vendor.reviews} reviews)
                        </span>
                        <Badge variant="outline">{vendor.priceRange}</Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                        {vendor.description}
                      </p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-1">
                        <MapPin className="h-4 w-4" />
                        {vendor.address}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        📞 {vendor.phone}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm mb-1">Specialties:</h4>
                      <div className="flex flex-wrap gap-1">
                        {vendor.specialties.map((specialty, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {specialty}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {vendor.website && (
                      <Button 
                        size="sm" 
                        onClick={() => window.open(`https://${vendor.website}`, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Visit Website
                      </Button>
                    )}
                    <Button size="sm" variant="outline">
                      📞 Call Now
                    </Button>
                    <Button size="sm" variant="outline">
                      📍 Get Directions
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {getFilteredVendors().length === 0 && (
            <Card className="border-0 shadow-lg dark:bg-slate-800/90">
              <CardContent className="p-8 text-center">
                <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No local vendors found</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Try entering your zip code or expanding your search area
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Wishlist Tab */}
        <TabsContent value="wishlist" className="space-y-4">
          <Card className="border-0 shadow-lg dark:bg-slate-800/90">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Party Shopping List
                </CardTitle>
                <div className="text-right">
                  <div className="text-sm text-gray-600 dark:text-gray-300">Total Estimated Cost</div>
                  <div className={`text-xl font-bold ${budgetWarning ? 'text-red-600' : 'text-green-600'}`}>
                    ${totalSpent.toFixed(2)}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {wishlist.length === 0 ? (
                <div className="text-center py-8">
                  <Heart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Your shopping list is empty</h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Add items from the products or vendors tabs to start planning
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {wishlist.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 p-3 border rounded-lg">
                      <img 
                        src={item.image} 
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium">{item.name}</h4>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <Badge variant="outline">{item.platform}</Badge>
                          <span>${item.price}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeFromWishlist(item.id)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  
                  {budgetWarning && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mt-4">
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                        <h4 className="font-semibold">Budget Warning</h4>
                      </div>
                      <p className="text-sm text-red-600 mt-1">
                        Your shopping list total (${totalSpent.toFixed(2)}) exceeds your party budget (${partyBudget.toFixed(2)}).
                        Consider removing some items or adjusting your budget.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Shopping Tips */}
      <Card className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Shopping Checklist & Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Don't Forget:</h4>
              <ul className="space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Order cake 2-3 weeks in advance
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Book venue early for weekend parties
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Consider dietary restrictions for food
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Order decorations 1-2 weeks ahead
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Money-Saving Tips:</h4>
              <ul className="space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-green-600" />
                  Compare prices across platforms
                </li>
                <li className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-green-600" />
                  Look for bulk discounts
                </li>
                <li className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-green-600" />
                  DIY decorations can save 40-60%
                </li>
                <li className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-green-600" />
                  Local vendors often negotiate
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}