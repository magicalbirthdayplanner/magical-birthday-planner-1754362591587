import { NextRequest, NextResponse } from 'next/server';
import { searchVenues, SearchParams } from '@/lib/google-places';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract query parameters
    const zipCode = searchParams.get('zipCode');
    const category = searchParams.get('category') as 'indoor' | 'outdoor' | 'specialty' | 'community';
    const radius = searchParams.get('radius');
    const minRating = searchParams.get('minRating');
    const searchQuery = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') as 'distance' | 'rating' | 'name' | 'reviews';

    // Validate required parameters
    if (!zipCode) {
      return NextResponse.json(
        { error: 'ZIP code is required' },
        { status: 400 }
      );
    }

    if (!category || !['indoor', 'outdoor', 'specialty', 'community'].includes(category)) {
      return NextResponse.json(
        { error: 'Valid category is required (indoor, outdoor, specialty, community)' },
        { status: 400 }
      );
    }

    // Build search parameters
    const params: SearchParams = {
      zipCode,
      category,
      radius: radius ? parseInt(radius) : 20,
      minRating: minRating ? parseFloat(minRating) : undefined,
      searchQuery: searchQuery || undefined,
      sortBy: sortBy || 'distance'
    };

    console.log('API: Searching venues with params:', params);

    // Search venues (will use cache if available, otherwise fetch from Google Places API)
    const venues = await searchVenues(params);

    return NextResponse.json({
      success: true,
      venues,
      total: venues.length,
      searchParams: params
    });

  } catch (error) {
    console.error('API Error searching venues:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to search venues',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { zipCode, category, radius, minRating, searchQuery, sortBy } = body;

    // Validate required parameters
    if (!zipCode) {
      return NextResponse.json(
        { error: 'ZIP code is required' },
        { status: 400 }
      );
    }

    if (!category || !['indoor', 'outdoor', 'specialty', 'community'].includes(category)) {
      return NextResponse.json(
        { error: 'Valid category is required (indoor, outdoor, specialty, community)' },
        { status: 400 }
      );
    }

    // Build search parameters
    const params: SearchParams = {
      zipCode,
      category,
      radius: radius || 20,
      minRating: minRating || undefined,
      searchQuery: searchQuery || undefined,
      sortBy: sortBy || 'distance'
    };

    console.log('API: Searching venues with params:', params);

    // Search venues (will use cache if available, otherwise fetch from Google Places API)
    const venues = await searchVenues(params);

    return NextResponse.json({
      success: true,
      venues,
      total: venues.length,
      searchParams: params
    });

  } catch (error) {
    console.error('API Error searching venues:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to search venues',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}