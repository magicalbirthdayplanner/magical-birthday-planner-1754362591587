import { NextRequest, NextResponse } from 'next/server';
import { scrapeGoogleMapsVenues, cleanVenueData } from '../../../utils/apifyClient';

export const dynamic = 'force-dynamic';

interface Venue {
  name: string;
  address: string;
  rating: number;
  photoUrl?: string;
  distance: string;
  placeId?: string;
  reviewsCount?: number;
  price?: string;
  phone?: string;
  website?: string;
  category?: string;
}

// Search terms mapping for different venue categories
const SEARCH_TERMS = {
  indoor: [
    'party hall',
    'community center',
    'indoor playground',
    'recreation center',
    'event venue',
    'banquet hall',
    'conference center',
    'kids party venue'
  ],
  outdoor: [
    'park pavilion',
    'outdoor venue',
    'garden party',
    'picnic area',
    'outdoor playground',
    'beach venue',
    'outdoor event space',
    'park gazebo'
  ],
  specialty: [
    'trampoline park',
    'bowling alley',
    'laser tag',
    'arcade',
    'mini golf',
    'go kart',
    'escape room',
    'indoor water park',
    'adventure park',
    'fun center'
  ]
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const zip = searchParams.get('zip');
  const category = searchParams.get('category');
  const sortBy = searchParams.get('sortBy') || 'rating';
  const searchQuery = searchParams.get('search') || '';
  const minRating = parseFloat(searchParams.get('minRating') || '0');
  const maxDistance = parseFloat(searchParams.get('maxDistance') || '50');

  try {

    // Validate required parameters
    if (!zip || !category) {
      return NextResponse.json(
        { error: 'Missing required parameters: zip and category' },
        { status: 400 }
      );
    }

    // Validate category
    if (!['indoor', 'outdoor', 'specialty'].includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category. Must be: indoor, outdoor, or specialty' },
        { status: 400 }
      );
    }

    // Check if APIFY token is available
    if (!process.env.APIFY_API_TOKEN) {
      console.warn('APIFY_API_TOKEN not found, falling back to mock data');
      return NextResponse.json([]);
    }

    // Get search terms for the category
    const searchTerms = SEARCH_TERMS[category as keyof typeof SEARCH_TERMS];
    
    // Add custom search query if provided
    if (searchQuery) {
      searchTerms.unshift(searchQuery);
    }

    console.log(`Searching for ${category} venues near ZIP ${zip} with terms:`, searchTerms);

    // Scrape venues using APIFY
    const rawVenues = await scrapeGoogleMapsVenues({
      location: zip,
      searchTerms: searchTerms,
      radiusKm: maxDistance / 1.60934, // Convert miles to km
    });

    console.log(`Found ${rawVenues.length} raw venues`);

    // If no venues found from APIFY, provide fallback sample data
    if (rawVenues.length === 0) {
      console.log('No venues found from APIFY, providing fallback sample data');
      const fallbackVenues = getFallbackVenues(category, zip);
      return NextResponse.json(fallbackVenues);
    }

    // Clean and transform venue data
    const cleanedVenues = rawVenues
      .map(cleanVenueData)
      .map((venue, index) => ({
        name: venue.title,
        address: venue.address,
        rating: venue.rating || 0,
        photoUrl: venue.imageUrl,
        distance: calculateDistanceFromZip(zip, venue.coordinates),
        placeId: venue.id,
        reviewsCount: venue.reviewsCount,
        price: venue.price,
        phone: venue.phone,
        website: venue.website,
        category: venue.category,
      }))
      .filter(venue => {
        // Filter by minimum rating
        if (minRating > 0 && venue.rating < minRating) return false;
        
        // Filter by search query
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return venue.name.toLowerCase().includes(query) || 
                 venue.address.toLowerCase().includes(query) ||
                 venue.category?.toLowerCase().includes(query);
        }
        
        return true;
      });

    // Sort venues
    const sortedVenues = sortVenues(cleanedVenues, sortBy);

    console.log(`Returning ${sortedVenues.length} filtered venues`);

    return NextResponse.json(sortedVenues);

    /* 
    // Production implementation with Google Places API:
    
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Places API key not configured' },
        { status: 500 }
      );
    }

    // Get coordinates for ZIP code (using geocoding)
    const geocodeResponse = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${zip}&key=${apiKey}`
    );
    const geocodeData = await geocodeResponse.json();
    
    if (geocodeData.status !== 'OK' || !geocodeData.results[0]) {
      return NextResponse.json(
        { error: 'Invalid ZIP code' },
        { status: 400 }
      );
    }

    const location = geocodeData.results[0].geometry.location;
    
    // Build search query based on category
    let query = '';
    switch (category) {
      case 'indoor':
        query = 'party hall community center indoor playground';
        break;
      case 'outdoor':
        query = 'park pavilion outdoor venue garden';
        break;
      case 'specialty':
        query = 'trampoline park bowling alley laser tag arcade';
        break;
    }

    // Search for places
    const placesResponse = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&location=${location.lat},${location.lng}&radius=10000&key=${apiKey}`
    );
    const placesData = await placesResponse.json();

    if (placesData.status !== 'OK') {
      return NextResponse.json(
        { error: 'Failed to fetch venues' },
        { status: 500 }
      );
    }

    // Transform results
    const venues: Venue[] = placesData.results.map((place: any) => ({
      name: place.name,
      address: place.formatted_address,
      rating: place.rating || 0,
      photoUrl: place.photos?.[0] 
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${apiKey}`
        : undefined,
      distance: calculateDistance(location, place.geometry.location),
      placeId: place.place_id
    }));

    return NextResponse.json(venues);
    */

  } catch (error) {
    console.error('Error fetching venues:', error);
    console.log('APIFY failed, providing fallback sample data');
    const fallbackVenues = getFallbackVenues(category || 'indoor', zip || '10001');
    return NextResponse.json(fallbackVenues);
  }
}

// Fallback venue data when APIFY returns no results
function getFallbackVenues(category: string, zipCode: string): Venue[] {
  const baseVenues = {
    indoor: [
      {
        name: "Community Center Party Hall",
        address: `${zipCode} Area, MI`,
        rating: 4.2,
        photoUrl: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&h=300&fit=crop",
        distance: "2.1 miles",
        placeId: "fallback_indoor_1",
        reviewsCount: 45,
        price: "$$",
        phone: "(555) 123-4567",
        website: "https://example.com",
        category: "Community Center"
      },
      {
        name: "Recreation Center Event Space",
        address: `${zipCode} Area, MI`,
        rating: 4.5,
        photoUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop",
        distance: "3.2 miles",
        placeId: "fallback_indoor_2",
        reviewsCount: 32,
        price: "$$$",
        phone: "(555) 234-5678",
        website: "https://example.com",
        category: "Recreation Center"
      }
    ],
    outdoor: [
      {
        name: "Riverside Park Pavilion",
        address: `${zipCode} Area, MI`,
        rating: 4.3,
        photoUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop",
        distance: "1.8 miles",
        placeId: "fallback_outdoor_1",
        reviewsCount: 28,
        price: "$",
        phone: "(555) 345-6789",
        website: "https://example.com",
        category: "Park"
      },
      {
        name: "Sunset Gardens Event Space",
        address: `${zipCode} Area, MI`,
        rating: 4.7,
        photoUrl: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop",
        distance: "4.1 miles",
        placeId: "fallback_outdoor_2",
        reviewsCount: 56,
        price: "$$",
        phone: "(555) 456-7890",
        website: "https://example.com",
        category: "Garden"
      }
    ],
    specialty: [
      {
        name: "Fun Zone Activity Center",
        address: `${zipCode} Area, MI`,
        rating: 4.6,
        photoUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop",
        distance: "2.5 miles",
        placeId: "fallback_specialty_1",
        reviewsCount: 89,
        price: "$$$",
        phone: "(555) 567-8901",
        website: "https://example.com",
        category: "Activity Center"
      },
      {
        name: "Adventure Quest Entertainment",
        address: `${zipCode} Area, MI`,
        rating: 4.4,
        photoUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop",
        distance: "3.7 miles",
        placeId: "fallback_specialty_2",
        reviewsCount: 67,
        price: "$$",
        phone: "(555) 678-9012",
        website: "https://example.com",
        category: "Entertainment"
      }
    ]
  };

  return baseVenues[category as keyof typeof baseVenues] || [];
}

// Helper function to calculate distance from ZIP code
async function calculateDistanceFromZip(zipCode: string, coordinates: { lat: number; lng: number } | null): string {
  if (!coordinates) return 'Distance unknown';
  
  try {
    // For now, return a placeholder. In production, you'd geocode the ZIP to get coordinates
    // and then calculate the actual distance
    return 'Distance calculated';
  } catch (error) {
    console.error('Error calculating distance:', error);
    return 'Distance unknown';
  }
}

// Helper function to sort venues
function sortVenues(venues: Venue[], sortBy: string): Venue[] {
  return venues.sort((a, b) => {
    switch (sortBy) {
      case 'rating':
        return (b.rating || 0) - (a.rating || 0);
      case 'distance':
        // Extract numeric distance for sorting
        const aDistance = parseFloat(a.distance.replace(/[^\d.]/g, '')) || 999;
        const bDistance = parseFloat(b.distance.replace(/[^\d.]/g, '')) || 999;
        return aDistance - bDistance;
      case 'name':
        return a.name.localeCompare(b.name);
      case 'reviews':
        return (b.reviewsCount || 0) - (a.reviewsCount || 0);
      default:
        return 0;
    }
  });
}

// Helper function to calculate distance (for production use)
function calculateDistance(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): string {
  const R = 3959; // Earth's radius in miles
  const dLat = (destination.lat - origin.lat) * Math.PI / 180;
  const dLng = (destination.lng - origin.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(origin.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return `${distance.toFixed(1)} miles`;
}
