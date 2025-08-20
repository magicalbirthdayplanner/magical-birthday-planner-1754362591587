// Geocoding utility to convert location (ZIP/City) to coordinates
// Uses free geocoding services to get latitude/longitude for Apify integration

interface GeocodeResult {
  success: boolean;
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;
  error?: string;
}

/**
 * Convert a location (ZIP code, city, or address) to coordinates
 * Uses multiple free geocoding services as fallbacks
 */
export async function geocodeLocation(location: string): Promise<GeocodeResult> {
  if (!location || location.trim() === '') {
    return { success: false, error: 'Location is required' };
  }

  const trimmedLocation = location.trim();

  // Try free geocoding services in order of preference
  const geocodingServices = [
    () => geocodeWithGeoapify(trimmedLocation),
    () => geocodeWithNominatim(trimmedLocation),
    () => geocodeWithPositionstack(trimmedLocation)
  ];

  for (const service of geocodingServices) {
    try {
      const result = await service();
      if (result.success) {
        return result;
      }
    } catch (error) {
      console.warn('Geocoding service failed, trying next service:', error);
      continue;
    }
  }

  return { 
    success: false, 
    error: 'Unable to geocode location. Please check the address and try again.' 
  };
}

/**
 * Geocode using Geoapify (free tier: 3,000 requests/day)
 */
async function geocodeWithGeoapify(location: string): Promise<GeocodeResult> {
  const API_KEY = process.env.GEOAPIFY_API_KEY;
  
  if (!API_KEY) {
    throw new Error('Geoapify API key not configured');
  }

  const encodedLocation = encodeURIComponent(location);
  const url = `https://api.geoapify.com/v1/geocode/search?text=${encodedLocation}&format=json&apiKey=${API_KEY}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Geoapify API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.results && data.results.length > 0) {
    const result = data.results[0];
    return {
      success: true,
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      formattedAddress: result.formatted
    };
  }

  throw new Error('No results found');
}

/**
 * Geocode using OpenStreetMap Nominatim (free, no API key required)
 */
async function geocodeWithNominatim(location: string): Promise<GeocodeResult> {
  const encodedLocation = encodeURIComponent(location);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedLocation}&limit=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'MagicalBirthdayPlanner/1.0' // Required by Nominatim
    }
  });

  if (!response.ok) {
    throw new Error(`Nominatim API error: ${response.status}`);
  }

  const data = await response.json();

  if (Array.isArray(data) && data.length > 0) {
    const result = data[0];
    return {
      success: true,
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      formattedAddress: result.display_name
    };
  }

  throw new Error('No results found');
}

/**
 * Geocode using Positionstack (free tier: 25,000 requests/month)
 */
async function geocodeWithPositionstack(location: string): Promise<GeocodeResult> {
  const API_KEY = process.env.POSITIONSTACK_API_KEY;
  
  if (!API_KEY) {
    throw new Error('Positionstack API key not configured');
  }

  const encodedLocation = encodeURIComponent(location);
  const url = `http://api.positionstack.com/v1/forward?access_key=${API_KEY}&query=${encodedLocation}&limit=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Positionstack API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.data && data.data.length > 0) {
    const result = data.data[0];
    return {
      success: true,
      latitude: result.latitude,
      longitude: result.longitude,
      formattedAddress: result.label
    };
  }

  throw new Error('No results found');
}

/**
 * Helper function to calculate distance between two points (Haversine formula)
 * Used to validate coordinates and calculate search radius
 */
export function calculateDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert miles to kilometers for Apify radiusKm parameter
 */
export function milesToKilometers(miles: number): number {
  return miles * 1.60934;
}

/**
 * Default search radius in miles (convertible to km for Apify)
 */
export const DEFAULT_SEARCH_RADIUS_MILES = 10;
export const DEFAULT_SEARCH_RADIUS_KM = milesToKilometers(DEFAULT_SEARCH_RADIUS_MILES);