"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  MapPin, 
  Star, 
  Phone, 
  ExternalLink,
  Trash2,
  Heart,
  PartyPopper,
  BookmarkX
} from "lucide-react";

interface Venue {
  id: string;
  title: string;
  address: string;
  rating: number;
  reviewsCount: number;
  price?: string;
  phone?: string;
  website?: string;
  imageUrl?: string;
  coordinates?: { lat: number; lng: number };
  category?: string;
  isFavorite?: boolean;
}

export default function FavoritesTab() {
  const [favoriteVenues, setFavoriteVenues] = useState<Venue[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Load favorites from localStorage
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        // Load favorite venue IDs
        const savedFavorites = localStorage.getItem('venueFavorites');
        const favoriteIds = savedFavorites ? JSON.parse(savedFavorites) : [];
        setFavorites(new Set(favoriteIds));

        // Load venue data from localStorage cache
        const cachedVenues = localStorage.getItem('cachedVenues');
        if (cachedVenues) {
          const allVenues: Venue[] = JSON.parse(cachedVenues);
          const favVenues = allVenues.filter(venue => favoriteIds.includes(venue.id));
          setFavoriteVenues(favVenues.map(venue => ({ ...venue, isFavorite: true })));
        }
      } catch (error) {
        console.error('Error loading favorites:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFavorites();
  }, []);

  // Listen for venue data updates from VenuesTab
  useEffect(() => {
    const handleStorageChange = () => {
      // Reload favorites when localStorage changes
      const savedFavorites = localStorage.getItem('venueFavorites');
      const favoriteIds = savedFavorites ? JSON.parse(savedFavorites) : [];
      setFavorites(new Set(favoriteIds));

      const cachedVenues = localStorage.getItem('cachedVenues');
      if (cachedVenues) {
        const allVenues: Venue[] = JSON.parse(cachedVenues);
        const favVenues = allVenues.filter(venue => favoriteIds.includes(venue.id));
        setFavoriteVenues(favVenues.map(venue => ({ ...venue, isFavorite: true })));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const removeFavorite = (venueId: string) => {
    // Remove from favorites set
    const newFavorites = new Set(favorites);
    newFavorites.delete(venueId);
    setFavorites(newFavorites);

    // Update localStorage
    localStorage.setItem('venueFavorites', JSON.stringify(Array.from(newFavorites)));

    // Remove from displayed venues
    setFavoriteVenues(prev => prev.filter(venue => venue.id !== venueId));

    // Trigger a custom event to notify other components
    window.dispatchEvent(new CustomEvent('favoriteRemoved', { 
      detail: { venueId } 
    }));
  };

  const formatAddress = (address: string) => {
    // Shorten address to show city + ZIP
    const parts = address.split(',');
    if (parts.length >= 2) {
      const lastTwo = parts.slice(-2).join(',').trim();
      return lastTwo;
    }
    return address;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            ⭐ Your Favorite Venues
          </h2>
          <p className="text-gray-600 dark:text-gray-400">Loading your saved venues...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          ⭐ Your Favorite Venues
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Your saved venues for easy access and comparison
        </p>
      </div>

      {/* Stats */}
      {favoriteVenues.length > 0 && (
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-700">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Heart className="h-5 w-5 text-red-500 fill-red-500" />
                <span className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {favoriteVenues.length}
                </span>
              </div>
              <p className="text-sm text-purple-600 dark:text-purple-400">
                Saved venue{favoriteVenues.length !== 1 ? 's' : ''} for your party
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {favoriteVenues.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <PartyPopper className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              💝 No favorites yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Start exploring venues and save your favorites for easy comparison!
            </p>
            <Alert className="max-w-md mx-auto">
              <Heart className="h-4 w-4" />
              <AlertDescription>
                <strong>💡 Tip:</strong> Go to the Venues tab and click the "⭐ Save" button on venues you like to add them here.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Favorites Grid */}
      {favoriteVenues.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {favoriteVenues.map((venue) => (
            <Card key={venue.id} className="group hover:shadow-lg transition-all duration-200 border-2 border-purple-200 dark:border-purple-700 bg-gradient-to-br from-white to-purple-50/30 dark:from-gray-900 dark:to-purple-900/10">
              <CardHeader className="pb-3">
                {/* Favorite Badge */}
                <div className="absolute top-4 right-4 z-10">
                  <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                    <Heart className="h-3 w-3 mr-1 fill-white" />
                    Favorite
                  </Badge>
                </div>

                {/* Venue Image */}
                {venue.imageUrl && (
                  <div className="w-full h-48 mb-3 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                    <img 
                      src={venue.imageUrl} 
                      alt={venue.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&h=300&fit=crop&crop=center';
                      }}
                    />
                  </div>
                )}

                {/* Venue Title */}
                <CardTitle className="text-lg font-bold text-gray-900 dark:text-gray-100 line-clamp-2">
                  📍 {venue.title}
                </CardTitle>

                {/* Rating */}
                {venue.rating && venue.reviewsCount && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold">{venue.rating}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      ({venue.reviewsCount} reviews)
                    </span>
                  </div>
                )}
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Address */}
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    🗺 {formatAddress(venue.address)}
                  </span>
                </div>

                {/* Phone */}
                {venue.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      📞 {venue.phone}
                    </span>
                  </div>
                )}

                {/* Category */}
                {venue.category && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                    {venue.category}
                  </Badge>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  {/* Remove from Favorites */}
                  <Button
                    onClick={() => removeFavorite(venue.id)}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                  >
                    <BookmarkX className="mr-1 h-4 w-4" />
                    Remove
                  </Button>

                  {/* Website Button */}
                  {venue.website && (
                    <Button
                      onClick={() => window.open(venue.website, '_blank')}
                      variant="outline"
                      size="sm"
                      className="hover:bg-blue-50 dark:hover:bg-blue-900"
                    >
                      <ExternalLink className="mr-1 h-4 w-4" />
                      🌐 Website
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Help Text */}
      {favoriteVenues.length > 0 && (
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700">
          <CardContent className="pt-6">
            <div className="text-center text-sm text-blue-700 dark:text-blue-300">
              💡 <strong>Pro Tip:</strong> Compare your favorite venues side by side to make the best choice for your party!
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}