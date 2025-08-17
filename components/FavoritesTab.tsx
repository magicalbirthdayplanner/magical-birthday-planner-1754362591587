"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Heart, 
  Star, 
  Loader2,
  Trash2,
  ArrowLeft,
  AlertCircle,
  Lightbulb
} from 'lucide-react';

interface PartyIdea {
  id: string;
  title: string;
  description: string;
  category: 'CAKES_DESSERTS' | 'DECORATIONS' | 'ACTIVITIES_GAMES' | 'PARTY_FAVORS' | 'ENTERTAINMENT';
  emoji?: string;
  liked: boolean;
  disliked: boolean;
  favorited: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FavoritesTabProps {
  partyId: string;
  partyData?: {
    childName: string;
    childAge: string;
    theme: string;
  };
  onBackToIdeas?: () => void;
}

const categoryLabels = {
  CAKES_DESSERTS: { label: 'Cakes & Desserts', emoji: '🎂', color: 'bg-pink-100 text-pink-800' },
  DECORATIONS: { label: 'Decorations', emoji: '🎈', color: 'bg-purple-100 text-purple-800' },
  ACTIVITIES_GAMES: { label: 'Activities & Games', emoji: '🎭', color: 'bg-blue-100 text-blue-800' },
  PARTY_FAVORS: { label: 'Party Favors', emoji: '🎁', color: 'bg-green-100 text-green-800' },
  ENTERTAINMENT: { label: 'Entertainment', emoji: '🎶', color: 'bg-yellow-100 text-yellow-800' }
};

export default function FavoritesTab({ partyId, partyData, onBackToIdeas }: FavoritesTabProps) {
  const [favorites, setFavorites] = useState<PartyIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingFavorite, setRemovingFavorite] = useState<string | null>(null);

  // Load favorites
  useEffect(() => {
    if (partyId) {
      loadFavorites();
    }
  }, [partyId]);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/ideas?partyId=${partyId}&favorited=true&limit=100`);
      
      if (!response.ok) {
        throw new Error('Failed to load favorites');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setFavorites(data.ideas);
      } else {
        throw new Error(data.error || 'Failed to load favorites');
      }
    } catch (err) {
      console.error('Error loading favorites:', err);
      setError(err instanceof Error ? err.message : 'Failed to load favorites');
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (ideaId: string) => {
    try {
      setRemovingFavorite(ideaId);
      
      const response = await fetch(`/api/ideas/${ideaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorited: false })
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove favorite');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setFavorites(prev => prev.filter(idea => idea.id !== ideaId));
      }
    } catch (err) {
      console.error('Error removing favorite:', err);
      setError('Failed to remove favorite');
    } finally {
      setRemovingFavorite(null);
    }
  };

  const groupFavoritesByCategory = () => {
    const grouped: Record<string, PartyIdea[]> = {};
    
    favorites.forEach(idea => {
      if (!grouped[idea.category]) {
        grouped[idea.category] = [];
      }
      grouped[idea.category].push(idea);
    });
    
    return grouped;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading favorites...</span>
        </div>
      </div>
    );
  }

  const groupedFavorites = groupFavoritesByCategory();
  const categoryKeys = Object.keys(groupedFavorites);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Heart className="h-6 w-6 text-red-500 fill-current" />
          <h2 className="text-2xl font-bold">
            Favorite Ideas for {partyData?.childName}'s Party
          </h2>
        </div>
        
        {onBackToIdeas && (
          <Button 
            onClick={onBackToIdeas} 
            variant="outline"
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to All Ideas</span>
          </Button>
        )}
      </div>

      {/* Summary */}
      <Alert>
        <Star className="h-4 w-4" />
        <AlertDescription>
          You have <strong>{favorites.length}</strong> favorite idea{favorites.length !== 1 ? 's' : ''} 
          saved for your {partyData?.theme} party.
        </AlertDescription>
      </Alert>

      {/* Error message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Favorites by category */}
      {categoryKeys.length > 0 ? (
        <div className="space-y-8">
          {categoryKeys.map(categoryKey => {
            const categoryInfo = categoryLabels[categoryKey as keyof typeof categoryLabels];
            const categoryIdeas = groupedFavorites[categoryKey];
            
            return (
              <div key={categoryKey} className="space-y-4">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">{categoryInfo.emoji}</span>
                  <h3 className="text-xl font-semibold">{categoryInfo.label}</h3>
                  <Badge variant="secondary">
                    {categoryIdeas.length} idea{categoryIdeas.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryIdeas.map((idea) => {
                    const isRemoving = removingFavorite === idea.id;
                    
                    return (
                      <Card key={idea.id} className="hover:shadow-md transition-shadow duration-200">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-xl">{idea.emoji || categoryInfo.emoji}</span>
                              <Badge className={categoryInfo.color} variant="secondary">
                                Favorite
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFavorite(idea.id)}
                              disabled={isRemoving}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              {isRemoving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <CardTitle className="text-lg">{idea.title}</CardTitle>
                        </CardHeader>
                        
                        <CardContent>
                          <CardDescription className="text-sm leading-relaxed">
                            {idea.description}
                          </CardDescription>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty state */
        <div className="text-center py-12">
          <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No favorites yet!</h3>
          <p className="text-gray-500 mb-4">
            Start exploring ideas and click the star icon to save your favorites.
          </p>
          {onBackToIdeas && (
            <Button onClick={onBackToIdeas} variant="outline">
              <Lightbulb className="h-4 w-4 mr-2" />
              Browse Ideas
            </Button>
          )}
        </div>
      )}
    </div>
  );
}