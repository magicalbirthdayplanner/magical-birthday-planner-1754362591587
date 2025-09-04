'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Star, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Venue {
  name: string;
  address: string;
  rating: number;
  photoUrl?: string;
  distance: string;
  placeId?: string;
}

interface VenueListProps {
  zipCode: string;
  category: string;
  onVenueChosen: (venue: Venue) => void;
}

export default function VenueList({ zipCode, category, onVenueChosen }: VenueListProps) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVenues = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/venues?zip=${zipCode}&category=${category}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch venues');
        }
        
        const data = await response.json();
        setVenues(data);
      } catch (err) {
        console.error('Error fetching venues:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch venues');
      } finally {
        setLoading(false);
      }
    };

    fetchVenues();
  }, [zipCode, category]);

  const handleVenueSelect = (venue: Venue) => {
    onVenueChosen(venue);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          Finding venues near you...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Unable to find venues
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
          {error}
        </p>
        <Button 
          onClick={() => window.location.reload()}
          variant="outline"
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (venues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <MapPin className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No venues found near you
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
          We couldn't find any {category} venues near ZIP code {zipCode}.
        </p>
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Consider hosting at home instead!
          </p>
          <Button 
            onClick={() => onVenueChosen({ 
              name: 'Home Venue', 
              address: 'Your Home', 
              rating: 5, 
              distance: '0 miles' 
            })}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            Choose Home Venue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <p className="text-gray-600 dark:text-gray-400">
          Found {venues.length} venue{venues.length !== 1 ? 's' : ''} near ZIP code {zipCode}
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {venues.map((venue, index) => (
          <Card 
            key={venue.placeId || index}
            className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 border-2 hover:border-purple-300 dark:hover:border-purple-600"
            onClick={() => handleVenueSelect(venue)}
          >
            <CardHeader className="pb-3">
              {venue.photoUrl && (
                <div className="w-full h-32 mb-3 rounded-lg overflow-hidden">
                  <img 
                    src={venue.photoUrl} 
                    alt={venue.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                  />
                </div>
              )}
              <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
                {venue.name}
              </CardTitle>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {venue.address}
                  </p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {venue.rating.toFixed(1)}
                    </span>
                  </div>
                  
                  <Badge variant="secondary" className="text-xs">
                    {venue.distance}
                  </Badge>
                </div>
                
                <Button 
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleVenueSelect(venue);
                  }}
                >
                  Choose This Venue
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
