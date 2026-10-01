import { NextRequest, NextResponse } from 'next/server';
import { haversineMiles } from '@/lib/geo/distance';
import { resolveZip } from '@/lib/geo/zip';
import { isValidPhotoName, normalizePlace } from '@/lib/google/places';
import { photoProxyUrl } from '@/lib/discovery/client-venue';
import { SupabaseDiscoveryStore } from '@/lib/discovery/supabase-store';
import { getSupabaseAdmin, hasServiceRole } from '@/lib/server/supabase-admin';
import { rateLimit } from '@/lib/server/rate-limit';
import { clientIp } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

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
  distance?: number;
  popularity?: number;
  images: string[];
  isAIRecommended?: boolean;
  deliveryAvailable?: boolean;
  cateringAvailable?: boolean;
  minOrder?: number;
}

// Geocode ZIP code to coordinates using Google Geocoding API
async function geocodeZipCode(zipCode: string): Promise<{latitude: number, longitude: number}> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  
  if (!apiKey) {
    throw new Error('Google Places API key not found');
  }

  // Format ZIP code with country for better geocoding results
  const address = `${zipCode},USA`;
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  
  try {
    const response = await fetch(geocodeUrl);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      console.log(`Geocoded ZIP ${zipCode} to coordinates: ${location.lat}, ${location.lng}`);
      return {
        latitude: location.lat,
        longitude: location.lng
      };
    } else {
      console.error('Geocoding failed:', data.status, data.error_message);
      // Fallback to a default location if geocoding fails
      return {
        latitude: 42.3314, // Default to Detroit area coordinates
        longitude: -83.0458
      };
    }
  } catch (error) {
    console.error('Error geocoding ZIP code:', error);
    // Fallback to a default location if geocoding fails
    return {
      latitude: 42.3314, // Default to Detroit area coordinates
      longitude: -83.0458
    };
  }
}

// Google Places API (New) integration for restaurants
async function searchGooglePlacesRestaurants(query: string, zipCode: string, radius: number = 50000) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  
  if (!apiKey) {
    throw new Error('Google Places API key not found');
  }

  // Geocode the ZIP code to get actual coordinates
  const coordinates = await geocodeZipCode(zipCode);

  // Use the new Places API (New) endpoint
  const baseUrl = 'https://places.googleapis.com/v1/places:searchText';
  
  const requestBody = {
    textQuery: query,
    locationBias: {
      circle: {
        center: {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude
        },
        radius: radius
      }
    },
    maxResultCount: 20,
    languageCode: 'en'
  };

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.nationalPhoneNumber,places.websiteUri,places.photos,places.types,places.id,places.location'
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Google Places API error:', response.status, errorText);
    throw new Error(`Google Places API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.places) {
    console.log('No restaurants found in response:', data);
    return [];
  }

  return data.places;
}

// Map Google Places types to cuisine types
function mapCuisineTypes(types: string[]): string[] {
  const cuisineMap: { [key: string]: string } = {
    'restaurant': 'Restaurant',
    'meal_takeaway': 'Takeout',
    'meal_delivery': 'Delivery',
    'bakery': 'Bakery',
    'cafe': 'Cafe',
    'bar': 'Bar',
    'pizza': 'Pizza',
    'hamburger': 'American',
    'sandwich': 'Sandwich',
    'seafood': 'Seafood',
    'steak_house': 'Steakhouse',
    'sushi': 'Japanese',
    'chinese': 'Chinese',
    'indian': 'Indian',
    'thai': 'Thai',
    'mexican': 'Mexican',
    'italian': 'Italian',
    'french': 'French',
    'greek': 'Greek',
    'mediterranean': 'Mediterranean',
    'korean': 'Korean',
    'vietnamese': 'Vietnamese',
    'japanese': 'Japanese',
    'dessert': 'Desserts',
    'ice_cream': 'Ice Cream',
    'fast_food': 'Fast Food'
  };

  const cuisines = types
    .map(type => cuisineMap[type])
    .filter(Boolean)
    .filter((cuisine, index, arr) => arr.indexOf(cuisine) === index); // Remove duplicates

  return cuisines.length > 0 ? cuisines : ['Restaurant'];
}

// Generate specialties based on cuisine type
function generateSpecialties(cuisineTypes: string[]): string[] {
  const specialtyMap: { [key: string]: string[] } = {
    'Pizza': ['Margherita Pizza', 'Pepperoni', 'Custom Party Platters', 'Garlic Bread'],
    'American': ['Classic Cheeseburger', 'Mini Sliders', 'Sweet Potato Fries', 'Milkshakes'],
    'Chinese': ['Sweet & Sour Chicken', 'Fried Rice', 'Dumplings', 'Lo Mein', 'Fortune Cookies'],
    'Italian': ['Pasta', 'Pizza', 'Garlic Bread', 'Tiramisu'],
    'Mexican': ['Taco Bar', 'Quesadillas', 'Nachos', 'Mild Salsa', 'Guacamole'],
    'Japanese': ['California Rolls', 'Chicken Teriyaki', 'Edamame', 'Miso Soup', 'Tempura'],
    'Indian': ['Butter Chicken', 'Biryani', 'Samosas', 'Naan Bread', 'Mango Lassi'],
    'Mediterranean': ['Grilled Chicken', 'Hummus Platters', 'Pita Bread', 'Greek Salad', 'Baklava'],
    'Bakery': ['Custom Birthday Cakes', 'Cupcakes', 'Cookies', 'Cake Pops', 'Themed Desserts'],
    'Desserts': ['Birthday Cakes', 'Cupcakes', 'Cookies', 'Ice Cream', 'Candy'],
    'Fast Food': ['Burgers', 'Fries', 'Chicken Nuggets', 'Milkshakes'],
    'Seafood': ['Fish & Chips', 'Shrimp', 'Crab Cakes', 'Lobster Rolls'],
    'Steakhouse': ['Steak', 'Ribs', 'Baked Potato', 'Caesar Salad']
  };

  const specialties: string[] = [];
  cuisineTypes.forEach(cuisine => {
    if (specialtyMap[cuisine]) {
      specialties.push(...specialtyMap[cuisine]);
    }
  });

  // Remove duplicates and limit to 5 specialties
  return Array.from(new Set(specialties)).slice(0, 5);
}

// Generate dietary options based on cuisine type
function generateDietaryOptions(cuisineTypes: string[]): string[] {
  const dietaryMap: { [key: string]: string[] } = {
    'Indian': ['Vegetarian', 'Vegan', 'Gluten Free', 'Dairy Free'],
    'Mediterranean': ['Vegetarian', 'Vegan', 'Gluten Free', 'Dairy Free'],
    'Japanese': ['Vegetarian', 'Gluten Free'],
    'Mexican': ['Vegetarian', 'Vegan', 'Gluten Free'],
    'Chinese': ['Vegetarian', 'Gluten Free'],
    'Italian': ['Vegetarian', 'Gluten Free'],
    'Bakery': ['Vegetarian', 'Vegan', 'Gluten Free', 'Nut Free', 'Dairy Free'],
    'Desserts': ['Vegetarian', 'Vegan', 'Gluten Free', 'Nut Free', 'Dairy Free']
  };

  const dietaryOptions: string[] = ['Vegetarian']; // Default option
  cuisineTypes.forEach(cuisine => {
    if (dietaryMap[cuisine]) {
      dietaryOptions.push(...dietaryMap[cuisine]);
    }
  });

  // Remove duplicates
  return Array.from(new Set(dietaryOptions));
}

// AI-powered food vendor recommendation logic
async function getAIRecommendedVendors(vendors: FoodVendor[], zipCode: string, guestCount: number): Promise<FoodVendor[]> {
  try {
    const recommendations = vendors.map(vendor => {
      let score = vendor.rating * 20; // Base score from rating
      
      // Guest count considerations
      if (guestCount > 0) {
        if (vendor.cateringAvailable) {
          score += 15; // Catering is ideal for parties
        }
        if (vendor.minOrder && vendor.minOrder <= guestCount * 15) {
          score += 10; // Reasonable minimum order
        }
      }
      
      // Distance preference (closer is better)
      if (vendor.distance && vendor.distance <= 3) {
        score += 15;
      } else if (vendor.distance && vendor.distance <= 7) {
        score += 10;
      } else if (vendor.distance && vendor.distance <= 15) {
        score += 5;
      }
      
      // Review count (more reviews = more reliable)
      if (vendor.reviews > 150) {
        score += 15;
      } else if (vendor.reviews > 75) {
        score += 10;
      } else if (vendor.reviews > 25) {
        score += 5;
      }
      
      // Kid-friendly cuisine types
      const kidFriendlyCuisines = ['Pizza', 'American', 'Burgers', 'Desserts', 'Bakery', 'Italian'];
      const hasKidFriendly = vendor.cuisineType.some(cuisine => 
        kidFriendlyCuisines.some(friendly => cuisine.toLowerCase().includes(friendly.toLowerCase()))
      );
      if (hasKidFriendly) {
        score += 12;
      }
      
      // Dietary accommodations (important for parties)
      const commonDietary = ['Vegetarian', 'Gluten Free', 'Nut Free'];
      const hasDietaryOptions = vendor.dietaryOptions.some(dietary => 
        commonDietary.includes(dietary)
      );
      if (hasDietaryOptions) {
        score += 8;
      }
      
      // Delivery and catering availability
      if (vendor.deliveryAvailable) {
        score += 8;
      }
      if (vendor.cateringAvailable) {
        score += 10;
      }
      
      // Kid-friendly specialties
      const kidFriendlySpecialties = ['pizza', 'burger', 'cake', 'cookies', 'fries', 'chicken', 'sandwich'];
      const hasKidSpecialties = vendor.specialties.some(specialty => 
        kidFriendlySpecialties.some(friendly => specialty.toLowerCase().includes(friendly))
      );
      if (hasKidSpecialties) {
        score += 10;
      }
      
      return {
        ...vendor,
        popularity: Math.min(100, Math.max(0, score)),
        isAIRecommended: score > 85
      };
    });
    
    return recommendations.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  } catch (error) {
    console.error('Error in AI food recommendations:', error);
    return vendors.map(vendor => ({ ...vendor, popularity: vendor.rating * 20 }));
  }
}

const PRICE_SYMBOLS: Record<string, string> = {
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
};

export async function GET(request: NextRequest) {
  // Unauthenticated legacy endpoint that calls paid Google APIs: cap per IP.
  if (!rateLimit(`food-vendors:${clientIp(request)}`, 10, 60_000).ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const zipCode = searchParams.get('zipCode') || '12345';
    const guestCount = parseInt(searchParams.get('guestCount') || '20');
    const cuisineFilter = searchParams.get('cuisine');
    const dietaryFilter = searchParams.get('dietary');

    // Check if API key is available
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    console.log('Google Places API Key available for restaurants:', !!apiKey);
    
    if (!apiKey) {
      console.error('Google Places API key is required but not found');
      return NextResponse.json(
        { error: 'Google Places API key is required but not configured' },
        { status: 500 }
      );
    }

    // Search for restaurants using Google Places API
    const restaurantQueries = [
      'restaurants',
      'pizza',
      'fast food',
      'bakery',
      'cafe',
      'catering',
      'party food'
    ];

    console.log(`Searching Google Places for restaurants near ZIP ${zipCode}`);
    
    // Search Google Places (limit radius to 50km max for Google Places API)
    const radiusInMeters = Math.min(50 * 1609.34, 50000); // 50 miles max, converted to meters
    const allRestaurants: any[] = [];

    // Search with multiple queries to get variety
    for (const query of restaurantQueries.slice(0, 3)) { // Limit to 3 queries to avoid rate limits
      try {
        const places = await searchGooglePlacesRestaurants(query, zipCode, radiusInMeters);
        allRestaurants.push(...places);
      } catch (error) {
        console.error(`Error searching for ${query}:`, error);
      }
    }

    if (allRestaurants.length === 0) {
      console.log('No restaurants found for the given search criteria');
      return NextResponse.json({
        success: true,
        vendors: [],
        zipCode,
        guestCount,
        totalFound: 0,
        aiRecommendedCount: 0,
        appliedFilters: {
          cuisine: cuisineFilter || null,
          dietary: dietaryFilter || null
        }
      });
    }

    // Register places so the photo proxy will serve them, and get the ZIP centroid for distances.
    const center = await resolveZip(zipCode);
    if (hasServiceRole()) {
      const store = new SupabaseDiscoveryStore(getSupabaseAdmin());
      const normalized = allRestaurants.map((p) => normalizePlace(p, ['caterer'])).filter((v): v is NonNullable<typeof v> => !!v);
      await Promise.all(normalized.slice(0, 20).map((v) => store.saveVenueDetails(v).catch(() => undefined)));
    }

    // Process restaurants from Google Places API
    const vendors: FoodVendor[] = allRestaurants.slice(0, 20).map((place, index) => {
      try {
        const cuisineTypes = mapCuisineTypes(place.types || []);
        const specialties = generateSpecialties(cuisineTypes);
        const dietaryOptions = generateDietaryOptions(cuisineTypes);
        
        return {
          id: place.id || `restaurant_${index}`,
          name: place.displayName?.text || 'Unknown Restaurant',
          cuisineType: cuisineTypes,
          rating: place.rating || 0,
          reviews: place.userRatingCount || 0,
          priceRange: (PRICE_SYMBOLS[place.priceLevel] ?? '$$') as '$' | '$$' | '$$$' | '$$$$',
          address: place.formattedAddress || 'Address not available',
          phone: place.nationalPhoneNumber || 'Phone not available',
          website: place.websiteUri || undefined,
          email: undefined, // Not available from Google Places API
          description: `Delicious ${cuisineTypes.join(', ')} cuisine perfect for your party. ${specialties.slice(0, 2).join(' and ')} are our specialties.`,
          specialties: specialties,
          dietaryOptions: dietaryOptions,
          // Real distance from the ZIP centroid; never a random number.
          distance: center && place.location ? Math.round(haversineMiles(center, { lat: place.location.latitude, lng: place.location.longitude }) * 10) / 10 : undefined,
          // Same-origin photo proxy: the API key never reaches the browser.
          images: place.photos && place.photos[0] && isValidPhotoName(place.photos[0].name) ? [photoProxyUrl(place.photos[0].name, 400)] : [],
          // Google does not provide delivery/catering/minimum-order data; leave unknown.
          deliveryAvailable: undefined,
          cateringAvailable: undefined,
          minOrder: undefined
        };
      } catch (error) {
        console.error('Error processing restaurant:', error);
        return null;
      }
    }).filter(Boolean) as FoodVendor[];

    // Apply filters if provided
    let filteredVendors = vendors;
    if (cuisineFilter) {
      const cuisines = cuisineFilter.split(',');
      filteredVendors = filteredVendors.filter(vendor => 
        cuisines.some(cuisine => vendor.cuisineType.includes(cuisine))
      );
    }
    
    if (dietaryFilter) {
      const dietaryOptions = dietaryFilter.split(',');
      filteredVendors = filteredVendors.filter(vendor => 
        dietaryOptions.some(dietary => vendor.dietaryOptions.includes(dietary))
      );
    }
    
    // Apply AI recommendations
    const aiRecommendedVendors = await getAIRecommendedVendors(filteredVendors, zipCode, guestCount);

    return NextResponse.json({
      success: true,
      vendors: aiRecommendedVendors,
      zipCode,
      guestCount,
      totalFound: aiRecommendedVendors.length,
      aiRecommendedCount: aiRecommendedVendors.filter(v => v.isAIRecommended).length,
      appliedFilters: {
        cuisine: cuisineFilter || null,
        dietary: dietaryFilter || null
      }
    });
  } catch (error) {
    console.error('Error in food vendors API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch food vendor recommendations from Google Places API',
        vendors: []
      },
      { status: 500 }
    );
  }
}