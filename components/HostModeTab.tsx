"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Sparkles,
  Mic,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  BookOpen,
  Package,
  Clock,
  Star,
  Crown,
  Zap,
  Heart,
  Lightbulb,
  Trash2
} from "lucide-react";

interface HostModeActivity {
  id: string;
  name: string;
  description?: string;
  estimatedTime?: number;
  timeUnit: string;
  supplies: string[];
  peopleRequired?: number;
  groupInstructions?: string;
  hostScript?: string;
  themeEmoji?: string;
  themeContext?: string;
  stepByStepScript?: string;
  soundCues: string[];
  energyLevel: 'CALM' | 'ACTIVE' | 'HIGH_ENERGY' | 'MEDIUM';
  isHostModeReady: boolean;
  isSelected?: boolean;
  source: 'AI_GENERATED' | 'USER_CREATED' | 'THEME_DEFAULT';
  
  // Comprehensive AI Content Fields
  isFullyExpanded?: boolean;
  fullHostScript?: string;
  rulesAndVariations?: {
    baseRules?: string[];
    ageVariations?: Record<string, string>;
    groupSizeAdjustments?: Record<string, string>;
    spaceAdjustments?: Record<string, string>;
  };
  materialsList?: {
    craftMaterials?: Array<{
      item: string;
      quantity: string;
      purpose: string;
    }>;
    extras?: Array<{
      item: string;
      purpose: string;
    }>;
    prepReminders?: string[];
  };
  optionalExtras?: {
    prepTime?: string;
    playTime?: string;
    messFactor?: string;
    adultInvolvement?: string;
  };
}

interface VenueData {
  name: string;
  address: string;
  rating?: number;
  distance?: string;
  type?: 'home' | 'indoor' | 'outdoor' | 'specialty';
  partySize?: string;
  addOns?: string[];
  placeId?: string;
  photoUrl?: string;
}

interface HostModeTabProps {
  partyId: string;
  partyData?: {
    childName: string;
    childAge: number;
    theme: string;
    interests: string[];
    favoriteColors: string[];
    venue?: VenueData | 'indoor' | 'outdoor' | 'mixed';
    guestCount?: number;
  };
  selectedActivities?: any[];
}

export default function HostModeTab({ partyId, partyData, selectedActivities = [] }: HostModeTabProps) {
  const [activities, setActivities] = useState<HostModeActivity[]>([]);
  const [currentActivity, setCurrentActivity] = useState<HostModeActivity | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanding, setExpanding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);


  // Use selected activities from Activities tab instead of loading from API
  useEffect(() => {
    if (selectedActivities && selectedActivities.length > 0) {
      // Transform selected activities to HostModeActivity format
      const hostModeActivities = selectedActivities.map(activity => ({
        id: activity.id,
        name: activity.name,
        description: activity.description,
        estimatedTime: activity.estimatedTime || 30,
        timeUnit: activity.timeUnit || 'minutes',
        supplies: activity.suppliesNeeded || ['Basic supplies'],
        peopleRequired: activity.minParticipants || 2,
        groupInstructions: activity.description,
        hostScript: `Welcome to ${activity.name}! Let's have some fun!`,
        themeEmoji: '🎉',
        themeContext: 'Birthday Party',
        stepByStepScript: activity.description,
        soundCues: ['🎵', '👏', '🎉'],
        energyLevel: 'MEDIUM' as const,
        isHostModeReady: true,
        isSelected: true,
        source: 'THEME_DEFAULT' as const,
        isFullyExpanded: false,
        fullHostScript: `Welcome everyone to our amazing ${activity.name} activity! This is going to be so much fun. Let me explain how we're going to play...`,
        rulesAndVariations: {
          baseRules: ['Have fun!', 'Be safe!', 'Include everyone!'],
          variations: ['Easy mode', 'Challenge mode'],
          safetyNotes: ['Make sure everyone is safe', 'Take breaks if needed']
        },
        timingAndFlow: {
          setupTime: '5 minutes',
          activityDuration: `${activity.estimatedTime || 30} minutes`,
          cleanupTime: '5 minutes',
          transitionTips: 'Great job everyone! Ready for the next activity?'
        },
        engagementStrategies: {
          attentionGrabbers: ['Listen up!', 'Ready to play?'],
          participationTips: ['Everyone gets a turn', 'Help each other out'],
          energyManagement: ['Take breaks', 'Stay hydrated']
        }
      }));
      
      setActivities(hostModeActivities);
      console.log('Host Mode loaded with selected activities:', hostModeActivities.length);
    } else {
      setActivities([]);
    }
  }, [selectedActivities]);


  const loadActivities = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/party-activities?partyId=${partyId}`);
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
        
        // Only set current activity if user explicitly selects one - don't auto-load
        setCurrentActivity(null);
      } else {
        setError('Failed to load activities');
      }
    } catch (error) {
      setError('Error loading activities');
    } finally {
      setLoading(false);
    }
  };

  const expandActivityForHostMode = async (activityId: string) => {
    setExpanding(activityId);
    setError(null);
    console.log('Expanding activity with comprehensive AI content:', activityId, 'for party:', partyId);
    
    try {
      const response = await fetch('/api/activity-full-expand', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partyId,
          activityId,
        }),
      });

      console.log('Full expand response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Full expand response data:', data);
        
        // Update the activity in the local state with comprehensive content
        const updatedActivity = { ...data.activity };
        setActivities(prev => 
          prev.map(a => a.id === activityId ? { ...a, ...updatedActivity } : a)
        );
        
        // IMMEDIATELY show the expanded activity in the main display
        setCurrentActivity(updatedActivity);
        
        setSuccess('Activity expanded with comprehensive AI content! All 4 sections generated successfully.');
        setTimeout(() => setSuccess(null), 4000);
      } else {
        const errorData = await response.text();
        console.error('Full expand error response:', errorData);
        setError(`Failed to expand activity: ${response.status} - ${errorData}`);
      }
    } catch (error) {
      console.error('Full expand error:', error);
      setError(`Error expanding activity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setExpanding(null);
    }
  };


  const deleteActivity = async (activityId: string) => {
    setError(null);
    
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
        // Remove activity from local state
        setActivities(prev => prev.filter(a => a.id !== activityId));
        
        // If this was the current activity, clear it
        if (currentActivity?.id === activityId) {
          setCurrentActivity(null);
        }
        
        setSuccess('Activity deleted successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Failed to delete activity');
      }
    } catch (error) {
      setError('Error deleting activity');
    }
  };

  const switchActivity = (energyLevel?: string) => {
    const filteredActivities = energyLevel 
      ? activities.filter(a => a.energyLevel === energyLevel && a.isHostModeReady && a.isSelected)
      : activities.filter(a => a.isHostModeReady && a.isSelected);
    
    if (filteredActivities.length > 0) {
      const randomActivity = filteredActivities[Math.floor(Math.random() * filteredActivities.length)];
      setCurrentActivity(randomActivity);
    }
  };


  const getEnergyLevelColor = (level: string) => {
    switch (level) {
      case 'CALM': return 'bg-blue-100 text-blue-800';
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'HIGH_ENERGY': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getEnergyLevelIcon = (level: string) => {
    switch (level) {
      case 'CALM': return <Heart className="h-3 w-3" />;
      case 'ACTIVE': return <Zap className="h-3 w-3" />;
      case 'HIGH_ENERGY': return <Star className="h-3 w-3" />;
      default: return <Lightbulb className="h-3 w-3" />;
    }
  };


  const fullyExpandedActivities = activities.filter(a => a.isFullyExpanded && a.isSelected);
  const basicExpandedActivities = activities.filter(a => a.isHostModeReady && !a.isFullyExpanded && a.isSelected);
  const needsExpansion = activities.filter(a => !a.isHostModeReady && a.isSelected);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading Host Mode...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          🎭 Host Mode
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Transform into the ultimate party host with AI-powered guidance
        </p>
      </div>

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

      {/* Activities Need Expansion */}
      {needsExpansion.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-orange-600" />
                  Expand Activities for Host Mode
                </CardTitle>
                <CardDescription>
                  These activities need AI expansion to be ready for Host Mode. Check your browser console for detailed debugging information.
                </CardDescription>
              </div>
              <Button
                onClick={() => {
                  // Clear all activities that need expansion
                  const activitiesToDelete = needsExpansion.map(a => a.id);
                  activitiesToDelete.forEach(activityId => deleteActivity(activityId));
                }}
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {needsExpansion.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border relative">
                  <div className="flex-1">
                    <h4 className="font-medium">{activity.name}</h4>
                    <p className="text-sm text-gray-600">{activity.estimatedTime} {activity.timeUnit}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => expandActivityForHostMode(activity.id)}
                      disabled={expanding === activity.id}
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      {expanding === activity.id ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      {expanding === activity.id ? 'Expanding...' : 'Expand'}
                    </Button>
                    <Button
                      onClick={() => deleteActivity(activity.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Host Mode Interface */}
      {(fullyExpandedActivities.length > 0 || basicExpandedActivities.length > 0) ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Activity Switcher Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Switch Activities
                </CardTitle>
                <CardDescription>
                  Click to switch between your Host Mode activities
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Fully Expanded Activities */}
                {fullyExpandedActivities.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">
                      ✨ Comprehensive Content
                    </div>
                    <div className="space-y-2">
                      {fullyExpandedActivities.map((activity) => (
                        <div
                          key={activity.id}
                          className={cn(
                            "p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-sm border-green-200 bg-green-50/50 dark:bg-green-900/10",
                            currentActivity?.id === activity.id 
                              ? "ring-2 ring-green-500 border-green-300" 
                              : "hover:bg-green-100/50 dark:hover:bg-green-900/20"
                          )}
                          onClick={() => setCurrentActivity(activity)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-xl">{activity.themeEmoji}</span>
                              <div className="min-w-0 flex-1">
                                <h4 className="font-medium text-sm truncate">{activity.name}</h4>
                                <div className="flex items-center gap-1 mt-1">
                                  <Badge 
                                    className={cn("text-xs px-1 py-0", getEnergyLevelColor(activity.energyLevel))}
                                  >
                                    {getEnergyLevelIcon(activity.energyLevel)}
                                  </Badge>
                                  <span className="text-xs text-gray-500">
                                    {activity.estimatedTime}m
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteActivity(activity.id);
                              }}
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0 h-6 w-6 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Basic Expanded Activities */}
                {basicExpandedActivities.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-2">
                      📝 Basic Host Mode
                    </div>
                    <div className="space-y-2">
                      {basicExpandedActivities.map((activity) => (
                        <div
                          key={activity.id}
                          className={cn(
                            "p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-sm border-orange-200 bg-orange-50/50 dark:bg-orange-900/10",
                            currentActivity?.id === activity.id 
                              ? "ring-2 ring-orange-500 border-orange-300" 
                              : "hover:bg-orange-100/50 dark:hover:bg-orange-900/20"
                          )}
                          onClick={() => setCurrentActivity(activity)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-xl">{activity.themeEmoji}</span>
                              <div className="min-w-0 flex-1">
                                <h4 className="font-medium text-sm truncate">{activity.name}</h4>
                                <div className="flex items-center gap-1 mt-1">
                                  <Badge 
                                    className={cn("text-xs px-1 py-0", getEnergyLevelColor(activity.energyLevel))}
                                  >
                                    {getEnergyLevelIcon(activity.energyLevel)}
                                  </Badge>
                                  <span className="text-xs text-gray-500">
                                    {activity.estimatedTime}m
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteActivity(activity.id);
                              }}
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0 h-6 w-6 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
              </CardContent>
            </Card>
          </div>

          {/* Main Host Display */}
          <div className="lg:col-span-3">
            {currentActivity ? (
              <Card className="min-h-[600px]">
                <CardHeader className="text-center bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-lg">
                  <div className="flex items-center justify-center mb-4">
                    <Badge className="bg-white/20 text-white">
                      🎭 Host Mode Active
                    </Badge>
                  </div>
                  <CardTitle className="text-2xl flex items-center justify-center gap-3">
                    <span className="text-3xl">{currentActivity.themeEmoji}</span>
                    {currentActivity.name}
                  </CardTitle>
                  <CardDescription className="text-purple-100">
                    {currentActivity.themeContext}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-6 space-y-6">

                  {/* Teleprompter Script */}
                  {/* Comprehensive AI Content Sections */}
                  {currentActivity.isFullyExpanded ? (
                    <div className="space-y-6">
                      {/* 1️⃣ Full Host Script */}
                      <Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Mic className="h-5 w-5 text-green-600" />
                            1️⃣ Full Host Script
                          </CardTitle>
                          <CardDescription className="text-green-600">
                            🎤 Host Read-Aloud Script (energetic, fun tone)
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="text-lg leading-relaxed space-y-4 font-medium">
                            {currentActivity.fullHostScript ? (
                              currentActivity.fullHostScript.split('\n').map((line, index) => (
                                <div key={index} className="py-2">
                                  {line.includes('[') && line.includes(']') ? (
                                    <div className="space-y-2">
                                      {line.split(/(\[.*?\])/).map((part, i) => (
                                        part.startsWith('[') && part.endsWith(']') ? (
                                          <div key={i} className="text-sm text-purple-600 italic bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                                            {part}
                                          </div>
                                        ) : part.trim() ? (
                                          <div key={i} className="text-gray-800 dark:text-gray-200">
                                            {part}
                                          </div>
                                        ) : null
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-gray-800 dark:text-gray-200">{line}</div>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="text-gray-600 italic">
                                Full host script will be generated when you expand this activity.
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* 2️⃣ Rules & Variations */}
                      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-blue-600" />
                            2️⃣ Rules & Variations
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {currentActivity.rulesAndVariations ? (
                            <div className="space-y-4">
                              {/* Base Rules */}
                              <div>
                                <h4 className="font-semibold text-blue-600 mb-2">Base Rules:</h4>
                                <ul className="space-y-1">
                                  {currentActivity.rulesAndVariations.baseRules?.map((rule, index) => (
                                    <li key={index} className="flex items-start gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                      <span>{rule}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* Age Variations */}
                              {currentActivity.rulesAndVariations.ageVariations && (
                                <div>
                                  <h4 className="font-semibold text-blue-600 mb-2">Age Variations:</h4>
                                  <div className="space-y-2">
                                    {Object.entries(currentActivity.rulesAndVariations.ageVariations).map(([age, description]) => (
                                      <div key={age} className="bg-white dark:bg-gray-800 p-3 rounded-lg border">
                                        <div className="font-medium text-sm text-blue-600 mb-1">
                                          {age.replace('_', ' ').replace(/([A-Z])/g, ' $1').trim()}:
                                        </div>
                                        <div className="text-sm">{description}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Group Size Adjustments */}
                              {currentActivity.rulesAndVariations.groupSizeAdjustments && (
                                <div>
                                  <h4 className="font-semibold text-blue-600 mb-2">Group Size Adjustments:</h4>
                                  <div className="space-y-2">
                                    {Object.entries(currentActivity.rulesAndVariations.groupSizeAdjustments).map(([size, description]) => (
                                      <div key={size} className="bg-white dark:bg-gray-800 p-3 rounded-lg border">
                                        <div className="font-medium text-sm text-blue-600 mb-1">
                                          {size.replace('_', ' ').replace(/([A-Z])/g, ' $1').trim()}:
                                        </div>
                                        <div className="text-sm">{description}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Space Adjustments */}
                              {currentActivity.rulesAndVariations.spaceAdjustments && (
                                <div>
                                  <h4 className="font-semibold text-blue-600 mb-2">Space Adjustments:</h4>
                                  <div className="space-y-2">
                                    {Object.entries(currentActivity.rulesAndVariations.spaceAdjustments).map(([space, description]) => (
                                      <div key={space} className="bg-white dark:bg-gray-800 p-3 rounded-lg border">
                                        <div className="font-medium text-sm text-blue-600 mb-1">
                                          {space.charAt(0).toUpperCase() + space.slice(1)}:
                                        </div>
                                        <div className="text-sm">{description}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-gray-600 italic">
                              Rules and variations will be generated when you expand this activity.
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* 3️⃣ Materials List */}
                      <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Package className="h-5 w-5 text-yellow-600" />
                            3️⃣ Materials List
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {currentActivity.materialsList ? (
                            <div className="space-y-4">
                              {/* Craft Materials */}
                              {(currentActivity.materialsList.craftMaterials?.length ?? 0) > 0 && (
                                <div>
                                  <h4 className="font-semibold text-yellow-600 mb-2">Craft Materials:</h4>
                                  <div className="space-y-2">
                                    {currentActivity.materialsList.craftMaterials?.map((material, index) => (
                                      <div key={index} className="flex items-start gap-3 bg-white dark:bg-gray-800 p-3 rounded-lg border">
                                        <Package className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1">
                                          <div className="font-medium">{material.item}</div>
                                          <div className="text-sm text-gray-600">Quantity: {material.quantity}</div>
                                          <div className="text-sm text-gray-500">{material.purpose}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Extras */}
                              {(currentActivity.materialsList.extras?.length ?? 0) > 0 && (
                                <div>
                                  <h4 className="font-semibold text-yellow-600 mb-2">Extras:</h4>
                                  <div className="space-y-2">
                                    {currentActivity.materialsList.extras?.map((extra, index) => (
                                      <div key={index} className="flex items-start gap-3 bg-white dark:bg-gray-800 p-3 rounded-lg border">
                                        <Star className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1">
                                          <div className="font-medium">{extra.item}</div>
                                          <div className="text-sm text-gray-500">{extra.purpose}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Prep Reminders */}
                              {(currentActivity.materialsList.prepReminders?.length ?? 0) > 0 && (
                                <div>
                                  <h4 className="font-semibold text-yellow-600 mb-2">Prep Reminders:</h4>
                                  <div className="space-y-1">
                                    {currentActivity.materialsList.prepReminders?.map((reminder, index) => (
                                      <div key={index} className="flex items-start gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                                        <span className="text-sm">{reminder}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-gray-600 italic">
                              Materials list will be generated when you expand this activity.
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* 4️⃣ Optional Extras for Parents */}
                      <Card className="border-purple-200 bg-purple-50 dark:bg-purple-900/20">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Clock className="h-5 w-5 text-purple-600" />
                            4️⃣ Optional Extras for Parents
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {currentActivity.optionalExtras ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
                                <div className="font-semibold text-purple-600 mb-1">Prep Time:</div>
                                <div className="text-sm">{currentActivity.optionalExtras.prepTime}</div>
                              </div>
                              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
                                <div className="font-semibold text-purple-600 mb-1">Play Time:</div>
                                <div className="text-sm">{currentActivity.optionalExtras.playTime}</div>
                              </div>
                              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
                                <div className="font-semibold text-purple-600 mb-1">Mess Factor:</div>
                                <div className="text-sm">{currentActivity.optionalExtras.messFactor}</div>
                              </div>
                              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
                                <div className="font-semibold text-purple-600 mb-1">Adult Involvement:</div>
                                <div className="text-sm">{currentActivity.optionalExtras.adultInvolvement}</div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-600 italic">
                              Optional extras for parents will be generated when you expand this activity.
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    /* Original Host Script (Basic Expansion) */
                    <Card className="bg-gray-50 dark:bg-gray-800">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Mic className="h-5 w-5" />
                          Basic Host Script
                        </CardTitle>
                        <CardDescription>
                          Click "Expand" above to generate comprehensive activity content with all 4 sections.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-lg leading-relaxed space-y-4 font-medium">
                          {currentActivity.stepByStepScript ? (
                            currentActivity.stepByStepScript.split('\n').map((line, index) => (
                              <div key={index} className="py-2">
                                {line.includes('[') && line.includes(']') ? (
                                  <div className="space-y-2">
                                    {line.split(/(\[.*?\])/).map((part, i) => (
                                      part.startsWith('[') && part.endsWith(']') ? (
                                        <div key={i} className="text-sm text-purple-600 italic bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                                          {part}
                                        </div>
                                      ) : part.trim() ? (
                                        <div key={i} className="text-gray-800 dark:text-gray-200">
                                          {part}
                                        </div>
                                      ) : null
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-gray-800 dark:text-gray-200">{line}</div>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="text-gray-600 italic">
                              {currentActivity.hostScript || 'No script available. Click "Expand for Host Mode" to generate one.'}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}


                  {/* Activity Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentActivity.supplies.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Supplies Needed</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-1">
                            {currentActivity.supplies.map((supply, index) => (
                              <li key={index} className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                {supply}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                    
                    {currentActivity.groupInstructions && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Group Setup</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-gray-700 dark:text-gray-300">
                            {currentActivity.groupInstructions}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="min-h-[600px] flex items-center justify-center">
                <CardContent className="text-center">
                  <Crown className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Ready to Host?</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Select an activity from the sidebar to begin your hosting experience
                  </p>
                  <div className="text-sm text-purple-600 bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                    👈 Click any activity in the sidebar to get started with AI-powered hosting guidance
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <div className="space-y-4">
              <Crown className="h-16 w-16 text-gray-400 mx-auto" />
              <h3 className="text-xl font-semibold">No Activities Selected for Host Mode</h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                Visit the Activities tab, select the activities you want to include, and click "Add to Host Mode" to begin your hosting experience!
              </p>
              <div className="text-sm text-gray-500 mt-2">
                💡 Tip: Select activities in the Activities tab and click the orange "Add to Host Mode" button
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}