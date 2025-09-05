import { ApifyClient } from 'apify-client';

/**
 * Initialize and configure Apify client
 * @returns {ApifyClient} Configured Apify client instance
 */
export function createApifyClient() {
  const token = process.env.APIFY_API_TOKEN;
  
  if (!token) {
    throw new Error('APIFY_API_TOKEN environment variable is required');
  }

  return new ApifyClient({
    token,
  });
}

/**
 * Call the Apify Google Maps Scraper Actor
 * @param {Object} params - Scraper parameters
 * @param {string} params.location - Location (ZIP code or city name)
 * @param {string[]} params.searchTerms - Array of search terms
 * @param {number} params.radiusKm - Search radius in kilometers (default: 16)
 * @param {Object} params.customGeolocation - Custom geolocation object with coordinates
 * @returns {Promise<Array>} Array of venue results
 */
export async function scrapeGoogleMapsVenues({ location, searchTerms, radiusKm = 16, customGeolocation }) {
  const client = createApifyClient();
  
  // Google Maps Scraper Actor ID (public actor)
  const actorId = 'nwua9Gu5YrADL7ZDj';
  
  const input = {
    searchStringsArray: searchTerms,
    searchLocation: location,
    maxCrawledPlacesPerSearch: 20,
    includeImages: true,
    includeReviews: false,
    reviewsSort: 'mostRelevant',
    language: 'en',
    countryCode: 'us',
    searchRadius: radiusKm * 1000, // Convert km to meters
    exportPlaceUrls: false,
    deeperCityScrape: false,
  };

  // Add custom geolocation if provided
  if (customGeolocation) {
    input.customGeolocation = customGeolocation;
  }

  try {
    // Run the actor and wait for results
    const run = await client.actor(actorId).call(input, {
      waitSecs: 120, // Wait up to 2 minutes for completion
    });

    // Get the results from the default dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    return items || [];
  } catch (error) {
    console.error('Apify scraping error:', error);
    throw new Error('Failed to scrape venue data from Google Maps');
  }
}

/**
 * Clean and format venue data for API response
 * @param {Object} rawVenue - Raw venue data from Apify
 * @returns {Object} Cleaned venue object
 */
export function cleanVenueData(rawVenue) {
  return {
    id: rawVenue.placeId || `venue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: rawVenue.title || 'Unknown Venue',
    address: rawVenue.address || 'Address not available',
    rating: rawVenue.totalScore || null,
    reviewsCount: rawVenue.reviewsCount || 0,
    price: rawVenue.priceRange || null,
    phone: rawVenue.phone || null,
    website: rawVenue.website || null,
    imageUrl: rawVenue.imageUrls?.[0] || null,
    coordinates: {
      lat: rawVenue.location?.lat || null,
      lng: rawVenue.location?.lng || null,
    },
    category: rawVenue.categoryName || 'General',
  };
}