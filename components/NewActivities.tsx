"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Wand2,
  Sparkles,
  RefreshCw,
  Clock,
  Users,
  Star,
  Lightbulb,
  PartyPopper,
  Settings,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Gamepad2,
  Paintbrush,
  Music,
  TreePine,
  Play,
  Zap,
  Heart,
  Trophy,
  Gift,
  Download,
  Share2,
  Calendar,
  MapPin,
  DollarSign,
  Target
} from "lucide-react";

interface ActivitySuggestion {
  id: string;
  name: string;
  category: 'game' | 'craft' | 'creative' | 'active' | 'quiet' | 'educational';
  difficulty: 'easy' | 'medium' | 'advanced';
  duration: string;
  ageAppropriate: string;
  participants: string;
  description: string;
  materials: string[];
  instructions: string[];
  tips: string[];
  safetyNotes?: string[];
  energyLevel: 'low' | 'medium' | 'high';
  setupTime: string;
  cost: 'free' | 'low' | 'medium' | 'high';
}

interface ActivitiesProps {
  theme: string;
  childAge: number;
  guestCount: number;
  partyId: string;
  budget?: 'low' | 'medium' | 'high';
  venue?: 'indoor' | 'outdoor' | 'mixed';
  duration?: string;
}

const categoryIcons = {
  game: <Gamepad2 className="h-4 w-4" />,
  craft: <Paintbrush className="h-4 w-4" />,
  creative: <Star className="h-4 w-4" />,
  active: <Zap className="h-4 w-4" />,
  quiet: <BookOpen className="h-4 w-4" />,
  educational: <Trophy className="h-4 w-4" />
};

const categoryColors = {
  game: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  craft: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
  creative: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
  active: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
  quiet: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
  educational: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-200'
};

const difficultyColors = {
  easy: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  advanced: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
};

const energyColors = {
  low: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-200',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
};

const costColors = {
  free: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
  high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
};

export default function NewActivities({ 
  theme, 
  childAge, 
  guestCount, 
  partyId,
  budget = 'medium',
  venue = 'mixed',
  duration = '2-3 hours'
}: ActivitiesProps) {
  const [activities, setActivities] = useState<ActivitySuggestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customRequests, setCustomRequests] = useState('');
  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(new Set());
  const [currentView, setCurrentView] = useState<'generator' | 'suggestions' | 'selected'>('generator');

  // Generate AI-powered activity suggestions
  const generateActivities = async () => {
    if (!partyId) {
      setError('Party ID is required to generate activities');
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);

      const requestData = {
        theme,
        childAge,
        guestCount,
        budget,
        venue,
        duration,
        customRequests: customRequests.trim() || undefined
      };

      console.log('Generating activities with data:', requestData);

      const response = await fetch(`/api/parties/${partyId}/activities/generate-new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to generate activities (${response.status})`);
      }

      const data = await response.json();
      
      if (!data.activities || !Array.isArray(data.activities)) {
        throw new Error('Invalid response format from activity generator');
      }

      setActivities(data.activities);
      setCurrentView('suggestions');

    } catch (error) {
      console.error('Error generating activities:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate activities');
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle activity selection
  const toggleActivitySelection = (activityId: string) => {
    const newSelection = new Set(selectedActivities);
    if (newSelection.has(activityId)) {
      newSelection.delete(activityId);
    } else {
      newSelection.add(activityId);
    }
    setSelectedActivities(newSelection);
  };

  // Save selected activities
  const saveSelectedActivities = async () => {
    if (selectedActivities.size === 0) {
      setError('Please select at least one activity to save');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const selectedActivityData = activities.filter(activity => 
        selectedActivities.has(activity.id)
      );

      const response = await fetch(`/api/parties/${partyId}/activities/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          activities: selectedActivityData,
          partyConfiguration: {
            theme,
            childAge,
            guestCount,
            budget,
            venue,
            duration,
            customRequests
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save activities');
      }

      setCurrentView('selected');
      
    } catch (error) {
      console.error('Error saving activities:', error);
      setError(error instanceof Error ? error.message : 'Failed to save activities');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedActivityList = activities.filter(activity => 
    selectedActivities.has(activity.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-blue-900/20 p-6 rounded-xl border border-purple-200 dark:border-purple-700">
        <div className="flex items-center justify-center gap-3 mb-3">
          <Wand2 className="h-8 w-8 text-purple-600 dark:text-purple-400" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
            AI Activity Planner
          </h1>
          <Sparkles className="h-8 w-8 text-pink-600 dark:text-pink-400" />
        </div>
        <p className="text-lg text-purple-700 dark:text-purple-300 font-medium">
          Get personalized activity suggestions powered by GPT for your {theme} party
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={currentView} onValueChange={(value) => setCurrentView(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="generator" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configure
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="flex items-center gap-2" disabled={activities.length === 0}>
            <Lightbulb className="h-4 w-4" />
            AI Suggestions ({activities.length})
          </TabsTrigger>
          <TabsTrigger value="selected" className="flex items-center gap-2" disabled={selectedActivities.size === 0}>
            <CheckCircle2 className="h-4 w-4" />
            Selected ({selectedActivities.size})
          </TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="generator" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Party Details
              </CardTitle>
              <CardDescription>
                Tell us about your party for personalized activity suggestions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Party Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <div className="text-center">
                  <PartyPopper className="h-6 w-6 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Theme</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100 capitalize">{theme}</div>
                </div>
                <div className="text-center">
                  <Users className="h-6 w-6 text-green-600 dark:text-green-400 mx-auto mb-2" />
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Age</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{childAge} years old</div>
                </div>
                <div className="text-center">
                  <Users className="h-6 w-6 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Guests</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{guestCount} kids</div>
                </div>
                <div className="text-center">
                  <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400 mx-auto mb-2" />
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Duration</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{duration}</div>
                </div>
              </div>

              {/* Custom Requests */}
              <div className="space-y-3">
                <Label htmlFor="customRequests">Special Requests & Preferences</Label>
                <Textarea
                  id="customRequests"
                  placeholder="Tell us what you'd like! For example: outdoor games, no messy crafts, educational activities, specific interests, allergies to consider, or any other special requirements..."
                  value={customRequests}
                  onChange={(e) => setCustomRequests(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  The more details you provide, the better our AI can customize activities for your party!
                </p>
              </div>

              {/* Generate Button */}
              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={generateActivities} 
                  disabled={isGenerating}
                  className="flex-1 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white text-lg py-6"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                      Generating Amazing Activities...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" />
                      Generate AI Activity Suggestions
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Suggestions Tab */}
        <TabsContent value="suggestions" className="space-y-6">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <RefreshCw className="h-16 w-16 animate-spin text-purple-600 dark:text-purple-400" />
              <div>
                <h3 className="text-xl font-bold">Creating Your Perfect Activities</h3>
                <p className="text-gray-600 dark:text-gray-300">Our AI is crafting personalized suggestions just for you...</p>
              </div>
            </div>
          ) : activities.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Lightbulb className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-3">Ready to Generate Activities?</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Configure your party details and click "Generate AI Activity Suggestions" to get started!
                </p>
                <Button onClick={() => setCurrentView('generator')} className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                  <Settings className="h-4 w-4 mr-2" />
                  Go to Configuration
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">AI Activity Suggestions</h2>
                  <p className="text-gray-600 dark:text-gray-300">
                    {activities.length} personalized activities for your {theme} party
                  </p>
                </div>
                {selectedActivities.size > 0 && (
                  <Button 
                    onClick={saveSelectedActivities}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 text-white"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Save Selected ({selectedActivities.size})
                      </>
                    )}
                  </Button>
                )}
              </div>

              <div className="grid gap-6">
                {activities.map((activity, index) => (
                  <Card 
                    key={activity.id} 
                    className={`border-2 transition-all duration-200 hover:shadow-lg ${
                      selectedActivities.has(activity.id) 
                        ? 'border-green-300 bg-green-50 dark:border-green-600 dark:bg-green-900/20' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                    }`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="flex-shrink-0">
                            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full w-10 h-10 flex items-center justify-center text-lg font-bold">
                              {index + 1}
                            </div>
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-xl mb-2">{activity.name}</CardTitle>
                            <CardDescription className="text-base mb-3">
                              {activity.description}
                            </CardDescription>
                            <div className="flex flex-wrap gap-2">
                              <Badge className={categoryColors[activity.category]}>
                                {categoryIcons[activity.category]}
                                <span className="ml-1 capitalize">{activity.category}</span>
                              </Badge>
                              <Badge className={difficultyColors[activity.difficulty]}>
                                {activity.difficulty}
                              </Badge>
                              <Badge className={energyColors[activity.energyLevel]}>
                                {activity.energyLevel} energy
                              </Badge>
                              <Badge className={costColors[activity.cost]}>
                                {activity.cost === 'free' ? 'Free!' : `${activity.cost} cost`}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Button
                          onClick={() => toggleActivitySelection(activity.id)}
                          variant={selectedActivities.has(activity.id) ? 'default' : 'outline'}
                          className={selectedActivities.has(activity.id) 
                            ? 'bg-green-600 hover:bg-green-700 text-white' 
                            : 'border-purple-300 hover:bg-purple-50 dark:border-purple-600'
                          }
                        >
                          {selectedActivities.has(activity.id) ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Selected
                            </>
                          ) : (
                            'Select'
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Activity Details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <span>{activity.duration}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-green-600" />
                          <span>{activity.participants}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-600" />
                          <span>{activity.ageAppropriate}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Settings className="h-4 w-4 text-purple-600" />
                          <span>Setup: {activity.setupTime}</span>
                        </div>
                      </div>

                      <Separator />

                      {/* Materials */}
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <Gift className="h-4 w-4" />
                          Materials Needed:
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {activity.materials.map((material, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {material}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Instructions */}
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          Instructions:
                        </h4>
                        <ol className="list-decimal list-inside space-y-1 text-sm">
                          {activity.instructions.map((instruction, idx) => (
                            <li key={idx} className="text-gray-700 dark:text-gray-300">
                              {instruction}
                            </li>
                          ))}
                        </ol>
                      </div>

                      {/* Tips */}
                      {activity.tips.length > 0 && (
                        <Alert>
                          <Lightbulb className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Pro Tips:</strong>
                            <ul className="mt-2 space-y-1 text-xs">
                              {activity.tips.map((tip, idx) => (
                                <li key={idx}>• {tip}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Safety Notes */}
                      {activity.safetyNotes && activity.safetyNotes.length > 0 && (
                        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Safety Notes:</strong>
                            <ul className="mt-2 space-y-1 text-xs">
                              {activity.safetyNotes.map((note, idx) => (
                                <li key={idx}>• {note}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Selection Summary */}
              {selectedActivities.size > 0 && (
                <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="font-semibold">
                          {selectedActivities.size} activities selected for your party
                        </span>
                      </div>
                      <Button 
                        onClick={saveSelectedActivities}
                        disabled={isLoading}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 text-white"
                      >
                        {isLoading ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Save Activities
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Selected Activities Tab */}
        <TabsContent value="selected" className="space-y-6">
          {selectedActivityList.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <CheckCircle2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-3">No Activities Selected Yet</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Select activities from the AI suggestions to create your personalized party plan.
                </p>
                <Button 
                  onClick={() => setCurrentView('suggestions')} 
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                  disabled={activities.length === 0}
                >
                  <Lightbulb className="h-4 w-4 mr-2" />
                  View AI Suggestions
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">Your Selected Activities</h2>
                  <p className="text-gray-600 dark:text-gray-300">
                    {selectedActivityList.length} activities ready for your {theme} party
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Download Plan
                  </Button>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Share2 className="h-4 w-4" />
                    Share Plan
                  </Button>
                </div>
              </div>

              <div className="grid gap-4">
                {selectedActivityList.map((activity, index) => (
                  <Card key={activity.id} className="border-green-200 bg-green-50 dark:border-green-600 dark:bg-green-900/10">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-lg">{activity.name}</CardTitle>
                          <div className="flex gap-2 mt-1">
                            <Badge className={categoryColors[activity.category]}>
                              {categoryIcons[activity.category]}
                              <span className="ml-1 capitalize">{activity.category}</span>
                            </Badge>
                            <Badge variant="outline">{activity.duration}</Badge>
                            <Badge variant="outline">{activity.participants}</Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActivitySelection(activity.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Remove
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>

              {/* Party Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Suggested Party Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedActivityList.map((activity, index) => (
                      <div key={activity.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-500">
                            {index * 15 + 10} min
                          </span>
                          <span className="font-medium">{activity.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {activity.duration}
                          </Badge>
                        </div>
                        <Badge className={energyColors[activity.energyLevel]}>
                          {activity.energyLevel}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}