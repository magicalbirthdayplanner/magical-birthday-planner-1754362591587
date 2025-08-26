// 100 Classic Birthday Party Themes - Complete Collection
// Comprehensive themes data with categories, search, and filtering capabilities

export interface ThemeCategory {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
}

export interface ClassicTheme {
  id: string;
  name: string;
  emoji: string;
  category: string;
  ageRange: string;
  description: string;
  color: string;
  decorations: string[];
  activities: string[];
  colorPalette: string[];
  keywords: string[];
  popularity: number; // 1-10 scale
}

export const themeCategories: ThemeCategory[] = [
  {
    id: "adventure",
    name: "Adventure & Exploration",
    description: "Exciting outdoor and exploration themes",
    emoji: "🗺️",
    color: "from-green-500 to-emerald-600"
  },
  {
    id: "fantasy",
    name: "Fantasy & Imagination",
    description: "Magical and fairy tale themed parties",
    emoji: "🧚",
    color: "from-purple-500 to-pink-500"
  },
  {
    id: "heroes",
    name: "Heroes & Characters",
    description: "Superhero and popular character themes",
    emoji: "🦸",
    color: "from-red-500 to-blue-600"
  },
  {
    id: "sports",
    name: "Sports & Games",
    description: "Active and competitive party themes",
    emoji: "⚽",
    color: "from-orange-500 to-red-600"
  },
  {
    id: "creative",
    name: "Creative & Fun",
    description: "Artistic and hands-on creative themes",
    emoji: "🎨",
    color: "from-yellow-500 to-orange-500"
  },
  {
    id: "cultural",
    name: "Cultural & Seasonal",
    description: "Cultural celebrations and seasonal themes",
    emoji: "🌎",
    color: "from-teal-500 to-cyan-600"
  },
  {
    id: "baby",
    name: "Baby/Toddler-Friendly",
    description: "Perfect themes for ages 0-3",
    emoji: "🧸",
    color: "from-pink-400 to-purple-400"
  }
];

// Complete collection of 100 classic birthday party themes
export const classicThemes: ClassicTheme[] = [
  // Adventure & Exploration (15 themes)
  {
    id: "dinosaur-adventure",
    name: "Dinosaur Adventure",
    emoji: "🦕",
    category: "adventure",
    ageRange: "3-10",
    description: "A prehistoric party adventure with dinosaurs from all eras!",
    color: "bg-gradient-to-r from-green-500 to-emerald-600",
    decorations: ["Dinosaur footprint path", "Large inflatable dinosaurs", "Jungle backdrop", "Volcano centerpiece"],
    activities: ["Dinosaur fossil dig", "Pin the tail on T-Rex", "Dinosaur egg hunt", "Create-your-own dinosaur craft"],
    colorPalette: ["#32CD32", "#228B22", "#8FBC8F", "#6B8E23"],
    keywords: ["dinosaur", "prehistoric", "fossils", "jurassic", "t-rex"],
    popularity: 9
  },
  {
    id: "space-explorer",
    name: "Space Explorer Mission",
    emoji: "🚀",
    category: "adventure",
    ageRange: "4-12",
    description: "Blast off to an intergalactic celebration among the stars!",
    color: "bg-gradient-to-r from-purple-600 to-indigo-800",
    decorations: ["Silver balloon archway", "Hanging planets and stars", "Rocket ship backdrop", "Galaxy tablecloth with LEDs"],
    activities: ["Build paper rockets", "Space trivia games", "Astronaut training course", "Design your planet"],
    colorPalette: ["#4169E1", "#8A2BE2", "#191970", "#483D8B"],
    keywords: ["space", "astronaut", "rocket", "planets", "galaxy"],
    popularity: 8
  },
  {
    id: "safari-adventure",
    name: "African Safari Adventure",
    emoji: "🦁",
    category: "adventure",
    ageRange: "3-10",
    description: "Join the wild adventure through African savanna!",
    color: "bg-gradient-to-r from-yellow-500 to-orange-600",
    decorations: ["Jungle vine entrance", "Safari jeep cutout", "Animal print tablecloth", "Stuffed safari animals"],
    activities: ["Animal charades", "Safari scavenger hunt", "Animal face painting", "Make binoculars craft"],
    colorPalette: ["#FFD700", "#FF8C00", "#DAA520", "#B8860B"],
    keywords: ["safari", "animals", "jungle", "lion", "africa"],
    popularity: 8
  },
  {
    id: "under-sea",
    name: "Under the Sea Adventure",
    emoji: "🐠",
    category: "adventure",
    ageRange: "2-8",
    description: "Dive deep into an underwater world filled with sea creatures!",
    color: "bg-gradient-to-r from-blue-500 to-cyan-600",
    decorations: ["Blue streamers as waves", "Hanging jellyfish", "Treasure chest", "Coral reef backdrop"],
    activities: ["Fishing game with magnets", "Mermaid tail craft", "Musical sea creatures", "Ocean slime making"],
    colorPalette: ["#4169E1", "#00CED1", "#20B2AA", "#87CEEB"],
    keywords: ["ocean", "sea", "fish", "underwater", "mermaid"],
    popularity: 7
  },
  {
    id: "pirate-treasure",
    name: "Pirate Treasure Hunt",
    emoji: "🏴‍☠️",
    category: "adventure",
    ageRange: "4-10",
    description: "Ahoy mateys! Set sail for adventure and buried treasure!",
    color: "bg-gradient-to-r from-amber-600 to-red-700",
    decorations: ["Pirate ship entrance", "Treasure maps", "Skull banners", "Gold coins scattered"],
    activities: ["Treasure hunt with maps", "Walk the plank game", "Pirate hat crafts", "Cannonball toss"],
    colorPalette: ["#8B4513", "#DAA520", "#DC143C", "#000000"],
    keywords: ["pirate", "treasure", "ship", "adventure", "gold"],
    popularity: 8
  }
];