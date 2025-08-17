"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Lightbulb, 
  ThumbsUp, 
  ThumbsDown, 
  Star, 
  RefreshCw, 
  Loader2,
  Sparkles,
  Heart,
  AlertCircle
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

interface IdeasTabProps {
  partyId: string;
  partyData?: {
    childName: string;
    childAge: string;
    theme: string;
    interests?: string[];
    favoriteColors?: string[];
    guestCount?: number;
    venue?: string;
  };
}

const categoryLabels = {
  CAKES_DESSERTS: { label: 'Cakes & Desserts', emoji: '🎂', color: 'bg-pink-100 text-pink-800' },
  DECORATIONS: { label: 'Decorations', emoji: '🎈', color: 'bg-purple-100 text-purple-800' },
  ACTIVITIES_GAMES: { label: 'Activities & Games', emoji: '🎭', color: 'bg-blue-100 text-blue-800' },
  PARTY_FAVORS: { label: 'Party Favors', emoji: '🎁', color: 'bg-green-100 text-green-800' },
  ENTERTAINMENT: { label: 'Entertainment', emoji: '🎶', color: 'bg-yellow-100 text-yellow-800' }
};

export default function IdeasTab({ partyId, partyData }: IdeasTabProps) {
  const [ideas, setIdeas] = useState<PartyIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [interactionLoading, setInteractionLoading] = useState<string | null>(null);

  // Load initial ideas
  useEffect(() => {
    if (partyId) {
      loadIdeas(true);
    }
  }, [partyId]);

  const loadIdeas = async (reset = false) => {
    try {
      setLoading(reset);
      setError(null);
      
      const currentOffset = reset ? 0 : offset;
      const response = await fetch(`/api/ideas?partyId=${partyId}&limit=12&offset=${currentOffset}`);
      
      if (!response.ok) {
        throw new Error('Failed to load ideas');
      }
      
      const data = await response.json();
      
      if (data.success) {
        if (reset) {
          setIdeas(data.ideas);
        } else {
          setIdeas(prev => [...prev, ...data.ideas]);
        }
        setHasMore(data.pagination.hasMore);
        setOffset(currentOffset + data.ideas.length);
      } else {
        throw new Error(data.error || 'Failed to load ideas');
      }
    } catch (err) {
      console.error('Error loading ideas:', err);
      setError(err instanceof Error ? err.message : 'Failed to load ideas');
    } finally {
      setLoading(false);
    }
  };

  const generateMoreIdeas = async () => {
    try {
      setGenerating(true);
      setError(null);
      
      const response = await fetch('/api/ideas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partyId, count: 12 })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate ideas');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setIdeas(prev => [...data.ideas, ...prev]); // Add new ideas at the top
        setHasMore(true);
      } else {
        throw new Error(data.error || 'Failed to generate ideas');
      }
    } catch (err) {
      console.error('Error generating ideas:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate ideas');
    } finally {
      setGenerating(false);
    }
  };

  const updateIdeaInteraction = async (ideaId: string, updates: { liked?: boolean; disliked?: boolean; favorited?: boolean }) => {
    try {
      setInteractionLoading(ideaId);
      
      const response = await fetch(`/api/ideas/${ideaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update idea');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setIdeas(prev => prev.map(idea => 
          idea.id === ideaId ? { ...idea, ...updates } : idea
        ));
      }
    } catch (err) {
      console.error('Error updating idea:', err);
      setError('Failed to update idea interaction');
    } finally {
      setInteractionLoading(null);
    }
  };

  const handleLike = useCallback((ideaId: string, currentLiked: boolean) => {
    updateIdeaInteraction(ideaId, { 
      liked: !currentLiked,
      disliked: false // Clear dislike if liking
    });
  }, []);

  const handleDislike = useCallback((ideaId: string, currentDisliked: boolean) => {
    updateIdeaInteraction(ideaId, { 
      disliked: !currentDisliked,
      liked: false // Clear like if disliking
    });
  }, []);

  const handleFavorite = useCallback((ideaId: string, currentFavorited: boolean) => {
    updateIdeaInteraction(ideaId, { favorited: !currentFavorited });
  }, []);

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (loading || generating || !hasMore) return;
    
    const scrolledToBottom = window.innerHeight + window.scrollY >= document.documentElement.offsetHeight - 1000;
    
    if (scrolledToBottom) {
      loadIdeas(false);
    }
  }, [loading, generating, hasMore]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Auto-generate ideas if none exist
  useEffect(() => {
    if (ideas.length === 0 && !loading && !generating && partyId) {
      generateMoreIdeas();
    }
  }, [ideas.length, loading, generating, partyId]);

  if (loading && ideas.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading magical ideas...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Lightbulb className="h-6 w-6 text-yellow-500" />
          <h2 className="text-2xl font-bold">
            ✨ Ideas for {partyData?.childName}'s Party
          </h2>
        </div>
        
        <Button 
          onClick={generateMoreIdeas} 
          disabled={generating}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate More Ideas
            </>
          )}
        </Button>
      </div>

      {/* Theme context */}
      {partyData && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Generating personalized ideas for <strong>{partyData.childName}</strong> (age {partyData.childAge}) 
            with a <strong>{partyData.theme}</strong> theme
            {partyData.favoriteColors && partyData.favoriteColors.length > 0 && (
              <> in {partyData.favoriteColors.join(' and ')} colors</>
            )}
            {partyData.guestCount && <> for {partyData.guestCount} guests</>}.
          </AlertDescription>
        </Alert>
      )}

      {/* Error message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Ideas grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ideas.map((idea) => {
          const categoryInfo = categoryLabels[idea.category];
          const isInteracting = interactionLoading === idea.id;
          
          return (
            <Card key={idea.id} className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{idea.emoji || categoryInfo.emoji}</span>
                    <Badge className={categoryInfo.color}>
                      {categoryInfo.label}
                    </Badge>
                  </div>
                  {idea.favorited && (
                    <Heart className="h-5 w-5 text-red-500 fill-current" />
                  )}
                </div>
                <CardTitle className="text-lg">{idea.title}</CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <CardDescription className="text-sm leading-relaxed">
                  {idea.description}
                </CardDescription>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant={idea.liked ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleLike(idea.id, idea.liked)}
                      disabled={isInteracting}
                      className={idea.liked ? "bg-green-500 hover:bg-green-600" : ""}
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant={idea.disliked ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleDislike(idea.id, idea.disliked)}
                      disabled={isInteracting}
                      className={idea.disliked ? "bg-red-500 hover:bg-red-600" : ""}
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <Button
                    variant={idea.favorited ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleFavorite(idea.id, idea.favorited)}
                    disabled={isInteracting}
                    className={idea.favorited ? "bg-yellow-500 hover:bg-yellow-600" : ""}
                  >
                    <Star className={`h-4 w-4 ${idea.favorited ? 'fill-current' : ''}`} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Loading more indicator */}
      {loading && ideas.length > 0 && (
        <div className="flex items-center justify-center py-6">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading more ideas...</span>
          </div>
        </div>
      )}

      {/* No more ideas message */}
      {!hasMore && ideas.length > 0 && (
        <div className="text-center py-6 text-gray-500">
          <p>That's all the ideas we have for now!</p>
          <Button 
            onClick={generateMoreIdeas} 
            disabled={generating}
            variant="outline"
            className="mt-2"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Generate More
          </Button>
        </div>
      )}

      {/* Empty state */}
      {ideas.length === 0 && !loading && !generating && (
        <div className="text-center py-12">
          <Lightbulb className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No ideas yet!</h3>
          <p className="text-gray-500 mb-4">
            Click "Generate More Ideas" to get personalized suggestions for your party.
          </p>
          <Button onClick={generateMoreIdeas} disabled={generating}>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Ideas
          </Button>
        </div>
      )}
    </div>
  );
}