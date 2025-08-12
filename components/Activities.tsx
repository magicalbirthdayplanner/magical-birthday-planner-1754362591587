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
  Music, 
  Users, 
  Trophy, 
  Paintbrush, 
  Gamepad2, 
  Camera, 
  Star,
  Clock,
  Heart,
  Shuffle,
  Sparkles,
  Play,
  MapPin,
  DollarSign,
  Calendar,
  Settings,
  Target,
  Zap,
  Download,
  BookOpen,
  Lightbulb,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Info,
  TreePine,
  Home,
  Sun,
  Package,
  PartyPopper,
  Smile,
  Plus
} from "lucide-react";

interface PartyVibeConfig {
  theme: string;
  ageGroup: string;
  numberOfKids: number;
  totalDuration: string;
  setting: 'indoor' | 'outdoor' | 'mixed';
  availableMaterials: string[];
  budgetLevel: 'low' | 'medium' | 'high';
  specialRequests: string[];
  customText?: string;
}

interface ActivityPlan {
  id: string;
  name: string;
  category: 'game' | 'craft' | 'dance' | 'quiet' | 'outdoor' | 'educational';
  difficulty: 'easy' | 'medium' | 'hard';
  timeEstimate: string;
  bestGroupSize: string;
  instructions: string[];
  materials: string[];
  materialAlternatives: Record<string, string[]>;
  energyLevel: 'high' | 'medium' | 'calm';
  sequence: number;
}

interface ActivitiesProps {
  theme: string;
  childAge: number;
  guestCount?: number;
  partyId: string;
}

const categoryIcons = {
  game: <Gamepad2 className="h-5 w-5" />,
  craft: <Paintbrush className="h-5 w-5" />,
  dance: <Music className="h-5 w-5" />,
  quiet: <BookOpen className="h-5 w-5" />,
  outdoor: <TreePine className="h-5 w-5" />,
  educational: <Star className="h-5 w-5" />
};

const categoryColors = {
  game: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
  craft: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
  dance: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-200',
  quiet: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200',
  outdoor: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
  educational: 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800 text-pink-800 dark:text-pink-200'
};

const energyColors = {
  high: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  calm: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
};

const difficultyColors = {
  easy: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  hard: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
};

// Default party activity templates based on theme and age
const generateDefaultActivities = (theme: string, ageGroup: string, numberOfKids: number): ActivityPlan[] => {
  const ageNum = parseInt(ageGroup.split('-')[0]) || 5;
  const isToddler = ageNum <= 3;
  const isPreschool = ageNum >= 4 && ageNum <= 6;
  const isSchoolAge = ageNum >= 7;

  const baseActivities: ActivityPlan[] = [
    {
      id: '1',
      name: `${theme.charAt(0).toUpperCase() + theme.slice(1)} Themed Treasure Hunt`,
      category: 'game',
      difficulty: isToddler ? 'easy' : 'medium',
      timeEstimate: '20-30 minutes',
      bestGroupSize: `4-${Math.min(numberOfKids, 15)} kids`,
      instructions: [
        'Hide themed treasures around the party area',
        'Give each child a treasure map or clue list',
        'Guide younger children, let older ones work independently',
        'Celebrate each discovery with cheers and high-fives',
        'End with everyone sharing their favorite find'
      ],
      materials: ['Themed treasures/toys', 'Maps or clue cards', 'Small bags for collecting', 'Stickers as rewards'],
      materialAlternatives: {
        'Themed treasures/toys': ['Wrapped candy', 'Small household items painted in theme colors', 'Homemade themed cutouts'],
        'Maps or clue cards': ['Hand-drawn maps', 'Picture clues for non-readers', 'Riddles written on paper'],
        'Small bags for collecting': ['Paper lunch bags', 'Plastic containers', 'Pillowcases']
      },
      energyLevel: 'high',
      sequence: 1
    },
    {
      id: '2',
      name: `Create Your Own ${theme.charAt(0).toUpperCase() + theme.slice(1)} Masterpiece`,
      category: 'craft',
      difficulty: 'easy',
      timeEstimate: '25-35 minutes',
      bestGroupSize: `1-${numberOfKids} kids`,
      instructions: [
        'Set up craft stations with all materials organized',
        'Show examples but encourage creativity',
        'Help younger children with difficult steps',
        'Let each child personalize their creation',
        'Have a show-and-tell at the end'
      ],
      materials: ['Craft supplies', 'Glue sticks', 'Child-safe scissors', 'Crayons/markers', 'Decorative items'],
      materialAlternatives: {
        'Craft supplies': ['Cardboard from boxes', 'Toilet paper tubes', 'Construction paper', 'Paper plates'],
        'Decorative items': ['Buttons', 'Cotton balls', 'Aluminum foil', 'Stickers from around the house']
      },
      energyLevel: 'calm',
      sequence: 2
    },
    {
      id: '3',
      name: `${theme.charAt(0).toUpperCase() + theme.slice(1)} Dance Party Freeze`,
      category: 'dance',
      difficulty: 'easy',
      timeEstimate: '15-20 minutes',
      bestGroupSize: `3-${numberOfKids} kids`,
      instructions: [
        'Play upbeat themed music',
        'Demonstrate fun theme-related dance moves',
        'When music stops, everyone freezes like a statue',
        'Add fun poses related to the theme',
        'Give everyone a chance to show their best freeze pose'
      ],
      materials: ['Themed music playlist', 'Speaker or music player', 'Optional: themed props'],
      materialAlternatives: {
        'Themed music playlist': ['YouTube playlists on phone', 'Radio with theme-appropriate music', 'Kids singing together'],
        'Speaker or music player': ['Phone speaker', 'Laptop speakers', 'Singing without music']
      },
      energyLevel: 'high',
      sequence: 3
    },
    {
      id: '4',
      name: `${theme.charAt(0).toUpperCase() + theme.slice(1)} Story Circle`,
      category: 'quiet',
      difficulty: 'easy',
      timeEstimate: '15-20 minutes',
      bestGroupSize: `3-${numberOfKids} kids`,
      instructions: [
        'Gather everyone in a cozy circle',
        'Start a themed story with 2-3 sentences',
        'Each child adds one sentence to continue the story',
        'Keep it lighthearted and fun',
        'End with applause for the group story creation'
      ],
      materials: ['Comfortable seating', 'Optional: themed props for inspiration'],
      materialAlternatives: {
        'Comfortable seating': ['Pillows from couch', 'Blankets on floor', 'Sitting in grass outside'],
        'themed props': ['Toys related to theme', 'Pictures from books', 'Drawings made earlier']
      },
      energyLevel: 'calm',
      sequence: 4
    }
  ];

  if (numberOfKids >= 8) {
    baseActivities.push({
      id: '5',
      name: `${theme.charAt(0).toUpperCase() + theme.slice(1)} Team Challenge`,
      category: 'game',
      difficulty: 'medium',
      timeEstimate: '25-30 minutes',
      bestGroupSize: `8-${numberOfKids} kids`,
      instructions: [
        'Divide into 2-3 teams of equal size',
        'Set up themed challenges at different stations',
        'Teams rotate through each challenge',
        'Focus on fun and teamwork over competition',
        'Celebrate all teams with themed stickers or high-fives'
      ],
      materials: ['Station markers', 'Themed challenge props', 'Timer', 'Team name tags'],
      materialAlternatives: {
        'Station markers': ['Colored paper signs', 'Cones made from paper', 'Chairs as markers'],
        'Team name tags': ['Colored stickers', 'Hand-drawn badges', 'Colored ribbons'],
        'Timer': ['Phone timer', 'Kitchen timer', 'Counting aloud'],
        'Themed challenge props': ['Household items', 'DIY obstacles', 'Simple games']
      },
      energyLevel: 'high',
      sequence: 5
    });
  }

  return baseActivities.slice(0, Math.min(6, baseActivities.length));
};

export default function Activities({ theme, childAge, guestCount = 8, partyId }: ActivitiesProps) {
  const [currentView, setCurrentView] = useState<'genie' | 'activities' | 'playbook'>('genie');
  const [partyVibe, setPartyVibe] = useState<PartyVibeConfig>({
    theme: theme || 'superhero',
    ageGroup: `${childAge}-${childAge + 2}`,
    numberOfKids: guestCount,
    totalDuration: '2-3 hours',
    setting: 'mixed',
    availableMaterials: [],
    budgetLevel: 'medium',
    specialRequests: [],
    customText: ''
  });
  const [activityPlan, setActivityPlan] = useState<ActivityPlan[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [customMaterial, setCustomMaterial] = useState('');
  const [customRequest, setCustomRequest] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Guard against missing partyId
  if (!partyId || partyId.trim() === '') {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Party ID Required</h3>
          <p className="text-muted-foreground mb-6">
            Unable to load activities. Please ensure you have a valid party selected.
          </p>
          <Button onClick={() => window.location.href = '/dashboard'}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Load existing data on component mount
  useEffect(() => {
    loadExistingData();
  }, [partyId]);

  const loadExistingData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Loading activity data for party:', partyId);
      
      const response = await fetch(`/api/parties/${partyId}/activities`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Activity data loaded successfully:', data);
        
        if (data.vibeConfig) {
          setPartyVibe({
            theme: data.vibeConfig.theme || theme || 'superhero',
            ageGroup: data.vibeConfig.ageGroup || `${childAge}-${childAge + 2}`,
            numberOfKids: data.vibeConfig.numberOfKids || guestCount,
            totalDuration: data.vibeConfig.totalDuration || '2-3 hours',
            setting: (data.vibeConfig.setting || 'mixed').toLowerCase(),
            availableMaterials: data.vibeConfig.availableMaterials || [],
            budgetLevel: (data.vibeConfig.budgetLevel || 'medium').toLowerCase(),
            specialRequests: data.vibeConfig.specialRequests || [],
            customText: data.vibeConfig.customText || ''
          });
          
          if (data.vibeConfig.activityPlans && data.vibeConfig.activityPlans.length > 0) {
            setActivityPlan(data.vibeConfig.activityPlans.map((plan: any) => ({
              ...plan,
              category: (plan.category || 'GAME').toLowerCase(),
              difficulty: (plan.difficulty || 'EASY').toLowerCase(),
              energyLevel: (plan.energyLevel || 'MEDIUM').toLowerCase()
            })));
          }
        }
      } else {
        // Parse error response for better error handling
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          errorData = { error: 'Unknown error', message: 'Unable to parse error response' };
        }
        
        console.warn('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });

        if (response.status === 404) {
          // Party not found or no existing data - this could be normal for new parties
          console.log('No existing activity data found for party:', partyId);
          
          // Check if it's truly a party not found error vs just no activity data
          if (errorData.error === 'Party not found') {
            setError(`Party not found. Please make sure you have a valid party selected. Error: ${errorData.message || 'The party does not exist.'}`);
          } else {
            // No activity data yet, which is normal
            console.log('Party exists but no activity configuration found - this is normal for new parties');
          }
        } else if (response.status === 400) {
          // Bad request - invalid party ID
          setError(`Invalid request: ${errorData.message || 'Please check your party ID and try again.'}`);
        } else if (response.status === 503) {
          // Database connection issues
          setError(`Database connection error: ${errorData.message || 'Unable to connect to database. Please try again later.'}`);
        } else {
          // Other server errors
          setError(`Server error (${response.status}): ${errorData.message || 'An unexpected error occurred. Please try refreshing the page.'}`);
        }
      }
    } catch (networkError) {
      console.error('Network error loading activity data:', networkError);
      
      // Check if it's a network connectivity issue
      if (networkError instanceof TypeError && networkError.message.includes('fetch')) {
        setError('Network connection error. Please check your internet connection and try again.');
      } else {
        setError(networkError instanceof Error ? `Connection error: ${networkError.message}` : 'Failed to load activity data. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMaterial = () => {
    if (customMaterial.trim()) {
      setPartyVibe(prev => ({
        ...prev,
        availableMaterials: [...prev.availableMaterials, customMaterial.trim()]
      }));
      setCustomMaterial('');
    }
  };

  const handleRemoveMaterial = (index: number) => {
    setPartyVibe(prev => ({
      ...prev,
      availableMaterials: prev.availableMaterials.filter((_, i) => i !== index)
    }));
  };

  const handleAddRequest = () => {
    if (customRequest.trim()) {
      setPartyVibe(prev => ({
        ...prev,
        specialRequests: [...prev.specialRequests, customRequest.trim()]
      }));
      setCustomRequest('');
    }
  };

  const handleRemoveRequest = (index: number) => {
    setPartyVibe(prev => ({
      ...prev,
      specialRequests: prev.specialRequests.filter((_, i) => i !== index)
    }));
  };

  const generateActivityPlan = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      
      console.log('Starting activity plan generation for party:', partyId);
      
      // First save the party vibe config
      console.log('Saving party vibe configuration...');
      const vibeResponse = await fetch(`/api/parties/${partyId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...partyVibe,
          setting: partyVibe.setting.toUpperCase(),
          budgetLevel: partyVibe.budgetLevel.toUpperCase()
        })
      });
      
      if (!vibeResponse.ok) {
        let vibeErrorData;
        try {
          vibeErrorData = await vibeResponse.json();
        } catch (parseError) {
          vibeErrorData = { message: 'Unable to parse error response' };
        }
        
        console.error('Failed to save party vibe config:', vibeResponse.status, vibeErrorData);
        throw new Error(`Failed to save party configuration: ${vibeErrorData.message || 'Please try again.'}`);
      }
      
      console.log('Party vibe configuration saved successfully');
      
      // Generate activities using AI or defaults
      console.log('Generating activities...');
      const generateResponse = await fetch(`/api/parties/${partyId}/activities/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...partyVibe,
          setting: partyVibe.setting.toUpperCase(),
          budgetLevel: partyVibe.budgetLevel.toUpperCase()
        })
      });
      
      if (!generateResponse.ok) {
        let generateErrorData;
        try {
          generateErrorData = await generateResponse.json();
        } catch (parseError) {
          generateErrorData = { message: 'Unable to parse error response' };
        }
        
        console.error('Failed to generate activities:', generateResponse.status, generateErrorData);
        
        // If generation fails, fall back to default activities immediately
        console.log('Falling back to default activities due to generation error');
        const defaultActivities = generateDefaultActivities(partyVibe.theme, partyVibe.ageGroup, partyVibe.numberOfKids);
        setActivityPlan(defaultActivities);
        setCurrentView('activities');
        setError(`Activity generation encountered an issue, but we've created default activities for you. Error: ${generateErrorData.message || 'Please try the AI generation again later.'}`);
        return;
      }
      
      const generateData = await generateResponse.json();
      console.log('Activities generated successfully:', generateData);
      
      const { activities } = generateData;
      
      if (!Array.isArray(activities) || activities.length === 0) {
        console.warn('Empty or invalid activities received from generation');
        const defaultActivities = generateDefaultActivities(partyVibe.theme, partyVibe.ageGroup, partyVibe.numberOfKids);
        setActivityPlan(defaultActivities);
        setCurrentView('activities');
        setError('No activities were generated. We\'ve provided default activities instead. Please try again.');
        return;
      }
      
      // Save generated activities to database
      console.log('Saving generated activities to database...');
      const saveResponse = await fetch(`/api/parties/${partyId}/activities`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityPlans: activities })
      });
      
      if (!saveResponse.ok) {
        let saveErrorData;
        try {
          saveErrorData = await saveResponse.json();
        } catch (parseError) {
          saveErrorData = { message: 'Unable to parse error response' };
        }
        
        console.error('Failed to save activities to database:', saveResponse.status, saveErrorData);
        
        // Still show the activities even if saving failed
        setActivityPlan(activities.map((activity: any) => ({
          ...activity,
          category: (activity.category || 'GAME').toLowerCase(),
          difficulty: (activity.difficulty || 'EASY').toLowerCase(),
          energyLevel: (activity.energyLevel || 'MEDIUM').toLowerCase()
        })));
        
        setCurrentView('activities');
        setError(`Activities were generated but couldn't be saved. Your activities are still shown below. Error: ${saveErrorData.message || 'Please try saving again later.'}`);
        return;
      }
      
      console.log('Activities saved successfully to database');
      
      // Process and set the activities with proper case conversion
      setActivityPlan(activities.map((activity: any) => ({
        ...activity,
        category: (activity.category || 'GAME').toLowerCase(),
        difficulty: (activity.difficulty || 'EASY').toLowerCase(),
        energyLevel: (activity.energyLevel || 'MEDIUM').toLowerCase()
      })));
      
      setCurrentView('activities');
      console.log('Activity plan generation completed successfully');
      
    } catch (error) {
      console.error('Unexpected error during activity plan generation:', error);
      
      // Always provide fallback activities to prevent broken UI
      const defaultActivities = generateDefaultActivities(partyVibe.theme, partyVibe.ageGroup, partyVibe.numberOfKids);
      setActivityPlan(defaultActivities);
      setCurrentView('activities');
      
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during activity generation.';
      setError(`${errorMessage} We've provided default activities as a fallback. Please try again or refresh the page.`);
    } finally {
      setIsGenerating(false);
    }
  };

  const surpriseMe = async () => {
    try {
      setIsGenerating(true);
      
      // Add "surprise me" to special requests
      const surpriseVibe = {
        ...partyVibe,
        specialRequests: [...partyVibe.specialRequests, 'Make it extra fun and silly!'],
        customText: (partyVibe.customText || '') + ' Please add silly twists and creative variations to make the activities more entertaining!'
      };
      
      // Generate surprise activities
      const generateResponse = await fetch(`/api/parties/${partyId}/activities/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...surpriseVibe,
          setting: surpriseVibe.setting.toUpperCase(),
          budgetLevel: surpriseVibe.budgetLevel.toUpperCase()
        })
      });
      
      if (generateResponse.ok) {
        const { activities } = await generateResponse.json();
        
        // Save surprise activities
        await fetch(`/api/parties/${partyId}/activities`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activityPlans: activities })
        });
        
        setActivityPlan(activities.map((activity: any) => ({
          ...activity,
          category: (activity.category || 'GAME').toLowerCase(),
          difficulty: (activity.difficulty || 'EASY').toLowerCase(),
          energyLevel: (activity.energyLevel || 'MEDIUM').toLowerCase()
        })));
      } else {
        // Fallback to silly variations of default activities
        const baseActivities = generateDefaultActivities(partyVibe.theme, partyVibe.ageGroup, partyVibe.numberOfKids);
        const sillyActivities = baseActivities.map(activity => ({
          ...activity,
          name: activity.name.replace('Masterpiece', 'Super Silly Creation').replace('Challenge', 'Giggle Challenge'),
          instructions: activity.instructions.map(instruction => 
            instruction.includes('show') ? instruction + ' with funny voices and silly faces!' : instruction
          )
        }));
        setActivityPlan(sillyActivities);
      }
    } catch (error) {
      console.error('Error with surprise generation:', error);
      // Fallback to default silly activities
      const baseActivities = generateDefaultActivities(partyVibe.theme, partyVibe.ageGroup, partyVibe.numberOfKids);
      const sillyActivities = baseActivities.map(activity => ({
        ...activity,
        name: activity.name.replace('Masterpiece', 'Super Silly Creation').replace('Challenge', 'Giggle Challenge')
      }));
      setActivityPlan(sillyActivities);
    } finally {
      setIsGenerating(false);
    }
  };

  const generatePlaybook = () => {
    return {
      schedule: [
        { time: '0:00', activity: 'Welcome & Ice Breaker', duration: '10 min' },
        ...activityPlan.map((activity, index) => ({
          time: `${10 + (index * 25)}:00`,
          activity: activity.name,
          duration: activity.timeEstimate
        }))
      ],
      setupGuide: [
        'Set up activity stations 30 minutes before party starts',
        'Test all music and equipment',
        'Organize materials in labeled containers',
        'Prepare backup indoor activities if weather is uncertain'
      ],
      hostTips: [
        'Keep energy balanced: follow high-energy activities with calmer ones',
        'Have a helper for every 4-5 children',
        'Keep activities flexible - skip or extend based on group interest',
        'Take photos but don\'t let it interrupt the fun'
      ],
      icebreakers: [
        `Why don't ${partyVibe.theme}s ever get lost? Because they always find their way to fun!`,
        `What do you call a ${partyVibe.theme} who loves to dance? A party animal!`,
        `Knock knock! Who's there? Birthday! Birthday who? Birthday fun is about to begin!`
      ]
    };
  };

  return (
    <div className="space-y-6">
      {/* AI Party Activity Genie Header */}
      <div className="text-center bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-800">
        <div className="flex items-center justify-center gap-2">
          <Wand2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            AI Party Activity Genie
          </h1>
          <Sparkles className="h-6 w-6 text-pink-600 dark:text-pink-400" />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Navigation Tabs */}
      <Tabs value={currentView} onValueChange={(value) => setCurrentView(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="genie" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Party Vibe Setup
          </TabsTrigger>
          <TabsTrigger value="activities" className="flex items-center gap-2">
            <PartyPopper className="h-4 w-4" />
            Activity Plan
          </TabsTrigger>
          <TabsTrigger value="playbook" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Host Playbook
          </TabsTrigger>
        </TabsList>

        {/* Party Vibe Configuration */}
        <TabsContent value="genie" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Party Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                <div className="space-y-2">
                  <Label htmlFor="duration">Total Party Duration</Label>
                  <Select value={partyVibe.totalDuration} onValueChange={(value) => setPartyVibe(prev => ({ ...prev, totalDuration: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-2 hours">1-2 hours</SelectItem>
                      <SelectItem value="2-3 hours">2-3 hours</SelectItem>
                      <SelectItem value="3-4 hours">3-4 hours</SelectItem>
                      <SelectItem value="4+ hours">4+ hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setting">Setting</Label>
                  <Select value={partyVibe.setting} onValueChange={(value) => setPartyVibe(prev => ({ ...prev, setting: value as any }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="indoor">Indoor</SelectItem>
                      <SelectItem value="outdoor">Outdoor</SelectItem>
                      <SelectItem value="mixed">Mixed (Indoor & Outdoor)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budgetLevel">Budget Level</Label>
                  <Select value={partyVibe.budgetLevel} onValueChange={(value) => setPartyVibe(prev => ({ ...prev, budgetLevel: value as any }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low (DIY & household items)</SelectItem>
                      <SelectItem value="medium">Medium (some purchases)</SelectItem>
                      <SelectItem value="high">High (premium materials)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Custom Text Input */}
              <div className="space-y-2">
                <Label htmlFor="customText">Additional Party Details (Optional)</Label>
                <Textarea
                  id="customText"
                  placeholder="Tell us more about what you want for this party... special requirements, favorite activities, things to avoid, or any other details that will help us create the perfect activity plan!"
                  value={partyVibe.customText || ''}
                  onChange={(e) => setPartyVibe(prev => ({ ...prev, customText: e.target.value }))}
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  This text input works alongside the dropdown selections to give our AI more context about your party preferences.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={generateActivityPlan} 
                  disabled={isGenerating}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                >
                  {isGenerating ? (
                    <>
                      <Wand2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Your Perfect Party Plan...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Create My Activity Plan!
                    </>
                  )}
                </Button>
                
                <Button 
                  onClick={surpriseMe}
                  disabled={isGenerating}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Shuffle className="h-4 w-4" />
                  Surprise Me!
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Generated Activity Plan */}
        <TabsContent value="activities" className="space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <RefreshCw className="h-12 w-12 animate-spin text-purple-600" />
              <div>
                <h3 className="text-lg font-semibold">Loading Your Activities</h3>
                <p className="text-gray-600 dark:text-gray-300">Retrieving your saved party plan...</p>
              </div>
            </div>
          ) : isGenerating ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <Wand2 className="h-12 w-12 animate-spin text-purple-600" />
              <div>
                <h3 className="text-lg font-semibold">Creating Your Activity Plan</h3>
                <p className="text-gray-600 dark:text-gray-300">Crafting magical activities just for you...</p>
              </div>
            </div>
          ) : activityPlan.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <PartyPopper className="h-12 w-12 text-gray-400" />
              <div>
                <h3 className="text-lg font-semibold">Ready to Create Activities?</h3>
                <p className="text-gray-600 dark:text-gray-300">Click "Create My Activity Plan" to get started!</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold">Your Activity Plan</h2>
                  <p className="text-gray-600 dark:text-gray-300">
                    {activityPlan.length} activities for a {partyVibe.theme} themed party
                  </p>
                </div>
                <Button onClick={surpriseMe} variant="outline" className="flex items-center gap-2" disabled={isGenerating}>
                  <RefreshCw className="h-4 w-4" />
                  Surprise Me Again!
                </Button>
              </div>

              <div className="grid gap-4">
            {activityPlan.map((activity, index) => (
              <Card key={activity.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${categoryColors[activity.category as keyof typeof categoryColors] || categoryColors.game}`}>
                        {categoryIcons[activity.category as keyof typeof categoryIcons] || categoryIcons.game}
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </span>
                          {activity.name}
                        </CardTitle>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="capitalize">
                            {activity.category}
                          </Badge>
                          <Badge className={difficultyColors[activity.difficulty as keyof typeof difficultyColors] || difficultyColors.easy}>
                            {activity.difficulty}
                          </Badge>
                          <Badge className={energyColors[activity.energyLevel as keyof typeof energyColors] || energyColors.medium}>
                            {activity.energyLevel} energy
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {activity.timeEstimate}
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {activity.bestGroupSize}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Step-by-Step Instructions:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      {activity.instructions.map((instruction, idx) => (
                        <li key={idx} className="text-gray-700 dark:text-gray-300">{instruction}</li>
                      ))}
                    </ol>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Materials Needed:</h4>
                    <div className="flex flex-wrap gap-1">
                      {activity.materials.map((material, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {material}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {Object.keys(activity.materialAlternatives).length > 0 && (
                    <Alert>
                      <Lightbulb className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Don't have some materials?</strong> Try these household alternatives:
                        <div className="mt-2 space-y-1 text-xs">
                          {Object.entries(activity.materialAlternatives).map(([item, alternatives]) => (
                            <div key={item}>
                              <span className="font-medium">{item}:</span> {alternatives.join(', ')}
                            </div>
                          ))}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Party Host Playbook */}
        <TabsContent value="playbook" className="space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <BookOpen className="h-12 w-12 animate-pulse text-purple-600" />
              <div>
                <h3 className="text-lg font-semibold">Loading Your Playbook</h3>
                <p className="text-gray-600 dark:text-gray-300">Preparing your host guide...</p>
              </div>
            </div>
          ) : isGenerating ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <BookOpen className="h-12 w-12 animate-pulse text-purple-600" />
              <div>
                <h3 className="text-lg font-semibold">Preparing Your Playbook</h3>
                <p className="text-gray-600 dark:text-gray-300">Creating your host guide...</p>
              </div>
            </div>
          ) : activityPlan.length > 0 ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Your Party Host Playbook</h2>
                <Button className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download Printable Guide
                </Button>
              </div>

              <div className="grid gap-6">
                {/* Schedule */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Party Schedule
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {generatePlaybook().schedule.map((item, index) => (
                        <div key={index} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <span className="font-medium">{item.time}</span>
                          <span>{item.activity}</span>
                          <span className="text-sm text-gray-500">{item.duration}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Setup Guide */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Quick Setup Guide
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {generatePlaybook().setupGuide.map((tip, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Host Tips */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="h-5 w-5" />
                      Host Tips for Smooth Transitions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {generatePlaybook().hostTips.map((tip, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Zap className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Icebreaker Jokes */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Smile className="h-5 w-5" />
                      Age-Appropriate Icebreaker Jokes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {generatePlaybook().icebreakers.map((joke, index) => (
                        <div key={index} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                          <p className="text-sm italic">"{joke}"</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Generate Your Activity Plan First!</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Create your magical activity plan to unlock your personalized Party Host Playbook.
                </p>
                <Button onClick={() => setCurrentView('genie')}>
                  Go to Party Vibe Setup
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}