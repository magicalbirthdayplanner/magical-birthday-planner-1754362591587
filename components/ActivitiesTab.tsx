"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  RotateCcw, 
  Trash2, 
  Save, 
  Edit3,
  Clock,
  Users,
  CheckCircle2,
  Sparkles,
  GripVertical,
  AlertCircle,
  Lightbulb,
  Filter,
  X,
  Tag
} from "lucide-react";

interface Activity {
  id: string;
  name: string;
  description?: string;
  supplies: string[];
  estimatedTime?: number;
  timeUnit: string;
  peopleRequired?: number;
  groupInstructions?: string;
  hostScript?: string;
  tips: string[];
  sortOrder: number;
  isCustom: boolean;
  source: 'AI_GENERATED' | 'USER_CREATED' | 'THEME_DEFAULT';
  isExpanded?: boolean;
  isSelected?: boolean;
  category?: string;
  shortDescription?: string;
}

interface ActivitiesTabProps {
  partyId: string;
  themeActivities?: string; // AI recommendation text from wizard
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
}

export default function ActivitiesTab({ partyId, themeActivities, partyData, onActivitiesChange, onSelectedActivitiesChange }: ActivitiesTabProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newActivityName, setNewActivityName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  
  // New state for keyword input and filters
  const [keywords, setKeywords] = useState<string[]>([]);
  const [currentKeyword, setCurrentKeyword] = useState("");
  const [filterTime, setFilterTime] = useState<string>("all");
  const [filterVenue, setFilterVenue] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [hasGeneratedFromTheme, setHasGeneratedFromTheme] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  
  // Activity categories
  const activityCategories = [
    'Games & Competitions',
    'Arts & Crafts', 
    'Active & Sports',
    'Educational & Learning',
    'Music & Dance',
    'Food & Cooking',
    'Other'
  ];

  // Load activities on component mount and auto-generate if no activities exist
  useEffect(() => {
    loadActivities();
  }, [partyId]);

  // Auto-generate activities if theme data available and no activities exist
  useEffect(() => {
    if (partyData && themeActivities && activities.length === 0 && !loading && !hasGeneratedFromTheme) {
      generateActivitiesFromAI();
      setHasGeneratedFromTheme(true);
    }
  }, [partyData, themeActivities, activities.length, loading, hasGeneratedFromTheme]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/party-activities?partyId=${partyId}`);
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      } else {
        console.error('Failed to load activities');
      }
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateActivitiesFromAI = async () => {
    if (!themeActivities) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Enhanced prompt with party context and keywords
      const enhancedPrompt = createEnhancedActivityPrompt();
      
      const response = await fetch('/api/activity-expansion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partyId,
          activityText: themeActivities,
          partyData,
          keywords,
          enhancedPrompt
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities);
        setSuccess('Activities successfully generated from AI recommendations!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Failed to generate activities. Please try again.');
      }
    } catch (error) {
      setError('Error generating activities. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const createEnhancedActivityPrompt = () => {
    if (!partyData) return "";
    
    const { childName, childAge, theme, interests, favoriteColors, venue, guestCount } = partyData;
    
    return `Generate activities for ${childName}'s ${childAge}-year-old birthday party with the ${theme} theme. 
    
    Party Context:
    - Child's interests: ${interests.join(', ')}
    - Favorite colors: ${favoriteColors.join(', ')}
    - Venue: ${venue || 'Not specified'}
    - Expected kids: ${guestCount || 'Not specified'}
    - Additional keywords from parent: ${keywords.join(', ') || 'None'}
    
    IMPORTANT: Focus exclusively on activities designed for CHILDREN/KIDS ONLY. Do not include activities that require adult participation as players or participants.
    
    Please ensure activities are:
    1. Age-appropriate for ${childAge}-year-olds specifically
    2. Theme-specific for ${theme} parties
    3. Suitable for the venue type: ${venue || 'any location'}
    4. Designed for kids to participate independently or with minimal adult supervision
    5. Incorporate the child's interests: ${interests.join(', ')}
    6. Engaging for groups of children, not mixed adult-child activities
    
    Generate activities where kids are the main participants (e.g., treasure hunts, craft activities, games, challenges) rather than activities requiring significant adult involvement as participants. Adults should only be facilitators, supervisors, or organizers.
    
    Focus on ${theme}-themed activities like safari animal games, jungle exploration, wildlife crafts, etc.`;
  };

  const saveActivity = async (activity: Activity) => {
    try {
      const response = await fetch('/api/party-activities', {
        method: activity.id.startsWith('temp_') ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partyId,
          activity,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update local state with saved activity
        setActivities(prev => 
          prev.map(a => a.id === activity.id ? data.activity : a)
        );
        setSuccess('Activity saved successfully!');
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError('Failed to save activity');
      }
    } catch (error) {
      setError('Error saving activity');
    }
  };

  const deleteActivity = async (activityId: string) => {
    try {
      const response = await fetch('/api/party-activities', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partyId,
          activityId,
        }),
      });

      if (response.ok) {
        setActivities(prev => prev.filter(a => a.id !== activityId));
        setSuccess('Activity deleted successfully!');
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError('Failed to delete activity');
      }
    } catch (error) {
      setError('Error deleting activity');
    }
  };

  const addNewActivity = () => {
    if (!newActivityName.trim()) return;

    const newActivity: Activity = {
      id: `temp_${Date.now()}`,
      name: newActivityName,
      description: '',
      supplies: [],
      estimatedTime: 30,
      timeUnit: 'minutes',
      peopleRequired: 1,
      groupInstructions: '',
      hostScript: '',
      tips: [],
      sortOrder: activities.length,
      isCustom: true,
      source: 'USER_CREATED',
      isExpanded: true,
    };

    setActivities(prev => [...prev, newActivity]);
    setNewActivityName("");
    setShowAddForm(false);
  };

  const updateActivity = (activityId: string, field: keyof Activity, value: any) => {
    setActivities(prev =>
      prev.map(activity =>
        activity.id === activityId ? { ...activity, [field]: value } : activity
      )
    );
  };

  const toggleExpanded = (activityId: string) => {
    setActivities(prev =>
      prev.map(activity =>
        activity.id === activityId 
          ? { ...activity, isExpanded: !activity.isExpanded }
          : activity
      )
    );
  };

  const addSupplyItem = (activityId: string, supply: string) => {
    if (!supply.trim()) return;
    updateActivity(activityId, 'supplies', [...activities.find(a => a.id === activityId)?.supplies || [], supply]);
  };

  const removeSupplyItem = (activityId: string, index: number) => {
    const activity = activities.find(a => a.id === activityId);
    if (activity) {
      const newSupplies = activity.supplies.filter((_, i) => i !== index);
      updateActivity(activityId, 'supplies', newSupplies);
    }
  };

  const addTip = (activityId: string, tip: string) => {
    if (!tip.trim()) return;
    updateActivity(activityId, 'tips', [...activities.find(a => a.id === activityId)?.tips || [], tip]);
  };

  const removeTip = (activityId: string, index: number) => {
    const activity = activities.find(a => a.id === activityId);
    if (activity) {
      const newTips = activity.tips.filter((_, i) => i !== index);
      updateActivity(activityId, 'tips', newTips);
    }
  };

  // Keyword management functions
  const addKeyword = () => {
    if (currentKeyword.trim() && keywords.length < 3 && !keywords.includes(currentKeyword.trim())) {
      setKeywords([...keywords, currentKeyword.trim()]);
      setCurrentKeyword("");
    }
  };

  const removeKeyword = (index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index));
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

    // Venue filtering (based on activity characteristics)
    if (filterVenue !== "all") {
      const activityName = activity.name.toLowerCase();
      const description = (activity.description || "").toLowerCase();
      const supplies = activity.supplies.join(" ").toLowerCase();
      
      switch (filterVenue) {
        case "indoor":
          venueMatch = !/(outdoor|park|garden|field|playground|nature|water|pool)/.test(activityName + description + supplies);
          break;
        case "outdoor":
          venueMatch = /(outdoor|park|garden|field|playground|nature|water|pool|treasure hunt|scavenger|sports)/.test(activityName + description + supplies);
          break;
      }
    }

    // Category filtering
    if (selectedCategory !== "all") {
      categoryMatch = activity.category === selectedCategory;
    }

    return timeMatch && venueMatch && categoryMatch;
  });

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Party Activities</h2>
          <p className="text-gray-600 dark:text-gray-400">
            {partyData ? `Fun activities for ${partyData.childName}'s ${partyData.theme} party` : 'Detailed activity plans with supplies, timing, and parent instructions'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
          {/* Quick keyword input for regeneration */}
          {themeActivities && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <div className="flex items-center gap-2">
                <Input
                  value={currentKeyword}
                  onChange={(e) => setCurrentKeyword(e.target.value)}
                  placeholder="Add keyword (e.g., dinosaurs, music...)"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      if (currentKeyword.trim() && keywords.length < 3 && !keywords.includes(currentKeyword.trim())) {
                        setKeywords([...keywords, currentKeyword.trim()]);
                        setCurrentKeyword("");
                      }
                    }
                  }}
                  className="w-64 h-9"
                />
                {currentKeyword.trim() && keywords.length < 3 && !keywords.includes(currentKeyword.trim()) && (
                  <Button 
                    onClick={() => {
                      setKeywords([...keywords, currentKeyword.trim()]);
                      setCurrentKeyword("");
                    }}
                    size="sm"
                    variant="outline"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                )}
              </div>
              
              {/* Show current keywords */}
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {keywords.map((keyword, index) => (
                    <Badge key={index} variant="secondary" className="text-xs flex items-center gap-1">
                      {keyword}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeKeyword(index)}
                        className="h-3 w-3 p-0 hover:bg-transparent"
                      >
                        <X className="h-2 w-2" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
          
          <div className="flex gap-2">
            {/* Activity Selection Controls */}
            {activities.length > 0 && (
              <>
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
              </>
            )}
            <Button 
              onClick={() => setShowFilters(!showFilters)}
              variant="outline"
              size="sm"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
            {themeActivities && (
              <Button 
                onClick={generateActivitiesFromAI}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {loading ? 'Generating...' : 'Regenerate with AI'}
              </Button>
            )}
            <Button 
              onClick={() => setShowAddForm(true)}
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Activity
            </Button>
          </div>
        </div>
      </div>

      {/* Selection Summary */}
      {activities.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-blue-800 dark:text-blue-200">
              {activities.filter(a => a.isSelected).length} of {activities.length} activities selected for Host Mode
            </span>
          </div>
          {activities.filter(a => a.isSelected).length > 0 && (
            <Badge className="bg-blue-600 text-white">
              Ready for Host Mode
            </Badge>
          )}
        </div>
      )}

      {/* Enhanced Controls Section */}
      {showFilters && (
        <Card className="bg-gray-50 dark:bg-gray-800/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Customize & Filter Activities
            </CardTitle>
            <CardDescription>
              Add keywords to personalize activities and use filters to find the perfect activities for your party
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Keywords Section */}
            <div>
              <Label className="text-sm font-medium">Additional Keywords (max 3)</Label>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                Add specific activities, themes, or interests your child loves
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {keywords.map((keyword, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {keyword}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeKeyword(index)}
                      className="h-4 w-4 p-0 hover:bg-transparent"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
              {keywords.length < 3 && (
                <div className="flex gap-2">
                  <Input
                    value={currentKeyword}
                    onChange={(e) => setCurrentKeyword(e.target.value)}
                    placeholder="e.g., dinosaurs, painting, water games..."
                    onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                    className="max-w-xs"
                  />
                  <Button 
                    onClick={addKeyword} 
                    disabled={!currentKeyword.trim()}
                    size="sm"
                  >
                    Add
                  </Button>
                </div>
              )}
            </div>

            {/* Visual Filter Cards */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-blue-600" />
                  Duration Filter
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { value: 'all', label: 'All', icon: '🎯', color: 'bg-gray-100 hover:bg-gray-200' },
                    { value: 'short', label: 'Quick (≤15min)', icon: '⚡', color: 'bg-green-100 hover:bg-green-200 text-green-800' },
                    { value: 'medium', label: 'Standard (15-30min)', icon: '⏱️', color: 'bg-blue-100 hover:bg-blue-200 text-blue-800' },
                    { value: 'long', label: 'Extended (30+ min)', icon: '🕰️', color: 'bg-purple-100 hover:bg-purple-200 text-purple-800' }
                  ].map((option) => (
                    <Button
                      key={option.value}
                      variant={filterTime === option.value ? 'default' : 'outline'}
                      onClick={() => setFilterTime(option.value)}
                      className={cn(
                        "h-auto p-3 flex flex-col items-center gap-1 text-xs transition-all",
                        filterTime === option.value 
                          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg" 
                          : option.color
                      )}
                    >
                      <span className="text-lg">{option.icon}</span>
                      <span className="font-medium">{option.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-purple-600" />
                  Venue Filter
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { value: 'all', label: 'All Venues', icon: '🏠', desc: 'Indoor & outdoor activities', color: 'bg-gray-100 hover:bg-gray-200' },
                    { value: 'indoor', label: 'Indoor Only', icon: '🏢', desc: 'Perfect for home or hall', color: 'bg-orange-100 hover:bg-orange-200 text-orange-800' },
                    { value: 'outdoor', label: 'Outdoor Only', icon: '🌳', desc: 'Garden, park, or backyard', color: 'bg-green-100 hover:bg-green-200 text-green-800' }
                  ].map((option) => (
                    <Button
                      key={option.value}
                      variant={filterVenue === option.value ? 'default' : 'outline'}
                      onClick={() => setFilterVenue(option.value)}
                      className={cn(
                        "h-auto p-4 flex flex-col items-center gap-2 text-sm transition-all",
                        filterVenue === option.value 
                          ? "bg-purple-600 hover:bg-purple-700 text-white shadow-lg" 
                          : option.color
                      )}
                    >
                      <span className="text-2xl">{option.icon}</span>
                      <div className="text-center">
                        <div className="font-medium">{option.label}</div>
                        <div className={cn(
                          "text-xs mt-1",
                          filterVenue === option.value ? "text-purple-100" : "text-gray-600"
                        )}>
                          {option.desc}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Category Filter */}
              <div>
                <Label className="text-sm font-medium flex items-center gap-2 mb-3">
                  <Tag className="h-4 w-4 text-green-600" />
                  Activity Category
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button
                    variant={selectedCategory === "all" ? 'default' : 'outline'}
                    onClick={() => setSelectedCategory("all")}
                    className={cn(
                      "h-auto p-3 flex flex-col items-center gap-1 text-xs transition-all",
                      selectedCategory === "all" 
                        ? "bg-green-600 hover:bg-green-700 text-white shadow-lg" 
                        : "bg-gray-100 hover:bg-gray-200"
                    )}
                  >
                    <span className="text-lg">🎯</span>
                    <span className="font-medium">All Categories</span>
                  </Button>
                  {activityCategories.map((category) => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? 'default' : 'outline'}
                      onClick={() => setSelectedCategory(category)}
                      className={cn(
                        "h-auto p-3 flex flex-col items-center gap-1 text-xs transition-all",
                        selectedCategory === category 
                          ? "bg-green-600 hover:bg-green-700 text-white shadow-lg" 
                          : "bg-gray-100 hover:bg-gray-200"
                      )}
                    >
                      <span className="text-lg">
                        {category === 'Games & Competitions' ? '🎮' :
                         category === 'Arts & Crafts' ? '🎨' :
                         category === 'Active & Sports' ? '⚽' :
                         category === 'Educational & Learning' ? '📚' :
                         category === 'Music & Dance' ? '🎵' :
                         category === 'Food & Cooking' ? '🍰' : '🎪'}
                      </span>
                      <span className="font-medium">{category}</span>
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Active Filters Summary */}
              {(filterTime !== "all" || filterVenue !== "all" || selectedCategory !== "all") && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Filter className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Active filters:</span>
                  <div className="flex gap-2">
                    {filterTime !== "all" && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        {filterTime} duration
                      </Badge>
                    )}
                    {filterVenue !== "all" && (
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                        {filterVenue} venue
                      </Badge>
                    )}
                    {selectedCategory !== "all" && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        {selectedCategory}
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setFilterTime("all");
                      setFilterVenue("all");
                      setSelectedCategory("all");
                    }}
                    className="ml-auto text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                  >
                    Clear all
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success/Error Messages */}
      {success && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
      
      {error && (
        <Alert className="border-red-200 bg-red-50 text-red-800">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Add New Activity Form */}
      {showAddForm && (
        <Card className="border-dashed border-2">
          <CardHeader>
            <CardTitle className="text-lg">Add New Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Activity name"
                value={newActivityName}
                onChange={(e) => setNewActivityName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addNewActivity()}
              />
              <Button onClick={addNewActivity} disabled={!newActivityName.trim()}>
                Add
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAddForm(false);
                  setNewActivityName("");
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activities List */}
      {loading && activities.length === 0 ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading activities...</p>
        </div>
      ) : activities.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="space-y-3">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto">
                <Sparkles className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold">No Activities Yet</h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                {partyData && themeActivities 
                  ? `We'll automatically generate ${partyData.theme}-themed activities based on ${partyData.childName}'s interests and party details.`
                  : themeActivities 
                    ? "Generate detailed activities from your theme recommendations or add your own custom activities."
                    : "Start by adding your own custom activities for the party."
                }
              </p>
              {themeActivities && (
                <Button 
                  onClick={generateActivitiesFromAI}
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Activities
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Filter Results Summary */}
          {(filterTime !== "all" || filterVenue !== "all" || selectedCategory !== "all") && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Filter className="h-4 w-4" />
              Showing {filteredActivities.length} of {activities.length} activities
              {filterTime !== "all" && ` • Duration: ${filterTime}`}
              {filterVenue !== "all" && ` • Venue: ${filterVenue}`}
              {selectedCategory !== "all" && ` • Category: ${selectedCategory}`}
            </div>
          )}
          
          {/* Activities */}
          {filteredActivities.length === 0 ? (
            <Card className="text-center py-8">
              <CardContent>
                <div className="space-y-3">
                  <Filter className="h-8 w-8 text-gray-400 mx-auto" />
                  <h3 className="text-lg font-semibold">No activities match your filters</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Try adjusting your filters or generate new activities with different keywords.
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
                    Clear Filters
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredActivities.map((activity, index) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  onUpdate={updateActivity}
                  onSave={saveActivity}
                  onDelete={deleteActivity}
                  onToggleExpanded={toggleExpanded}
                  onAddSupply={addSupplyItem}
                  onRemoveSupply={removeSupplyItem}
                  onAddTip={addTip}
                  onRemoveTip={removeTip}
                  onToggleSelection={toggleActivitySelection}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ActivityCardProps {
  activity: Activity;
  onUpdate: (activityId: string, field: keyof Activity, value: any) => void;
  onSave: (activity: Activity) => void;
  onDelete: (activityId: string) => void;
  onToggleExpanded: (activityId: string) => void;
  onAddSupply: (activityId: string, supply: string) => void;
  onRemoveSupply: (activityId: string, index: number) => void;
  onAddTip: (activityId: string, tip: string) => void;
  onRemoveTip: (activityId: string, index: number) => void;
  onToggleSelection: (activityId: string) => void;
}

function ActivityCard({ 
  activity, 
  onUpdate, 
  onSave, 
  onDelete, 
  onToggleExpanded,
  onAddSupply,
  onRemoveSupply,
  onAddTip,
  onRemoveTip,
  onToggleSelection
}: ActivityCardProps) {
  const [newSupply, setNewSupply] = useState("");
  const [newTip, setNewTip] = useState("");

  const handleAddSupply = () => {
    if (newSupply.trim()) {
      onAddSupply(activity.id, newSupply);
      setNewSupply("");
    }
  };

  const handleAddTip = () => {
    if (newTip.trim()) {
      onAddTip(activity.id, newTip);
      setNewTip("");
    }
  };

  return (
    <Card className="border-l-4 border-l-purple-500">
      <Collapsible open={activity.isExpanded} onOpenChange={() => onToggleExpanded(activity.id)}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={activity.isSelected || false}
                    onCheckedChange={(checked) => {
                      onToggleSelection(activity.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <GripVertical className="h-4 w-4 text-gray-400" />
                  {activity.isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-lg">{activity.name}</CardTitle>
                  <div className="flex items-center gap-4 mt-1">
                    {activity.estimatedTime && (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Clock className="h-3 w-3" />
                        {activity.estimatedTime} {activity.timeUnit}
                      </div>
                    )}
                    {activity.category && (
                      <Badge variant="outline">
                        {activity.category}
                      </Badge>
                    )}
                    {activity.shortDescription && (
                      <span className="text-sm text-gray-600 dark:text-gray-400 italic">
                        {activity.shortDescription}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSave(activity);
                  }}
                >
                  <Save className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(activity.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`name-${activity.id}`}>Activity Name</Label>
                <Input
                  id={`name-${activity.id}`}
                  value={activity.name}
                  onChange={(e) => onUpdate(activity.id, 'name', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor={`time-${activity.id}`}>Estimated Time</Label>
                  <Input
                    id={`time-${activity.id}`}
                    type="number"
                    value={activity.estimatedTime || ''}
                    onChange={(e) => onUpdate(activity.id, 'estimatedTime', parseInt(e.target.value) || null)}
                  />
                </div>
                <div>
                  <Label htmlFor={`timeunit-${activity.id}`}>Unit</Label>
                  <Select
                    value={activity.timeUnit}
                    onValueChange={(value) => onUpdate(activity.id, 'timeUnit', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <Label htmlFor={`desc-${activity.id}`}>Description</Label>
              <Textarea
                id={`desc-${activity.id}`}
                value={activity.description || ''}
                onChange={(e) => onUpdate(activity.id, 'description', e.target.value)}
                placeholder="Brief description of the activity..."
              />
            </div>

            {/* People Required and Group Instructions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`people-${activity.id}`}>People Required</Label>
                <Input
                  id={`people-${activity.id}`}
                  type="number"
                  value={activity.peopleRequired || ''}
                  onChange={(e) => onUpdate(activity.id, 'peopleRequired', parseInt(e.target.value) || null)}
                />
              </div>
              <div>
                <Label htmlFor={`group-${activity.id}`}>Group Formation</Label>
                <Input
                  id={`group-${activity.id}`}
                  value={activity.groupInstructions || ''}
                  onChange={(e) => onUpdate(activity.id, 'groupInstructions', e.target.value)}
                  placeholder="How to split kids by age/number..."
                />
              </div>
            </div>

            {/* Supplies Needed */}
            <div>
              <Label>Supplies Needed</Label>
              <div className="space-y-2">
                {activity.supplies.map((supply, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Checkbox id={`supply-${activity.id}-${index}`} />
                    <span className="flex-1">{supply}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onRemoveSupply(activity.id, index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newSupply}
                    onChange={(e) => setNewSupply(e.target.value)}
                    placeholder="Add supply item..."
                    onKeyPress={(e) => e.key === 'Enter' && handleAddSupply()}
                  />
                  <Button onClick={handleAddSupply} size="sm">
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Host Script */}
            <div>
              <Label htmlFor={`script-${activity.id}`}>Host Script / Instructions</Label>
              <Textarea
                id={`script-${activity.id}`}
                value={activity.hostScript || ''}
                onChange={(e) => onUpdate(activity.id, 'hostScript', e.target.value)}
                placeholder="Script or dialogue for parents to use when running this activity..."
                className="min-h-[100px]"
              />
            </div>

            {/* Tips and Notes */}
            <div>
              <Label>Tips & Safety Notes</Label>
              <div className="space-y-2">
                {activity.tips.map((tip, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                    <Lightbulb className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                    <span className="flex-1 text-sm">{tip}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onRemoveTip(activity.id, index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newTip}
                    onChange={(e) => setNewTip(e.target.value)}
                    placeholder="Add tip or safety note..."
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTip()}
                  />
                  <Button onClick={handleAddTip} size="sm">
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}