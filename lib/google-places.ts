// Google Places API integration with caching
import { createClient } from '@supabase/supabase-js';

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
const GOOGLE_PLACES_BASE_URL = 'https://maps.googleapis.com/maps/api/place';

// Initialize Supabase client with service role for database operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface VenueData {
  id?: string;
  placeId: string;
  name: string;
  address: string;
  formattedAddress?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewsCount?: number;
  priceLevel?: number;
  category: string;
  types?: string[];
  businessStatus?: string;
  latitude?: number;
  longitude?: number;
  zipCode?: string;
  city?: string;
  state?: string;
  country?: string;
  description?: string;
  photos?: string[];
  openingHours?: any;
  accessibilityInfo?: string;
  parkingInfo?: string;
  partyPackagesAvailable?: boolean;
  maxCapacity?: number;
  ageRestrictions?: string;
  amenities?: string[];
  distance?: string;
  distanceMiles?: number;
}

export interface SearchParams {
  zipCode: string;
  category: 'indoor' | 'outdoor' | 'specialty' | 'community';
  radius?: number;
  minRating?: number;
  searchQuery?: string;
  sortBy?: 'distance' | 'rating' | 'name' | 'reviews';
}

// Mapping venue categories to Google Places types
const VENUE_TYPE_MAPPING = {
  indoor: [
    'amusement_park',
    'bowling_alley',
    'gym',
    'movie_theater',
    'night_club',
    'restaurant',
    'shopping_mall',
    'arcade',
    'community_center',
    'establishment'
  ],
  outdoor: [
    'park',
    'zoo',
    'amusement_park',
    'campground',
    'tourist_attraction',
    'establishment'
  ],
  specialty: [
    'amusement_park',
    'bowling_alley',
    'gym',
    'movie_theater',
    'tourist_attraction',
    'establishment'
  ],
  community: [
    'community_center',
    'library',
    'church',
    'establishment'
  ]
};

// Convert ZIP code to coordinates using Google Geocoding API
export async function geocodeZipCode(zipCode: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${zipCode}&key=${GOOGLE_PLACES_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.results.length) {
      console.error('Geocoding failed:', data.status, data.error_message);
      return null;
    }
    
    const location = data.results[0].geometry.location;
    return { lat: location.lat, lng: location.lng };
  } catch (error) {
    console.error('Error geocoding ZIP code:', error);
    return null;
  }
}

// Search venues using Google Places API
export async function searchGooglePlaces(params: SearchParams): Promise<VenueData[]> {
  try {
    // First, get coordinates from ZIP code
    const coordinates = await geocodeZipCode(params.zipCode);
    if (!coordinates) {
      throw new Error(`Unable to geocode ZIP code: ${params.zipCode}`);
    }
    
    const { lat, lng } = coordinates;
    const radius = (params.radius || 20) * 1609.34; // Convert miles to meters
    const venueTypes = VENUE_TYPE_MAPPING[params.category] || VENUE_TYPE_MAPPING.indoor;
    
    const allResults: VenueData[] = [];
    
    // Search for each venue type
    for (const type of venueTypes) {
      try {
        const searchUrl = `${GOOGLE_PLACES_BASE_URL}/nearbysearch/json?` + 
          `location=${lat},${lng}&` +
          `radius=${radius}&` +
          `type=${type}&` +
          `key=${GOOGLE_PLACES_API_KEY}`;
        
        const response = await fetch(searchUrl);
        
        if (!response.ok) {
          console.error(`Places API request failed for type ${type}:`, response.statusText);
          continue;
        }
        
        const data = await response.json();
        
        if (data.status !== 'OK') {
          console.error(`Places API error for type ${type}:`, data.status, data.error_message);
          continue;
        }
        
        // Process results
        for (const place of data.results) {
          // Skip if we already have this place
          if (allResults.some(r => r.placeId === place.place_id)) {
            continue;
          }
          
          // Calculate distance
          const distanceMiles = calculateDistance(
            lat, lng, 
            place.geometry.location.lat, 
            place.geometry.location.lng
          );
          
          // Skip if outside radius
          if (distanceMiles > (params.radius || 20)) {
            continue;
          }
          
          // Skip if below minimum rating
          if (params.minRating && place.rating && place.rating < params.minRating) {
            continue;
          }
          
          const venue: VenueData = {
            placeId: place.place_id,
            name: place.name,
            address: place.vicinity || place.formatted_address || '',
            formattedAddress: place.formatted_address,
            rating: place.rating,
            reviewsCount: place.user_ratings_total,
            priceLevel: place.price_level,
            category: params.category,
            types: place.types,
            businessStatus: place.business_status,
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng,
            photos: place.photos?.map((photo: any) => photo.photo_reference) || [],
            distance: `${distanceMiles.toFixed(1)} miles`,
            distanceMiles
          };
          
          allResults.push(venue);
        }
        
        // Add a small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Error searching for type ${type}:`, error);
        continue;
      }
    }
    
    // Apply search query filter if provided
    let filteredResults = allResults;
    if (params.searchQuery) {
      const query = params.searchQuery.toLowerCase();
      filteredResults = allResults.filter(venue =>
        venue.name.toLowerCase().includes(query) ||
        venue.address.toLowerCase().includes(query) ||
        venue.types?.some(type => type.toLowerCase().includes(query))
      );
    }
    
    // Sort results
    const sortBy = params.sortBy || 'distance';
    filteredResults.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'reviews':
          return (b.reviewsCount || 0) - (a.reviewsCount || 0);
        default: // distance
          return (a.distanceMiles || 0) - (b.distanceMiles || 0);
      }
    });
    
    return filteredResults.slice(0, 50); // Limit to 50 results
    
  } catch (error) {
    console.error('Error searching Google Places:', error);
    throw error;
  }
}

// Get additional venue details from Google Places API
export async function getVenueDetails(placeId: string): Promise<Partial<VenueData> | null> {
  try {
    const detailsUrl = `${GOOGLE_PLACES_BASE_URL}/details/json?` +
      `place_id=${placeId}&` +
      `fields=name,formatted_address,formatted_phone_number,website,opening_hours,price_level,rating,user_ratings_total,types,business_status&` +
      `key=${GOOGLE_PLACES_API_KEY}`;
    
    const response = await fetch(detailsUrl);
    
    if (!response.ok) {
      throw new Error(`Details API request failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.result) {
      console.error('Places Details API error:', data.status, data.error_message);
      return null;
    }
    
    const place = data.result;
    
    return {
      phone: place.formatted_phone_number,
      website: place.website,
      openingHours: place.opening_hours,
      priceLevel: place.price_level,
      rating: place.rating,
      reviewsCount: place.user_ratings_total,
      types: place.types,
      businessStatus: place.business_status
    };
    
  } catch (error) {
    console.error('Error getting venue details:', error);
    return null;
  }
}

// Cache venues in database
export async function cacheVenues(venues: VenueData[]): Promise<void> {
  try {
    for (const venue of venues) {
      // Extract location data
      const addressParts = venue.address.split(',').map(part => part.trim());
      const zipCodeMatch = venue.address.match(/\b\d{5}(-\d{4})?\b/);
      
      const venueData = {
        place_id: venue.placeId,
        name: venue.name,
        address: venue.address,
        formatted_address: venue.formattedAddress,
        phone: venue.phone,
        website: venue.website,
        rating: venue.rating,
        reviews_count: venue.reviewsCount,
        price_level: venue.priceLevel,
        category: venue.category,
        types: venue.types,
        business_status: venue.businessStatus,
        latitude: venue.latitude,
        longitude: venue.longitude,
        zip_code: zipCodeMatch ? zipCodeMatch[0] : null,
        city: addressParts.length > 1 ? addressParts[addressParts.length - 2] : null,
        state: addressParts.length > 2 ? addressParts[addressParts.length - 1]?.split(' ')[0] : null,
        photos: venue.photos,
        opening_hours: venue.openingHours,
        party_packages_available: false, // Will be updated manually
        last_validated_at: new Date().toISOString()
      };
      
      // Upsert venue data
      const { error } = await supabase
        .from('venues')
        .upsert(venueData, { onConflict: 'place_id' });
      
      if (error) {
        console.error('Error caching venue:', venue.name, error);
      }
    }
    
    console.log(`Successfully cached ${venues.length} venues`);
  } catch (error) {
    console.error('Error caching venues:', error);
  }
}

// Cache search results
export async function cacheSearch(params: SearchParams, venues: VenueData[]): Promise<void> {
  try {
    // Insert or update search record
    const searchData = {
      zip_code: params.zipCode,
      category: params.category,
      radius_miles: params.radius || 20,
      search_query: params.searchQuery || null,
      min_rating: params.minRating || 0,
      total_results: venues.length,
      search_completed_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };
    
    const { data: searchRecord, error: searchError } = await supabase
      .from('venue_searches')
      .upsert(searchData, { 
        onConflict: 'zip_code,category,radius_miles,search_query,min_rating',
        ignoreDuplicates: false 
      })
      .select()
      .single();
    
    if (searchError || !searchRecord) {
      console.error('Error caching search:', searchError);
      return;
    }
    
    // Delete old search results
    await supabase
      .from('venue_search_results')
      .delete()
      .eq('search_id', searchRecord.id);
    
    // Insert new search results
    const searchResults = venues.map((venue, index) => ({
      search_id: searchRecord.id,
      venue_id: venue.id, // Will be null for new venues, handled by trigger
      distance_miles: venue.distanceMiles,
      search_rank: index + 1
    }));
    
    if (searchResults.length > 0) {
      const { error: resultsError } = await supabase
        .from('venue_search_results')
        .insert(searchResults);
      
      if (resultsError) {
        console.error('Error caching search results:', resultsError);
      }
    }
    
  } catch (error) {
    console.error('Error caching search:', error);
  }
}

// Get cached venues for a search
export async function getCachedVenues(params: SearchParams): Promise<VenueData[] | null> {
  try {
    const { data: searchRecord } = await supabase
      .from('venue_searches')
      .select(`
        *,
        venue_search_results (
          distance_miles,
          search_rank,
          venues (*)
        )
      `)
      .eq('zip_code', params.zipCode)
      .eq('category', params.category)
      .eq('radius_miles', params.radius || 20)
      .eq('search_query', params.searchQuery || null)
      .eq('min_rating', params.minRating || 0)
      .gt('expires_at', new Date().toISOString())
      .order('search_completed_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!searchRecord) {
      return null;
    }
    
    // Transform database records back to VenueData format
    const venues: VenueData[] = searchRecord.venue_search_results
      .filter((result: any) => result.venues) // Only include results with venue data
      .map((result: any) => {
        const venue = result.venues;
        return {
          id: venue.id,
          placeId: venue.place_id,
          name: venue.name,
          address: venue.address,
          formattedAddress: venue.formatted_address,
          phone: venue.phone,
          website: venue.website,
          rating: venue.rating,
          reviewsCount: venue.reviews_count,
          priceLevel: venue.price_level,
          category: venue.category,
          types: venue.types,
          businessStatus: venue.business_status,
          latitude: venue.latitude,
          longitude: venue.longitude,
          zipCode: venue.zip_code,
          city: venue.city,
          state: venue.state,
          country: venue.country,
          photos: venue.photos,
          openingHours: venue.opening_hours,
          partyPackagesAvailable: venue.party_packages_available,
          distance: `${result.distance_miles?.toFixed(1)} miles`,
          distanceMiles: result.distance_miles
        };
      })
      .sort((a, b) => (a.distanceMiles || 0) - (b.distanceMiles || 0));
    
    console.log(`Retrieved ${venues.length} cached venues for ${params.category} near ${params.zipCode}`);
    return venues;
    
  } catch (error) {
    console.error('Error getting cached venues:', error);
    return null;
  }
}

// Calculate distance between two points in miles
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Main search function with caching
export async function searchVenues(params: SearchParams): Promise<VenueData[]> {
  try {
    console.log(`Searching venues for ${params.category} near ${params.zipCode}`);
    
    // Try to get cached results first
    const cachedVenues = await getCachedVenues(params);
    if (cachedVenues && cachedVenues.length > 0) {
      console.log(`Using ${cachedVenues.length} cached venues`);
      return cachedVenues;
    }
    
    console.log('No cached results found, fetching from Google Places API...');
    
    // Fetch from Google Places API
    const venues = await searchGooglePlaces(params);
    
    if (venues.length > 0) {
      // Cache the results
      await cacheVenues(venues);
      await cacheSearch(params, venues);
    }
    
    return venues;
    
  } catch (error) {
    console.error('Error in searchVenues:', error);
    throw error;
  }
}