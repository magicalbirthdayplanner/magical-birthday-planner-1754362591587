import { NextRequest, NextResponse } from 'next/server';
import { scrapeGoogleMapsVenues, cleanVenueData } from '../../../utils/apifyClient.js';
import { geocodeLocation } from '../../../utils/geocode.js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { location, searchTerms, radiusKm = 16 } = body;

    // Validate required inputs
    if (!location || !searchTerms) {
      return NextResponse.json(
        { error: 'Missing required fields: location and searchTerms are required' },
        { status: 400 }
      );
    }

    // Validate searchTerms is an array
    if (!Array.isArray(searchTerms) || searchTerms.length === 0) {
      return NextResponse.json(
        { error: 'searchTerms must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate radiusKm is a positive number
    if (typeof radiusKm !== 'number' || radiusKm <= 0) {
      return NextResponse.json(
        { error: 'radiusKm must be a positive number' },
        { status: 400 }
      );
    }

    // Check if APIFY_API_TOKEN is configured
    if (!process.env.APIFY_API_TOKEN) {
      return NextResponse.json(
        { error: 'Apify API token not configured. Please set APIFY_API_TOKEN environment variable.' },
        { status: 500 }
      );
    }

    // Geocode the provided location
    const coordinates = await geocodeLocation(location);
    
    if (!coordinates) {
      return NextResponse.json(
        { error: 'Invalid location' },
        { status: 400 }
      );
    }

    // Call Apify Google Maps Scraper with custom geolocation
    const rawVenues = await scrapeGoogleMapsVenues({
      location,
      searchTerms,
      radiusKm,
      customGeolocation: {
        type: "Point",
        coordinates: [coordinates.lng, coordinates.lat],
        radiusKm: radiusKm
      }
    });

    // Clean and format the venue data
    const cleanedVenues = rawVenues.map(venue => cleanVenueData(venue));

    // Return successful response
    return NextResponse.json({
      success: true,
      venues: cleanedVenues,
      count: cleanedVenues.length,
      searchParams: {
        location,
        searchTerms,
        radiusKm,
      },
    });

  } catch (error) {
    console.error('Venues API error:', error);

    // Handle Apify-specific errors
    if (error instanceof Error && error.message.includes('APIFY_API_TOKEN')) {
      return NextResponse.json(
        { error: 'Apify API token is invalid or missing' },
        { status: 500 }
      );
    }

    // Handle general scraping errors
    if (error instanceof Error && error.message.includes('Failed to scrape')) {
      return NextResponse.json(
        { error: 'Failed to fetch venues' },
        { status: 500 }
      );
    }

    // Handle unexpected errors
    return NextResponse.json(
      { error: 'Failed to fetch venues' },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST request.' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST request.' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST request.' },
    { status: 405 }
  );
}