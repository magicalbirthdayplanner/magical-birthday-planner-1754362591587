'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Home, Users, Sparkles, Utensils, Gift, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HomeVenueProps {
  onVenueChosen: (venueData: any) => void;
}

interface PartySize {
  id: string;
  label: string;
  description: string;
  guestRange: string;
  icon: React.ReactNode;
}

interface AddOn {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  price: string;
}

const partySizes: PartySize[] = [
  {
    id: 'small',
    label: 'Small Party',
    description: 'Intimate gathering',
    guestRange: '5-15 guests',
    icon: <Users className="w-5 h-5" />
  },
  {
    id: 'medium',
    label: 'Medium Party',
    description: 'Perfect for most celebrations',
    guestRange: '16-30 guests',
    icon: <Users className="w-6 h-6" />
  },
  {
    id: 'large',
    label: 'Large Party',
    description: 'Big celebration',
    guestRange: '31+ guests',
    icon: <Users className="w-7 h-7" />
  }
];

const addOns: AddOn[] = [
  {
    id: 'decorations',
    name: 'Party Decorations',
    description: 'Balloons, banners, table settings',
    icon: <Sparkles className="w-5 h-5" />,
    price: 'From $50'
  },
  {
    id: 'catering',
    name: 'Catering Service',
    description: 'Food and beverage service',
    icon: <Utensils className="w-5 h-5" />,
    price: 'From $15/person'
  },
  {
    id: 'rentals',
    name: 'Equipment Rentals',
    description: 'Tables, chairs, sound system',
    icon: <Gift className="w-5 h-5" />,
    price: 'From $100'
  },
  {
    id: 'photography',
    name: 'Photography',
    description: 'Professional party photos',
    icon: <Camera className="w-5 h-5" />,
    price: 'From $200'
  }
];

export default function HomeVenue({ onVenueChosen }: HomeVenueProps) {
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);

  const handleSizeSelect = (sizeId: string) => {
    setSelectedSize(sizeId);
  };

  const handleAddOnToggle = (addOnId: string) => {
    setSelectedAddOns(prev => 
      prev.includes(addOnId) 
        ? prev.filter(id => id !== addOnId)
        : [...prev, addOnId]
    );
  };

  const handleContinue = () => {
    const venueData = {
      name: 'Home Venue',
      address: 'Your Home',
      rating: 5,
      distance: '0 miles',
      type: 'home',
      partySize: selectedSize,
      addOns: selectedAddOns,
      selectedAddOnDetails: addOns.filter(addOn => selectedAddOns.includes(addOn.id))
    };
    
    onVenueChosen(venueData);
  };

  const isContinueDisabled = !selectedSize;

  return (
    <div className="space-y-8">
      {/* Home Venue Header */}
      <Card className="border-2 border-purple-200 dark:border-purple-800">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900">
            <Home className="w-12 h-12 text-purple-600 dark:text-purple-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
            Host at Home
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Create magical memories in the comfort of your own space
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Party Size Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
            What's your party size?
          </CardTitle>
          <CardDescription>
            Choose the size that best fits your celebration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {partySizes.map((size) => (
              <Card
                key={size.id}
                className={cn(
                  "cursor-pointer transition-all duration-200 hover:shadow-md border-2",
                  selectedSize === size.id
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600"
                )}
                onClick={() => handleSizeSelect(size.id)}
              >
                <CardContent className="p-4 text-center">
                  <div className="mx-auto mb-3 p-3 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-800 dark:to-pink-800">
                    <div className="text-purple-600 dark:text-purple-400">
                      {size.icon}
                    </div>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {size.label}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {size.description}
                  </p>
                  <Badge variant="secondary" className="text-xs">
                    {size.guestRange}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add-ons Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
            Suggested Add-ons
          </CardTitle>
          <CardDescription>
            Enhance your home party with these optional services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {addOns.map((addOn) => (
              <div
                key={addOn.id}
                className={cn(
                  "flex items-center space-x-4 p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer",
                  selectedAddOns.includes(addOn.id)
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600"
                )}
                onClick={() => handleAddOnToggle(addOn.id)}
              >
                <Checkbox
                  checked={selectedAddOns.includes(addOn.id)}
                  onChange={() => handleAddOnToggle(addOn.id)}
                  className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                />
                
                <div className="flex items-center space-x-3 flex-1">
                  <div className="p-2 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-800 dark:to-pink-800">
                    <div className="text-purple-600 dark:text-purple-400">
                      {addOn.icon}
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {addOn.name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {addOn.description}
                    </p>
                  </div>
                  
                  <Badge variant="outline" className="text-xs">
                    {addOn.price}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Continue Button */}
      <div className="text-center">
        <Button
          onClick={handleContinue}
          disabled={isContinueDisabled}
          className={cn(
            "px-8 py-3 text-lg font-medium",
            isContinueDisabled
              ? "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
              : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          )}
        >
          Continue with Home Venue
        </Button>
        
        {isContinueDisabled && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Please select a party size to continue
          </p>
        )}
      </div>
    </div>
  );
}
