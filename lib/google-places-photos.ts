// Google Places Photos API integration
const GOOGLE_PLACES_API_KEY = 'AIzaSyDWCLa9aKpRHX5y7LTc9rvQXTzJefjaCZw';

export function getGooglePlacePhotoUrl(
  photoReference: string, 
  maxWidth: number = 400,
  maxHeight: number = 300
): string {
  return `https://maps.googleapis.com/maps/api/place/photo?` +
    `maxwidth=${maxWidth}&` +
    `maxheight=${maxHeight}&` +
    `photoreference=${photoReference}&` +
    `key=${GOOGLE_PLACES_API_KEY}`;
}

export function getGooglePlacePhotosUrls(
  photoReferences: string[],
  maxWidth: number = 400,
  maxHeight: number = 300
): string[] {
  return photoReferences.map(ref => getGooglePlacePhotoUrl(ref, maxWidth, maxHeight));
}

// Get photo URL with error handling
export function getVenuePhotoUrl(
  venue: { photos?: string[]; name: string },
  maxWidth: number = 400,
  maxHeight: number = 300
): string | null {
  if (!venue.photos || venue.photos.length === 0) {
    return null;
  }
  
  try {
    return getGooglePlacePhotoUrl(venue.photos[0], maxWidth, maxHeight);
  } catch (error) {
    console.error('Error getting venue photo URL:', error);
    return null;
  }
}

// Generate placeholder image URL based on venue name and category
export function getVenuePlaceholderUrl(venueName: string, category: string): string {
  // Generate a simple placeholder based on venue type
  const placeholderImages = {
    indoor: 'https://images.unsplash.com/photo-1545431781-3e1b506e6e96?w=400&h=300&fit=crop',
    outdoor: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop', 
    specialty: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop',
    community: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop'
  };
  
  return placeholderImages[category as keyof typeof placeholderImages] || placeholderImages.indoor;
}