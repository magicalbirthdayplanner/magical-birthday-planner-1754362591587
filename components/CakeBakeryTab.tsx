"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { 
  MapPin, 
  Search, 
  Star, 
  DollarSign, 
  ExternalLink,
  Filter,
  Cake,
  Heart,
  Phone,
  Clock,
  Users,
  Loader2,
  Bookmark,
  Mail,
  AlertTriangle,
  ShieldCheck,
  Leaf
} from "lucide-react";

interface CakeBakery {
  id: string;
  name: string;
  rating: number;
  reviews: number;
  priceRange: '$' | '$$' | '$$$' | '$$$$';
  address: string;
  phone: string;
  website?: string;
  email?: string;
  description: string;
  specialties: string[];
  allergenFree: string[];
  distance?: number;
  popularity?: number;
  images: string[];
  isRecommended?: boolean;
  isBookmarked?: boolean;
  minOrder?: number;
  deliveryAvailable: boolean;
  customDesignAvailable: boolean;
  averageOrderTime: string;
}

interface CakeBakeryTabProps {
  zipCode?: string;
  partyId: string;
  guestCount?: number;
}

const ALLERGEN_OPTIONS = [
  'Gluten Free',
  'Nut Free', 
  'Dairy Free',
  'Egg Free',
  'Soy Free',
  'Vegan',
  'Sugar Free'
];

const CAKE_SPECIALTIES = [
  'Custom Birthday Cakes',
  'Theme Cakes',
  'Character Cakes',
  'Photo Cakes',
  'Cupcakes',
  'Cake Pops',
  'Tier Cakes',
  'Sheet Cakes',
  'Organic/Natural',
  'Gluten-Free Specialty'
];

export default function CakeBakeryTab({ zipCode, partyId, guestCount = 0 }: CakeBakeryTabProps) {
  const [bakeries, setBakeries] = useState<CakeBakery[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<string[]>([]);
  const [minRating, setMinRating] = useState([3]);
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'reviews' | 'popularity'>('rating');
  const [bookmarkedBakeries, setBookmarkedBakeries] = useState<Set<string>>(new Set());
  const [customDesignOnly, setCustomDesignOnly] = useState(false);
  const [deliveryOnly, setDeliveryOnly] = useState(false);

  // Load bookmarked bakeries from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`cake_bookmarks_${partyId}`);
      if (saved) {
        try {
          setBookmarkedBakeries(new Set(JSON.parse(saved)));
        } catch (error) {
          console.error('Error loading cake bookmarks:', error);
        }
      }
    }
  }, [partyId]);

  // Fetch bakeries data
  useEffect(() => {
    fetchBakeries();
  }, [zipCode]);

  const fetchBakeries = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/cake-bakeries?zipCode=${zipCode || ''}&guestCount=${guestCount}`);
      if (response.ok) {
        const data = await response.json();
        setBakeries(data.bakeries || []);
      } else {
        // Fallback to mock data if API not available
        setBakeries(getMockBakeries());
      }
    } catch (error) {
      console.error('Error fetching bakeries:', error);
      setBakeries(getMockBakeries());
    } finally {
      setLoading(false);
    }
  };

  // Mock data for demonstration
  const getMockBakeries = (): CakeBakery[] => [
    {
      id: '1',
      name: 'Sweet Dreams Custom Cakes',
      rating: 4.9,
      reviews: 234,
      priceRange: '$$$',
      address: '123 Baker St, Your City',
      phone: '(555) 123-4567',
      website: 'sweetdreamscakes.com',
      email: 'orders@sweetdreamscakes.com',
      description: 'Award-winning custom cake designers specializing in themed birthday cakes. We create edible masterpieces that make your celebration unforgettable.',
      specialties: ['Custom Birthday Cakes', 'Theme Cakes', 'Character Cakes', 'Photo Cakes'],
      allergenFree: ['Gluten Free', 'Nut Free', 'Dairy Free'],
      distance: 2.3,
      popularity: 4.9 * Math.log(234 + 1),
      images: ['https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=300'],
      isRecommended: true,
      minOrder: 50,
      deliveryAvailable: true,
      customDesignAvailable: true,
      averageOrderTime: '3-5 days'
    },
    {
      id: '2',
      name: 'The Cupcake Corner',
      rating: 4.7,
      reviews: 189,
      priceRange: '$$',
      address: '456 Sugar Ave, Your City',
      phone: '(555) 987-6543',
      website: 'cupcakecorner.com',
      description: 'Family-owned bakery famous for fresh cupcakes and creative cake designs. Perfect for kids\' parties with fun flavors and decorations.',
      specialties: ['Cupcakes', 'Cake Pops', 'Custom Birthday Cakes', 'Sheet Cakes'],
      allergenFree: ['Gluten Free', 'Vegan'],
      distance: 1.8,
      popularity: 4.7 * Math.log(189 + 1),
      images: ['https://images.unsplash.com/photo-1587668178277-295251f900ce?w=300'],
      isRecommended: true,
      minOrder: 25,
      deliveryAvailable: true,
      customDesignAvailable: true,
      averageOrderTime: '2-3 days'
    },
    {
      id: '3',
      name: 'Artisan Cake Studio',
      rating: 4.8,
      reviews: 156,
      priceRange: '$$$$',
      address: '789 Design Blvd, Your City',
      phone: '(555) 456-7890',
      email: 'info@artisancakestudio.com',
      description: 'High-end cake artistry for special occasions. Each cake is a unique work of art crafted with premium ingredients.',
      specialties: ['Tier Cakes', 'Custom Birthday Cakes', 'Photo Cakes', 'Organic/Natural'],
      allergenFree: ['Organic/Natural', 'Gluten Free', 'Sugar Free'],
      distance: 4.2,
      popularity: 4.8 * Math.log(156 + 1),
      images: ['https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=300'],
      minOrder: 100,
      deliveryAvailable: false,
      customDesignAvailable: true,
      averageOrderTime: '5-7 days'
    },
    {
      id: '4',
      name: 'Happy Kids Bakery',
      rating: 4.6,
      reviews: 298,
      priceRange: '$',
      address: '321 Fun Street, Your City',
      phone: '(555) 234-5678',
      description: 'Budget-friendly bakery specializing in kids\' birthday cakes with fun designs and great taste.',
      specialties: ['Character Cakes', 'Sheet Cakes', 'Cupcakes', 'Theme Cakes'],
      allergenFree: ['Nut Free'],
      distance: 3.1,
      popularity: 4.6 * Math.log(298 + 1),
      images: ['https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=300'],
      minOrder: 20,
      deliveryAvailable: true,
      customDesignAvailable: false,
      averageOrderTime: '1-2 days'
    },
    {
      id: '5',
      name: 'Gluten-Free Delights',
      rating: 4.5,
      reviews: 127,
      priceRange: '$$',
      address: '654 Health Way, Your City',
      phone: '(555) 345-6789',
      website: 'glutenfreeedelights.com',
      description: 'Dedicated gluten-free bakery ensuring safe treats for those with dietary restrictions without compromising on taste.',
      specialties: ['Gluten-Free Specialty', 'Custom Birthday Cakes', 'Cupcakes'],
      allergenFree: ['Gluten Free', 'Dairy Free', 'Nut Free', 'Egg Free'],
      distance: 5.7,
      popularity: 4.5 * Math.log(127 + 1),
      images: ['https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=300'],
      minOrder: 30,
      deliveryAvailable: true,
      customDesignAvailable: true,
      averageOrderTime: '2-4 days'
    }
  ];

  const getFilteredBakeries = () => {
    return bakeries.filter(bakery => {
      const matchesSearch = bakery.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           bakery.specialties.some(s => s.toLowerCase().includes(searchTerm.toLowerCase())) ||
                           bakery.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesSpecialties = selectedSpecialties.length === 0 || 
                                selectedSpecialties.some(specialty => bakery.specialties.includes(specialty));
      
      const matchesAllergens = selectedAllergens.length === 0 || 
                              selectedAllergens.some(allergen => bakery.allergenFree.includes(allergen));
      
      const matchesPriceRange = priceRange.length === 0 || priceRange.includes(bakery.priceRange);
      
      const matchesRating = bakery.rating >= minRating[0];
      
      const matchesCustomDesign = !customDesignOnly || bakery.customDesignAvailable;
      
      const matchesDelivery = !deliveryOnly || bakery.deliveryAvailable;
      
      return matchesSearch && matchesSpecialties && matchesAllergens && 
             matchesPriceRange && matchesRating && matchesCustomDesign && matchesDelivery;
    });
  };

  const getSortedBakeries = () => {
    const filtered = getFilteredBakeries();
    
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'distance':
          return (a.distance || 999) - (b.distance || 999);
        case 'rating':
          return b.rating - a.rating;
        case 'reviews':
          return b.reviews - a.reviews;
        case 'popularity':
          const aPopularity = a.rating * Math.log(a.reviews + 1);
          const bPopularity = b.rating * Math.log(b.reviews + 1);
          return bPopularity - aPopularity;
        default:
          return 0;
      }
    });
  };

  const toggleBookmark = (bakeryId: string) => {
    const newBookmarks = new Set(bookmarkedBakeries);
    if (newBookmarks.has(bakeryId)) {
      newBookmarks.delete(bakeryId);
    } else {
      newBookmarks.add(bakeryId);
    }
    setBookmarkedBakeries(newBookmarks);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(`cake_bookmarks_${partyId}`, JSON.stringify(Array.from(newBookmarks)));
    }
  };

  const toggleSpecialty = (specialty: string) => {
    setSelectedSpecialties(prev => 
      prev.includes(specialty) 
        ? prev.filter(s => s !== specialty)
        : [...prev, specialty]
    );
  };

  const toggleAllergen = (allergen: string) => {
    setSelectedAllergens(prev => 
      prev.includes(allergen) 
        ? prev.filter(a => a !== allergen)
        : [...prev, allergen]
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

  const getAllergenIcon = (allergen: string) => {
    switch (allergen) {
      case 'Vegan':
        return <Leaf className="h-3 w-3 text-green-600" />;
      case 'Gluten Free':
      case 'Nut Free':
      case 'Dairy Free':
      case 'Egg Free':
      case 'Soy Free':
      case 'Sugar Free':
        return <ShieldCheck className="h-3 w-3 text-blue-600" />;
      default:
        return <AlertTriangle className="h-3 w-3 text-orange-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent mb-2">
          Cake & Bakery Recommendations
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Find the perfect cake and bakery for your party with custom designs, allergen accommodations, and quality reviews
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
              placeholder="Search by bakery name, specialty, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Specialty Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Specialties</label>
              <div className="max-h-32 overflow-y-auto space-y-2 pr-2">
                {CAKE_SPECIALTIES.map(specialty => (
                  <div key={specialty} className="flex items-center space-x-2">
                    <Checkbox
                      id={`specialty-${specialty}`}
                      checked={selectedSpecialties.includes(specialty)}
                      onCheckedChange={() => toggleSpecialty(specialty)}
                    />
                    <label 
                      htmlFor={`specialty-${specialty}`}
                      className="text-sm cursor-pointer"
                    >
                      {specialty}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Allergen Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Allergen-Free Options</label>
              <div className="max-h-32 overflow-y-auto space-y-2 pr-2">
                {ALLERGEN_OPTIONS.map(allergen => (
                  <div key={allergen} className="flex items-center space-x-2">
                    <Checkbox
                      id={`allergen-${allergen}`}
                      checked={selectedAllergens.includes(allergen)}
                      onCheckedChange={() => toggleAllergen(allergen)}
                    />
                    <label 
                      htmlFor={`allergen-${allergen}`}
                      className="text-sm cursor-pointer flex items-center gap-1"
                    >
                      {getAllergenIcon(allergen)}
                      {allergen}
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
                      {price}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Rating Filter */}
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

            {/* Additional Filters */}
            <div>
              <label className="text-sm font-medium mb-2 block">Additional Options</label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="custom-design"
                    checked={customDesignOnly}
                    onCheckedChange={(checked) => setCustomDesignOnly(checked === true)}
                  />
                  <label htmlFor="custom-design" className="text-sm cursor-pointer">
                    Custom Design Available
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="delivery"
                    checked={deliveryOnly}
                    onCheckedChange={(checked) => setDeliveryOnly(checked === true)}
                  />
                  <label htmlFor="delivery" className="text-sm cursor-pointer">
                    Delivery Available
                  </label>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sort and Results Count */}
      <Card className="border-0 shadow-lg dark:bg-slate-800/90">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cake className="h-5 w-5 text-pink-600" />
              <span className="font-medium">
                {getSortedBakeries().length} bakeries found
                {zipCode && ` near ${zipCode}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">Sort by:</span>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-sm border border-gray-300 dark:border-slate-600 rounded-md px-3 py-1 bg-white dark:bg-slate-700 dark:text-gray-200"
              >
                <option value="rating">Customer Rating</option>
                <option value="distance">Distance</option>
                <option value="reviews">Most Reviews</option>
                <option value="popularity">Popularity</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bakeries List */}
      {loading ? (
        <Card className="border-0 shadow-lg dark:bg-slate-800/90">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-300">Loading bakeries...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {getSortedBakeries().map((bakery) => (
            <Card key={bakery.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow dark:bg-slate-800/90">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{bakery.name}</h3>
                      {bakery.isRecommended && (
                        <Badge className="bg-pink-600">
                          <Cake className="h-3 w-3 mr-1" />
                          Recommended
                        </Badge>
                      )}
                      {bakery.customDesignAvailable && (
                        <Badge variant="outline" className="border-purple-300 text-purple-700">
                          Custom Design
                        </Badge>
                      )}
                      {bakery.deliveryAvailable && (
                        <Badge variant="outline" className="border-green-300 text-green-700">
                          Delivery
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex text-yellow-400">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`h-4 w-4 ${i < Math.floor(bakery.rating) ? 'fill-current' : ''}`} />
                        ))}
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {bakery.rating} ({bakery.reviews} reviews)
                      </span>
                      <Badge variant="outline" className={getPriceColor(bakery.priceRange)}>
                        {bakery.priceRange}
                      </Badge>
                      {bakery.distance && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          {bakery.distance} mi
                        </Badge>
                      )}
                    </div>

                    <p className="text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                      {bakery.description}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleBookmark(bakery.id)}
                    className="ml-4"
                  >
                    <Bookmark className={`h-4 w-4 ${bookmarkedBakeries.has(bakery.id) ? 'fill-current text-pink-600' : ''}`} />
                  </Button>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-1">
                      <MapPin className="h-4 w-4" />
                      {bakery.address}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-1">
                      <Phone className="h-4 w-4" />
                      {bakery.phone}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <Clock className="h-4 w-4" />
                      Order time: {bakery.averageOrderTime}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm mb-2">Specialties:</h4>
                    <div className="flex flex-wrap gap-1">
                      {bakery.specialties.slice(0, 3).map((specialty, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {specialty}
                        </Badge>
                      ))}
                      {bakery.specialties.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{bakery.specialties.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm mb-2">Allergen-Free Options:</h4>
                    <div className="flex flex-wrap gap-1">
                      {bakery.allergenFree.map((allergen, index) => (
                        <Badge key={index} variant="outline" className="text-xs flex items-center gap-1">
                          {getAllergenIcon(allergen)}
                          {allergen}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {bakery.minOrder && (
                  <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    <DollarSign className="inline h-4 w-4 mr-1" />
                    Minimum order: ${bakery.minOrder}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {bakery.website && (
                    <Button 
                      size="sm" 
                      onClick={() => window.open(`https://${bakery.website}`, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Visit Website
                    </Button>
                  )}
                  <Button size="sm" variant="outline">
                    <Phone className="h-3 w-3 mr-1" />
                    Call Now
                  </Button>
                  {bakery.email && (
                    <Button size="sm" variant="outline">
                      <Mail className="h-3 w-3 mr-1" />
                      Email
                    </Button>
                  )}
                  <Button size="sm" variant="outline">
                    <MapPin className="h-3 w-3 mr-1" />
                    Directions
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {getSortedBakeries().length === 0 && !loading && (
        <Card className="border-0 shadow-lg dark:bg-slate-800/90">
          <CardContent className="p-8 text-center">
            <Cake className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No bakeries found</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Try adjusting your search terms or filters, or enter your zip code for local results
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}