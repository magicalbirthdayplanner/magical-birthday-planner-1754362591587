import { NextRequest, NextResponse } from 'next/server';

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
    const venues = places.slice(0, 20).map((place) => {
      try {
        return {
          name: place.displayName?.text || 'Unknown Venue',
          address: place.formattedAddress || 'Address not available',
          rating: place.rating || 0,
          photoUrl: place.photos && place.photos[0] 
            ? `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxWidthPx=400&key=${apiKey}`
            : 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop',
          distance: 'Distance calculated by Google Places',
          placeId: place.id || 'unknown',
          reviewsCount: place.userRatingCount || 0,
          price: place.priceLevel ? '$'.repeat(place.priceLevel) : '$$',
          phone: place.nationalPhoneNumber || 'Phone not available',
          website: place.websiteUri || 'Website not available',
          category: place.types?.[0] || 'Venue'
        };
      } catch (error) {
        console.error('Error processing place:', error);
        return null;
      }
    }).filter(Boolean);

    // Apply server-side filtering
    let filteredVenues = venues.filter(venue => {
      const matchesSearch = searchQuery
        ? venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          venue.address.toLowerCase().includes(searchQuery.toLowerCase())
        : true;
      const matchesRating = venue.rating >= minRating;
      return matchesSearch && matchesRating;
    });

    // Apply server-side sorting
    const sortedVenues = filteredVenues.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'distance':
          // Since we don't have exact distance, sort by rating as fallback
          return b.rating - a.rating;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'reviews':
          return b.reviewsCount - a.reviewsCount;
        default:
          return b.rating - a.rating;
      }
    });

    console.log(`Found ${filteredVenues.length} venues after filtering`);
    return NextResponse.json(sortedVenues);

  } catch (error) {
    console.error('Error fetching venues:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return NextResponse.json(
      { error: 'Failed to fetch venues from Google Places API' },
      { status: 500 }
    );
  }
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