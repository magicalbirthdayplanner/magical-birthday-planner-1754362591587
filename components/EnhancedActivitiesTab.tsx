"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  Clock,
  CheckCircle2,
  Sparkles,
  Filter,
  X,
  Search,
  MapPin,
  Users,
  Shuffle,
  Wand2,
  Home,
  TreePine,
  Building,
  Waves,
  GraduationCap,
  Gamepad2,
  Eye,
  Zap,
  Timer,
  Target,
  ChevronDown,
  ChevronUp,
  Palette
} from "lucide-react";

interface BirthdayActivity {
  id: string;
  name: string;
  description: string;
  fullDescription?: string;
  suppliesNeeded: string[];
  setupTime: number;
  helpersRequired: number;
  stepByStepInstructions?: string;
  hostScript?: string;
  ageGroup: string[];
  venueType: string[];
  duration: string;
  durationMinutes: number;
  themeCompatibility: string[];
  effortLevel: string;
  participantRange: string;
  minParticipants: number;
  maxParticipants?: number;
  category: string;
  tags: string[];
  isActive: boolean;
}

interface AIPartyPlan {
  activities: string[];
  timeline: string;
  groupFormation: string;
  hostingTips: string;
}

interface EnhancedActivitiesTabProps {
  partyId?: string;
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

const VENUE_ICONS = {
  INDOOR: Home,
  OUTDOOR: TreePine,
  MIXED: Building,
  HOME: Home,
  PARK: TreePine,
  PARTY_HALL: Building,
  POOL: Waves,
  SCHOOL: GraduationCap,
};

const AGE_LABELS = {
  AGE_0_2: "0-2 years",
  AGE_3_5: "3-5 years", 
  AGE_6_8: "6-8 years",
  AGE_9_12: "9-12 years",
};

const DURATION_LABELS = {
  DURATION_15: "15 min",
  DURATION_30: "30 min",
  DURATION_45: "45 min", 
  DURATION_60: "60 min",
  DURATION_90_PLUS: "90+ min",
};

const EFFORT_COLORS = {
  LOW: "bg-green-100 text-green-800 border-green-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200", 
  HIGH: "bg-red-100 text-red-800 border-red-200",
};

export default function EnhancedActivitiesTab({ partyId, partyData }: EnhancedActivitiesTabProps) {
  const [activities, setActivities] = useState<BirthdayActivity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<BirthdayActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAgeGroups, setSelectedAgeGroups] = useState<string[]>([]);
  const [selectedVenueTypes, setSelectedVenueTypes] = useState<string[]>([]);
  const [selectedDurations, setSelectedDurations] = useState<string[]>([]);
  const [selectedEffortLevels, setSelectedEffortLevels] = useState<string[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [participantCount, setParticipantCount] = useState<number | undefined>();
  
  // UI states
  const [showFilters, setShowFilters] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<BirthdayActivity | null>(null);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiPartyPlan, setAiPartyPlan] = useState<AIPartyPlan | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Unique filter options
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableThemes, setAvailableThemes] = useState<string[]>([]);

  // Load activities on component mount
  useEffect(() => {
    fetchActivities();
  }, []);

  // Apply filters when filter states change
  useEffect(() => {
    applyFilters();
  }, [
    activities,
    searchTerm,
    selectedAgeGroups,
    selectedVenueTypes,
    selectedDurations,
    selectedEffortLevels,
    selectedThemes,
    selectedCategories,
    participantCount,
  ]);

  // Set default filters based on party data
  useEffect(() => {
    if (partyData && activities.length > 0) {
      // Set age group based on child age
      if (partyData.childAge <= 2) {
        setSelectedAgeGroups(["AGE_0_2"]);
      } else if (partyData.childAge <= 5) {
        setSelectedAgeGroups(["AGE_3_5"]);
      } else if (partyData.childAge <= 8) {
        setSelectedAgeGroups(["AGE_6_8"]);
      } else {
        setSelectedAgeGroups(["AGE_9_12"]);
      }

      // Set venue type if available
      if (partyData.venue) {
        if (partyData.venue.toLowerCase().includes('outdoor')) {
          setSelectedVenueTypes(["OUTDOOR"]);
        } else if (partyData.venue.toLowerCase().includes('indoor')) {
          setSelectedVenueTypes(["INDOOR"]);
        }
      }

      // Set participant count
      if (partyData.guestCount) {
        setParticipantCount(partyData.guestCount);
      }

      // Set theme if it matches available themes
      if (partyData.theme && availableThemes.includes(partyData.theme)) {
        setSelectedThemes([partyData.theme]);
      }
    }
  }, [partyData, activities, availableThemes]);

  // Extract unique filter options from activities
  useEffect(() => {
    if (activities.length > 0) {
      const categories = Array.from(new Set(activities.map(a => a.category))).sort();
      const themes = Array.from(new Set(activities.flatMap(a => a.themeCompatibility))).sort();
      
      setAvailableCategories(categories);
      setAvailableThemes(themes);
    }
  }, [activities]);

  const fetchActivities = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/birthday-activities');
      const result = await response.json();
      
      if (result.success) {
        setActivities(result.data);
      } else {
        setError(result.error || 'Failed to load activities');
      }
    } catch (err) {
      setError('Failed to load activities');
      console.error('Error fetching activities:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...activities];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(activity =>
        activity.name.toLowerCase().includes(term) ||
        activity.description.toLowerCase().includes(term) ||
        activity.category.toLowerCase().includes(term) ||
        activity.tags.some(tag => tag.toLowerCase().includes(term))
      );
    }

    // Age group filter
    if (selectedAgeGroups.length > 0) {
      filtered = filtered.filter(activity =>
        activity.ageGroup.some(age => selectedAgeGroups.includes(age))
      );
    }

    // Venue type filter
    if (selectedVenueTypes.length > 0) {
      filtered = filtered.filter(activity =>
        activity.venueType.some(venue => selectedVenueTypes.includes(venue))
      );
    }

    // Duration filter
    if (selectedDurations.length > 0) {
      filtered = filtered.filter(activity =>
        selectedDurations.includes(activity.duration)
      );
    }

    // Effort level filter
    if (selectedEffortLevels.length > 0) {
      filtered = filtered.filter(activity =>
        selectedEffortLevels.includes(activity.effortLevel)
      );
    }

    // Theme compatibility filter
    if (selectedThemes.length > 0) {
      filtered = filtered.filter(activity =>
        activity.themeCompatibility.some(theme => selectedThemes.includes(theme))
      );
    }

    // Category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(activity =>
        selectedCategories.includes(activity.category)
      );
    }

    // Participant count filter
    if (participantCount !== undefined) {
      filtered = filtered.filter(activity =>
        activity.minParticipants <= participantCount &&
        (!activity.maxParticipants || activity.maxParticipants >= participantCount)
      );
    }

    setFilteredActivities(filtered);
  };

  const randomizeActivities = () => {
    const shuffled = [...filteredActivities].sort(() => Math.random() - 0.5);
    setFilteredActivities(shuffled.slice(0, 12)); // Show random 12 activities
    setSuccess("Activities randomized! Here's a fun mix for your party.");
    setTimeout(() => setSuccess(null), 3000);
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedAgeGroups([]);
    setSelectedVenueTypes([]);
    setSelectedDurations([]);
    setSelectedEffortLevels([]);
    setSelectedThemes([]);
    setSelectedCategories([]);
    setParticipantCount(undefined);
  };

  const generateAIPartyPlan = async () => {
    if (!partyData) {
      setError("Party data is required for AI planning");
      return;
    }

    setAiLoading(true);
    setError(null);

    try {
      // Use filtered activities for AI planning
      const selectedActivitiesForAI = filteredActivities.slice(0, 8);
      
      // Simple AI planning logic (can be replaced with actual AI API call)
      const plan: AIPartyPlan = {
        activities: selectedActivitiesForAI.map(a => a.name),
        timeline: `
🕐 Hour 1: Welcome & Icebreaker Activities
- Start with ${selectedActivitiesForAI[0]?.name || 'welcome activity'}
- Get everyone comfortable and excited

🕑 Hour 2: High-Energy Activities  
- ${selectedActivitiesForAI[1]?.name || 'energetic activity'}
- ${selectedActivitiesForAI[2]?.name || 'group activity'}

🕒 Hour 3: Creative & Craft Time
- ${selectedActivitiesForAI[3]?.name || 'creative activity'}
- Perfect for calming down mid-party

🕓 Hour 4: Grand Finale
- ${selectedActivitiesForAI[4]?.name || 'finale activity'}
- End on a high note with celebration
        `,
        groupFormation: `
👥 **Group Formation Strategy:**
- Divide ${partyData.guestCount || 'guests'} into groups of 4-6 children
- Mix different ages for peer learning
- Consider personality types (shy with outgoing)
- Rotate groups every 2-3 activities for fresh dynamics
        `,
        hostingTips: `
🎯 **Pro Hosting Tips:**
- Keep backup activities ready for different energy levels
- Have a "calm down" activity between high-energy ones
- Assign helper roles to older children
- Keep celebration consistent with ${partyData.theme} theme
- Take photos during each activity for memories
- Have transition music between activities
        `
      };

      setAiPartyPlan(plan);
      setShowAIDialog(true);
    } catch (err) {
      setError('Failed to generate AI party plan');
      console.error('Error generating AI plan:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const getVenueIcon = (venueTypes: string[]) => {
    const primaryVenue = venueTypes[0];
    const IconComponent = VENUE_ICONS[primaryVenue as keyof typeof VENUE_ICONS] || MapPin;
    return <IconComponent className="h-4 w-4" />;
  };

  const getDurationBadge = (duration: string) => {
    return DURATION_LABELS[duration as keyof typeof DURATION_LABELS] || duration;
  };

  const getAgeBadges = (ageGroups: string[]) => {
    return ageGroups.map(age => AGE_LABELS[age as keyof typeof AGE_LABELS] || age).join(", ");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-600">Loading amazing activities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">🎉 Activities</h2>
          <p className="text-gray-600 dark:text-gray-400">
            {partyData 
              ? `Discover perfect activities for ${partyData.childName}'s ${partyData.theme} party` 
              : 'Choose from 105 amazing birthday party activities'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={randomizeActivities}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            size="sm"
          >
            <Shuffle className="h-4 w-4 mr-2" />
            Randomize
          </Button>
          <Button 
            onClick={generateAIPartyPlan}
            disabled={aiLoading || filteredActivities.length === 0}
            className="bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600"
            size="sm"
          >
            <Wand2 className="h-4 w-4 mr-2" />
            {aiLoading ? 'Planning...' : 'Plan My Party'}
          </Button>
        </div>
      </div>

      {/* Filters Section */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Activity Filters
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
          <CardDescription>
            Find the perfect activities for your party. {filteredActivities.length} activities match your criteria.
          </CardDescription>
        </CardHeader>
        
        {showFilters && (
          <CardContent className="space-y-4">
            {/* Search */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Search Activities</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, description, or tags..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filter Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Age Groups */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Age Groups</Label>
                <div className="space-y-2">
                  {Object.entries(AGE_LABELS).map(([value, label]) => (
                    <label key={value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedAgeGroups.includes(value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAgeGroups([...selectedAgeGroups, value]);
                          } else {
                            setSelectedAgeGroups(selectedAgeGroups.filter(a => a !== value));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Venue Types */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Venue Types</Label>
                <div className="space-y-2">
                  {['INDOOR', 'OUTDOOR', 'MIXED', 'HOME', 'PARK', 'PARTY_HALL', 'POOL', 'SCHOOL'].map((venue) => (
                    <label key={venue} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedVenueTypes.includes(venue)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedVenueTypes([...selectedVenueTypes, venue]);
                          } else {
                            setSelectedVenueTypes(selectedVenueTypes.filter(v => v !== venue));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm capitalize">{venue.toLowerCase().replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Duration</Label>
                <div className="space-y-2">
                  {Object.entries(DURATION_LABELS).map(([value, label]) => (
                    <label key={value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedDurations.includes(value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDurations([...selectedDurations, value]);
                          } else {
                            setSelectedDurations(selectedDurations.filter(d => d !== value));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Effort Level */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Effort Level</Label>
                <div className="space-y-2">
                  {['LOW', 'MEDIUM', 'HIGH'].map((effort) => (
                    <label key={effort} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedEffortLevels.includes(effort)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEffortLevels([...selectedEffortLevels, effort]);
                          } else {
                            setSelectedEffortLevels(selectedEffortLevels.filter(e => e !== effort));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm capitalize">{effort.toLowerCase()}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Categories */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Categories</Label>
                <Select
                  value={selectedCategories[0] || ""}
                  onValueChange={(value) => {
                    if (value) {
                      setSelectedCategories([value]);
                    } else {
                      setSelectedCategories([]);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All categories</SelectItem>
                    {availableCategories.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Participant Count */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Guest Count</Label>
                <Input
                  type="number"
                  placeholder="Number of guests"
                  value={participantCount || ''}
                  onChange={(e) => setParticipantCount(e.target.value ? parseInt(e.target.value) : undefined)}
                  min="1"
                  max="50"
                />
              </div>
            </div>

            {/* Clear Filters */}
            <div className="flex justify-end pt-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearAllFilters}
                disabled={
                  !searchTerm && 
                  selectedAgeGroups.length === 0 && 
                  selectedVenueTypes.length === 0 && 
                  selectedDurations.length === 0 && 
                  selectedEffortLevels.length === 0 && 
                  selectedThemes.length === 0 && 
                  selectedCategories.length === 0 && 
                  !participantCount
                }
              >
                <X className="h-4 w-4 mr-2" />
                Clear All Filters
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Messages */}
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

      {/* Activities Grid */}
      {filteredActivities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredActivities.map((activity) => (
            <Card 
              key={activity.id} 
              className="hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 border-l-purple-500"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg leading-tight">{activity.name}</CardTitle>
                  <Badge className={cn("text-xs", EFFORT_COLORS[activity.effortLevel as keyof typeof EFFORT_COLORS])}>
                    {activity.effortLevel}
                  </Badge>
                </div>
                <CardDescription className="text-sm line-clamp-2">
                  {activity.description}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-3">
                {/* Activity Details */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {getDurationBadge(activity.duration)}
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    {getVenueIcon(activity.venueType)}
                    {activity.venueType[0]?.replace('_', ' ').toLowerCase()}
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {activity.participantRange}
                  </Badge>
                </div>

                {/* Age Groups */}
                <div className="text-xs text-gray-600">
                  <span className="font-medium">Ages: </span>
                  {getAgeBadges(activity.ageGroup)}
                </div>

                {/* Category */}
                <Badge variant="secondary" className="text-xs">
                  {activity.category}
                </Badge>

                {/* View Details Button */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      className="w-full mt-3" 
                      variant="outline"
                      onClick={() => setSelectedActivity(activity)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        {activity.name}
                        <Badge className={cn("text-xs", EFFORT_COLORS[activity.effortLevel as keyof typeof EFFORT_COLORS])}>
                          {activity.effortLevel} Effort
                        </Badge>
                      </DialogTitle>
                      <DialogDescription className="text-base">
                        {activity.fullDescription || activity.description}
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 pt-4">
                      {/* Quick Details */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">Duration:</span>
                            <span>{getDurationBadge(activity.duration)} ({activity.durationMinutes} min)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-green-500" />
                            <span className="font-medium">Setup Time:</span>
                            <span>{activity.setupTime} minutes</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-purple-500" />
                            <span className="font-medium">Helpers Needed:</span>
                            <span>{activity.helpersRequired}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Gamepad2 className="h-4 w-4 text-orange-500" />
                            <span className="font-medium">Participants:</span>
                            <span>{activity.participantRange}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <GraduationCap className="h-4 w-4 text-indigo-500" />
                            <span className="font-medium">Ages:</span>
                            <span>{getAgeBadges(activity.ageGroup)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {getVenueIcon(activity.venueType)}
                            <span className="font-medium">Venue:</span>
                            <span>{activity.venueType.join(", ").replace(/_/g, ' ').toLowerCase()}</span>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Supplies Needed */}
                      {activity.suppliesNeeded.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2">📦 Supplies Needed</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            {activity.suppliesNeeded.map((supply, index) => (
                              <li key={index}>{supply}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Step-by-Step Instructions */}
                      {activity.stepByStepInstructions && (
                        <div>
                          <h4 className="font-semibold mb-2">📋 Step-by-Step Instructions</h4>
                          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md text-sm whitespace-pre-line">
                            {activity.stepByStepInstructions}
                          </div>
                        </div>
                      )}

                      {/* Host Script */}
                      {activity.hostScript && (
                        <div>
                          <h4 className="font-semibold mb-2">🎤 Host Script / Engagement</h4>
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md text-sm italic">
                            "{activity.hostScript}"
                          </div>
                        </div>
                      )}

                      {/* Theme Compatibility */}
                      {activity.themeCompatibility.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2">🎨 Theme Compatibility</h4>
                          <div className="flex flex-wrap gap-1">
                            {activity.themeCompatibility.map((theme, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {theme}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tags */}
                      {activity.tags.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2">🏷️ Tags</h4>
                          <div className="flex flex-wrap gap-1">
                            {activity.tags.map((tag, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <div className="space-y-3">
              <Filter className="h-8 w-8 text-gray-400 mx-auto" />
              <h3 className="text-lg font-semibold">No activities match your filters</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Try adjusting your filters to see more activities, or clear all filters to see everything.
              </p>
              <Button 
                onClick={clearAllFilters}
                variant="outline"
                size="sm"
              >
                Reset Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Party Plan Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-blue-500" />
              AI-Generated Party Plan
              {partyData && (
                <Badge variant="outline">
                  For {partyData.childName}'s {partyData.theme} Party
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Here's your personalized party timeline and hosting guide
            </DialogDescription>
          </DialogHeader>
          
          {aiPartyPlan && (
            <div className="space-y-6 pt-4">
              {/* Activities List */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Recommended Activities
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {aiPartyPlan.activities.map((activity, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <Badge className="bg-purple-100 text-purple-800 text-xs">{index + 1}</Badge>
                      <span className="text-sm">{activity}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Timeline */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  Party Timeline
                </h4>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
                  <pre className="text-sm whitespace-pre-line font-sans">
                    {aiPartyPlan.timeline}
                  </pre>
                </div>
              </div>

              {/* Group Formation */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Group Formation Strategy
                </h4>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md">
                  <pre className="text-sm whitespace-pre-line font-sans">
                    {aiPartyPlan.groupFormation}
                  </pre>
                </div>
              </div>

              {/* Hosting Tips */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Pro Hosting Tips
                </h4>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md">
                  <pre className="text-sm whitespace-pre-line font-sans">
                    {aiPartyPlan.hostingTips}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}