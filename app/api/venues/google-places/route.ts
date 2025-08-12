import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface GooglePlacesVenue {
  id: string;
  name: string;
  category: 'Outdoor' | 'Indoor' | 'Sports Arena';
  rating: number;
  reviews: number;
  priceRange: '$' | '$$' | '$$$' | '$$$$';
  address: string;
  phone?: string;
  website?: string;
  description: string;
  capacity: number;
  amenities: string[];
  distance?: number;
  popularity?: number;
  images: string[];
  isAIRecommended?: boolean;
  googlePlaceId?: string;
  location?: {
    lat: number;
    lng: number;
  };
}

// Map Google Places types to our venue categories
function mapPlaceTypeToCategory(types: string[]): 'Outdoor' | 'Indoor' | 'Sports Arena' {
  const typeLower = types.map(t => t.toLowerCase());
  
  if (typeLower.some(t => t.includes('gym') || t.includes('sports') || t.includes('stadium') || t.includes('arena'))) {
    return 'Sports Arena';
  }
  
  if (typeLower.some(t => t.includes('park') || t.includes('campground') || t.includes('rv_park'))) {
    return 'Outdoor';
  }
  
  return 'Indoor'; // Default to indoor for community centers, banquet halls, etc.
}

// Map Google Places price level to our format
function mapPriceLevel(priceLevel?: number): '$' | '$$' | '$$$' | '$$$$' {
  switch (priceLevel) {
    case 0:
    case 1:
      return '$';
    case 2:
      return '$$';
    case 3:
      return '$$$';
    case 4:
      return '$$$$';
    default:
      return '$$'; // Default
  }
}

// Generate amenities based on Google Places types and features
function generateAmenities(types: string[], hasParking?: boolean): string[] {
  const amenities: string[] = [];
  const typeLower = types.map(t => t.toLowerCase());
  
  // Add amenities based on place types
  if (typeLower.includes('gym') || typeLower.includes('sports_complex')) {
    amenities.push('Fitness Equipment', 'Locker Rooms', 'Sports Courts');
  }
  
  if (typeLower.includes('park')) {
    amenities.push('Playground', 'Picnic Tables', 'Outdoor Space');
  }
  
  if (typeLower.includes('restaurant') || typeLower.includes('banquet_hall')) {
    amenities.push('Catering', 'Kitchen', 'Tables & Chairs');
  }
  
  if (typeLower.includes('tourist_attraction') || typeLower.includes('establishment')) {
    amenities.push('Entertainment', 'Photo Opportunities');
  }
  
  // Standard amenities for most venues
  amenities.push('Restrooms');
  
  if (hasParking) {
    amenities.push('Parking');
  }
  
  // Add common party amenities
  if (typeLower.includes('event_venue') || typeLower.includes('banquet_hall')) {
    amenities.push('Sound System', 'AC/Heating', 'Dance Floor');
  }
  
  return Array.from(new Set(amenities)); // Remove duplicates
}

// Geocode zip code to coordinates using Google Geocoding API
async function geocodeZipCode(zipCode: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(zipCode)}&key=${apiKey}`;
    const response = await fetch(geocodeUrl);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// Calculate distance between two coordinates
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Search for venues using Google Places API
async function searchGooglePlacesVenues(
  lat: number, 
  lng: number, 
  apiKey: string, 
  venueType?: string,
  priceRange?: string,
  minRating?: number
): Promise<GooglePlacesVenue[]> {
  try {
    // Define search queries based on venue type
    const searchQueries = {
      'outdoor': 'parks pavilions outdoor event venues birthday party venues',
      'indoor': 'community centers banquet halls indoor event venues birthday party venues',
      'sports': 'sports complexes gyms recreation centers sports venues'
    };
    
    const query = venueType && searchQueries[venueType as keyof typeof searchQueries] 
      ? searchQueries[venueType as keyof typeof searchQueries]
      : 'event venues birthday party venues community centers parks';
    
    // Use Google Places Text Search API
    const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=25000&key=${apiKey}`;
    
    const response = await fetch(placesUrl);
    const data = await response.json();
    
    if (data.status !== 'OK') {
      console.error('Google Places API error:', data.status, data.error_message);
      return [];
    }
    
    const venues: GooglePlacesVenue[] = [];
    
    for (const place of data.results.slice(0, 20)) { // Limit to 20 results
      // Apply filters
      if (minRating && place.rating < minRating) continue;
      if (priceRange && place.price_level !== undefined) {
        const placePriceRange = mapPriceLevel(place.price_level);
        const targetPriceLevel = priceRange === '$' ? 1 : priceRange === '$$' ? 2 : priceRange === '$$$' ? 3 : 4;
        if (place.price_level > targetPriceLevel) continue;
      }
      
      const distance = calculateDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng);
      const category = mapPlaceTypeToCategory(place.types || []);
      const amenities = generateAmenities(place.types || []);
      
      // Estimate capacity based on venue type
      let estimatedCapacity = 50; // Default
      if (place.types?.includes('park')) estimatedCapacity = 150;
      else if (place.types?.includes('gym') || place.types?.includes('sports_complex')) estimatedCapacity = 80;
      else if (place.types?.includes('banquet_hall')) estimatedCapacity = 120;
      else if (place.types?.includes('community_center')) estimatedCapacity = 100;
      
      const venue: GooglePlacesVenue = {
        id: place.place_id,
        googlePlaceId: place.place_id,
        name: place.name,
        category,
        rating: place.rating || 4.0,
        reviews: place.user_ratings_total || 0,
        priceRange: mapPriceLevel(place.price_level),
        address: place.formatted_address || '',
        description: `${place.name} - A ${category.toLowerCase()} venue perfect for birthday parties and special events.`,
        capacity: estimatedCapacity,
        amenities,
        distance: Math.round(distance * 10) / 10,
        images: place.photos ? [`https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${apiKey}`] : [],
        location: {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng
        }
      };
      
      venues.push(venue);
    }
    
    return venues;
  } catch (error) {
    console.error('Google Places search error:', error);
    return [];
  }
}

// Apply AI recommendations and popularity scoring
function applyAIRecommendations(venues: GooglePlacesVenue[], guestCount: number): GooglePlacesVenue[] {
  return venues.map(venue => {
    let score = venue.rating * 20; // Base score from rating
    
    // Capacity matching
    if (venue.capacity >= guestCount && venue.capacity <= guestCount * 1.5) {
      score += 15; // Perfect capacity match
    } else if (venue.capacity >= guestCount) {
      score += 10; // Can accommodate
    } else {
      score -= 20; // Too small
    }
    
    // Distance preference (closer is better)
    if (venue.distance && venue.distance <= 5) {
      score += 10;
    } else if (venue.distance && venue.distance <= 10) {
      score += 5;
    }
    
    // Review count (more reviews = more reliable)
    if (venue.reviews > 100) {
      score += 10;
    } else if (venue.reviews > 50) {
      score += 5;
    }
    
    // Family-friendly amenities for birthday parties
    const familyAmenities = ['Kitchen', 'Playground', 'Parking', 'Restrooms', 'Tables & Chairs'];
    const matchingAmenities = venue.amenities.filter(amenity => 
      familyAmenities.some(family => amenity.toLowerCase().includes(family.toLowerCase()))
    );
    score += matchingAmenities.length * 3;
    
    return {
      ...venue,
      popularity: Math.min(100, Math.max(0, score)),
      isAIRecommended: score > 85
    };
  });
}

// Sort venues by popularity and other criteria
function sortVenues(venues: GooglePlacesVenue[], sortBy: string = 'popularity'): GooglePlacesVenue[] {
  switch (sortBy) {
    case 'popularity':
      return venues.sort((a, b) => {
        // Primary sort by popularity score
        const popularityDiff = (b.popularity || 0) - (a.popularity || 0);
        if (popularityDiff !== 0) return popularityDiff;
        
        // Secondary sort by review count (more reviews = higher)
        const reviewDiff = b.reviews - a.reviews;
        if (reviewDiff !== 0) return reviewDiff;
        
        // Tertiary sort by rating
        return b.rating - a.rating;
      });
    case 'distance':
      return venues.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    case 'rating':
      return venues.sort((a, b) => b.rating - a.rating);
    case 'reviews':
      return venues.sort((a, b) => b.reviews - a.reviews);
    default:
      return venues;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const zipCode = searchParams.get('zipCode') || '12345';
    const guestCount = parseInt(searchParams.get('guestCount') || '20');
    const venueType = searchParams.get('venueType'); // outdoor, indoor, sports
    const priceRange = searchParams.get('priceRange'); // $, $$, $$$, $$$$
    const minRating = searchParams.get('minRating') ? parseFloat(searchParams.get('minRating')!) : undefined;
    const sortBy = searchParams.get('sortBy') || 'popularity';
    
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    
    if (!apiKey) {
      // Fallback to mock data if no API key provided
      console.log('No Google Places API key found, using mock data');
      const mockResponse = await fetch(`${request.url.replace('/google-places', '')}`);
      return mockResponse;
    }
    
    // Geocode zip code to coordinates
    const coordinates = await geocodeZipCode(zipCode, apiKey);
    
    if (!coordinates) {
      return NextResponse.json({
        success: false,
        error: 'Unable to geocode zip code',
        venues: []
      }, { status: 400 });
    }
    
    // Search for venues using Google Places API
    const venues = await searchGooglePlacesVenues(
      coordinates.lat, 
      coordinates.lng, 
      apiKey, 
      venueType || undefined,
      priceRange || undefined,
      minRating
    );
    
    if (venues.length === 0) {
      return NextResponse.json({
        success: true,
        venues: [],
        zipCode,
        guestCount,
        totalFound: 0,
        aiRecommendedCount: 0,
        message: 'No venues found matching your criteria'
      });
    }
    
    // Apply AI recommendations
    const aiRecommendedVenues = applyAIRecommendations(venues, guestCount);
    
    // Sort venues
    const sortedVenues = sortVenues(aiRecommendedVenues, sortBy);
    
    return NextResponse.json({
      success: true,
      venues: sortedVenues,
      zipCode,
      guestCount,
      totalFound: sortedVenues.length,
      aiRecommendedCount: sortedVenues.filter(v => v.isAIRecommended).length,
      coordinates,
      source: 'google-places-api'
    });
  } catch (error) {
    console.error('Error in Google Places venues API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch venue recommendations from Google Places',
        venues: []
      },
      { status: 500 }
    );
  }
}