"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Plus, 
  Star, 
  CheckCircle2, 
  Sparkles,
  ArrowLeft,
  Loader2,
  AlertTriangle
} from "lucide-react";
import ActivityCard from "@/components/ActivityCard";
import Filters from "@/components/Filters";
import { cn } from "@/lib/utils";

interface Activity {
  id: string;
  name: string;
  description: string;
  estimatedTime: number;
  timeUnit: string;
  category: string;
  venue: 'indoor' | 'outdoor' | 'both';
  suppliesNeeded?: string[];
  participantRange?: string;
  minParticipants?: number;
  maxParticipants?: number;
  effortLevel?: string;
  ageGroup?: string[];
  themeCompatibility?: string[];
  tags?: string[];
}

interface PersonalizedTip {
  [activityId: string]: string;
}

export default function ActivitiesPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  // State
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(new Set());
  const [personalizedTips, setPersonalizedTips] = useState<PersonalizedTip>({});
  const [loadingPersonalization, setLoadingPersonalization] = useState<Set<string>>(new Set());
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [materialsFilter, setMaterialsFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 50;

  // Party data for personalization (you can get this from context or props)
  const partyData = useMemo(() => ({
    childName: "Alex", // This should come from your party context
    childAge: 7,
    theme: "Superhero",
    interests: ["comics", "action", "saving the world"],
    favoriteColors: ["red", "blue"],
    venue: "indoor",
    guestCount: 12
  }), []);

  // Fetch activities
  const fetchActivities = useCallback(async (pageNum: number = 1) => {
    try {
      setLoading(pageNum === 1);
      setLoadingMore(pageNum > 1);
      
      const response = await fetch(`/api/activities?page=${pageNum}&limit=${ITEMS_PER_PAGE}`);
      if (!response.ok) throw new Error('Failed to fetch activities');
      
      const data = await response.json();
      const newActivities = data.activities || [];
      
      if (pageNum === 1) {
        setActivities(newActivities);
      } else {
        setActivities(prev => [...prev, ...newActivities]);
      }
      
      setHasMore(newActivities.length === ITEMS_PER_PAGE);
      setPage(pageNum);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch activities');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Fetch user favorites and selected activities
  const fetchUserData = useCallback(async () => {
    if (!user) return;
    
    try {
      // Fetch favorites
      const favoritesResponse = await fetch('/api/favorites');
      if (favoritesResponse.ok) {
        const favoritesData = await favoritesResponse.json();
        setFavorites(new Set(favoritesData.favorites.map((f: any) => f.activityId)));
      }
      
      // Fetch selected activities (you might want to pass partyId here)
      const selectedResponse = await fetch('/api/selected-activities');
      if (selectedResponse.ok) {
        const selectedData = await selectedResponse.json();
        setSelectedActivities(new Set(selectedData.selectedActivities.map((s: any) => s.activityId)));
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    }
  }, [user]);

  // Load initial data
  useEffect(() => {
    fetchActivities(1);
    fetchUserData();
  }, [fetchActivities, fetchUserData]);

  // Apply filters
  useEffect(() => {
    let filtered = [...activities];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(activity =>
        activity.name.toLowerCase().includes(query) ||
        activity.description.toLowerCase().includes(query) ||
        activity.tags?.some(tag => tag.toLowerCase().includes(query)) ||
        activity.category.toLowerCase().includes(query)
      );
    }
    
    // Time filter
    if (timeFilter !== "all") {
      filtered = filtered.filter(activity => {
        const time = activity.estimatedTime;
        switch (timeFilter) {
          case "short":
            return time < 15;
          case "medium":
            return time >= 15 && time <= 30;
          case "long":
            return time > 30;
          default:
            return true;
        }
      });
    }
    
    // Materials filter
    if (materialsFilter !== "all") {
      filtered = filtered.filter(activity => {
        const supplies = activity.suppliesNeeded || [];
        switch (materialsFilter) {
          case "none":
            return supplies.length === 0;
          case "simple":
            return supplies.length <= 3;
          case "advanced":
            return supplies.length > 3;
          default:
            return true;
        }
      });
    }
    
    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(activity => activity.category === categoryFilter);
    }
    
    setFilteredActivities(filtered);
  }, [activities, searchQuery, timeFilter, materialsFilter, categoryFilter]);

  // Toggle favorite
  const handleToggleFavorite = async (activityId: string) => {
    if (!user) {
      router.push('/signin');
      return;
    }
    
    try {
      const isFavorite = favorites.has(activityId);
      const response = await fetch('/api/favorites', {
        method: isFavorite ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId })
      });
      
      if (response.ok) {
        setFavorites(prev => {
          const newSet = new Set(prev);
          if (isFavorite) {
            newSet.delete(activityId);
          } else {
            newSet.add(activityId);
          }
          return newSet;
        });
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  // Toggle selected activity
  const handleToggleSelected = async (activityId: string) => {
    if (!user) {
      router.push('/signin');
      return;
    }
    
    try {
      const isSelected = selectedActivities.has(activityId);
      const response = await fetch('/api/selected-activities', {
        method: isSelected ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          activityId,
          partyId: 'your-party-id' // You'll need to get this from context
        })
      });
      
      if (response.ok) {
        setSelectedActivities(prev => {
          const newSet = new Set(prev);
          if (isSelected) {
            newSet.delete(activityId);
          } else {
            newSet.add(activityId);
          }
          return newSet;
        });
      }
    } catch (err) {
      console.error('Failed to toggle selected activity:', err);
    }
  };

  // Generate personalized tip
  const generatePersonalizedTip = async (activityId: string) => {
    if (!user || personalizedTips[activityId]) return;
    
    try {
      setLoadingPersonalization(prev => new Set(prev).add(activityId));
      
      const response = await fetch('/api/activities/personalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId,
          partyData
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setPersonalizedTips(prev => ({
          ...prev,
          [activityId]: data.personalizedTip
        }));
      }
    } catch (err) {
      console.error('Failed to generate personalized tip:', err);
    } finally {
      setLoadingPersonalization(prev => {
        const newSet = new Set(prev);
        newSet.delete(activityId);
        return newSet;
      });
    }
  };

  // Load more activities
  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchActivities(page + 1);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setTimeFilter("all");
    setMaterialsFilter("all");
    setCategoryFilter("all");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-12 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-80" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                🎉 Birthday Activities
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Discover magical activities for your perfect party
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-sm">
              {selectedActivities.size} selected
            </Badge>
            <Badge variant="outline" className="text-sm">
              {favorites.size} favorites
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Find Your Perfect Activities
            </CardTitle>
            <CardDescription>
              Filter and search through our collection of birthday party activities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Filters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              timeFilter={timeFilter}
              onTimeFilterChange={setTimeFilter}
              materialsFilter={materialsFilter}
              onMaterialsFilterChange={setMaterialsFilter}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              onClearFilters={clearFilters}
              totalActivities={activities.length}
              filteredCount={filteredActivities.length}
            />
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Activities Grid */}
        {filteredActivities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                isFavorite={favorites.has(activity.id)}
                isSelected={selectedActivities.has(activity.id)}
                onToggleFavorite={handleToggleFavorite}
                onToggleSelected={handleToggleSelected}
                personalizedTip={personalizedTips[activity.id]}
                isLoadingPersonalization={loadingPersonalization.has(activity.id)}
                partyData={partyData}
              />
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <div className="text-gray-500 dark:text-gray-400">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No activities found</h3>
                <p className="mb-4">
                  Try adjusting your filters or search terms to find more activities.
                </p>
                <Button onClick={clearFilters} variant="outline">
                  Clear All Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Load More Button */}
        {hasMore && (
          <div className="text-center mt-8">
            <Button
              onClick={loadMore}
              disabled={loadingMore}
              variant="outline"
              size="lg"
              className="px-8"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Load More Activities
                </>
              )}
            </Button>
          </div>
        )}

        {/* Selected Activities Summary */}
        {selectedActivities.size > 0 && (
          <Card className="mt-8 border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
                <CheckCircle2 className="h-5 w-5" />
                Your Party Activities ({selectedActivities.size})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-green-700 dark:text-green-300 mb-4">
                Great choices! These activities will make your party magical.
              </p>
              <div className="flex gap-2">
                <Button variant="default" className="bg-green-600 hover:bg-green-700">
                  View Party Plan
                </Button>
                <Button variant="outline" className="border-green-300 text-green-700">
                  Export Activities
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
