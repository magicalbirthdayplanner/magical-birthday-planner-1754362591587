"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Clock,
  CheckCircle2,
  Sparkles,
  Filter,
  X,
  Tag,
  MapPin,
  Users,
  Plus,
  Lightbulb
} from "lucide-react";

interface Activity {
  id: string;
  name: string;
  description?: string;
  estimatedTime?: number;
  timeUnit: string;
  category: string;
  venue: 'indoor' | 'outdoor' | 'both';
  isSelected?: boolean;
  isRecommended?: boolean;
  source: 'AI_GENERATED' | 'USER_CREATED' | 'PREDEFINED';
}

interface ActivitiesTabProps {
  partyId: string;
  themeActivities?: string;
  partyData?: {
    childName: string;
    childAge: number;
    theme: string;
    interests: string[];
    favoriteColors: string[];
    venue?: string;
    guestCount?: number;
  };
  onActivitiesChange?: (activities: Activity[]) => void;
  onSelectedActivitiesChange?: (selectedActivities: Activity[]) => void;
  onAddToHostMode?: (selectedActivities: Activity[]) => void;
}

export default function ActivitiesTab({ partyId, themeActivities, partyData, onActivitiesChange, onSelectedActivitiesChange, onAddToHostMode }: ActivitiesTabProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Filter states - now always visible
  const [filterTime, setFilterTime] = useState<string>("all");
  const [filterVenue, setFilterVenue] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  // AI recommendations state
  const [recommendedActivities, setRecommendedActivities] = useState<string[]>([]);
  
  // Activity categories
  const activityCategories = [
    'Games & Competitions',
    'Creative & Crafty',
    'Performance & Storytelling',
    'Interactive Play',
    'Calm & Relax Zones'
  ];

  // Predefined activities organized by category
  const predefinedActivities: Record<string, Activity[]> = {
    'Games & Competitions': [
      { id: 'gc1', name: 'Musical Chairs', description: 'Classic chair game with themed music or props', estimatedTime: 15, timeUnit: 'minutes', category: 'Games & Competitions', venue: 'both', source: 'PREDEFINED' },
      { id: 'gc2', name: 'Treasure Hunt', description: 'Themed clues, indoor/outdoor adventure', estimatedTime: 30, timeUnit: 'minutes', category: 'Games & Competitions', venue: 'both', source: 'PREDEFINED' },
      { id: 'gc3', name: 'Sack Race or Relay Race', description: 'Active competitive fun for groups', estimatedTime: 20, timeUnit: 'minutes', category: 'Games & Competitions', venue: 'outdoor', source: 'PREDEFINED' },
      { id: 'gc4', name: 'Pin the Tail', description: 'Customized to theme (e.g., Pin the Wheel on the Car)', estimatedTime: 10, timeUnit: 'minutes', category: 'Games & Competitions', venue: 'indoor', source: 'PREDEFINED' },
      { id: 'gc5', name: 'Balloon Pop Challenge', description: 'Fun balloon popping games and challenges', estimatedTime: 15, timeUnit: 'minutes', category: 'Games & Competitions', venue: 'both', source: 'PREDEFINED' },
      { id: 'gc6', name: 'Obstacle Course', description: 'Custom obstacle course for active play', estimatedTime: 25, timeUnit: 'minutes', category: 'Games & Competitions', venue: 'outdoor', source: 'PREDEFINED' }
    ],
    'Creative & Crafty': [
      { id: 'cc1', name: 'Themed Coloring Station', description: 'Theme-based coloring pages and activities', estimatedTime: 20, timeUnit: 'minutes', category: 'Creative & Crafty', venue: 'indoor', source: 'PREDEFINED' },
      { id: 'cc2', name: 'Build Your Own Craft', description: 'Cars, castles, rockets, animals crafting', estimatedTime: 30, timeUnit: 'minutes', category: 'Creative & Crafty', venue: 'indoor', source: 'PREDEFINED' },
      { id: 'cc3', name: 'DIY Party Hats or Masks', description: 'Create personalized party accessories', estimatedTime: 25, timeUnit: 'minutes', category: 'Creative & Crafty', venue: 'indoor', source: 'PREDEFINED' },
      { id: 'cc4', name: 'Decorate Your Own Cupcake/Cookie', description: 'Fun food decoration activity', estimatedTime: 20, timeUnit: 'minutes', category: 'Creative & Crafty', venue: 'indoor', source: 'PREDEFINED' },
      { id: 'cc5', name: 'Make-Your-Own Slime or Playdough', description: 'Hands-on sensory crafting fun', estimatedTime: 25, timeUnit: 'minutes', category: 'Creative & Crafty', venue: 'indoor', source: 'PREDEFINED' }
    ],
    'Performance & Storytelling': [
      { id: 'ps1', name: 'Talent Show', description: 'Dance, singing, jokes performance time', estimatedTime: 30, timeUnit: 'minutes', category: 'Performance & Storytelling', venue: 'both', source: 'PREDEFINED' },
      { id: 'ps2', name: 'Story Time', description: 'Theme-based adventure storytelling', estimatedTime: 15, timeUnit: 'minutes', category: 'Performance & Storytelling', venue: 'indoor', source: 'PREDEFINED' },
      { id: 'ps3', name: 'Puppet Show', description: 'Interactive puppet theater performance', estimatedTime: 20, timeUnit: 'minutes', category: 'Performance & Storytelling', venue: 'indoor', source: 'PREDEFINED' },
      { id: 'ps4', name: 'Karaoke Corner', description: 'Singing and music performance fun', estimatedTime: 25, timeUnit: 'minutes', category: 'Performance & Storytelling', venue: 'indoor', source: 'PREDEFINED' },
      { id: 'ps5', name: 'Magic Show', description: 'Simple magic tricks and illusions', estimatedTime: 20, timeUnit: 'minutes', category: 'Performance & Storytelling', venue: 'both', source: 'PREDEFINED' }
    ],
    'Interactive Play': [
      { id: 'ip1', name: 'Dance Party with DJ', description: 'Music and dancing with playlist or DJ', estimatedTime: 30, timeUnit: 'minutes', category: 'Interactive Play', venue: 'both', source: 'PREDEFINED' },
      { id: 'ip2', name: 'Bubble Play Zone', description: 'Bubble machines and bubble activities', estimatedTime: 20, timeUnit: 'minutes', category: 'Interactive Play', venue: 'outdoor', source: 'PREDEFINED' },
      { id: 'ip3', name: 'Giant Board Games', description: 'Connect 4, Jenga, and oversized games', estimatedTime: 25, timeUnit: 'minutes', category: 'Interactive Play', venue: 'both', source: 'PREDEFINED' },
      { id: 'ip4', name: 'Parachute Games', description: 'Group parachute play activities', estimatedTime: 15, timeUnit: 'minutes', category: 'Interactive Play', venue: 'outdoor', source: 'PREDEFINED' },
      { id: 'ip5', name: 'Water Balloon Fight', description: 'Outdoor water play and games', estimatedTime: 20, timeUnit: 'minutes', category: 'Interactive Play', venue: 'outdoor', source: 'PREDEFINED' }
    ],
    'Calm & Relax Zones': [
      { id: 'cr1', name: 'Reading Nook', description: 'Quiet space for books and stories', estimatedTime: 20, timeUnit: 'minutes', category: 'Calm & Relax Zones', venue: 'indoor', source: 'PREDEFINED' },
      { id: 'cr2', name: 'Movie Screening', description: 'Short themed clips or full movie', estimatedTime: 45, timeUnit: 'minutes', category: 'Calm & Relax Zones', venue: 'indoor', source: 'PREDEFINED' },
      { id: 'cr3', name: 'Lego Build Zone', description: 'Free-building with Lego blocks', estimatedTime: 30, timeUnit: 'minutes', category: 'Calm & Relax Zones', venue: 'indoor', source: 'PREDEFINED' },
      { id: 'cr4', name: 'Puzzle Station', description: 'Age-appropriate puzzles and games', estimatedTime: 25, timeUnit: 'minutes', category: 'Calm & Relax Zones', venue: 'indoor', source: 'PREDEFINED' }
    ]
  };

  // Initialize with predefined activities
  useEffect(() => {
    const allPredefined = Object.values(predefinedActivities).flat();
    setActivities(allPredefined);
    generateAIRecommendations(allPredefined);
  }, []);

  // Generate AI recommendations based on party data
  const generateAIRecommendations = async (activityList: Activity[]) => {
    if (!partyData) return;
    
    setLoading(true);
    try {
      // Simple AI recommendation logic based on party data
      const recommendations: string[] = [];
      const { childAge, theme, interests, venue } = partyData;
      
      // Age-based recommendations
      if (childAge <= 5) {
        recommendations.push('cc1', 'cr1', 'ps2', 'cc4'); // Quieter, simpler activities
      } else if (childAge <= 8) {
        recommendations.push('gc1', 'gc4', 'cc2', 'ip1', 'ps1'); // More interactive
      } else {
        recommendations.push('gc2', 'gc6', 'ps1', 'ip3', 'gc5'); // More complex activities
      }
      
      // Theme-based recommendations
      if (theme.toLowerCase().includes('princess')) {
        recommendations.push('cc3', 'ps1', 'cc4');
      } else if (theme.toLowerCase().includes('superhero')) {
        recommendations.push('gc6', 'gc5', 'ps5');
      } else if (theme.toLowerCase().includes('pirate')) {
        recommendations.push('gc2', 'ps3', 'gc1');
      }
      
      // Venue-based recommendations
      if (venue === 'outdoor') {
        recommendations.push('gc3', 'ip2', 'ip5', 'gc6');
      } else if (venue === 'indoor') {
        recommendations.push('cc1', 'ps4', 'cr2', 'ip3');
      }
      
      // Interest-based recommendations
      interests.forEach(interest => {
        if (interest.toLowerCase().includes('art') || interest.toLowerCase().includes('craft')) {
          recommendations.push('cc1', 'cc2', 'cc3');
        }
        if (interest.toLowerCase().includes('music') || interest.toLowerCase().includes('dance')) {
          recommendations.push('ip1', 'ps4', 'ps1');
        }
        if (interest.toLowerCase().includes('sport') || interest.toLowerCase().includes('active')) {
          recommendations.push('gc3', 'gc6', 'ip4');
        }
      });
      
      // Remove duplicates and limit to 6-8 recommendations
      const uniqueRecommendations = Array.from(new Set(recommendations)).slice(0, 8);
      setRecommendedActivities(uniqueRecommendations);
      
      // Mark recommended activities
      setActivities(prev => prev.map(activity => ({
        ...activity,
        isRecommended: uniqueRecommendations.includes(activity.id)
      })));
      
    } catch (error) {
      console.error('Error generating recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Activity selection functions
  const toggleActivitySelection = (activityId: string) => {
    setActivities(prev => {
      const updated = prev.map(activity =>
        activity.id === activityId 
          ? { ...activity, isSelected: !activity.isSelected }
          : activity
      );
      
      // Call callback with selected activities
      const selected = updated.filter(a => a.isSelected);
      onSelectedActivitiesChange?.(selected);
      
      return updated;
    });
  };

  const selectAllActivities = () => {
    setActivities(prev => {
      const updated = prev.map(activity => ({ ...activity, isSelected: true }));
      onSelectedActivitiesChange?.(updated);
      return updated;
    });
  };

  const deselectAllActivities = () => {
    setActivities(prev => {
      const updated = prev.map(activity => ({ ...activity, isSelected: false }));
      onSelectedActivitiesChange?.([]);
      return updated;
    });
  };

  const selectRecommendedActivities = () => {
    setActivities(prev => {
      const updated = prev.map(activity => ({ 
        ...activity, 
        isSelected: activity.isRecommended || activity.isSelected 
      }));
      const selected = updated.filter(a => a.isSelected);
      onSelectedActivitiesChange?.(selected);
      return updated;
    });
  };

  const handleAddToHostMode = async () => {
    const selectedActivities = activities.filter(a => a.isSelected);
    if (selectedActivities.length === 0) return;

    setLoading(true);
    try {
      // Save each selected activity to the database
      const savePromises = selectedActivities.map(async (activity) => {
        const response = await fetch('/api/party-activities', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            partyId,
            activity: {
              name: activity.name,
              description: activity.description,
              estimatedTime: activity.estimatedTime,
              timeUnit: activity.timeUnit,
              supplies: [], // Will be filled by AI expansion
              source: activity.source,
              isSelected: true,
              isHostModeReady: false, // Will need AI expansion
              category: activity.category,
              venue: activity.venue,
              energyLevel: 'MEDIUM', // Default energy level
              sortOrder: 0
            }
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to save activity: ${activity.name}`);
        }

        return response.json();
      });

      await Promise.all(savePromises);
      
      setSuccess(`${selectedActivities.length} activities added to Host Mode! Visit Host Mode tab to expand them with AI scripts.`);
      onAddToHostMode?.(selectedActivities);
      
      setTimeout(() => setSuccess(null), 5000);
    } catch (error) {
      console.error('Error saving activities:', error);
      setError('Failed to add activities to Host Mode. Please try again.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  // Activity filtering logic
  const filteredActivities = activities.filter(activity => {
    let timeMatch = true;
    let venueMatch = true;
    let categoryMatch = true;

    // Time filtering
    if (filterTime !== "all" && activity.estimatedTime) {
      const time = activity.estimatedTime;
      switch (filterTime) {
        case "short":
          timeMatch = time <= 15;
          break;
        case "medium":
          timeMatch = time > 15 && time <= 30;
          break;
        case "long":
          timeMatch = time > 30;
          break;
      }
    }

    // Venue filtering
    if (filterVenue !== "all") {
      switch (filterVenue) {
        case "indoor":
          venueMatch = activity.venue === 'indoor' || activity.venue === 'both';
          break;
        case "outdoor":
          venueMatch = activity.venue === 'outdoor' || activity.venue === 'both';
          break;
      }
    }

    // Category filtering
    if (selectedCategory !== "all") {
      categoryMatch = activity.category === selectedCategory;
    }

    return timeMatch && venueMatch && categoryMatch;
  });

  // Group activities by category for display
  const activitiesByCategory = activityCategories.reduce((acc, category) => {
    acc[category] = filteredActivities.filter(activity => activity.category === category);
    return acc;
  }, {} as Record<string, Activity[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Activity Bucket List</h2>
          <p className="text-gray-600 dark:text-gray-400">
            {partyData ? `Select activities for ${partyData.childName}'s ${partyData.theme} party` : 'Choose from our curated collection of party activities'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {recommendedActivities.length > 0 && (
            <Button 
              onClick={selectRecommendedActivities}
              className="bg-purple-600 hover:bg-purple-700"
              size="sm"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Select AI Picks
            </Button>
          )}
          <Button 
            onClick={selectAllActivities}
            variant="outline"
            size="sm"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Select All
          </Button>
          <Button 
            onClick={deselectAllActivities}
            variant="outline"
            size="sm"
          >
            <X className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      {/* Selection Summary with Add to Host Mode */}
      {activities.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-blue-800 dark:text-blue-200">
              {activities.filter(a => a.isSelected).length} activities selected for your party
            </span>
            {recommendedActivities.length > 0 && (
              <Badge className="bg-purple-600 text-white">
                <Sparkles className="h-3 w-3 mr-1" />
                {recommendedActivities.length} AI Recommendations
              </Badge>
            )}
          </div>
          {activities.filter(a => a.isSelected).length > 0 && (
            <Button 
              onClick={handleAddToHostMode}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold px-6 py-2 shadow-lg"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add to Host Mode
            </Button>
          )}
        </div>
      )}

      {/* Always Visible Filters */}
      <Card className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800/50 dark:to-blue-900/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Quick Filters
          </CardTitle>
          <CardDescription>
            Find the perfect activities for your party setup
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-center">
            {/* Duration Filters */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium flex items-center gap-1 text-blue-600">
                <Clock className="h-4 w-4" />
                Duration:
              </Label>
              <div className="flex gap-1">
                {[
                  { value: 'all', label: 'All', color: 'bg-gray-200 hover:bg-gray-300' },
                  { value: 'short', label: '≤15m', color: 'bg-blue-100 hover:bg-blue-200 text-blue-800' },
                  { value: 'medium', label: '15-30m', color: 'bg-blue-200 hover:bg-blue-300 text-blue-800' },
                  { value: 'long', label: '30m+', color: 'bg-blue-300 hover:bg-blue-400 text-blue-900' }
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant="ghost"
                    onClick={() => setFilterTime(option.value)}
                    className={cn(
                      "text-xs px-3 py-1 h-7 rounded-full",
                      filterTime === option.value 
                        ? "bg-blue-600 text-white hover:bg-blue-700" 
                        : option.color
                    )}
                    size="sm"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Venue Filters */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium flex items-center gap-1 text-purple-600">
                <MapPin className="h-4 w-4" />
                Venue:
              </Label>
              <div className="flex gap-1">
                {[
                  { value: 'all', label: 'All', color: 'bg-gray-200 hover:bg-gray-300' },
                  { value: 'indoor', label: 'Indoor', color: 'bg-purple-100 hover:bg-purple-200 text-purple-800' },
                  { value: 'outdoor', label: 'Outdoor', color: 'bg-purple-100 hover:bg-purple-200 text-purple-800' }
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant="ghost"
                    onClick={() => setFilterVenue(option.value)}
                    className={cn(
                      "text-xs px-3 py-1 h-7 rounded-full",
                      filterVenue === option.value 
                        ? "bg-purple-600 text-white hover:bg-purple-700" 
                        : option.color
                    )}
                    size="sm"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Category Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-sm font-medium flex items-center gap-1 text-green-600">
                <Tag className="h-4 w-4" />
                Category:
              </Label>
              <div className="flex gap-1 flex-wrap">
                <Button
                  variant="ghost"
                  onClick={() => setSelectedCategory("all")}
                  className={cn(
                    "text-xs px-3 py-1 h-7 rounded-full",
                    selectedCategory === "all" 
                      ? "bg-green-600 text-white hover:bg-green-700" 
                      : "bg-gray-200 hover:bg-gray-300"
                  )}
                  size="sm"
                >
                  All
                </Button>
                {activityCategories.map((category) => (
                  <Button
                    key={category}
                    variant="ghost"
                    onClick={() => setSelectedCategory(category)}
                    className={cn(
                      "text-xs px-3 py-1 h-7 rounded-full whitespace-nowrap",
                      selectedCategory === category 
                        ? "bg-green-600 text-white hover:bg-green-700" 
                        : "bg-green-100 hover:bg-green-200 text-green-800"
                    )}
                    size="sm"
                  >
                    {category.split(' ')[0]}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Success/Error Messages */}
      {success && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
      
      {error && (
        <Alert className="border-red-200 bg-red-50 text-red-800">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Activities by Category */}
      <div className="space-y-8">
        {activityCategories.map((category) => {
          const categoryActivities = activitiesByCategory[category];
          if (categoryActivities.length === 0) return null;
          
          const categoryIcon = {
            'Games & Competitions': '🎮',
            'Creative & Crafty': '🎨',
            'Performance & Storytelling': '🎭',
            'Interactive Play': '🎪',
            'Calm & Relax Zones': '😌'
          }[category];
          
          return (
            <div key={category}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{categoryIcon}</span>
                <h3 className="text-xl font-semibold">{category}</h3>
                <Badge variant="outline" className="ml-2">
                  {categoryActivities.length} activities
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryActivities.map((activity) => (
                  <Card 
                    key={activity.id} 
                    className={cn(
                      "transition-all hover:shadow-md cursor-pointer border-l-4",
                      activity.isSelected 
                        ? "border-l-green-500 bg-green-50 dark:bg-green-900/20" 
                        : activity.isRecommended 
                          ? "border-l-purple-500 bg-purple-50 dark:bg-purple-900/20"
                          : "border-l-gray-300"
                    )}
                    onClick={() => toggleActivitySelection(activity.id)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={activity.isSelected || false}
                            onChange={() => {}}
                            className="mt-1"
                          />
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              {activity.name}
                              {activity.isRecommended && (
                                <Badge className="bg-purple-600 text-white text-xs">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  AI Pick
                                </Badge>
                              )}
                            </CardTitle>
                            <CardDescription className="text-sm mt-1">
                              {activity.description}
                            </CardDescription>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-4">
                          {activity.estimatedTime && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {activity.estimatedTime} {activity.timeUnit}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {activity.venue === 'both' ? 'Indoor/Outdoor' : 
                             activity.venue === 'indoor' ? 'Indoor' : 'Outdoor'}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredActivities.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <div className="space-y-3">
              <Filter className="h-8 w-8 text-gray-400 mx-auto" />
              <h3 className="text-lg font-semibold">No activities match your filters</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Try adjusting your filters to see more activities.
              </p>
              <Button 
                onClick={() => {
                  setFilterTime("all");
                  setFilterVenue("all");
                  setSelectedCategory("all");
                }}
                variant="outline"
                size="sm"
              >
                Reset Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}