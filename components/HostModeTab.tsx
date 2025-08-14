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
  Crown,
  Zap,
  Star,
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
}

interface HostModeTabProps {
  partyId: string;
  partyData?: {
    childName: string;
    childAge: number;
    theme: string;
    interests: string[];
    favoriteColors: string[];
    venue?: string;
    guestCount?: number;
  };
}

export default function HostModeTab({ partyId, partyData }: HostModeTabProps) {
  const [activities, setActivities] = useState<HostModeActivity[]>([]);
  const [currentActivity, setCurrentActivity] = useState<HostModeActivity | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanding, setExpanding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);


  // Load activities on mount
  useEffect(() => {
    loadActivities();
  }, [partyId]);


  const loadActivities = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/party-activities?partyId=${partyId}`);
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
        
        // Set first selected Host Mode ready activity as current
        const selectedHostModeActivity = data.activities?.find((a: HostModeActivity) => a.isHostModeReady && a.isSelected);
        if (selectedHostModeActivity) {
          setCurrentActivity(selectedHostModeActivity);
        } else {
          // Clear current activity if no selected activities are found
          setCurrentActivity(null);
        }
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
    
    try {
      const response = await fetch('/api/host-mode-expand', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partyId,
          activityId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update the activity in the local state
        setActivities(prev => 
          prev.map(a => a.id === activityId ? { ...a, ...data.activity } : a)
        );
        
        // If this was the current activity, update it
        if (currentActivity?.id === activityId) {
          setCurrentActivity({ ...currentActivity, ...data.activity });
        }
        
        setSuccess('Activity expanded for Host Mode!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Failed to expand activity');
      }
    } catch (error) {
      setError('Error expanding activity');
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


  const hostModeActivities = activities.filter(a => a.isHostModeReady && a.isSelected);
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
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-600" />
              Expand Activities for Host Mode
            </CardTitle>
            <CardDescription>
              These activities need AI expansion to be ready for Host Mode
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {needsExpansion.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border">
                  <div>
                    <h4 className="font-medium">{activity.name}</h4>
                    <p className="text-sm text-gray-600">{activity.estimatedTime} {activity.timeUnit}</p>
                  </div>
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
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Host Mode Interface */}
      {hostModeActivities.length > 0 ? (
        <div className="space-y-6">
          {/* Activities List - Hidden Section */}
          <div className="hidden">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Your Host Mode Activities
                </CardTitle>
                <CardDescription>
                  Select an activity to host or delete activities you no longer need
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {hostModeActivities.map((activity) => (
                    <Card 
                      key={activity.id} 
                      className={cn(
                        "cursor-pointer transition-all duration-200 hover:shadow-md",
                        currentActivity?.id === activity.id ? "ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/20" : ""
                      )}
                      onClick={() => setCurrentActivity(activity)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-2xl">{activity.themeEmoji}</span>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-medium truncate">{activity.name}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge 
                                  className={cn("text-xs", getEnergyLevelColor(activity.energyLevel))}
                                >
                                  {getEnergyLevelIcon(activity.energyLevel)}
                                  {activity.energyLevel.toLowerCase()}
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
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Host Display */}
          <div>
            {currentActivity ? (
              <Card className="min-h-[600px]">
                <CardHeader className="text-center bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-lg">
                  <div className="flex items-center justify-center mb-4">
                    <Badge className="bg-white/20 text-white">
                      Host Mode Active
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
                  <Card className="bg-gray-50 dark:bg-gray-800">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Mic className="h-5 w-5" />
                        Your Host Script
                      </CardTitle>
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