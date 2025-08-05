import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface Venue {
  id: string;
  name: string;
  category: 'Outdoor' | 'Indoor' | 'Sports Arena';
  rating: number;
  reviews: number;
  priceRange: '$' | '$$' | '$$$' | '$$$$';
  address: string;
  phone: string;
  website?: string;
  email?: string;
  description: string;
  capacity: number;
  amenities: string[];
  distance?: number;
  popularity?: number;
  images: string[];
  isAIRecommended?: boolean;
}

// AI-powered venue recommendation logic
async function getAIRecommendedVenues(venues: Venue[], zipCode: string, guestCount: number): Promise<Venue[]> {
  try {
    // In a real implementation, this would call Azure OpenAI API
    // For now, we'll use rule-based AI recommendations
    
    const recommendations = venues.map(venue => {
      let score = venue.rating * 20; // Base score from rating
      
      // Capacity matching
      if (venue.capacity >= guestCount && venue.capacity <= guestCount * 1.5) {
        score += 15; // Perfect capacity match
      } else if (venue.capacity >= guestCount) {
        score += 10; // Can accommodate
      } else {
        score -= 20; // Too small
      }
      
      // Distance preference (closer is better)
      if (venue.distance && venue.distance <= 5) {
        score += 10;
      } else if (venue.distance && venue.distance <= 10) {
        score += 5;
      }
      
      // Review count (more reviews = more reliable)
      if (venue.reviews > 100) {
        score += 10;
      } else if (venue.reviews > 50) {
        score += 5;
      }
      
      // Family-friendly amenities for birthday parties
      const familyAmenities = ['Kitchen', 'Playground', 'Parking', 'Restrooms', 'Tables & Chairs'];
      const matchingAmenities = venue.amenities.filter(amenity => 
        familyAmenities.some(family => amenity.toLowerCase().includes(family.toLowerCase()))
      );
      score += matchingAmenities.length * 3;
      
      return {
        ...venue,
        popularity: Math.min(100, Math.max(0, score)),
        isAIRecommended: score > 85
      };
    });
    
    return recommendations.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  } catch (error) {
    console.error('Error in AI recommendations:', error);
    return venues.map(venue => ({ ...venue, popularity: venue.rating * 20 }));
  }
}

// Mock venue data generator based on zip code
function generateVenuesForZip(zipCode: string): Venue[] {
  const baseVenues: Omit<Venue, 'distance' | 'popularity'>[] = [
    {
      id: '1',
      name: 'Sunny Parks Community Center',
      category: 'Indoor',
      rating: 4.8,
      reviews: 156,
      priceRange: '$$',
      address: `123 Park Ave, ${zipCode}`,
      phone: '(555) 123-4567',
      website: 'https://sunnyparks.com',
      email: 'events@sunnyparks.com',
      description: 'Beautiful community center with large indoor spaces perfect for birthday parties. Features kitchen facilities, sound system, and party decorations.',
      capacity: 80,
      amenities: ['Kitchen', 'Sound System', 'Parking', 'AC/Heating', 'Tables & Chairs'],
      images: ['https://images.unsplash.com/photo-1511795409834-432f7b54b4b4?w=400']
    },
    {
      id: '2',
      name: 'Adventure Park Pavilion',
      category: 'Outdoor',
      rating: 4.6,
      reviews: 89,
      priceRange: '$',
      address: `456 Adventure Rd, ${zipCode}`,
      phone: '(555) 987-6543',
      description: 'Outdoor pavilion with playground, picnic tables, and beautiful nature views. Perfect for outdoor birthday celebrations.',
      capacity: 120,
      amenities: ['Playground', 'Picnic Tables', 'BBQ Grills', 'Restrooms', 'Parking'],
      images: ['https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400']
    },
    {
      id: '3',
      name: 'SportZone Arena',
      category: 'Sports Arena',
      rating: 4.4,
      reviews: 234,
      priceRange: '$$$',
      address: `789 Sports Complex Dr, ${zipCode}`,
      phone: '(555) 456-7890',
      website: 'https://sportzone.com',
      description: 'Indoor sports arena with basketball courts, party rooms, and arcade games. Great for active birthday parties.',
      capacity: 60,
      amenities: ['Basketball Court', 'Arcade', 'Party Room', 'Catering', 'Parking'],
      images: ['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400']
    },
    {
      id: '4',
      name: 'Lakeside Event Center',
      category: 'Outdoor',
      rating: 4.9,
      reviews: 78,
      priceRange: '$$$$',
      address: `321 Lakeside Dr, ${zipCode}`,
      phone: '(555) 321-9876',
      email: 'info@lakesidecenter.com',
      description: 'Premium lakeside venue with stunning water views, elegant facilities, and full-service catering options.',
      capacity: 150,
      amenities: ['Lake View', 'Full Catering', 'Dance Floor', 'Bar Service', 'Valet Parking'],
      images: ['https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=400']
    },
    {
      id: '5',
      name: 'Creative Arts Studio',
      category: 'Indoor',
      rating: 4.7,
      reviews: 92,
      priceRange: '$$',
      address: `654 Art Way, ${zipCode}`,
      phone: '(555) 654-3210',
      website: 'https://creativestudio.com',
      description: 'Art studio perfect for creative birthday parties. Includes art supplies, pottery wheels, and guided activities.',
      capacity: 25,
      amenities: ['Art Supplies', 'Pottery Wheels', 'Instructor', 'Aprons', 'Display Area'],
      images: ['https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400']
    },
    {
      id: '6',
      name: 'Garden Party Venue',
      category: 'Outdoor',
      rating: 4.5,
      reviews: 134,
      priceRange: '$$$',
      address: `987 Garden Lane, ${zipCode}`,
      phone: '(555) 987-1234',
      email: 'events@gardenparty.com',
      description: 'Beautiful botanical garden venue with covered pavilions and stunning flower displays perfect for memorable celebrations.',
      capacity: 100,
      amenities: ['Garden Views', 'Covered Pavilion', 'Photography Areas', 'Catering Kitchen', 'Parking'],
      images: ['https://images.unsplash.com/photo-1519167758481-83f29c1fe8cf?w=400']
    }
  ];

  // Add realistic distance calculations (mock)
  return baseVenues.map((venue, index) => ({
    ...venue,
    distance: Math.round((Math.random() * 15 + 1) * 10) / 10, // 0.1 to 15.0 miles
  }));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const zipCode = searchParams.get('zipCode') || '12345';
    const guestCount = parseInt(searchParams.get('guestCount') || '20');

    // Generate venues for the zip code
    const baseVenues = generateVenuesForZip(zipCode);
    
    // Apply AI recommendations
    const aiRecommendedVenues = await getAIRecommendedVenues(baseVenues, zipCode, guestCount);

    return NextResponse.json({
      success: true,
      venues: aiRecommendedVenues,
      zipCode,
      guestCount,
      totalFound: aiRecommendedVenues.length,
      aiRecommendedCount: aiRecommendedVenues.filter(v => v.isAIRecommended).length
    });
  } catch (error) {
    console.error('Error in venues API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch venue recommendations',
        venues: []
      },
      { status: 500 }
    );
  }
}