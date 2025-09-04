'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Home, Building2, Trees, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import VenueCard from './VenueCard';
import VenueList from './VenueList';
import HomeVenue from './HomeVenue';

interface VenueOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: string;
}

const venueOptions: VenueOption[] = [
  {
    id: 'indoor',
    title: 'Indoor Venues',
    description: 'Community centers, party halls, indoor play spaces',
    icon: <Building2 className="w-8 h-8" />,
    category: 'indoor'
  },
  {
    id: 'outdoor',
    title: 'Outdoor Venues',
    description: 'Parks, gardens, outdoor spaces',
    icon: <Trees className="w-8 h-8" />,
    category: 'outdoor'
  },
  {
    id: 'specialty',
    title: 'Specialty Venues',
    description: 'Trampoline parks, bowling alleys, etc.',
    icon: <Star className="w-8 h-8" />,
    category: 'specialty'
  },
  {
    id: 'home',
    title: 'Home Venue',
    description: 'Host at your own place',
    icon: <Home className="w-8 h-8" />,
    category: 'home'
  }
];

export default function VenueSelection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [zipCode] = useState(searchParams.get('zip') || '48226'); // Default to Detroit

  const handleVenueSelect = (category: string) => {
    if (category === 'home') {
      setSelectedCategory('home');
    } else {
      setSelectedCategory(category);
    }
  };

  const handleBack = () => {
    if (selectedCategory) {
      setSelectedCategory(null);
    } else {
      router.back();
    }
  };

  const handleVenueChosen = (venueData: any) => {
    // Store venue selection and navigate back to party planning
    console.log('Venue selected:', venueData);
    router.push('/party-plan');
  };

  if (selectedCategory === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 py-4 sm:py-6 lg:py-8">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex items-center mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="mr-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Home Venue Setup
            </h1>
          </div>
          <HomeVenue onVenueChosen={handleVenueChosen} />
        </div>
      </div>
    );
  }

  if (selectedCategory && selectedCategory !== 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 py-4 sm:py-6 lg:py-8">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex items-center mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="mr-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {venueOptions.find(opt => opt.id === selectedCategory)?.title}
            </h1>
          </div>
          <VenueList 
            zipCode={zipCode} 
            category={selectedCategory}
            onVenueChosen={handleVenueChosen}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 py-4 sm:py-6 lg:py-8">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-8">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="mr-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Choose Your Venue
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Select the perfect location for your party
            </p>
          </div>
        </div>

        {/* Venue Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {venueOptions.map((option) => (
            <VenueCard
              key={option.id}
              title={option.title}
              description={option.description}
              icon={option.icon}
              onSelect={() => handleVenueSelect(option.category)}
            />
          ))}
        </div>

        {/* ZIP Code Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Searching venues near ZIP code: <span className="font-medium">{zipCode}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
