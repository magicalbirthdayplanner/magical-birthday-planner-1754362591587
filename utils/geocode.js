/**
 * Geocoding utility using OpenStreetMap Nominatim API
 * Converts location strings to latitude/longitude coordinates
 */

/**
 * Geocode a location string to coordinates using OpenStreetMap Nominatim API
 * @param {string} locationString - Location string (e.g., "10001", "New York, NY")
 * @returns {Promise<{lat: number, lng: number} | null>} Coordinates object or null if not found
 */
export async function geocodeLocation(locationString) {
  if (!locationString || typeof locationString !== 'string') {
    console.error('Invalid location string provided to geocodeLocation');
    return null;
  }

  // Clean the location string
  const cleanLocation = locationString.trim();
  
  if (!cleanLocation) {
    console.error('Empty location string provided to geocodeLocation');
    return null;
  }

  try {
    // Construct the Nominatim API URL
    const baseUrl = 'https://nominatim.openstreetmap.org/search';
    const params = new URLSearchParams({
      q: cleanLocation,
      format: 'json',
      limit: '1',
      addressdetails: '1',
      countrycodes: 'us', // Restrict to US for better results
    });

    const url = `${baseUrl}?${params}`;

    // Make the API request with proper headers
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MagicalBirthdayPlanner/1.0', // Required by Nominatim
      },
    });

    if (!response.ok) {
      console.error(`Nominatim API request failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    // Check if we got results
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn(`No geocoding results found for location: ${locationString}`);
      return null;
    }

    const result = data[0];

    // Validate that we have valid coordinates
    if (!result.lat || !result.lon) {
      console.warn(`Invalid coordinates in geocoding result for: ${locationString}`);
      return null;
    }

    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    // Validate coordinates are numbers and within valid ranges
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      console.warn(`Invalid coordinate values for location: ${locationString}`);
      return null;
    }

    console.log(`Successfully geocoded "${locationString}" to lat: ${lat}, lng: ${lng}`);

    return {
      lat,
      lng,
    };

  } catch (error) {
    console.error('Error geocoding location:', error);
    return null;
  }
}