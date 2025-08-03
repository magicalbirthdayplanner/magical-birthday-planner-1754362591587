"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, 
  TrendingUp, 
  ShoppingCart, 
  MapPin,
  Gift,
  Utensils,
  Music,
  Palette,
  ExternalLink,
  Star,
  ShoppingBag,
  AlertTriangle,
  TrendingDown,
  Calculator,
  Sparkles,
  MapPinIcon,
  Phone,
  Clock,
  PieChart,
  BarChart3,
  Zap,
  Bell,
  TrendingUp as TrendingUpIcon
} from "lucide-react";

interface BudgetAllocation {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  icon: React.ReactElement;
}

interface Deal {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  retailer: string;
  url: string;
  image?: string;
  rating?: number;
  shipping?: string;
  category: string;
}

interface CateringOption {
  id: string;
  name: string;
  type: string;
  rating: number;
  priceRange: string;
  distance: string;
  phone: string;
  address: string;
  cuisines: string[];
  kidFriendly: boolean;
  specialties: string[];
}

interface GiftBundle {
  id: string;
  title: string;
  description: string;
  ageRange: string;
  price: number;
  items: string[];
  retailer: string;
  url: string;
  rating: number;
  theme: string;
}

interface BudgetProps {
  partyTheme?: string;
  childAge?: number;
  guestCount?: number;
  checklistItems?: any[];
}

interface SpentItem {
  id: string;
  name: string;
  amount: number;
  category: string;
  retailer: string;
  date: Date;
}

export default function Budget({ partyTheme = "superhero", childAge = 6, guestCount = 10, checklistItems = [] }: BudgetProps) {
  const [totalBudget, setTotalBudget] = useState<number>(0);
  const [allocations, setAllocations] = useState<BudgetAllocation[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [cateringOptions, setCateringOptions] = useState<CateringOption[]>([]);
  const [giftBundles, setGiftBundles] = useState<GiftBundle[]>([]);
  const [isAIAllocating, setIsAIAllocating] = useState(false);
  const [priceAlerts, setPriceAlerts] = useState<{ [key: string]: boolean }>({});
  const [spentItems, setSpentItems] = useState<SpentItem[]>([]);
  const [budgetPreferences, setBudgetPreferences] = useState<string>("");
  const [showChart, setShowChart] = useState<'pie' | 'bar'>('pie');
  const [budgetAlerts, setBudgetAlerts] = useState<{ [key: string]: boolean }>({});

  // Load saved budget data
  useEffect(() => {
    // Check if we're on the client side to avoid hydration issues
    if (typeof window !== 'undefined') {
      const savedBudget = localStorage.getItem('partyBudget');
      if (savedBudget) {
        try {
          const budgetData = JSON.parse(savedBudget);
          setTotalBudget(budgetData.total || 0);
          setAllocations(budgetData.allocations || []);
        } catch (error) {
          console.error('Error parsing saved budget data:', error);
          // Clear corrupted data
          localStorage.removeItem('partyBudget');
        }
      }
    }
  }, []);

  // Enhanced AI Budget Allocation with user preferences
  const handleAIAllocation = async () => {
    if (totalBudget <= 0) return;
    
    setIsAIAllocating(true);
    
    // Simulate AI allocation based on party theme, age, guest count, and user preferences
    setTimeout(() => {
      const baseAllocations: BudgetAllocation[] = [
        {
          category: "Food & Catering",
          amount: 0,
          percentage: 35,
          color: "bg-orange-500",
          icon: <Utensils className="h-4 w-4" />
        },
        {
          category: "Decorations & Supplies",
          amount: 0,
          percentage: 25,
          color: "bg-pink-500",
          icon: <Palette className="h-4 w-4" />
        },
        {
          category: "Entertainment & Activities",
          amount: 0,
          percentage: 20,
          color: "bg-purple-500",
          icon: <Music className="h-4 w-4" />
        },
        {
          category: "Return Gifts",
          amount: 0,
          percentage: 15,
          color: "bg-yellow-500",
          icon: <Gift className="h-4 w-4" />
        },
        {
          category: "Miscellaneous",
          amount: 0,
          percentage: 5,
          color: "bg-gray-500",
          icon: <ShoppingCart className="h-4 w-4" />
        }
      ];

      // Adjust percentages based on child age
      if (childAge <= 4) {
        // Younger kids - more focus on simple activities and safety
        baseAllocations[0].percentage = 40; // Food
        baseAllocations[1].percentage = 25; // Decorations
        baseAllocations[2].percentage = 15; // Entertainment
        baseAllocations[3].percentage = 15; // Gifts
        baseAllocations[4].percentage = 5;  // Misc
      } else if (childAge >= 8) {
        // Older kids - more entertainment focused
        baseAllocations[0].percentage = 30; // Food
        baseAllocations[1].percentage = 20; // Decorations
        baseAllocations[2].percentage = 30; // Entertainment
        baseAllocations[3].percentage = 15; // Gifts
        baseAllocations[4].percentage = 5;  // Misc
      }

      // Adjust based on user preferences
      if (budgetPreferences.toLowerCase().includes('food') || budgetPreferences.toLowerCase().includes('cake')) {
        baseAllocations[0].percentage += 10; // More food budget
        baseAllocations[1].percentage -= 5;  // Less decorations
      }
      if (budgetPreferences.toLowerCase().includes('activities') || budgetPreferences.toLowerCase().includes('entertainment')) {
        baseAllocations[2].percentage += 10; // More entertainment
        baseAllocations[1].percentage -= 5;  // Less decorations
      }
      if (budgetPreferences.toLowerCase().includes('decor') || budgetPreferences.toLowerCase().includes('decoration')) {
        baseAllocations[1].percentage += 10; // More decorations
        baseAllocations[2].percentage -= 5;  // Less entertainment
      }

      // Ensure percentages add up to 100
      const totalPercentage = baseAllocations.reduce((sum, alloc) => sum + alloc.percentage, 0);
      if (totalPercentage !== 100) {
        const diff = 100 - totalPercentage;
        baseAllocations[0].percentage += diff; // Adjust food category
      }

      // Calculate amounts
      const updatedAllocations = baseAllocations.map(allocation => ({
        ...allocation,
        amount: Math.round((totalBudget * allocation.percentage) / 100)
      }));

      setAllocations(updatedAllocations);
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('partyBudget', JSON.stringify({
          total: totalBudget,
          allocations: updatedAllocations,
          preferences: budgetPreferences
        }));
      }
      
      setIsAIAllocating(false);
    }, 2000);
  };

  // Mock deal finder data
  useEffect(() => {
    const mockDeals: Deal[] = [
      {
        id: "1",
        title: "Superhero Party Decorations Bundle",
        price: 24.99,
        originalPrice: 39.99,
        retailer: "Amazon",
        url: "#",
        rating: 4.5,
        shipping: "Free 2-day shipping",
        category: "Decorations"
      },
      {
        id: "2",
        title: "Kids Birthday Cake Decorating Kit",
        price: 15.99,
        originalPrice: 22.99,
        retailer: "Walmart",
        url: "#",
        rating: 4.2,
        shipping: "Pickup available",
        category: "Food"
      },
      {
        id: "3",
        title: "Party Favor Superhero Masks (12 pack)",
        price: 12.99,
        retailer: "Temu",
        url: "#",
        rating: 4.0,
        shipping: "Free shipping over $29",
        category: "Gifts"
      },
      {
        id: "4",
        title: "Bluetooth Speaker for Kids Parties",
        price: 29.99,
        originalPrice: 49.99,
        retailer: "Amazon",
        url: "#",
        rating: 4.7,
        shipping: "Free next-day delivery",
        category: "Entertainment"
      }
    ];
    setDeals(mockDeals);

    // Simulate price drop alerts
    setTimeout(() => {
      setPriceAlerts({ "1": true, "4": true });
    }, 3000);
  }, []);

  // Mock catering options
  useEffect(() => {
    const mockCatering: CateringOption[] = [
      {
        id: "1",
        name: "Pizza Palace Kids",
        type: "Pizza Restaurant",
        rating: 4.5,
        priceRange: "$$",
        distance: "0.8 miles",
        phone: "(555) 123-4567",
        address: "123 Main St, Downtown",
        cuisines: ["Pizza", "Italian", "American"],
        kidFriendly: true,
        specialties: ["Birthday party packages", "Gluten-free options", "Party room available"]
      },
      {
        id: "2",
        name: "Happy Tummy Catering",
        type: "Catering Service",
        rating: 4.8,
        priceRange: "$$$",
        distance: "1.2 miles",
        phone: "(555) 987-6543",
        address: "456 Oak Ave, Riverside",
        cuisines: ["American", "Mexican", "Healthy"],
        kidFriendly: true,
        specialties: ["Custom kids menus", "Allergy-friendly", "Setup included"]
      },
      {
        id: "3",
        name: "Burger Barn Family",
        type: "Fast Food",
        rating: 4.1,
        priceRange: "$",
        distance: "2.1 miles",
        phone: "(555) 456-7890",
        address: "789 Elm St, Westside",
        cuisines: ["American", "Burgers", "Kids Menu"],
        kidFriendly: true,
        specialties: ["Kids meal deals", "Play area", "Birthday cakes available"]
      }
    ];
    setCateringOptions(mockCatering);
  }, []);

  // Mock gift bundles
  useEffect(() => {
    const mockBundles: GiftBundle[] = [
      {
        id: "1",
        title: "Superhero Adventure Bundle",
        description: "Complete superhero party favor set with masks, capes, and stickers",
        ageRange: "4-8 years",
        price: 34.99,
        items: ["6 superhero masks", "6 mini capes", "Sticker sheets", "Temporary tattoos", "Mini comic books"],
        retailer: "Amazon",
        url: "#",
        rating: 4.6,
        theme: "superhero"
      },
      {
        id: "2",
        title: "Creative Arts Party Pack",
        description: "Art supplies and craft kits perfect for creative birthday parties",
        ageRange: "5-10 years",
        price: 28.99,
        items: ["Coloring books", "Crayons", "Stickers", "Mini puzzles", "Craft foam sheets"],
        retailer: "Temu",
        url: "#",
        rating: 4.3,
        theme: "arts"
      },
      {
        id: "3",
        title: "Outdoor Adventure Kit",
        description: "Fun outdoor activities and games for active birthday celebrations",
        ageRange: "6-12 years",
        price: 42.99,
        items: ["Mini frisbees", "Bubbles", "Jump ropes", "Sidewalk chalk", "Water balloons"],
        retailer: "Walmart",
        url: "#",
        rating: 4.4,
        theme: "outdoor"
      }
    ];
    setGiftBundles(mockBundles);
  }, []);

  const updateAllocation = (index: number, newAmount: number) => {
    const updatedAllocations = [...allocations];
    updatedAllocations[index].amount = newAmount;
    updatedAllocations[index].percentage = totalBudget > 0 ? Math.round((newAmount / totalBudget) * 100) : 0;
    setAllocations(updatedAllocations);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('partyBudget', JSON.stringify({
        total: totalBudget,
        allocations: updatedAllocations
      }));
    }
  };

  const totalAllocated = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  const totalSpent = spentItems.reduce((sum, item) => sum + item.amount, 0);
  const remainingBudget = totalBudget - totalAllocated;
  const actualRemaining = totalBudget - totalSpent;

  // Budget alert system
  useEffect(() => {
    if (totalBudget > 0) {
      const spentPercentage = (totalSpent / totalBudget) * 100;
      const newAlerts: { [key: string]: boolean } = {};
      
      if (spentPercentage >= 90) {
        newAlerts.overBudget = true;
      } else if (spentPercentage >= 80) {
        newAlerts.nearBudget = true;
      }
      
      setBudgetAlerts(newAlerts);
    }
  }, [totalSpent, totalBudget]);

  // Add spending function
  const addSpending = (name: string, amount: number, category: string, retailer: string) => {
    const newSpentItem: SpentItem = {
      id: Date.now().toString(),
      name,
      amount,
      category,
      retailer,
      date: new Date()
    };
    setSpentItems(prev => [...prev, newSpentItem]);
  };

  // Visual chart component
  const BudgetChart = () => {
    if (allocations.length === 0) return null;

    if (showChart === 'pie') {
      return (
        <div className="relative w-48 h-48 mx-auto">
          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
            {allocations.map((allocation, index) => {
              const cumulativePercentage = allocations
                .slice(0, index)
                .reduce((sum, alloc) => sum + alloc.percentage, 0);
              
              const dashArray = `${allocation.percentage} ${100 - allocation.percentage}`;
              const dashOffset = -cumulativePercentage;
              
              return (
                <circle
                  key={allocation.category}
                  cx="50"
                  cy="50"
                  r="15.9"
                  fill="transparent"
                  stroke={allocation.color.replace('bg-', '').replace('-500', '')}
                  strokeWidth="4"
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  className="opacity-80"
                />
              );
            })}
          </svg>
        </div>
      );
    } else {
      return (
        <div className="space-y-2">
          {allocations.map((allocation) => (
            <div key={allocation.category} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: allocation.color.replace('bg-', '').replace('-500', '') }} />
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span>{allocation.category}</span>
                  <span>${allocation.amount}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${allocation.color} transition-all duration-300`}
                    style={{ width: `${allocation.percentage}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Budget Setup Card */}
      <Card className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-600" />
            Smart Budget Assistant
          </CardTitle>
          <CardDescription>
            Set your budget and get AI-powered allocation with live deals and savings recommendations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  Total Party Budget ($)
                </label>
                <Input
                  type="number"
                  placeholder="Enter your budget (e.g., 200)"
                  value={totalBudget || ""}
                  onChange={(e) => setTotalBudget(Number(e.target.value))}
                  className="text-xl font-semibold h-12 border-2"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-600" />
                Budget Preferences (Optional)
              </label>
              <Input
                placeholder='e.g., "focus more on activities than decor" or "we want the best cake"'
                value={budgetPreferences}
                onChange={(e) => setBudgetPreferences(e.target.value)}
                className=""
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleAIAllocation}
                disabled={totalBudget <= 0 || isAIAllocating}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white flex-1"
                size="lg"
              >
                {isAIAllocating ? (
                  <>
                    <Sparkles className="h-5 w-5 mr-2 animate-spin" />
                    AI Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Smart AI Allocation
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowChart(showChart === 'pie' ? 'bar' : 'pie')}
                disabled={allocations.length === 0}
                size="lg"
              >
                {showChart === 'pie' ? <BarChart3 className="h-5 w-5" /> : <PieChart className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {totalBudget > 0 && (
            <>
              {/* Budget Alerts */}
              {(budgetAlerts.overBudget || budgetAlerts.nearBudget) && (
                <div className={`p-4 rounded-lg border-l-4 ${budgetAlerts.overBudget ? 'bg-red-50 border-red-500 dark:bg-red-900/20' : 'bg-yellow-50 border-yellow-500 dark:bg-yellow-900/20'}`}>
                  <div className="flex items-center gap-2">
                    <Bell className={`h-5 w-5 ${budgetAlerts.overBudget ? 'text-red-600' : 'text-yellow-600'}`} />
                    <span className={`font-semibold ${budgetAlerts.overBudget ? 'text-red-800 dark:text-red-300' : 'text-yellow-800 dark:text-yellow-300'}`}>
                      {budgetAlerts.overBudget ? 'Over Budget Alert!' : 'Budget Warning!'}
                    </span>
                  </div>
                  <p className={`text-sm mt-1 ${budgetAlerts.overBudget ? 'text-red-700 dark:text-red-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
                    {budgetAlerts.overBudget 
                      ? `You've spent ${((totalSpent / totalBudget) * 100).toFixed(1)}% of your budget.`
                      : `You're approaching your budget limit at ${((totalSpent / totalBudget) * 100).toFixed(1)}% spent.`
                    }
                  </p>
                </div>
              )}

              <div className="grid grid-cols-4 gap-4 mt-4">
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">${totalBudget.toFixed(2)}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">Total Budget</div>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">${totalAllocated.toFixed(2)}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">Allocated</div>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">${totalSpent.toFixed(2)}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">Spent</div>
                </div>
                <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className={`text-2xl font-bold ${actualRemaining >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                    ${actualRemaining.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">Remaining</div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Budget Allocation with Visual Chart */}
      {allocations.length > 0 && (
        <Card className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-blue-600" />
              Smart Budget Allocation
            </CardTitle>
            <CardDescription>
              AI-optimized budget split with visual breakdown and manual adjustments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Visual Chart */}
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <BudgetChart />
                </div>
                {budgetPreferences && (
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">AI Preferences Applied</div>
                    <div className="text-xs text-blue-600 dark:text-blue-400">"{budgetPreferences}"</div>
                  </div>
                )}
              </div>

              {/* Allocation Details */}
              <div className="space-y-4">
                {allocations.map((allocation, index) => (
                  <div key={allocation.category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-full ${allocation.color} text-white`}>
                          {allocation.icon}
                        </div>
                        <span className="font-medium">{allocation.category}</span>
                        <Badge variant="outline">{allocation.percentage}%</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={allocation.amount}
                          onChange={(e) => updateAllocation(index, Number(e.target.value))}
                          className="w-32 text-right"
                          min="0"
                          step="1"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-300">$</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${allocation.color} transition-all duration-300`}
                        style={{ width: `${allocation.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Budget Features Tabs */}
      <Tabs defaultValue="deals" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="deals" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Live Deals
          </TabsTrigger>
          <TabsTrigger value="catering" className="flex items-center gap-2">
            <Utensils className="h-4 w-4" />
            Local Catering
          </TabsTrigger>
          <TabsTrigger value="gifts" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Gift Bundles
          </TabsTrigger>
        </TabsList>

        {/* Live Deals Tab */}
        <TabsContent value="deals" className="mt-6">
          <Card className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-green-600" />
                Smart Deal Finder
              </CardTitle>
              <CardDescription>
                Live prices for your party items with automatic budget tracking and savings alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {deals.map((deal) => (
                  <div key={deal.id} className="relative p-4 border rounded-lg hover:shadow-md transition-shadow">
                    {priceAlerts[deal.id] && (
                      <div className="absolute -top-2 -right-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1 animate-pulse">
                        <TrendingDown className="h-3 w-3" />
                        Price Drop!
                      </div>
                    )}
                    
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2">{deal.title}</h3>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {deal.category}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {deal.retailer}
                          </Badge>
                          {deal.rating && (
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              <span className="text-xs">{deal.rating}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl font-bold text-green-600">${deal.price}</span>
                          {deal.originalPrice && (
                            <span className="text-sm text-gray-500 line-through">${deal.originalPrice}</span>
                          )}
                          {deal.originalPrice && (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Save ${(deal.originalPrice - deal.price).toFixed(2)}
                            </Badge>
                          )}
                        </div>
                        {deal.shipping && (
                          <p className="text-sm text-gray-600 dark:text-gray-300">{deal.shipping}</p>
                        )}
                      </div>
                      <div className="ml-4 space-y-2">
                        <Button 
                          variant="outline"
                          onClick={() => window.open(deal.url, '_blank')}
                          className="w-full"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Deal
                        </Button>
                        <Button 
                          onClick={() => addSpending(deal.title, deal.price, deal.category, deal.retailer)}
                          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700"
                        >
                          <ShoppingBag className="h-4 w-4 mr-2" />
                          Track Purchase
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Recent Purchases */}
              {spentItems.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5 text-blue-600" />
                    Recent Purchases
                  </h3>
                  <div className="space-y-2">
                    {spentItems.slice(0, 3).map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">
                            {item.retailer} • {item.category}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">${item.amount.toFixed(2)}</div>
                          <div className="text-xs text-gray-500">
                            {item.date.toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Local Catering Tab */}
        <TabsContent value="catering" className="mt-6">
          <Card className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-red-600" />
                Smart Catering Recommendations
              </CardTitle>
              <CardDescription>
                AI-curated local restaurants and caterers perfect for your party theme and guest count
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                {cateringOptions.map((option, index) => (
                  <div key={option.id} className="relative p-4 border rounded-lg hover:shadow-md transition-shadow">
                    {/* AI Recommendation Badge */}
                    {index === 0 && (
                      <div className="absolute -top-2 -left-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1 rounded-full text-xs flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        AI Top Pick
                      </div>
                    )}
                    
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{option.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{option.type}</p>
                        {/* AI Recommendation */}
                        {index === 0 && (
                          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 italic">
                            Perfect for {partyTheme} parties with {guestCount} guests
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 mb-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{option.rating}</span>
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-300">{option.priceRange}</span>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPinIcon className="h-4 w-4 text-gray-500" />
                          <span>{option.address}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span>{option.distance} away</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-gray-500" />
                          <span>{option.phone}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <span className="text-sm font-medium">Cuisines: </span>
                          <span className="text-sm">{option.cuisines.join(", ")}</span>
                        </div>
                        {option.kidFriendly && (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Kid-Friendly
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="mb-4">
                      <h4 className="font-medium mb-2">Specialties:</h4>
                      <div className="flex flex-wrap gap-2">
                        {option.specialties.map((specialty, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {specialty}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1">
                        <Phone className="h-4 w-4 mr-2" />
                        Call Now
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <MapPin className="h-4 w-4 mr-2" />
                        Get Directions
                      </Button>
                      <Button 
                        className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700"
                        onClick={() => {
                          // Estimate catering cost and track spending
                          const estimatedCost = guestCount * (option.priceRange === '$' ? 15 : option.priceRange === '$$' ? 25 : 35);
                          addSpending(`${option.name} Catering`, estimatedCost, 'Food & Catering', option.name);
                        }}
                      >
                        <Utensils className="h-4 w-4 mr-2" />
                        Book & Track
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gift Bundles Tab */}
        <TabsContent value="gifts" className="mt-6">
          <Card className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-purple-600" />
                Smart Return Gift Bundles
              </CardTitle>
              <CardDescription>
                AI-curated age-appropriate gift bundles with instant budget tracking and 1-click ordering for {guestCount} guests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                {giftBundles.map((bundle, index) => {
                  const totalBundlePrice = bundle.price * Math.ceil(guestCount / 6); // Assuming 6 kids per bundle
                  const isRecommended = bundle.theme === partyTheme || (childAge >= 4 && childAge <= 8 && bundle.ageRange.includes('4-8'));
                  
                  return (
                    <div key={bundle.id} className={`relative p-4 border rounded-lg hover:shadow-md transition-shadow ${isRecommended ? 'border-purple-300 bg-purple-50/50 dark:bg-purple-900/10' : ''}`}>
                      {isRecommended && (
                        <div className="absolute -top-2 -left-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1 rounded-full text-xs flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          Perfect Match
                        </div>
                      )}
                      
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1">{bundle.title}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{bundle.description}</p>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">Ages {bundle.ageRange}</Badge>
                            <Badge variant="outline">{bundle.retailer}</Badge>
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              <span className="text-xs">{bundle.rating}</span>
                            </div>
                          </div>
                          {isRecommended && (
                            <p className="text-xs text-purple-600 dark:text-purple-400 italic">
                              Perfect for {partyTheme} theme and age {childAge}
                            </p>
                          )}
                        </div>
                        <div className="text-right space-y-2">
                          <div>
                            <div className="text-lg font-bold text-purple-600">${bundle.price}</div>
                            <div className="text-xs text-gray-500">per bundle</div>
                          </div>
                          <div className="p-2 bg-gray-50 dark:bg-slate-700 rounded">
                            <div className="text-sm font-semibold">${totalBundlePrice.toFixed(2)}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-300">for {guestCount} guests</div>
                          </div>
                        </div>
                      </div>

                      <div className="mb-4">
                        <h4 className="font-medium mb-2">What's Included:</h4>
                        <ul className="grid md:grid-cols-2 gap-1">
                          {bundle.items.map((item, index) => (
                            <li key={index} className="text-sm flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => window.open(bundle.url, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                        <Button 
                          className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700"
                          onClick={() => {
                            addSpending(`${bundle.title} (${Math.ceil(guestCount / 6)} bundles)`, totalBundlePrice, 'Return Gifts', bundle.retailer);
                            // Simulate adding to cart
                            alert(`Added ${Math.ceil(guestCount / 6)} ${bundle.title} bundle(s) to cart for $${totalBundlePrice.toFixed(2)}`);
                          }}
                        >
                          <ShoppingBag className="h-4 w-4 mr-2" />
                          1-Click Order
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Budget Impact Summary */}
              <div className="mt-6 pt-6 border-t">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-green-600" />
                  Budget Impact Summary
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">
                      ${allocations.find(a => a.category === 'Return Gifts')?.amount || 0}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Gift Budget</div>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      ${spentItems.filter(item => item.category === 'Return Gifts').reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Spent on Gifts</div>
                  </div>
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      ${Math.max(0, (allocations.find(a => a.category === 'Return Gifts')?.amount || 0) - spentItems.filter(item => item.category === 'Return Gifts').reduce((sum, item) => sum + item.amount, 0)).toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Remaining</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}