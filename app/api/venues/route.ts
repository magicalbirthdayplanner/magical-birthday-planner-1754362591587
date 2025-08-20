import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { geocodeLocation, DEFAULT_SEARCH_RADIUS_KM } from "@/lib/geocoding";

export interface VenueSearchParams {
  location?: string;
  zipCode?: string;
  radius?: number;
  theme?: string;
  customKeywords?: string; // New field for theme or custom keyword searches
  age?: number;
  budget?: number;
  capacity?: number;
  venueType?: 'indoor' | 'outdoor' | 'both';
  page?: number;
  limit?: number;
}

export interface VenueData {
  id: string;
  name: string;
  location: string;
  address?: string;
  capacity: number;
  priceRange: string;
  pricePerHour?: number;
  rating: number;
  reviewCount: number;
  description: string;
  aiContextualNote: string;
  amenities: string[];
  venueType: 'indoor' | 'outdoor' | 'both';
  ageRecommendation?: string;
  imageUrl?: string;
  phone?: string;
  website?: string;
  availability?: string;
  matchScore?: number;
}

// Demo venue data - will be replaced with Apify integration
const DEMO_VENUES: VenueData[] = [
  {
    id: "venue-1",
    name: "Chuck E. Cheese's Fun Center",
    location: "Downtown Plaza",
    address: "123 Main St, City, State 12345",
    capacity: 50,
    priceRange: "$200-400",
    pricePerHour: 300,
    rating: 4.2,
    reviewCount: 287,
    description: "Classic family entertainment center with arcade games, pizza, and birthday party packages.",
    aiContextualNote: "Perfect for superhero themes with arcade games and energetic atmosphere. Great for ages 4-8.",
    amenities: ["Arcade Games", "Pizza & Snacks", "Party Host", "Private Party Room", "Cake Service"],
    venueType: "indoor",
    ageRecommendation: "3-12 years",
    phone: "(555) 123-4567",
    website: "https://chuckecheese.com",
    availability: "Weekends available",
    matchScore: 92
  },
  {
    id: "venue-2", 
    name: "Adventure Park & Playground",
    location: "Riverside District",
    address: "456 Park Ave, City, State 12345",
    capacity: 75,
    priceRange: "$150-300",
    pricePerHour: 225,
    rating: 4.5,
    reviewCount: 156,
    description: "Outdoor adventure playground with climbing structures, slides, and picnic areas.",
    aiContextualNote: "Excellent for dinosaur or safari themes with natural outdoor setting. Weather dependent.",
    amenities: ["Playground Equipment", "Picnic Tables", "BBQ Grills", "Parking", "Restrooms"],
    venueType: "outdoor",
    ageRecommendation: "2-10 years", 
    phone: "(555) 234-5678",
    availability: "Spring/Summer only",
    matchScore: 88
  },
  {
    id: "venue-3",
    name: "Princess Palace Party Hall",
    location: "Uptown Center",
    address: "789 Royal Rd, City, State 12345",
    capacity: 40,
    priceRange: "$250-450",
    pricePerHour: 350,
    rating: 4.7,
    reviewCount: 203,
    description: "Elegant themed party hall with princess decorations and royal party packages.",
    aiContextualNote: "Magical setting perfect for princess themes with royal decorations and dress-up activities.",
    amenities: ["Themed Decorations", "Costume Rentals", "Photo Booth", "Catering Kitchen", "Sound System"],
    venueType: "indoor",
    ageRecommendation: "3-8 years",
    phone: "(555) 345-6789",
    website: "https://princesspalace.com",
    availability: "Available all year",
    matchScore: 95
  },
  {
    id: "venue-4",
    name: "Sky Zone Trampoline Park",
    location: "Westside Mall",
    address: "321 Jump St, City, State 12345", 
    capacity: 60,
    priceRange: "$300-500",
    pricePerHour: 400,
    rating: 4.4,
    reviewCount: 342,
    description: "High-energy trampoline park with foam pits, dodgeball courts, and party packages.",
    aiContextualNote: "High-energy venue perfect for space or superhero themes. Great for active kids 6+.",
    amenities: ["Trampolines", "Foam Pits", "Dodgeball", "Private Party Room", "Safety Equipment"],
    venueType: "indoor",
    ageRecommendation: "6-16 years",
    phone: "(555) 456-7890",
    website: "https://skyzone.com",
    availability: "Year-round",
    matchScore: 85
  },
  {
    id: "venue-5",
    name: "Aquatic Adventure Center",
    location: "Marina District",
    address: "654 Ocean Way, City, State 12345",
    capacity: 80,
    priceRange: "$400-600",
    pricePerHour: 500,
    rating: 4.6,
    reviewCount: 198,
    description: "Water park facility with pools, slides, and aquatic party packages.",
    aiContextualNote: "Perfect for ocean themes with water activities. Ideal for summer birthdays.",
    amenities: ["Swimming Pool", "Water Slides", "Lazy River", "Pool Deck", "Changing Rooms"],
    venueType: "both",
    ageRecommendation: "4-14 years",
    phone: "(555) 567-8901",
    website: "https://aquaticadventure.com",
    availability: "Summer season",
    matchScore: 90
  },
  {
    id: "venue-6",
    name: "Little Explorers Science Center",
    location: "Education District",
    address: "987 Discovery Lane, City, State 12345",
    capacity: 35,
    priceRange: "$180-350",
    pricePerHour: 275,
    rating: 4.3,
    reviewCount: 124,
    description: "Interactive science museum with hands-on experiments and educational party programs.",
    aiContextualNote: "Perfect for space themes with planetarium shows and rocket building activities.",
    amenities: ["Interactive Exhibits", "Planetarium", "Lab Space", "Educational Activities", "Science Kits"],
    venueType: "indoor",
    ageRecommendation: "5-12 years",
    phone: "(555) 678-9012",
    website: "https://littleexplorers.com",
    availability: "Year-round, advance booking",
    matchScore: 88
  },
  {
    id: "venue-7",
    name: "Safari Adventure Zone",
    location: "Zoo District",
    address: "456 Wildlife Way, City, State 12345",
    capacity: 65,
    priceRange: "$250-450",
    pricePerHour: 350,
    rating: 4.5,
    reviewCount: 189,
    description: "Wildlife-themed venue with animal encounters and safari party experiences.",
    aiContextualNote: "Amazing for safari themes with real animal encounters and jungle decorations.",
    amenities: ["Animal Encounters", "Jungle Decorations", "Educational Programs", "Photo Opportunities", "Themed Activities"],
    venueType: "both",
    ageRecommendation: "3-10 years",
    phone: "(555) 789-0123",
    website: "https://safariadventure.com",
    availability: "Seasonal availability",
    matchScore: 93
  },
  {
    id: "venue-8",
    name: "Pirate's Cove Adventure Club",
    location: "Harbor District",
    address: "123 Treasure Island Rd, City, State 12345",
    capacity: 45,
    priceRange: "$220-380",
    pricePerHour: 300,
    rating: 4.4,
    reviewCount: 167,
    description: "Pirate-themed adventure club with treasure hunts and nautical party experiences.",
    aiContextualNote: "Ahoy! Perfect for pirate themes with treasure hunting and ship deck adventures.",
    amenities: ["Pirate Ship Replica", "Treasure Hunt Games", "Costume Rentals", "Nautical Decorations", "Pirate Shows"],
    venueType: "indoor",
    ageRecommendation: "4-10 years",
    phone: "(555) 890-1234",
    website: "https://piratescove.com",
    availability: "Year-round",
    matchScore: 91
  }
];

async function generateAIContextualNotes(venues: VenueData[], searchParams: VenueSearchParams): Promise<VenueData[]> {
  const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

  // If Azure OpenAI is not configured, use fallback logic
  if (!azureApiKey || !azureEndpoint) {
    console.log("Azure OpenAI not configured, using fallback AI contextual notes");
    return generateFallbackContextualNotes(venues, searchParams);
  }

  try {
    // Process venues in batches to avoid token limits
    const batchSize = 5;
    const enrichedVenues: VenueData[] = [];
    
    for (let i = 0; i < venues.length; i += batchSize) {
      const batch = venues.slice(i, i + batchSize);
      
      const prompt = `You are an AI assistant specializing in kids' birthday party planning. Generate playful, contextual notes explaining why each venue is perfect for the specific party requirements.

Party Details:
- Child's Age: ${searchParams.age || 'Not specified'}
- Theme: ${searchParams.theme || 'Not specified'}  
- Location: ${searchParams.location || searchParams.zipCode || 'Not specified'}
- Party Size: ${searchParams.capacity || 'Not specified'} guests
- Budget: ${searchParams.budget ? `$${searchParams.budget}` : 'Not specified'}
- Venue Preference: ${searchParams.venueType || 'Any'}

For each venue below, write a fun, engaging 1-2 sentence contextual note explaining why it's a great match. Include relevant emojis and focus on how it fits the party theme, age group, and specific requirements:

${batch.map((venue, idx) => 
  `${idx + 1}. ${venue.name} - ${venue.description} (Rating: ${venue.rating}/5, Capacity: ${venue.capacity}, Type: ${venue.venueType})`
).join('\n')}

Return only the contextual notes, one per line, numbered 1-${batch.length}.`;

      const response = await fetch(`${azureEndpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': azureApiKey
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a helpful AI assistant specializing in kids birthday party planning. Be fun, playful, and enthusiastic in your responses.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 500,
          temperature: 0.8,
          top_p: 0.9
        })
      });

      if (!response.ok) {
        console.log("Azure OpenAI request failed, using fallback for batch");
        const fallbackBatch = generateFallbackContextualNotes(batch, searchParams);
        enrichedVenues.push(...fallbackBatch);
        continue;
      }

      const data = await response.json();
      const aiNotes = data.choices?.[0]?.message?.content?.split('\n').filter((line: string) => line.trim()) || [];
      
      // Apply AI-generated notes to venues
      const enrichedBatch = batch.map((venue, idx) => ({
        ...venue,
        aiContextualNote: aiNotes[idx]?.replace(/^\d+\.\s*/, '').trim() || generateFallbackNote(venue, searchParams)
      }));
      
      enrichedVenues.push(...enrichedBatch);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`Successfully generated AI contextual notes for ${enrichedVenues.length} venues`);
    return enrichedVenues;
    
  } catch (error) {
    console.error("Error generating AI contextual notes:", error);
    // Fallback to rule-based contextual notes
    return generateFallbackContextualNotes(venues, searchParams);
  }
}

function generateFallbackContextualNotes(venues: VenueData[], searchParams: VenueSearchParams): VenueData[] {
  return venues.map(venue => ({
    ...venue,
    aiContextualNote: generateFallbackNote(venue, searchParams)
  }));
}

function generateFallbackNote(venue: VenueData, searchParams: VenueSearchParams): string {
  let contextualNote = venue.description || `Great venue for birthday parties`;
  
  // Match theme
  if (searchParams.theme) {
    const theme = searchParams.theme.toLowerCase();
    if (theme.includes('princess') && venue.name.toLowerCase().includes('princess')) {
      contextualNote = `🏰 Perfect princess paradise! ${contextualNote}`;
    } else if (theme.includes('superhero') && (venue.amenities.some(a => a.toLowerCase().includes('arcade')) || venue.name.toLowerCase().includes('adventure'))) {
      contextualNote = `⚡ Superhero headquarters awaits! ${contextualNote}`;
    } else if (theme.includes('ocean') && (venue.name.toLowerCase().includes('aquatic') || venue.name.toLowerCase().includes('water'))) {
      contextualNote = `🌊 Dive into ocean adventures! ${contextualNote}`;
    } else if (theme.includes('safari') && venue.name.toLowerCase().includes('safari')) {
      contextualNote = `🦁 Safari expedition central! ${contextualNote}`;
    } else if (theme.includes('pirate') && venue.name.toLowerCase().includes('pirate')) {
      contextualNote = `🏴‍☠️ Ahoy! Pirate adventure starts here! ${contextualNote}`;
    } else if (theme.includes('space') && (venue.name.toLowerCase().includes('science') || venue.name.toLowerCase().includes('sky'))) {
      contextualNote = `🚀 Blast off to space adventures! ${contextualNote}`;
    } else if (theme.includes('dinosaur') && venue.name.toLowerCase().includes('adventure')) {
      contextualNote = `🦕 Dinosaur discoveries await! ${contextualNote}`;
    } else if (theme.includes('unicorn') && venue.name.toLowerCase().includes('magical')) {
      contextualNote = `🦄 Magical unicorn wonderland! ${contextualNote}`;
    }
  }
  
  // Match age appropriateness
  if (searchParams.age) {
    const age = searchParams.age;
    if (age <= 4) {
      contextualNote += ` 🍼 Perfect for little ones with safe, age-appropriate fun!`;
    } else if (age >= 8) {
      contextualNote += ` 🎯 Exciting adventures for older kids who love action!`;
    } else {
      contextualNote += ` 🎈 Great for kids this age with engaging activities!`;
    }
  }
  
  // Match capacity
  if (searchParams.capacity && venue.capacity >= searchParams.capacity) {
    contextualNote += ` 👨‍👩‍👧‍👦 Spacious enough for all ${searchParams.capacity} of your guests!`;
  }
  
  // Match venue type preference
  if (searchParams.venueType && searchParams.venueType !== 'both') {
    if (venue.venueType === searchParams.venueType || venue.venueType === 'both') {
      contextualNote += ` ✨ Perfect ${searchParams.venueType} setting just as you wanted!`;
    }
  }
  
  return contextualNote;
}

async function fetchVenuesFromApify(searchParams: VenueSearchParams): Promise<VenueData[]> {
  const ApifyClient = require('apify-client');
  const apifyToken = process.env.APIFY_API_TOKEN;
  
  if (!apifyToken) {
    console.log("No Apify API token configured, using demo data");
    return DEMO_VENUES;
  }
  
  try {
    const client = new ApifyClient({
      token: apifyToken,
    });

    // Build dynamic search query based on wizard inputs
    const searchTerms = buildSearchQueries(searchParams);
    const locationQuery = searchParams.location || searchParams.zipCode || "New York, NY";
    
    // Try to geocode the location for enhanced precision
    let customGeolocation: any = null;
    const radiusKm = searchParams.radius ? searchParams.radius * 1.60934 : DEFAULT_SEARCH_RADIUS_KM; // Convert miles to km or use default
    
    try {
      console.log(`Attempting to geocode location: ${locationQuery}`);
      const geocodeResult = await geocodeLocation(locationQuery);
      
      if (geocodeResult.success && geocodeResult.latitude && geocodeResult.longitude) {
        customGeolocation = {
          type: "Point",
          coordinates: [geocodeResult.longitude.toString(), geocodeResult.latitude.toString()],
          radiusKm: Math.round(radiusKm)
        };
        console.log(`Successfully geocoded to coordinates: ${geocodeResult.latitude}, ${geocodeResult.longitude} with ${radiusKm}km radius`);
      }
    } catch (geocodeError) {
      console.warn("Geocoding failed, proceeding with location query only:", geocodeError);
    }
    
    const input = {
      searchStringsArray: searchTerms,
      locationQuery: locationQuery,
      ...(customGeolocation && { customGeolocation }), // Add geolocation if available
      maxCrawledPlacesPerSearch: 50, // Increased for better results
      placeMinimumStars: "four", // Focus on highly rated venues
      scrapePlaceDetailPage: true, // Get detailed venue information
      skipClosedPlaces: true, // Only include open venues
      language: "en",
      countryCode: "US",
      exportPlaceUrls: false,
      additionalInfo: true,
      maxImages: 3, // Get more images for venue cards
      maxReviews: 10, // Get more reviews for AI context
      reviewsSort: "newest",
      onlyDataFromSearchPage: false,
      maxCrawledPlaces: 100 // Increase total crawling limit
    };

    console.log("Calling Apify Google Maps Scraper with enhanced input:", {
      ...input,
      searchTermsCount: searchTerms.length,
      hasGeolocation: !!customGeolocation
    });
    
    // Run the Google Maps Scraper actor
    const run = await client.actor("apify/google-maps-scraper").call(input, {
      waitForFinish: 300, // Wait up to 5 minutes
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    if (!items || items.length === 0) {
      console.log("No venues found from Apify, using demo data");
      return DEMO_VENUES;
    }

    // Transform Apify results to our VenueData format
    const venues = items.map((place: any): VenueData => ({
      id: place.placeId || `venue-${Date.now()}-${Math.random()}`,
      name: place.title || place.name || "Unknown Venue",
      location: place.neighborhood || place.city || place.address || "Unknown Location",
      address: place.address || "Address not available",
      capacity: estimateCapacityFromPlace(place),
      priceRange: estimatePriceRange(place),
      pricePerHour: place.priceLevel ? place.priceLevel * 100 : undefined,
      rating: place.totalScore || place.rating || 0,
      reviewCount: place.reviewsCount || 0,
      description: place.description || generateDescription(place),
      aiContextualNote: "", // Will be filled by GPT-4.1
      amenities: extractAmenities(place),
      venueType: determineVenueType(place),
      ageRecommendation: "All ages",
      imageUrl: place.imageUrls?.[0] || place.photos?.[0]?.url,
      phone: place.phone,
      website: place.website,
      availability: "Contact for availability",
      matchScore: calculateMatchScore(place, searchParams)
    }));

    console.log(`Successfully fetched ${venues.length} venues from Apify`);
    return venues;
    
  } catch (error) {
    console.error("Error fetching from Apify:", error);
    // Fallback to demo data
    console.log("Falling back to demo data due to Apify error");
    return DEMO_VENUES;
  }
}

// Build dynamic search queries based on wizard inputs
function buildSearchQueries(params: VenueSearchParams): string[] {
  const queries: string[] = [];
  
  // Base query with location
  const baseLocation = params.location || params.zipCode || "";
  
  // Priority 1: Custom keywords (if provided)
  if (params.customKeywords && params.customKeywords.trim()) {
    const customTerms = params.customKeywords.trim();
    queries.push(`${customTerms} birthday party venue ${baseLocation}`);
    queries.push(`${customTerms} party venue ${baseLocation}`);
    queries.push(`${customTerms} ${baseLocation}`);
    
    // Add variations with common party venue terms
    queries.push(`${customTerms} party halls ${baseLocation}`);
    queries.push(`${customTerms} event venues ${baseLocation}`);
  }
  
  // Priority 2: Theme-based venue filtering
  if (params.theme) {
    const theme = params.theme.toLowerCase();
    if (theme.includes('princess')) {
      queries.push(`princess party venues ${baseLocation}`);
      queries.push(`elegant party halls ${baseLocation}`);
      queries.push(`princess theme birthday venue ${baseLocation}`);
    } else if (theme.includes('superhero')) {
      queries.push(`superhero party venues ${baseLocation}`);
      queries.push(`arcade birthday parties ${baseLocation}`);
      queries.push(`superhero theme party venue ${baseLocation}`);
    } else if (theme.includes('dinosaur')) {
      queries.push(`dinosaur theme parties ${baseLocation}`);
      queries.push(`museum birthday parties ${baseLocation}`);
      queries.push(`dinosaur party venue ${baseLocation}`);
    } else if (theme.includes('space')) {
      queries.push(`space theme birthday parties ${baseLocation}`);
      queries.push(`planetarium parties ${baseLocation}`);
      queries.push(`science center events ${baseLocation}`);
    } else if (theme.includes('safari') || theme.includes('animal')) {
      queries.push(`zoo birthday parties ${baseLocation}`);
      queries.push(`animal encounters parties ${baseLocation}`);
      queries.push(`petting zoo events ${baseLocation}`);
    } else if (theme.includes('ocean') || theme.includes('mermaid')) {
      queries.push(`aquarium birthday parties ${baseLocation}`);
      queries.push(`water park parties ${baseLocation}`);
      queries.push(`swimming pool parties ${baseLocation}`);
    } else if (theme.includes('pirate')) {
      queries.push(`pirate theme parties ${baseLocation}`);
      queries.push(`adventure party venues ${baseLocation}`);
      queries.push(`pirate ship party venue ${baseLocation}`);
    } else if (theme.includes('unicorn')) {
      queries.push(`unicorn birthday parties ${baseLocation}`);
      queries.push(`magical party venues ${baseLocation}`);
      queries.push(`unicorn theme party venue ${baseLocation}`);
    }
  }
  
  // Priority 3: Age-based venue filtering
  if (params.age) {
    if (params.age <= 3) {
      queries.push(`toddler birthday party venues ${baseLocation}`);
      queries.push(`indoor play spaces for toddlers ${baseLocation}`);
    } else if (params.age <= 6) {
      queries.push(`kids birthday party venues ${baseLocation}`);
      queries.push(`children's party halls ${baseLocation}`);
      queries.push(`soft play centers ${baseLocation}`);
    } else if (params.age <= 10) {
      queries.push(`kids party venues ${baseLocation}`);
      queries.push(`indoor entertainment centers ${baseLocation}`);
      queries.push(`trampoline parks ${baseLocation}`);
    } else {
      queries.push(`teen birthday party venues ${baseLocation}`);
      queries.push(`arcade centers ${baseLocation}`);
      queries.push(`bowling alleys ${baseLocation}`);
    }
  }
  
  // Priority 4: Indoor/Outdoor preference
  if (params.venueType) {
    if (params.venueType === 'indoor') {
      queries.push(`indoor birthday party venues ${baseLocation}`);
      queries.push(`indoor play centers ${baseLocation}`);
    } else if (params.venueType === 'outdoor') {
      queries.push(`outdoor birthday party venues ${baseLocation}`);
      queries.push(`park party venues ${baseLocation}`);
      queries.push(`outdoor event spaces ${baseLocation}`);
    }
  }
  
  // Priority 5: Party size consideration
  if (params.capacity) {
    if (params.capacity > 50) {
      queries.push(`large party venues ${baseLocation}`);
      queries.push(`banquet halls ${baseLocation}`);
    } else if (params.capacity > 20) {
      queries.push(`medium party venues ${baseLocation}`);
      queries.push(`private party rooms ${baseLocation}`);
    } else {
      queries.push(`small party venues ${baseLocation}`);
      queries.push(`intimate party spaces ${baseLocation}`);
    }
  }
  
  // Priority 6: Budget consideration
  if (params.budget) {
    if (params.budget < 200) {
      queries.push(`affordable birthday party venues ${baseLocation}`);
      queries.push(`budget party halls ${baseLocation}`);
    } else if (params.budget > 500) {
      queries.push(`premium birthday party venues ${baseLocation}`);
      queries.push(`luxury party spaces ${baseLocation}`);
    }
  }
  
  // Fallback queries if none specified
  if (queries.length === 0) {
    queries.push(`kids birthday party venues ${baseLocation}`);
    queries.push(`children's party halls ${baseLocation}`);
    queries.push(`birthday party venues ${baseLocation}`);
    queries.push(`indoor play center ${baseLocation}`);
    queries.push(`party venue ${baseLocation}`);
  }
  
  // Remove duplicates and limit to maximum 15 queries for better coverage
  const uniqueQueries = Array.from(new Set(queries));
  return uniqueQueries.slice(0, 15);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const params: VenueSearchParams = {
      location: searchParams.get('location') || undefined,
      zipCode: searchParams.get('zipCode') || undefined,
      radius: searchParams.get('radius') ? parseInt(searchParams.get('radius')!) : undefined,
      theme: searchParams.get('theme') || undefined,
      customKeywords: searchParams.get('customKeywords') || undefined,
      age: searchParams.get('age') ? parseInt(searchParams.get('age')!) : undefined,
      budget: searchParams.get('budget') ? parseInt(searchParams.get('budget')!) : undefined,
      capacity: searchParams.get('capacity') ? parseInt(searchParams.get('capacity')!) : undefined,
      venueType: (searchParams.get('venueType') as 'indoor' | 'outdoor' | 'both') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 5,
    };

    // Fetch venues (from Apify or demo data)
    let venues = await fetchVenuesFromApify(params);
    
    // Generate AI contextual notes
    venues = await generateAIContextualNotes(venues, params);
    
    // Apply filters
    if (params.venueType && params.venueType !== 'both') {
      venues = venues.filter(venue => 
        venue.venueType === params.venueType || venue.venueType === 'both'
      );
    }
    
    if (params.capacity) {
      venues = venues.filter(venue => venue.capacity >= params.capacity!);
    }
    
    if (params.budget) {
      venues = venues.filter(venue => 
        !venue.pricePerHour || venue.pricePerHour <= params.budget!
      );
    }
    
    // Sort by match score (descending)
    venues.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    
    // Apply pagination
    const page = params.page || 1;
    const limit = params.limit || 5;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedVenues = venues.slice(startIndex, endIndex);
    
    const response = {
      venues: paginatedVenues,
      pagination: {
        page,
        limit,
        total: venues.length,
        totalPages: Math.ceil(venues.length / limit),
        hasNext: endIndex < venues.length,
        hasPrev: page > 1
      },
      filters: params
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error fetching venues:', error);
    return NextResponse.json(
      { error: 'Failed to fetch venues' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      action, 
      venueId, 
      venueName, 
      venueLocation, 
      venueAddress,
      venueRating,
      venuePrice,
      venueType,
      venueWebsite,
      venuePhone,
      matchScore,
      aiNote,
      feedback,
      rating,
      notes 
    } = body;
    
    // For now, return success without database operation
    // In production, you would integrate with Supabase auth to get userId
    // and store favorites/feedback in the database
    
    if (action === 'favorite') {
      console.log(`Favoriting venue: ${venueName} (${venueId})`);
      return NextResponse.json({ success: true, message: 'Venue favorited' });
    }
    
    if (action === 'unfavorite') {
      console.log(`Unfavoriting venue: ${venueName} (${venueId})`);
      return NextResponse.json({ success: true, message: 'Venue unfavorited' });
    }
    
    if (action === 'feedback') {
      console.log(`Feedback for venue ${venueName}: ${feedback}`, { rating, notes });
      return NextResponse.json({ success: true, message: 'Feedback recorded' });
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('Error handling venue action:', error);
    return NextResponse.json(
      { error: 'Failed to process venue action' },
      { status: 500 }
    );
  }
}

// Helper functions for future Apify integration

function estimateCapacityFromPlace(place: any): number {
  // Logic to estimate venue capacity from place data
  // Could use size, reviews mentioning capacity, etc.
  return Math.floor(Math.random() * 80) + 20; // Random for demo
}

function estimatePriceRange(place: any): string {
  const priceLevel = place.priceLevel || Math.floor(Math.random() * 4) + 1;
  const ranges = ["$100-200", "$200-350", "$350-500", "$500-750"];
  return ranges[priceLevel - 1] || "$200-400";
}

function generateDescription(place: any): string {
  return place.description || 
    `${place.title || place.name} offers a great venue for birthday parties and special events.`;
}

function extractAmenities(place: any): string[] {
  // Extract amenities from place data, reviews, etc.
  const commonAmenities = [
    "Parking", "Restrooms", "Food Service", "Party Room", 
    "Sound System", "Decorations", "Party Host"
  ];
  return commonAmenities.slice(0, Math.floor(Math.random() * 5) + 2);
}

function determineVenueType(place: any): 'indoor' | 'outdoor' | 'both' {
  // Logic to determine venue type from place data
  const types: ('indoor' | 'outdoor' | 'both')[] = ['indoor', 'outdoor', 'both'];
  return types[Math.floor(Math.random() * types.length)];
}

function calculateMatchScore(place: any, params: VenueSearchParams): number {
  // Calculate match score based on search parameters
  let score = 75; // Base score
  
  // Add points for various matches
  if (params.theme && place.title?.toLowerCase().includes(params.theme.toLowerCase())) {
    score += 15;
  }
  
  if (place.totalScore && place.totalScore > 4) {
    score += 5;
  }
  
  return Math.min(score + Math.floor(Math.random() * 10), 100);
}