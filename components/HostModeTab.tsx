"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  SkipForward,
  Volume2,
  VolumeX,
  Timer,
  Sparkles,
  Mic,
  Users,
  CheckCircle2,
  AlertCircle,
  Shuffle,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Crown,
  Zap,
  Star,
  Heart,
  Lightbulb,
  Music,
  Speaker
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

  // Timer and control states
  const [isRunning, setIsRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Audio states
  const [isMuted, setIsMuted] = useState(false);
  const [currentSoundCue, setCurrentSoundCue] = useState<string | null>(null);

  // Load activities on mount
  useEffect(() => {
    loadActivities();
  }, [partyId]);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning && !isPaused && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            setTimeRemaining(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, isPaused, timeRemaining]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/party-activities?partyId=${partyId}`);
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
        
        // Set first Host Mode ready activity as current
        const hostModeActivity = data.activities?.find((a: HostModeActivity) => a.isHostModeReady);
        if (hostModeActivity) {
          setCurrentActivity(hostModeActivity);
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

  const startActivity = (activity: HostModeActivity) => {
    if (!activity.estimatedTime) return;
    
    const timeInSeconds = activity.timeUnit === 'hours' 
      ? activity.estimatedTime * 3600 
      : activity.estimatedTime * 60;
    
    setCurrentActivity(activity);
    setTotalTime(timeInSeconds);
    setTimeRemaining(timeInSeconds);
    setIsRunning(true);
    setIsPaused(false);
  };

  const pauseResume = () => {
    setIsPaused(!isPaused);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setIsPaused(false);
    setTimeRemaining(totalTime);
  };

  const switchActivity = (energyLevel?: string) => {
    const filteredActivities = energyLevel 
      ? activities.filter(a => a.energyLevel === energyLevel && a.isHostModeReady)
      : activities.filter(a => a.isHostModeReady);
    
    if (filteredActivities.length > 0) {
      const randomActivity = filteredActivities[Math.floor(Math.random() * filteredActivities.length)];
      setCurrentActivity(randomActivity);
      setIsRunning(false);
      setTimeRemaining(0);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  const playSound = (cue: string) => {
    if (!isMuted) {
      setCurrentSoundCue(cue);
      
      // Basic sound feedback - could be enhanced with actual audio files
      try {
        // Create a simple audio context for sound feedback
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Map sound cues to frequencies for demonstration
        const soundMap: { [key: string]: number } = {
          'music': 523, // C5
          'fanfare': 659, // E5
          'victory': 784, // G5
          'cheer': 880, // A5
          'whoosh': 440, // A4
          'applause': 330, // E4
          'drum': 220, // A3
          'bell': 1047, // C6
        };
        
        // Find matching frequency
        let frequency = 523; // Default C5
        for (const [key, freq] of Object.entries(soundMap)) {
          if (cue.toLowerCase().includes(key)) {
            frequency = freq;
            break;
          }
        }
        
        // Create and play tone
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
        
      } catch (error) {
        // Fallback for browsers without Web Audio API
        console.log('🎵 Sound cue:', cue);
      }
      
      setTimeout(() => setCurrentSoundCue(null), 2000);
    }
  };

  const hostModeActivities = activities.filter(a => a.isHostModeReady);
  const needsExpansion = activities.filter(a => !a.isHostModeReady);

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity Selection Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Activity Selection
                </CardTitle>
                <CardDescription>
                  Choose your next activity or let AI decide
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => switchActivity('CALM')}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    😌 Calm
                  </Button>
                  <Button
                    onClick={() => switchActivity('ACTIVE')}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    ⚡ Active
                  </Button>
                  <Button
                    onClick={() => switchActivity('HIGH_ENERGY')}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    🔥 High Energy
                  </Button>
                  <Button
                    onClick={() => switchActivity()}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    <Shuffle className="h-3 w-3 mr-1" />
                    Random
                  </Button>
                </div>
                
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {hostModeActivities.map((activity) => (
                    <Button
                      key={activity.id}
                      onClick={() => setCurrentActivity(activity)}
                      variant={currentActivity?.id === activity.id ? "default" : "outline"}
                      className="w-full justify-start text-left p-3 h-auto"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <span className="text-lg">{activity.themeEmoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{activity.name}</div>
                          <div className="flex items-center gap-1 mt-1">
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
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Host Display */}
          <div className="lg:col-span-2">
            {currentActivity ? (
              <Card className="min-h-[600px]">
                <CardHeader className="text-center bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-white/20 text-white">
                      Host Mode Active
                    </Badge>
                    <Button
                      onClick={() => setIsMuted(!isMuted)}
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-white/20"
                    >
                      {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
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
                  {/* Timer Controls */}
                  <div className="text-center space-y-4">
                    <div className="text-6xl font-mono font-bold text-purple-600">
                      {formatTime(timeRemaining)}
                    </div>
                    
                    {totalTime > 0 && (
                      <Progress 
                        value={totalTime > 0 ? ((totalTime - timeRemaining) / totalTime) * 100 : 0} 
                        className="h-3"
                      />
                    )}
                    
                    <div className="flex justify-center gap-3">
                      {!isRunning ? (
                        <Button
                          onClick={() => startActivity(currentActivity)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Start Activity
                        </Button>
                      ) : (
                        <Button
                          onClick={pauseResume}
                          variant="outline"
                        >
                          {isPaused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                          {isPaused ? 'Resume' : 'Pause'}
                        </Button>
                      )}
                      
                      <Button
                        onClick={resetTimer}
                        variant="outline"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset
                      </Button>
                      
                      <Button
                        onClick={() => switchActivity(currentActivity.energyLevel)}
                        variant="outline"
                      >
                        <SkipForward className="h-4 w-4 mr-2" />
                        Switch Activity
                      </Button>
                    </div>
                  </div>

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

                  {/* Sound Cues */}
                  {currentActivity.soundCues && currentActivity.soundCues.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Music className="h-5 w-5" />
                          Sound Cues
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {currentActivity.soundCues.map((cue, index) => (
                            <Button
                              key={index}
                              onClick={() => playSound(cue)}
                              variant="outline"
                              className="text-left justify-start h-auto p-3"
                            >
                              <Speaker className="h-4 w-4 mr-2 flex-shrink-0" />
                              <span className="text-sm">{cue}</span>
                            </Button>
                          ))}
                        </div>
                        
                        {currentSoundCue && (
                          <Alert className="mt-3 border-blue-200 bg-blue-50 text-blue-800">
                            <Music className="h-4 w-4" />
                            <AlertDescription>
                              🎵 Now playing: {currentSoundCue}
                            </AlertDescription>
                          </Alert>
                        )}
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
              <h3 className="text-xl font-semibold">No Host Mode Activities</h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                You need to expand your activities for Host Mode first. Visit the Activities tab and generate some activities!
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}