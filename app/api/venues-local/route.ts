import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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

// Google Places API (New) integration
async function searchGooglePlaces(query: string, zipCode: string, radius: number = 50000) {
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

  return data.places;
}

const SEARCH_TERMS: { [key: string]: string[] } = {
  indoor: [
    'indoor playground',
    'event hall',
    'community center',
    'gymnasium',
    'bowling alley',
    'skating rink',
    'art studio',
    'cooking class venue',
    'childrens museum',
    'indoor sports facility'
  ],
  outdoor: [
    'park',
    'botanical garden',
    'farm venue',
    'outdoor event space',
    'picnic area',
    'beach venue',
    'rooftop venue',
    'amphitheater',
    'zoo',
    'park gazebo'
  ],
  home: [
    'home party',
    'backyard party',
    'house party'
  ]
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const zip = searchParams.get('zip');
  const category = searchParams.get('category');
  const searchQuery = searchParams.get('search');
  const sortBy = searchParams.get('sortBy') || 'distance';
  const minRating = parseFloat(searchParams.get('minRating') || '0');
  const radius = parseFloat(searchParams.get('radius') || '15');

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
      console.error('Google Places API key is required but not found');
      return NextResponse.json(
        { error: 'Google Places API key is required but not configured' },
        { status: 500 }
      );
    }

    // Get search terms for the category
    const searchTerms = SEARCH_TERMS[category as keyof typeof SEARCH_TERMS] || SEARCH_TERMS.indoor;
    
    // If there's a search query, use it; otherwise use category-specific terms
    const query = searchQuery || searchTerms.join(' OR ');
    
    console.log(`Searching Google Places for: ${query} near ZIP ${zip}`);
    
    // Search Google Places (limit radius to 50km max for Google Places API)
    const radiusInMeters = Math.min(maxDistance * 1609.34, 50000); // Convert miles to meters, max 50km
    const places = await searchGooglePlaces(query, zip, radiusInMeters);
    
    if (!places || places.length === 0) {
      console.log('No places found for the given search criteria');
      return NextResponse.json([]);
    }

    // Process places from the new API format
    const processedVenues = places.map((place: any) => {
      // Calculate distance (simplified - in real implementation you'd use Haversine formula)
      const distance = Math.random() * 20; // Placeholder distance calculation
      
      return {
        id: place.id || `place_${Math.random().toString(36).substr(2, 9)}`,
        name: place.displayName?.text || 'Unknown Venue',
        address: place.formattedAddress || 'Address not available',
        phone: place.nationalPhoneNumber || 'Phone not available',
        website: place.websiteUri || null,
        rating: place.rating || 0,
        reviewsCount: place.userRatingCount || 0,
        priceLevel: place.priceLevel || 0,
        category: category,
        distance: `${distance.toFixed(1)} miles`,
        distanceMiles: distance,
        description: `A great ${category} venue for your party`,
        photos: place.photos?.map((photo: any) => photo.name) || [],
        types: place.types || []
      };
    });

    // Filter by minimum rating
    let filteredVenues = processedVenues.filter(venue => venue.rating >= minRating);

    // Sort venues
    switch (sortBy) {
      case 'rating':
        filteredVenues.sort((a, b) => b.rating - a.rating);
        break;
      case 'distance':
        filteredVenues.sort((a, b) => a.distanceMiles - b.distanceMiles);
        break;
      case 'reviews':
        filteredVenues.sort((a, b) => b.reviewsCount - a.reviewsCount);
        break;
      default:
        filteredVenues.sort((a, b) => a.distanceMiles - b.distanceMiles);
    }

    console.log(`Found ${filteredVenues.length} venues after filtering`);
    
    return NextResponse.json(filteredVenues);

  } catch (error) {
    console.error('Error fetching venues:', error);
    return NextResponse.json(
      { error: 'Failed to fetch venues' },
      { status: 500 }
    );
  }
}