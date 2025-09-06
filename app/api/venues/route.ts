import { NextRequest, NextResponse } from 'next/server';

// Google Places API (New) integration
async function searchGooglePlaces(query: string, location: string, radius: number = 50000) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  
  if (!apiKey) {
    throw new Error('Google Places API key not found');
  }

  // Use the new Places API (New) endpoint
  const baseUrl = 'https://places.googleapis.com/v1/places:searchText';
  
  const requestBody = {
    textQuery: query,
    locationBias: {
      circle: {
        center: {
          latitude: 42.3314, // Default to Detroit area coordinates
          longitude: -83.0458
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
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.nationalPhoneNumber,places.websiteUri,places.photos,places.types,places.id'
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
    console.log('No places found in response:', data);
    return [];
  }

  return data.places || [];
}

// Get place details using the new Places API (New)
async function getPlaceDetails(placeId: string) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  
  if (!apiKey) {
    throw new Error('Google Places API key not found');
  }

  const baseUrl = `https://places.googleapis.com/v1/places/${placeId}`;
  
  const response = await fetch(baseUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'displayName,formattedAddress,rating,userRatingCount,priceLevel,nationalPhoneNumber,websiteUri,photos,types'
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Google Places Details API error:', response.status, errorText);
    throw new Error(`Google Places Details API error: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

// Search terms mapping for different venue categories
const SEARCH_TERMS = {
  indoor: [
    'indoor party venue',
    'event space',
    'community center',
    'recreation center',
    'indoor playground',
    'trampoline park',
    'bowling alley',
    'arcade',
    'laser tag',
    'escape room'
  ],
  outdoor: [
    'outdoor party venue',
    'park pavilion',
    'garden venue',
    'outdoor event space',
    'beach venue',
    'outdoor playground',
    'sports complex',
    'outdoor recreation',
    'picnic area',
    'outdoor amphitheater'
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
    'fun center',
    'trampoline center',
    'entertainment center'
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

    // Check if API key is available
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    console.log('Google Places API Key available:', !!apiKey);
    
    if (!apiKey) {
      console.log('No Google Places API key found, using fallback data');
      const fallbackVenues = getFallbackVenues(category || 'indoor', zip || '10001');
      return NextResponse.json(fallbackVenues);
    }

    // Get search terms for the category
    const searchTerms = SEARCH_TERMS[category as keyof typeof SEARCH_TERMS] || SEARCH_TERMS.indoor;
    
    // If there's a search query, use it; otherwise use category-specific terms
    const query = searchQuery || searchTerms.join(' OR ');
    
    // Convert ZIP to coordinates for location-based search
    const location = `${zip}, USA`;
    
    console.log(`Searching Google Places for: ${query} near ${location}`);
    
    // Search Google Places (limit radius to 50km max for Google Places API)
    const radiusInMeters = Math.min(maxDistance * 1609.34, 50000); // Convert miles to meters, max 50km
    const places = await searchGooglePlaces(query, location, radiusInMeters);
    
    if (!places || places.length === 0) {
      console.log('No places found, returning fallback data');
      const fallbackVenues = getFallbackVenues(category || 'indoor', zip || '10001');
      return NextResponse.json(fallbackVenues);
    }

    // Process places from the new API format
    const venues = places.slice(0, 20).map((place) => {
      try {
        return {
          name: place.displayName?.text || 'Unknown Venue',
          address: place.formattedAddress || 'Address not available',
          rating: place.rating || 0,
          photoUrl: place.photos && place.photos[0] 
            ? `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxWidthPx=400&key=${process.env.GOOGLE_PLACES_API_KEY}`
            : 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop',
          distance: 'Distance calculated by Google',
          placeId: place.id,
          reviewsCount: place.userRatingCount || 0,
          price: place.priceLevel ? '$'.repeat(place.priceLevel) : 'Price not available',
          phone: place.nationalPhoneNumber || 'Phone not available',
          website: place.websiteUri || 'Website not available',
          category: place.types && place.types[0] ? place.types[0].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Venue'
        };
      } catch (error) {
        console.error(`Error processing place ${place.id}:`, error);
        return null;
      }
    });

    // Filter out null results and apply filters
    let filteredVenues = venues.filter(venue => venue !== null);

    // Apply search filter
    if (searchQuery) {
      filteredVenues = filteredVenues.filter(venue => 
        venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        venue.address.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply rating filter
    filteredVenues = filteredVenues.filter(venue => venue.rating >= minRating);

    // Sort venues
    filteredVenues.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'distance':
          return parseFloat(a.distance) - parseFloat(b.distance);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'reviews':
          return b.reviewsCount - a.reviewsCount;
        default:
          return b.rating - a.rating;
      }
    });

    console.log(`Found ${filteredVenues.length} venues after filtering`);
    return NextResponse.json(filteredVenues);

  } catch (error) {
    console.error('Error fetching venues:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    console.log('Google Places API failed, providing fallback sample data');
    const fallbackVenues = getFallbackVenues(category || 'indoor', zip || '10001');
    return NextResponse.json(fallbackVenues);
  }
}

// Fallback venue data when Google Places API fails
function getFallbackVenues(category: string, zipCode: string): Venue[] {
  const baseVenues = {
    indoor: [
      {
        name: "Community Center Hall",
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
        name: "Recreation Center",
        address: `${zipCode} Area, MI`,
        rating: 4.5,
        photoUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop",
        distance: "3.5 miles",
        placeId: "fallback_indoor_2",
        reviewsCount: 67,
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
        name: "JumpZone Trampoline Park",
        address: `${zipCode} Area, MI`,
        rating: 4.6,
        photoUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop",
        distance: "2.3 miles",
        placeId: "fallback_specialty_1",
        reviewsCount: 89,
        price: "$$$",
        phone: "(555) 567-8901",
        website: "https://example.com",
        category: "Trampoline Park"
      },
      {
        name: "Strike Zone Bowling",
        address: `${zipCode} Area, MI`,
        rating: 4.1,
        photoUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop",
        distance: "3.2 miles",
        placeId: "fallback_specialty_2",
        reviewsCount: 34,
        price: "$$",
        phone: "(555) 678-9012",
        website: "https://example.com",
        category: "Bowling Alley"
      }
    ]
  };

  return baseVenues[category as keyof typeof baseVenues] || baseVenues.indoor;
}

// Venue data interface
interface Venue {
  name: string;
  address: string;
  rating: number;
  photoUrl: string;
  distance: string;
  placeId: string;
  reviewsCount: number;
  price: string;
  phone: string;
  website: string;
  category: string;
}