"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
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
  Play
} from "lucide-react";

interface Activity {
  id: string;
  name: string;
  description: string;
  category: 'games' | 'dance' | 'crafts' | 'entertainment' | 'sports' | 'creative';
  duration: string;
  participants: string;
  materials: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  ageRange: string;
  icon: React.ReactElement;
}

interface ActivitiesProps {
  theme: string;
  childAge: number;
  guestCount?: number;
}

const categoryIcons = {
  games: <Gamepad2 className="h-5 w-5" />,
  dance: <Music className="h-5 w-5" />,
  crafts: <Paintbrush className="h-5 w-5" />,
  entertainment: <Star className="h-5 w-5" />,
  sports: <Trophy className="h-5 w-5" />,
  creative: <Sparkles className="h-5 w-5" />
};

const categoryColors = {
  games: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
  dance: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-200',
  crafts: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
  entertainment: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200',
  sports: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
  creative: 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800 text-pink-800 dark:text-pink-200'
};

// Theme-based activity templates
const getThemeActivities = (theme: string, childAge: number): Activity[] => {
  const baseActivities: { [key: string]: Activity[] } = {
    superhero: [
      {
        id: 'superhero-training',
        name: 'Superhero Training Academy',
        description: 'Create an obstacle course where kids can test their superhero abilities',
        category: 'sports',
        duration: '20-30 minutes',
        participants: '4-12 kids',
        materials: ['Cones', 'Jump ropes', 'Hula hoops', 'Small weights (water bottles)'],
        difficulty: 'medium',
        ageRange: '4-12',
        icon: <Trophy className="h-5 w-5" />
      },
      {
        id: 'cape-decorating',
        name: 'Design Your Superhero Cape',
        description: 'Let kids create and decorate their own superhero capes',
        category: 'crafts',
        duration: '25-35 minutes',
        participants: '1-10 kids',
        materials: ['Plain capes/fabric', 'Fabric markers', 'Stickers', 'Glue', 'Superhero symbols'],
        difficulty: 'easy',
        ageRange: '3-10',
        icon: <Paintbrush className="h-5 w-5" />
      },
      {
        id: 'villain-freeze-dance',
        name: 'Freeze the Villain Dance',
        description: 'Dance party with superhero music - freeze when the villain appears!',
        category: 'dance',
        duration: '15-20 minutes',
        participants: '5-20 kids',
        materials: ['Superhero playlist', 'Speaker', 'Villain cutout'],
        difficulty: 'easy',
        ageRange: '3-12',
        icon: <Music className="h-5 w-5" />
      },
      {
        id: 'save-the-city',
        name: 'Save the City Mission',
        description: 'Treasure hunt where kids solve clues to save the city from villains',
        category: 'games',
        duration: '30-40 minutes',
        participants: '4-15 kids',
        materials: ['Clue cards', 'Hidden treasures', 'City map', 'Mission cards'],
        difficulty: 'medium',
        ageRange: '5-12',
        icon: <Gamepad2 className="h-5 w-5" />
      }
    ],
    princess: [
      {
        id: 'royal-makeover',
        name: 'Royal Makeover Station',
        description: 'Transform into royalty with makeup, nail art, and hair styling',
        category: 'creative',
        duration: '20-30 minutes',
        participants: '1-8 kids',
        materials: ['Child-safe makeup', 'Nail stickers', 'Hair accessories', 'Mirrors', 'Tiaras'],
        difficulty: 'easy',
        ageRange: '4-10',
        icon: <Sparkles className="h-5 w-5" />
      },
      {
        id: 'crown-decorating',
        name: 'Design Your Royal Crown',
        description: 'Create beautiful crowns with gems, stickers, and glitter',
        category: 'crafts',
        duration: '25-35 minutes',
        participants: '1-12 kids',
        materials: ['Paper crowns', 'Gems', 'Glitter', 'Stickers', 'Glue', 'Markers'],
        difficulty: 'easy',
        ageRange: '3-10',
        icon: <Paintbrush className="h-5 w-5" />
      },
      {
        id: 'royal-ball-dance',
        name: 'Royal Ball Dance Party',
        description: 'Learn princess dances and waltz around the ballroom',
        category: 'dance',
        duration: '20-25 minutes',
        participants: '4-20 kids',
        materials: ['Classical music playlist', 'Dance instruction cards', 'Speaker'],
        difficulty: 'easy',
        ageRange: '4-12',
        icon: <Music className="h-5 w-5" />
      },
      {
        id: 'treasure-hunt-jewels',
        name: 'Hunt for Royal Jewels',
        description: 'Search for hidden jewels throughout the kingdom',
        category: 'games',
        duration: '25-35 minutes',
        participants: '4-15 kids',
        materials: ['Plastic jewels', 'Treasure chests', 'Clue cards', 'Royal map'],
        difficulty: 'easy',
        ageRange: '3-10',
        icon: <Gamepad2 className="h-5 w-5" />
      }
    ],
    dinosaur: [
      {
        id: 'dino-excavation',
        name: 'Dinosaur Fossil Excavation',
        description: 'Dig for dinosaur fossils and bones in a sandy dig site',
        category: 'games',
        duration: '30-40 minutes',
        participants: '4-12 kids',
        materials: ['Sand table/sandbox', 'Plastic dinosaur bones', 'Brushes', 'Sifters', 'Magnifying glasses'],
        difficulty: 'medium',
        ageRange: '4-10',
        icon: <Gamepad2 className="h-5 w-5" />
      },
      {
        id: 'dino-stomp-dance',
        name: 'Dinosaur Stomp Dance',
        description: 'Dance like different dinosaurs to prehistoric music',
        category: 'dance',
        duration: '15-20 minutes',
        participants: '5-20 kids',
        materials: ['Dinosaur sound effects', 'Music playlist', 'Dinosaur movement cards'],
        difficulty: 'easy',
        ageRange: '3-8',
        icon: <Music className="h-5 w-5" />
      },
      {
        id: 'dino-craft-making',
        name: 'Create Your Own Dinosaur',
        description: 'Make dinosaurs using paper plates, construction paper, and creativity',
        category: 'crafts',
        duration: '25-35 minutes',
        participants: '1-10 kids',
        materials: ['Paper plates', 'Construction paper', 'Googly eyes', 'Glue', 'Scissors', 'Crayons'],
        difficulty: 'easy',
        ageRange: '4-10',
        icon: <Paintbrush className="h-5 w-5" />
      }
    ],
    space: [
      {
        id: 'rocket-building',
        name: 'Build Your Own Rocket',
        description: 'Construct rockets using cardboard tubes and blast off to space',
        category: 'crafts',
        duration: '30-40 minutes',
        participants: '1-12 kids',
        materials: ['Cardboard tubes', 'Aluminum foil', 'Stickers', 'Markers', 'Tape'],
        difficulty: 'medium',
        ageRange: '5-12',
        icon: <Paintbrush className="h-5 w-5" />
      },
      {
        id: 'space-mission',
        name: 'Space Mission Adventure',
        description: 'Complete space missions and explore different planets',
        category: 'games',
        duration: '25-35 minutes',
        participants: '4-15 kids',
        materials: ['Mission cards', 'Planet stations', 'Space stickers', 'Astronaut badges'],
        difficulty: 'medium',
        ageRange: '5-12',
        icon: <Gamepad2 className="h-5 w-5" />
      },
      {
        id: 'alien-dance',
        name: 'Alien Dance Party',
        description: 'Dance like aliens from different planets with space music',
        category: 'dance',
        duration: '15-20 minutes',
        participants: '5-20 kids',
        materials: ['Space-themed music', 'LED lights', 'Alien costume pieces'],
        difficulty: 'easy',
        ageRange: '3-10',
        icon: <Music className="h-5 w-5" />
      }
    ],
    // Add more themes...
    default: [
      {
        id: 'musical-chairs',
        name: 'Musical Chairs',
        description: 'Classic party game with upbeat music and lots of fun',
        category: 'games',
        duration: '10-15 minutes',
        participants: '5-20 kids',
        materials: ['Chairs', 'Music player', 'Upbeat playlist'],
        difficulty: 'easy',
        ageRange: '3-12',
        icon: <Music className="h-5 w-5" />
      },
      {
        id: 'face-painting',
        name: 'Face Painting Station',
        description: 'Transform into favorite characters with face painting',
        category: 'creative',
        duration: '5-10 min per child',
        participants: '1-15 kids',
        materials: ['Face paints', 'Brushes', 'Sponges', 'Mirrors', 'Design cards'],
        difficulty: 'medium',
        ageRange: '3-12',
        icon: <Paintbrush className="h-5 w-5" />
      },
      {
        id: 'dance-freeze',
        name: 'Freeze Dance',
        description: 'Dance until the music stops, then freeze in place!',
        category: 'dance',
        duration: '10-15 minutes',
        participants: '5-25 kids',
        materials: ['Music player', 'Fun playlist'],
        difficulty: 'easy',
        ageRange: '2-12',
        icon: <Music className="h-5 w-5" />
      },
      {
        id: 'balloon-games',
        name: 'Balloon Pop Games',
        description: 'Various balloon games including keep it up and balloon stomp',
        category: 'games',
        duration: '15-20 minutes',
        participants: '5-20 kids',
        materials: ['Balloons', 'String', 'Small prizes inside balloons'],
        difficulty: 'easy',
        ageRange: '4-12',
        icon: <Gamepad2 className="h-5 w-5" />
      }
    ]
  };

  const themeKey = theme.toLowerCase();
  const activities = baseActivities[themeKey] || baseActivities.default;

  // Filter activities based on age appropriateness
  return activities.filter(activity => {
    const [minAge, maxAge] = activity.ageRange.split('-').map(age => parseInt(age));
    return childAge >= minAge && childAge <= maxAge;
  });
};

export default function Activities({ theme, childAge, guestCount = 8 }: ActivitiesProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  useEffect(() => {
    // Load theme-based activities
    const themeActivities = getThemeActivities(theme, childAge);
    setActivities(themeActivities);
  }, [theme, childAge]);

  const filteredActivities = selectedCategory === 'all' 
    ? activities 
    : activities.filter(activity => activity.category === selectedCategory);

  const categories = Array.from(new Set(activities.map(activity => activity.category)));

  const generateAIActivities = async () => {
    setIsGeneratingAI(true);
    
    try {
      const response = await fetch('/api/ai-activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          theme,
          childAge,
          guestCount,
          interests: [], // Could be passed as prop if available
          selectedActivities: activities.map(a => a.name),
          partyDuration: '2-3 hours',
          venue: 'home'
        }),
      });

      const data = await response.json();
      
      if (data.success && data.activities) {
        // Add new AI-generated activities to existing ones
        const newActivities = data.activities.map((aiActivity: any) => ({
          id: aiActivity.id,
          name: aiActivity.name,
          description: aiActivity.description,
          category: aiActivity.category,
          duration: aiActivity.duration,
          participants: aiActivity.participants,
          materials: aiActivity.materials,
          difficulty: aiActivity.difficulty,
          ageRange: aiActivity.ageRange,
          icon: categoryIcons[aiActivity.category as keyof typeof categoryIcons] || categoryIcons.games
        }));
        
        // Merge with existing activities, avoiding duplicates
        setActivities(prevActivities => {
          const existingNames = prevActivities.map(a => a.name.toLowerCase());
          const uniqueNewActivities = newActivities.filter((newActivity: Activity) => 
            !existingNames.includes(newActivity.name.toLowerCase())
          );
          return [...prevActivities, ...uniqueNewActivities];
        });
      } else if (data.fallback && data.activities) {
        // Handle fallback activities when AI is not available
        const fallbackActivities = data.activities.map((activity: any) => ({
          id: activity.id,
          name: activity.name,
          description: activity.description,
          category: activity.category,
          duration: activity.duration,
          participants: activity.participants,
          materials: activity.materials,
          difficulty: activity.difficulty,
          ageRange: activity.ageRange,
          icon: categoryIcons[activity.category as keyof typeof categoryIcons] || categoryIcons.games
        }));
        
        setActivities(prevActivities => [...prevActivities, ...fallbackActivities]);
      }
    } catch (error) {
      console.error('Error generating AI activities:', error);
      // Could show a user-friendly error message here
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
      case 'hard': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
      default: return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with AI Generation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Party Activities
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            {theme.charAt(0).toUpperCase() + theme.slice(1)} theme activities for age {childAge}
          </p>
        </div>
        <Button
          onClick={generateAIActivities}
          disabled={isGeneratingAI}
          className="bg-gradient-to-r from-purple-600 to-pink-600 text-white"
        >
          {isGeneratingAI ? (
            <>
              <Shuffle className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate More AI Activities
            </>
          )}
        </Button>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory('all')}
          className="mb-2"
        >
          All Activities ({activities.length})
        </Button>
        {categories.map(category => {
          const count = activities.filter(a => a.category === category).length;
          return (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="mb-2 capitalize"
            >
              {categoryIcons[category as keyof typeof categoryIcons]}
              <span className="ml-1">{category} ({count})</span>
            </Button>
          );
        })}
      </div>

      {/* Activities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredActivities.map((activity) => (
          <Card key={activity.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 dark:bg-slate-800/90 dark:backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${categoryColors[activity.category]}`}>
                    {activity.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{activity.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs capitalize">
                        {activity.category}
                      </Badge>
                      <Badge className={`text-xs ${getDifficultyColor(activity.difficulty)}`}>
                        {activity.difficulty}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CardDescription className="text-sm">
                {activity.description}
              </CardDescription>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-300">{activity.duration}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-300">{activity.participants}</span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2">Materials Needed:</h4>
                <div className="flex flex-wrap gap-1">
                  {activity.materials.slice(0, 3).map((material, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {material}
                    </Badge>
                  ))}
                  {activity.materials.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{activity.materials.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>

              <Button className="w-full" variant="outline" size="sm">
                <Play className="h-4 w-4 mr-2" />
                Add to Party Plan
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty state */}
      {filteredActivities.length === 0 && (
        <div className="text-center py-12">
          <Music className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No activities found
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            No activities match your current filter. Try selecting a different category.
          </p>
          <Button onClick={() => setSelectedCategory('all')} variant="outline">
            Show All Activities
          </Button>
        </div>
      )}
    </div>
  );
}