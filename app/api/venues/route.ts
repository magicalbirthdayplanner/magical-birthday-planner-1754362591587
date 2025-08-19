import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

export interface VenueSearchParams {
  location?: string;
  zipCode?: string;
  radius?: number;
  theme?: string;
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
  // Future: Integrate with OpenAI GPT-4 for contextual AI notes
  // For now, use intelligent matching based on search parameters
  
  return venues.map(venue => {
    let contextualNote = venue.aiContextualNote;
    
    // Match theme
    if (searchParams.theme) {
      const theme = searchParams.theme.toLowerCase();
      if (theme.includes('princess') && venue.name.toLowerCase().includes('princess')) {
        contextualNote = `🏰 Perfect match! ${contextualNote}`;
      } else if (theme.includes('superhero') && venue.amenities.some(a => a.toLowerCase().includes('arcade'))) {
        contextualNote = `⚡ Superhero headquarters! ${contextualNote}`;
      } else if (theme.includes('ocean') && venue.name.toLowerCase().includes('aquatic')) {
        contextualNote = `🌊 Ocean adventure awaits! ${contextualNote}`;
      } else if (theme.includes('safari') && venue.name.toLowerCase().includes('safari')) {
        contextualNote = `🦁 Safari expedition ready! ${contextualNote}`;
      } else if (theme.includes('pirate') && venue.name.toLowerCase().includes('pirate')) {
        contextualNote = `🏴‍☠️ Ahoy matey! ${contextualNote}`;
      } else if (theme.includes('space') && venue.name.toLowerCase().includes('science')) {
        contextualNote = `🚀 Blast off to space! ${contextualNote}`;
      }
    }
    
    // Match age
    if (searchParams.age) {
      const age = searchParams.age;
      if (age <= 4 && venue.ageRecommendation?.includes('3-')) {
        contextualNote += ` Great for toddlers and preschoolers!`;
      } else if (age >= 8 && venue.ageRecommendation?.includes('-12')) {
        contextualNote += ` Perfect for older kids!`;
      }
    }
    
    // Match capacity
    if (searchParams.capacity && venue.capacity >= searchParams.capacity) {
      contextualNote += ` Can easily accommodate your ${searchParams.capacity} guests.`;
    }
    
    // Match venue type preference
    if (searchParams.venueType && searchParams.venueType !== 'both') {
      if (venue.venueType === searchParams.venueType || venue.venueType === 'both') {
        contextualNote += ` Matches your ${searchParams.venueType} venue preference!`;
      }
    }
    
    return { ...venue, aiContextualNote: contextualNote };
  });
}

async function fetchVenuesFromApify(searchParams: VenueSearchParams): Promise<VenueData[]> {
  // Future implementation: Call Apify actors for real venue data
  /*
  const apifyApiKey = process.env.APIFY_API_KEY;
  const actorId = process.env.APIFY_PLACES_ACTOR_ID; // e.g., "apify/google-places-scraper"
  
  if (!apifyApiKey) {
    console.log("No Apify API key configured, using demo data");
    return DEMO_VENUES;
  }
  
  try {
    const runInput = {
      searchTerms: [`kids birthday party venue near ${searchParams.zipCode || searchParams.location}`],
      locationSearch: searchParams.location || searchParams.zipCode,
      maxPlacesPerSearch: searchParams.limit || 20,
      language: "en",
      countryCode: "us"
    };
    
    // Start Apify actor run
    const response = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apifyApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: runInput })
    });
    
    const runData = await response.json();
    
    // Wait for completion and fetch results
    const resultsResponse = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs/${runData.data.id}/dataset/items`, {
      headers: {
        'Authorization': `Bearer ${apifyApiKey}`,
      }
    });
    
    const venues = await resultsResponse.json();
    
    // Transform Apify results to our VenueData format
    return venues.map((place: any): VenueData => ({
      id: place.placeId || `venue-${Date.now()}-${Math.random()}`,
      name: place.title || place.name,
      location: place.address?.neighborhood || place.address?.city || "Unknown Location",
      address: place.address?.full || place.address,
      capacity: estimateCapacityFromPlace(place), // Custom logic
      priceRange: estimatePriceRange(place), // Custom logic
      pricePerHour: place.priceLevel ? place.priceLevel * 100 : undefined,
      rating: place.totalScore || place.rating || 0,
      reviewCount: place.reviewsCount || 0,
      description: place.description || generateDescription(place),
      aiContextualNote: "", // Will be filled by generateAIContextualNotes
      amenities: extractAmenities(place),
      venueType: determineVenueType(place),
      ageRecommendation: "All ages",
      imageUrl: place.imageUrl || place.photos?.[0]?.url,
      phone: place.phone,
      website: place.website,
      availability: "Contact for availability",
      matchScore: calculateMatchScore(place, searchParams)
    }));
    
  } catch (error) {
    console.error("Error fetching from Apify:", error);
    // Fallback to demo data
    return DEMO_VENUES;
  }
  */
  
  // For MVP, return demo data
  return DEMO_VENUES;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const params: VenueSearchParams = {
      location: searchParams.get('location') || undefined,
      zipCode: searchParams.get('zipCode') || undefined,
      radius: searchParams.get('radius') ? parseInt(searchParams.get('radius')!) : undefined,
      theme: searchParams.get('theme') || undefined,
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
    const { action, venueId, userId } = body;
    
    if (action === 'favorite') {
      // Future: Store in database
      // For MVP, favorites are handled client-side with localStorage
      return NextResponse.json({ success: true, message: 'Venue favorited' });
    }
    
    if (action === 'unfavorite') {
      // Future: Remove from database
      return NextResponse.json({ success: true, message: 'Venue unfavorited' });
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