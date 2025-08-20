"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Star, 
  Phone, 
  ExternalLink,
  Crown,
  Building,
  AlertCircle
} from "lucide-react";
import { useSelectedVenue } from "@/hooks/useSelectedVenue";
import Link from "next/link";

interface SelectedVenueDisplayProps {
  showChangeButton?: boolean;
  className?: string;
}

export default function SelectedVenueDisplay({ 
  showChangeButton = true, 
  className = "" 
}: SelectedVenueDisplayProps) {
  const { selectedVenue, loading } = useSelectedVenue();

  const formatAddress = (address: string) => {
    const parts = address.split(',');
    if (parts.length >= 2) {
      const lastTwo = parts.slice(-2).join(',').trim();
      return lastTwo;
    }
    return address;
  };

  if (loading) {
    return (
      <Card className={`${className}`}>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            Loading venue selection...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!selectedVenue) {
    return (
      <Card className={`border-dashed border-2 border-gray-300 dark:border-gray-600 ${className}`}>
        <CardContent className="p-6">
          <div className="text-center">
            <Building className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No Venue Selected
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Choose your perfect party venue from our recommendations
            </p>
            {showChangeButton && (
              <Link href="/party-plan?tab=venues">
                <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                  <Building className="mr-2 h-4 w-4" />
                  Browse Venues
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-200 dark:border-yellow-700 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-yellow-600" />
            <CardTitle className="text-lg text-yellow-800 dark:text-yellow-200">
              🎉 Venue locked in: {selectedVenue.title}!
            </CardTitle>
          </div>
          {showChangeButton && (
            <Link href="/party-plan?tab=favorites">
              <Button
                variant="outline"
                size="sm"
                className="text-yellow-700 border-yellow-300 hover:bg-yellow-100"
              >
                Change Venue
              </Button>
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          {/* Venue Image */}
          {selectedVenue.imageUrl && (
            <div className="w-32 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800">
              <img 
                src={selectedVenue.imageUrl} 
                alt={selectedVenue.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&h=300&fit=crop&crop=center';
                }}
              />
            </div>
          )}
          
          {/* Venue Details */}
          <div className="flex-1">
            <h3 className="font-bold text-yellow-800 dark:text-yellow-200 mb-2 text-lg">
              📍 {selectedVenue.title}
            </h3>
            
            {/* Address */}
            <div className="flex items-start gap-2 mb-2">
              <MapPin className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
              <span className="text-sm text-yellow-700 dark:text-yellow-300">
                🗺 {formatAddress(selectedVenue.address)}
              </span>
            </div>

            {/* Rating */}
            {selectedVenue.rating && selectedVenue.reviewsCount && (
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold text-yellow-800 dark:text-yellow-200">
                    {selectedVenue.rating}
                  </span>
                </div>
                <span className="text-sm text-yellow-600 dark:text-yellow-400">
                  ({selectedVenue.reviewsCount} reviews)
                </span>
              </div>
            )}

            {/* Phone */}
            {selectedVenue.phone && (
              <div className="flex items-center gap-2 mb-2">
                <Phone className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-700 dark:text-yellow-300">
                  📞 {selectedVenue.phone}
                </span>
              </div>
            )}

            {/* Category */}
            {selectedVenue.category && (
              <div className="mb-2">
                <Badge className="bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200">
                  {selectedVenue.category}
                </Badge>
              </div>
            )}

            {/* Website Link */}
            {selectedVenue.website && (
              <div className="mt-3">
                <Button
                  onClick={() => window.open(selectedVenue.website, '_blank')}
                  variant="outline"
                  size="sm"
                  className="text-yellow-700 border-yellow-300 hover:bg-yellow-100"
                >
                  <ExternalLink className="mr-1 h-4 w-4" />
                  🌐 Visit Website
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}