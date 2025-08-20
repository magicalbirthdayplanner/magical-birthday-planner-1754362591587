import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface FoodVendor {
  id: string;
  name: string;
  cuisineType: string[];
  rating: number;
  reviews: number;
  priceRange: '$' | '$$' | '$$$' | '$$$$';
  address: string;
  phone: string;
  website?: string;
  email?: string;
  description: string;
  specialties: string[];
  dietaryOptions: string[];
  distance?: number;
  popularity?: number;
  images: string[];
  isAIRecommended?: boolean;
  deliveryAvailable?: boolean;
  cateringAvailable?: boolean;
  minOrder?: number;
}

// AI-powered food vendor recommendation logic
async function getAIRecommendedVendors(vendors: FoodVendor[], zipCode: string, guestCount: number): Promise<FoodVendor[]> {
  try {
    // In a real implementation, this would call Azure OpenAI API
    // For now, we'll use rule-based AI recommendations
    
    const recommendations = vendors.map(vendor => {
      let score = vendor.rating * 20; // Base score from rating
      
      // Guest count considerations
      if (guestCount > 0) {
        if (vendor.cateringAvailable) {
          score += 15; // Catering is ideal for parties
        }
        if (vendor.minOrder && vendor.minOrder <= guestCount * 15) {
          score += 10; // Reasonable minimum order
        }
      }
      
      // Distance preference (closer is better)
      if (vendor.distance && vendor.distance <= 3) {
        score += 15;
      } else if (vendor.distance && vendor.distance <= 7) {
        score += 10;
      } else if (vendor.distance && vendor.distance <= 15) {
        score += 5;
      }
      
      // Review count (more reviews = more reliable)
      if (vendor.reviews > 150) {
        score += 15;
      } else if (vendor.reviews > 75) {
        score += 10;
      } else if (vendor.reviews > 25) {
        score += 5;
      }
      
      // Kid-friendly cuisine types
      const kidFriendlyCuisines = ['Pizza', 'American', 'Burgers', 'Desserts', 'Bakery', 'Italian'];
      const hasKidFriendly = vendor.cuisineType.some(cuisine => 
        kidFriendlyCuisines.some(friendly => cuisine.toLowerCase().includes(friendly.toLowerCase()))
      );
      if (hasKidFriendly) {
        score += 12;
      }
      
      // Dietary accommodations (important for parties)
      const commonDietary = ['Vegetarian', 'Gluten Free', 'Nut Free'];
      const hasDietaryOptions = vendor.dietaryOptions.some(dietary => 
        commonDietary.includes(dietary)
      );
      if (hasDietaryOptions) {
        score += 8;
      }
      
      // Delivery and catering availability
      if (vendor.deliveryAvailable) {
        score += 8;
      }
      if (vendor.cateringAvailable) {
        score += 10;
      }
      
      // Kid-friendly specialties
      const kidFriendlySpecialties = ['pizza', 'burger', 'cake', 'cookies', 'fries', 'chicken', 'sandwich'];
      const hasKidSpecialties = vendor.specialties.some(specialty => 
        kidFriendlySpecialties.some(friendly => specialty.toLowerCase().includes(friendly))
      );
      if (hasKidSpecialties) {
        score += 10;
      }
      
      return {
        ...vendor,
        popularity: Math.min(100, Math.max(0, score)),
        isAIRecommended: score > 85
      };
    });
    
    return recommendations.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  } catch (error) {
    console.error('Error in AI food recommendations:', error);
    return vendors.map(vendor => ({ ...vendor, popularity: vendor.rating * 20 }));
  }
}

// Mock food vendor data generator based on zip code
function generateVendorsForZip(zipCode: string): FoodVendor[] {
  const baseVendors: Omit<FoodVendor, 'distance' | 'popularity'>[] = [
    {
      id: '1',
      name: 'Mario\'s Pizza Palace',
      cuisineType: ['Italian', 'Pizza'],
      rating: 4.8,
      reviews: 203,
      priceRange: '$$',
      address: `123 Main St, ${zipCode}`,
      phone: '(555) 123-4567',
      website: 'https://mariospizza.com',
      email: 'catering@mariospizza.com',
      description: 'Authentic Italian pizza with fresh ingredients. Perfect for birthday parties with kid-friendly options and custom party platters.',
      specialties: ['Margherita Pizza', 'Pepperoni', 'Custom Party Platters', 'Garlic Bread'],
      dietaryOptions: ['Vegetarian', 'Gluten Free', 'Vegan'],
      images: ['https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400'],
      deliveryAvailable: true,
      cateringAvailable: true,
      minOrder: 50
    },
    {
      id: '2',
      name: 'Spice Garden Indian Cuisine',
      cuisineType: ['Indian'],
      rating: 4.7,
      reviews: 156,
      priceRange: '$$',
      address: `456 Spice Ave, ${zipCode}`,
      phone: '(555) 987-6543',
      website: 'https://spicegarden.com',
      description: 'Authentic Indian cuisine with mild options perfect for children. Specializes in party catering with customizable spice levels.',
      specialties: ['Butter Chicken', 'Biryani', 'Samosas', 'Naan Bread', 'Mango Lassi'],
      dietaryOptions: ['Vegetarian', 'Vegan', 'Gluten Free', 'Dairy Free'],
      images: ['https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400'],
      deliveryAvailable: true,
      cateringAvailable: true,
      minOrder: 75
    },
    {
      id: '3',
      name: 'Burger Haven',
      cuisineType: ['American', 'Burgers'],
      rating: 4.5,
      reviews: 189,
      priceRange: '$',
      address: `789 Burger Blvd, ${zipCode}`,
      phone: '(555) 456-7890',
      description: 'Classic American burgers and fries. Kid-friendly menu with mini burgers and fun sides perfect for birthday celebrations.',
      specialties: ['Classic Cheeseburger', 'Mini Sliders', 'Sweet Potato Fries', 'Milkshakes'],
      dietaryOptions: ['Vegetarian', 'Gluten Free'],
      images: ['https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400'],
      deliveryAvailable: true,
      cateringAvailable: true,
      minOrder: 40
    },
    {
      id: '4',
      name: 'Golden Dragon Chinese',
      cuisineType: ['Chinese'],
      rating: 4.6,
      reviews: 167,
      priceRange: '$$',
      address: `321 Dragon Way, ${zipCode}`,
      phone: '(555) 321-9876',
      email: 'orders@goldendragon.com',
      description: 'Traditional Chinese cuisine with party-friendly options. Offers family-style platters perfect for sharing at celebrations.',
      specialties: ['Sweet & Sour Chicken', 'Fried Rice', 'Dumplings', 'Lo Mein', 'Fortune Cookies'],
      dietaryOptions: ['Vegetarian', 'Gluten Free'],
      images: ['https://images.unsplash.com/photo-1576704020880-b54e46bb6cbb?w=400'],
      deliveryAvailable: true,
      cateringAvailable: true,
      minOrder: 60
    },
    {
      id: '5',
      name: 'Sweet Dreams Bakery',
      cuisineType: ['Desserts', 'Bakery'],
      rating: 4.9,
      reviews: 134,
      priceRange: '$$$',
      address: `555 Sweet St, ${zipCode}`,
      phone: '(555) 555-0123',
      website: 'https://sweetdreamsbakery.com',
      email: 'orders@sweetdreams.com',
      description: 'Custom birthday cakes and dessert platters. Specializes in themed cakes and allergy-friendly options for children\'s parties.',
      specialties: ['Custom Birthday Cakes', 'Cupcakes', 'Cookies', 'Cake Pops', 'Themed Desserts'],
      dietaryOptions: ['Vegetarian', 'Vegan', 'Gluten Free', 'Nut Free', 'Dairy Free'],
      images: ['https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400'],
      deliveryAvailable: true,
      cateringAvailable: true,
      minOrder: 30
    },
    {
      id: '6',
      name: 'Taco Fiesta',
      cuisineType: ['Mexican'],
      rating: 4.4,
      reviews: 178,
      priceRange: '$',
      address: `444 Fiesta Dr, ${zipCode}`,
      phone: '(555) 444-5678',
      description: 'Fresh Mexican food with mild options for kids. Taco bar catering perfect for interactive party dining.',
      specialties: ['Taco Bar', 'Quesadillas', 'Nachos', 'Mild Salsa', 'Guacamole'],
      dietaryOptions: ['Vegetarian', 'Vegan', 'Gluten Free'],
      images: ['https://images.unsplash.com/photo-1565299585323-38174c1c5b2d?w=400'],
      deliveryAvailable: true,
      cateringAvailable: true,
      minOrder: 45
    },
    {
      id: '7',
      name: 'Sushi Zen',
      cuisineType: ['Japanese'],
      rating: 4.3,
      reviews: 95,
      priceRange: '$$',
      address: `666 Zen Way, ${zipCode}`,
      phone: '(555) 666-7890',
      website: 'https://sushizen.com',
      description: 'Fresh sushi and Japanese cuisine with kid-friendly options like chicken teriyaki and California rolls.',
      specialties: ['California Rolls', 'Chicken Teriyaki', 'Edamame', 'Miso Soup', 'Tempura'],
      dietaryOptions: ['Vegetarian', 'Gluten Free'],
      images: ['https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=400'],
      deliveryAvailable: true,
      cateringAvailable: true,
      minOrder: 70
    },
    {
      id: '8',
      name: 'Mediterranean Delight',
      cuisineType: ['Mediterranean', 'Greek'],
      rating: 4.6,
      reviews: 142,
      priceRange: '$$',
      address: `777 Olive St, ${zipCode}`,
      phone: '(555) 777-8901',
      email: 'catering@meddelight.com',
      description: 'Healthy Mediterranean cuisine with family platters. Offers grilled options and fresh salads perfect for health-conscious parties.',
      specialties: ['Grilled Chicken', 'Hummus Platters', 'Pita Bread', 'Greek Salad', 'Baklava'],
      dietaryOptions: ['Vegetarian', 'Vegan', 'Gluten Free', 'Dairy Free'],
      images: ['https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400'],
      deliveryAvailable: true,
      cateringAvailable: true,
      minOrder: 55
    }
  ];

  // Add realistic distance calculations (mock)
  return baseVendors.map((vendor, index) => ({
    ...vendor,
    distance: Math.round((Math.random() * 12 + 0.5) * 10) / 10, // 0.5 to 12.5 miles
  }));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const zipCode = searchParams.get('zipCode') || '12345';
    const guestCount = parseInt(searchParams.get('guestCount') || '20');
    const cuisineFilter = searchParams.get('cuisine');
    const dietaryFilter = searchParams.get('dietary');

    // Generate vendors for the zip code
    let baseVendors = generateVendorsForZip(zipCode);
    
    // Apply filters if provided
    if (cuisineFilter) {
      const cuisines = cuisineFilter.split(',');
      baseVendors = baseVendors.filter(vendor => 
        cuisines.some(cuisine => vendor.cuisineType.includes(cuisine))
      );
    }
    
    if (dietaryFilter) {
      const dietaryOptions = dietaryFilter.split(',');
      baseVendors = baseVendors.filter(vendor => 
        dietaryOptions.some(dietary => vendor.dietaryOptions.includes(dietary))
      );
    }
    
    // Apply AI recommendations
    const aiRecommendedVendors = await getAIRecommendedVendors(baseVendors, zipCode, guestCount);

    return NextResponse.json({
      success: true,
      vendors: aiRecommendedVendors,
      zipCode,
      guestCount,
      totalFound: aiRecommendedVendors.length,
      aiRecommendedCount: aiRecommendedVendors.filter(v => v.isAIRecommended).length,
      appliedFilters: {
        cuisine: cuisineFilter || null,
        dietary: dietaryFilter || null
      }
    });
  } catch (error) {
    console.error('Error in food vendors API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch food vendor recommendations',
        vendors: []
      },
      { status: 500 }
    );
  }
}