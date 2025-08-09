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

export default function Activities({ theme, childAge, guestCount = 8 }: ActivitiesProps) {
  const [currentView, setCurrentView] = useState<'genie' | 'activities' | 'playbook'>('genie');
  const [partyVibe, setPartyVibe] = useState<PartyVibeConfig>({
    theme: theme || 'superhero',
    ageGroup: `${childAge}-${childAge + 2}`,
    numberOfKids: guestCount,
    totalDuration: '2-3 hours',
    setting: 'mixed',
    availableMaterials: [],
    budgetLevel: 'medium',
    specialRequests: []
  });
  const [activityPlan, setActivityPlan] = useState<ActivityPlan[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [customMaterial, setCustomMaterial] = useState('');
  const [customRequest, setCustomRequest] = useState('');

  useEffect(() => {
    // Generate default activities based on props
    const defaultActivities = generateDefaultActivities(theme, `${childAge}`, guestCount);
    setActivityPlan(defaultActivities);
  }, [theme, childAge, guestCount]);

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

  const generateActivityPlan = () => {
    setIsGenerating(true);
    // Simulate generation process
    setTimeout(() => {
      const newActivities = generateDefaultActivities(partyVibe.theme, partyVibe.ageGroup, partyVibe.numberOfKids);
      setActivityPlan(newActivities);
      setIsGenerating(false);
      setCurrentView('activities');
    }, 2000);
  };

  const surpriseMe = () => {
    setIsGenerating(true);
    setTimeout(() => {
      // Generate activities with silly twists
      const baseActivities = generateDefaultActivities(partyVibe.theme, partyVibe.ageGroup, partyVibe.numberOfKids);
      const sillyActivities = baseActivities.map(activity => ({
        ...activity,
        name: activity.name.replace('Masterpiece', 'Super Silly Creation').replace('Challenge', 'Giggle Challenge'),
        instructions: activity.instructions.map(instruction => 
          instruction.includes('show') ? instruction + ' with funny voices and silly faces!' : instruction
        )
      }));
      setActivityPlan(sillyActivities);
      setIsGenerating(false);
    }, 1500);
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
      <div className="text-center space-y-2 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-xl border border-purple-100 dark:border-purple-800">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Wand2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            AI Party Activity Genie
          </h1>
          <Sparkles className="h-6 w-6 text-pink-600 dark:text-pink-400" />
        </div>
        <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
          Your super-fun, creative best friend for planning unforgettable kid's party activities! 
          Tell me about your party vibe, and I'll create a dazzling activity plan perfectly matched to your theme, 
          age group, and special requests. Let's make this party magical! ✨
        </p>
      </div>

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
                Tell Me About Your Party's Vibe!
              </CardTitle>
              <CardDescription>
                The more you tell me, the more magical and personalized your activity plan will be!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Input
                    id="theme"
                    value={partyVibe.theme}
                    onChange={(e) => setPartyVibe(prev => ({ ...prev, theme: e.target.value }))}
                    placeholder="e.g., Safari, Space, Princess"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="ageGroup">Age Group</Label>
                  <Input
                    id="ageGroup"
                    value={partyVibe.ageGroup}
                    onChange={(e) => setPartyVibe(prev => ({ ...prev, ageGroup: e.target.value }))}
                    placeholder="e.g., 5-7, 8-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="numberOfKids">Number of Kids</Label>
                  <Input
                    id="numberOfKids"
                    type="number"
                    min="1"
                    max="30"
                    value={partyVibe.numberOfKids}
                    onChange={(e) => setPartyVibe(prev => ({ ...prev, numberOfKids: parseInt(e.target.value) || 1 }))}
                  />
                </div>

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

              {/* Available Materials */}
              <div className="space-y-3">
                <Label>Available Materials (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    value={customMaterial}
                    onChange={(e) => setCustomMaterial(e.target.value)}
                    placeholder="Add materials you have available..."
                    onKeyPress={(e) => e.key === 'Enter' && handleAddMaterial()}
                  />
                  <Button onClick={handleAddMaterial} variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {partyVibe.availableMaterials.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {partyVibe.availableMaterials.map((material, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {material}
                        <button onClick={() => handleRemoveMaterial(index)} className="text-xs">×</button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Special Requests */}
              <div className="space-y-3">
                <Label>Special Requests (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    value={customRequest}
                    onChange={(e) => setCustomRequest(e.target.value)}
                    placeholder="e.g., less mess, more active, educational..."
                    onKeyPress={(e) => e.key === 'Enter' && handleAddRequest()}
                  />
                  <Button onClick={handleAddRequest} variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {partyVibe.specialRequests.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {partyVibe.specialRequests.map((request, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {request}
                        <button onClick={() => handleRemoveRequest(index)} className="text-xs">×</button>
                      </Badge>
                    ))}
                  </div>
                )}
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
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">Your Magical Activity Plan</h2>
              <p className="text-gray-600 dark:text-gray-300">
                {activityPlan.length} amazing activities for a {partyVibe.theme} themed party!
              </p>
            </div>
            <Button onClick={surpriseMe} variant="outline" className="flex items-center gap-2">
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
                      <div className={`p-2 rounded-lg ${categoryColors[activity.category]}`}>
                        {categoryIcons[activity.category]}
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
                          <Badge className={difficultyColors[activity.difficulty]}>
                            {activity.difficulty}
                          </Badge>
                          <Badge className={energyColors[activity.energyLevel]}>
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
        </TabsContent>

        {/* Party Host Playbook */}
        <TabsContent value="playbook" className="space-y-4">
          {activityPlan.length > 0 ? (
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