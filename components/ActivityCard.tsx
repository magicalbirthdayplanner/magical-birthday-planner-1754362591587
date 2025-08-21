"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Clock, 
  Star, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp,
  Sparkles,
  Users,
  MapPin,
  Lightbulb,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityCardProps {
  activity: {
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
  };
  isFavorite: boolean;
  isSelected: boolean;
  onToggleFavorite: (activityId: string) => void;
  onToggleSelected: (activityId: string) => void;
  personalizedTip?: string;
  isLoadingPersonalization?: boolean;
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

export default function ActivityCard({
  activity,
  isFavorite,
  isSelected,
  onToggleFavorite,
  onToggleSelected,
  personalizedTip,
  isLoadingPersonalization,
  partyData
}: ActivityCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getTimeDisplay = (time: number, unit: string) => {
    if (time < 60) {
      return `${time} ${unit}`;
    } else {
      const hours = Math.floor(time / 60);
      const minutes = time % 60;
      if (minutes === 0) {
        return `${hours}h`;
      }
      return `${hours}h ${minutes}m`;
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort?.toLowerCase()) {
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getVenueIcon = (venue: string) => {
    switch (venue) {
      case 'indoor':
        return '🏠';
      case 'outdoor':
        return '🌳';
      case 'both':
        return '🏠🌳';
      default:
        return '📍';
    }
  };

  return (
    <TooltipProvider>
      <Card className={cn(
        "transition-all duration-300 hover:shadow-lg border-2",
        isSelected 
          ? "border-green-500 bg-green-50 dark:bg-green-900/20" 
          : "border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
                {activity.name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  {activity.category}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {getVenueIcon(activity.venue)}
                </Badge>
              </div>
            </div>
            <div className="flex flex-col gap-2 ml-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 w-8 p-0 hover:bg-yellow-100 dark:hover:bg-yellow-900/30",
                      isFavorite && "text-yellow-500 hover:text-yellow-600"
                    )}
                    onClick={() => onToggleFavorite(activity.id)}
                  >
                    <Star className={cn("h-4 w-4", isFavorite && "fill-current")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isFavorite ? 'Remove from favorites' : 'Add to favorites'}</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 w-8 p-0",
                      isSelected 
                        ? "text-green-500 hover:text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30" 
                        : "hover:bg-green-100 dark:hover:bg-green-900/30"
                    )}
                    onClick={() => onToggleSelected(activity.id)}
                  >
                    <CheckCircle2 className={cn("h-4 w-4", isSelected && "fill-current")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isSelected ? 'Remove from party plan' : 'Add to party plan'}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <CardDescription className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
            {activity.description}
          </CardDescription>

          {/* Activity Details */}
          <div className="space-y-3 mb-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Clock className="h-4 w-4" />
              <span>{getTimeDisplay(activity.estimatedTime, activity.timeUnit)}</span>
            </div>

            {activity.participantRange && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Users className="h-4 w-4" />
                <span>{activity.participantRange} participants</span>
              </div>
            )}

            {activity.effortLevel && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Lightbulb className="h-4 w-4" />
                <Badge variant="secondary" className={getEffortColor(activity.effortLevel)}>
                  {activity.effortLevel} effort
                </Badge>
              </div>
            )}

            {activity.suppliesNeeded && activity.suppliesNeeded.length > 0 && (
              <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                <MapPin className="h-4 w-4 mt-0.5" />
                <div>
                  <span className="font-medium">Materials: </span>
                  <span className="line-clamp-2">
                    {activity.suppliesNeeded.slice(0, 3).join(', ')}
                    {activity.suppliesNeeded.length > 3 && ` +${activity.suppliesNeeded.length - 3} more`}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          {activity.tags && activity.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {activity.tags.slice(0, 4).map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {activity.tags.length > 4 && (
                <Badge variant="outline" className="text-xs">
                  +{activity.tags.length - 4}
                </Badge>
              )}
            </div>
          )}

          {/* Personalized Tip Section */}
          {partyData && (
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {isExpanded ? 'Hide' : 'Show'} Personalized Tip
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="mt-3">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 p-3 rounded-lg border border-purple-200 dark:border-purple-700">
                  {isLoadingPersonalization ? (
                    <div className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                      Generating personalized tip...
                    </div>
                  ) : personalizedTip ? (
                    <div className="text-sm text-purple-700 dark:text-purple-300">
                      <div className="font-medium mb-1">✨ Personalized for {partyData.childName}:</div>
                      {personalizedTip}
                    </div>
                  ) : (
                    <div className="text-sm text-purple-700 dark:text-purple-300">
                      <div className="font-medium mb-1">✨ Personalization available!</div>
                      Click to generate a tip tailored to {partyData.childName}'s {partyData.theme} party.
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 mt-4">
            <Button
              variant={isSelected ? "destructive" : "default"}
              size="sm"
              className="flex-1"
              onClick={() => onToggleSelected(activity.id)}
            >
              {isSelected ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Remove
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add to Party
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
