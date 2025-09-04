import { NextRequest, NextResponse } from 'next/server';

interface Venue {
  name: string;
  address: string;
  rating: number;
  photoUrl?: string;
  distance: string;
  placeId?: string;
}

// Mock venue data for development (replace with Google Places API calls)
const mockVenues: Record<string, Venue[]> = {
  indoor: [
    {
      name: "Happy Kids Play Hall",
      address: "123 Main St, Detroit, MI 48226",
      rating: 4.6,
      photoUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop",
      distance: "2.1 miles",
      placeId: "indoor_1"
    },
    {
      name: "Community Center Party Room",
      address: "456 Oak Ave, Detroit, MI 48226",
      rating: 4.3,
      photoUrl: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&h=300&fit=crop",
      distance: "3.5 miles",
      placeId: "indoor_2"
    },
    {
      name: "Fun Zone Indoor Playground",
      address: "789 Pine St, Detroit, MI 48226",
      rating: 4.8,
      photoUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop",
      distance: "1.8 miles",
      placeId: "indoor_3"
    }
  ],
  outdoor: [
    {
      name: "Riverside Park Pavilion",
      address: "321 River Rd, Detroit, MI 48226",
      rating: 4.4,
      photoUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop",
      distance: "2.7 miles",
      placeId: "outdoor_1"
    },
    {
      name: "Sunset Gardens",
      address: "654 Garden Way, Detroit, MI 48226",
      rating: 4.7,
      photoUrl: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop",
      distance: "4.2 miles",
      placeId: "outdoor_2"
    },
    {
      name: "Central Park Gazebo",
      address: "987 Central Ave, Detroit, MI 48226",
      rating: 4.2,
      photoUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop",
      distance: "1.5 miles",
      placeId: "outdoor_3"
    }
  ],
  specialty: [
    {
      name: "Jump Zone Trampoline Park",
      address: "147 Bounce St, Detroit, MI 48226",
      rating: 4.5,
      photoUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop",
      distance: "3.1 miles",
      placeId: "specialty_1"
    },
    {
      name: "Strike Zone Bowling Alley",
      address: "258 Strike Ln, Detroit, MI 48226",
      rating: 4.1,
      photoUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop",
      distance: "2.9 miles",
      placeId: "specialty_2"
    },
    {
      name: "Adventure Quest Laser Tag",
      address: "369 Quest Blvd, Detroit, MI 48226",
      rating: 4.9,
      photoUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop",
      distance: "4.8 miles",
      placeId: "specialty_3"
    }
  ]
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const zip = searchParams.get('zip');
    const category = searchParams.get('category');

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

    // For development, return mock data
    // In production, this would call Google Places API
    const venues = mockVenues[category] || [];

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return NextResponse.json(venues);

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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
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
