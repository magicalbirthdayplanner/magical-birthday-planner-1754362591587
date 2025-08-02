"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  DollarSign, 
  PieChart, 
  TrendingDown, 
  ShoppingCart, 
  MapPin,
  Utensils,
  Gift,
  Palette,
  Music,
  Star,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Calculator,
  Target,
  BarChart3,
  Clock,
  Zap,
  Edit3
} from "lucide-react";

interface BudgetCategory {
  name: string;
  icon: React.ReactElement;
  allocation: number;
  spent: number;
  color: string;
  items: BudgetItem[];
}

interface BudgetItem {
  id: string;
  name: string;
  category: string;
  estimatedCost: number;
  actualCost?: number;
  status: 'planned' | 'researched' | 'purchased';
  deals?: Deal[];
  notes?: string;
}

interface Deal {
  id: string;
  retailer: string;
  price: number;
  originalPrice?: number;
  rating: number;
  shipping: string;
  url: string;
  priceDropped?: boolean;
  lastUpdated: Date;
}

interface SmartBudgetAssistantProps {
  partyId: string;
  childName: string;
  childAge: number;
  partyDate: string;
  theme: string;
  guestCount: number;
}

export default function SmartBudgetAssistant({
  partyId,
  childName,
  childAge,
  partyDate,
  theme,
  guestCount
}: SmartBudgetAssistantProps) {
  const [totalBudget, setTotalBudget] = useState<number>(0);
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [budgetPreferences, setBudgetPreferences] = useState<string>('balanced');

  // Initialize budget categories with smart defaults
  const initializeBudgetCategories = (budget: number): BudgetCategory[] => {
    const baseAllocations = {
      balanced: { food: 0.40, decorations: 0.25, gifts: 0.20, entertainment: 0.15 },
      foodFocused: { food: 0.50, decorations: 0.20, gifts: 0.15, entertainment: 0.15 },
      decorationFocused: { food: 0.30, decorations: 0.40, gifts: 0.15, entertainment: 0.15 },
      activityFocused: { food: 0.35, decorations: 0.20, gifts: 0.15, entertainment: 0.30 }
    };

    const allocation = baseAllocations[budgetPreferences as keyof typeof baseAllocations] || baseAllocations.balanced;

    return [
      {
        name: "Food & Catering",
        icon: <Utensils className="h-5 w-5" />,
        allocation: Math.round(budget * allocation.food),
        spent: 0,
        color: "bg-orange-500",
        items: generateFoodItems()
      },
      {
        name: "Decorations & Supplies",
        icon: <Palette className="h-5 w-5" />,
        allocation: Math.round(budget * allocation.decorations),
        spent: 0,
        color: "bg-pink-500",
        items: generateDecorationItems()
      },
      {
        name: "Gifts & Party Favors",
        icon: <Gift className="h-5 w-5" />,
        allocation: Math.round(budget * allocation.gifts),
        spent: 0,
        color: "bg-purple-500",
        items: generateGiftItems()
      },
      {
        name: "Entertainment & Activities",
        icon: <Music className="h-5 w-5" />,
        allocation: Math.round(budget * allocation.entertainment),
        spent: 0,
        color: "bg-blue-500",
        items: generateEntertainmentItems()
      }
    ];
  };

  // Mock deal data - in a real app, this would come from external APIs
  const generateMockDeals = (itemName: string): Deal[] => {
    const retailers = ['Amazon', 'Walmart', 'Target', 'Temu'];
    const basePrice = Math.floor(Math.random() * 50) + 10;
    
    return retailers.map((retailer, index) => ({
      id: `deal_${index}`,
      retailer,
      price: basePrice + (Math.random() * 20 - 10),
      originalPrice: Math.random() > 0.5 ? basePrice + 10 : undefined,
      rating: 3.5 + Math.random() * 1.5,
      shipping: Math.random() > 0.3 ? 'Free shipping' : '$5.99 shipping',
      url: `https://example.com/${retailer.toLowerCase()}`,
      priceDropped: Math.random() > 0.7,
      lastUpdated: new Date()
    })).sort((a, b) => a.price - b.price);
  };

  const generateFoodItems = (): BudgetItem[] => [
    { id: 'food_1', name: 'Birthday Cake', category: 'Food & Catering', estimatedCost: 40, status: 'planned', deals: generateMockDeals('Birthday Cake') },
    { id: 'food_2', name: 'Pizza for guests', category: 'Food & Catering', estimatedCost: 60, status: 'planned', deals: generateMockDeals('Pizza') },
    { id: 'food_3', name: 'Drinks & beverages', category: 'Food & Catering', estimatedCost: 25, status: 'planned', deals: generateMockDeals('Party drinks') },
    { id: 'food_4', name: 'Party snacks', category: 'Food & Catering', estimatedCost: 30, status: 'planned', deals: generateMockDeals('Party snacks') }
  ];

  const generateDecorationItems = (): BudgetItem[] => [
    { id: 'decor_1', name: 'Balloons & streamers', category: 'Decorations & Supplies', estimatedCost: 20, status: 'planned', deals: generateMockDeals('Party balloons') },
    { id: 'decor_2', name: 'Tablecloth & plates', category: 'Decorations & Supplies', estimatedCost: 25, status: 'planned', deals: generateMockDeals('Party plates') },
    { id: 'decor_3', name: 'Theme decorations', category: 'Decorations & Supplies', estimatedCost: 35, status: 'planned', deals: generateMockDeals(`${theme} decorations`) },
    { id: 'decor_4', name: 'Candles & lighting', category: 'Decorations & Supplies', estimatedCost: 15, status: 'planned', deals: generateMockDeals('Party candles') }
  ];

  const generateGiftItems = (): BudgetItem[] => [
    { id: 'gift_1', name: 'Party favor bags', category: 'Gifts & Party Favors', estimatedCost: 30, status: 'planned', deals: generateMockDeals('Party favor bags') },
    { id: 'gift_2', name: 'Small toys/prizes', category: 'Gifts & Party Favors', estimatedCost: 25, status: 'planned', deals: generateMockDeals('Party toys') },
    { id: 'gift_3', name: 'Stickers & candy', category: 'Gifts & Party Favors', estimatedCost: 15, status: 'planned', deals: generateMockDeals('Party stickers') }
  ];

  const generateEntertainmentItems = (): BudgetItem[] => [
    { id: 'ent_1', name: 'Activity supplies', category: 'Entertainment & Activities', estimatedCost: 25, status: 'planned', deals: generateMockDeals('Craft supplies') },
    { id: 'ent_2', name: 'Games & prizes', category: 'Entertainment & Activities', estimatedCost: 20, status: 'planned', deals: generateMockDeals('Party games') },
    { id: 'ent_3', name: 'Music/entertainment', category: 'Entertainment & Activities', estimatedCost: 15, status: 'planned', deals: generateMockDeals('Party music') }
  ];

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedBudget = localStorage.getItem(`budget_${partyId}`);
    if (savedBudget) {
      const data = JSON.parse(savedBudget);
      setTotalBudget(data.totalBudget || 0);
      setBudgetCategories(data.categories || []);
      setBudgetPreferences(data.preferences || 'balanced');
    }
  }, [partyId]);

  // Save data to localStorage whenever state changes
  useEffect(() => {
    if (totalBudget > 0) {
      const budgetData = {
        totalBudget,
        categories: budgetCategories,
        preferences: budgetPreferences,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(`budget_${partyId}`, JSON.stringify(budgetData));
    }
  }, [totalBudget, budgetCategories, budgetPreferences, partyId]);

  const handleBudgetSet = () => {
    if (totalBudget > 0) {
      setLoading(true);
      setTimeout(() => {
        setBudgetCategories(initializeBudgetCategories(totalBudget));
        setLoading(false);
      }, 1500);
    }
  };

  const updateCategoryAllocation = (categoryName: string, newAmount: number) => {
    setBudgetCategories(prev => 
      prev.map(cat => 
        cat.name === categoryName 
          ? { ...cat, allocation: Math.max(0, newAmount) }
          : cat
      )
    );
  };

  const totalAllocated = budgetCategories.reduce((sum, cat) => sum + cat.allocation, 0);
  const totalSpent = budgetCategories.reduce((sum, cat) => sum + cat.spent, 0);
  const remaining = totalBudget - totalSpent;

  const handleItemPurchase = (itemId: string, actualCost: number) => {
    setBudgetCategories(prev => 
      prev.map(category => ({
        ...category,
        items: category.items.map(item => 
          item.id === itemId 
            ? { ...item, actualCost, status: 'purchased' as const }
            : item
        ),
        spent: category.items.reduce((sum, item) => 
          sum + (item.id === itemId ? actualCost : (item.actualCost || 0)), 0
        )
      }))
    );
  };

  const refreshDeals = (itemId: string) => {
    setBudgetCategories(prev => 
      prev.map(category => ({
        ...category,
        items: category.items.map(item => 
          item.id === itemId 
            ? { ...item, deals: generateMockDeals(item.name) }
            : item
        )
      }))
    );
  };

  if (totalBudget === 0) {
    return (
      <div className="space-y-6">
        {/* Budget Setup */}
        <Card className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-3 rounded-full">
                <DollarSign className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              Smart Budget Assistant
            </CardTitle>
            <CardDescription className="text-lg">
              Set your party budget and let AI help you allocate it wisely
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="max-w-md mx-auto space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Total Party Budget</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="number"
                    placeholder="Enter your budget"
                    value={totalBudget || ''}
                    onChange={(e) => setTotalBudget(Number(e.target.value))}
                    className="pl-10 text-lg h-12"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Budget Focus</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'balanced', label: 'Balanced', desc: 'Even distribution' },
                    { value: 'foodFocused', label: 'Food Focus', desc: 'More for catering' },
                    { value: 'decorationFocused', label: 'Decor Focus', desc: 'Beautiful setup' },
                    { value: 'activityFocused', label: 'Activity Focus', desc: 'Fun experiences' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setBudgetPreferences(option.value)}
                      className={`p-3 rounded-lg border text-sm transition-all ${
                        budgetPreferences === option.value
                          ? 'bg-green-50 border-green-500 text-green-700 dark:bg-green-900/20 dark:border-green-400 dark:text-green-300'
                          : 'bg-white border-gray-200 hover:border-gray-300 dark:bg-slate-800 dark:border-slate-600'
                      }`}
                    >
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{option.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <Button 
                onClick={handleBudgetSet}
                disabled={!totalBudget || totalBudget <= 0 || loading}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white h-12"
              >
                {loading ? (
                  <>
                    <Sparkles className="h-5 w-5 mr-2 animate-spin" />
                    Creating Your Budget Plan...
                  </>
                ) : (
                  <>
                    <Calculator className="h-5 w-5 mr-2" />
                    Create Smart Budget Plan
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Budget Overview Header */}
      <Card className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <DollarSign className="h-6 w-6 text-green-600" />
                Budget Overview
              </CardTitle>
              <CardDescription>
                ${totalBudget} total budget • ${remaining.toFixed(2)} remaining
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">${totalSpent.toFixed(2)}</div>
                <div className="text-sm text-gray-500">spent so far</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const hasSpentMoney = budgetCategories.some(cat => cat.spent > 0);
                  const shouldConfirm = hasSpentMoney || totalSpent > 0;
                  
                  if (shouldConfirm) {
                    const confirmed = window.confirm(
                      totalSpent > 0 
                        ? `You have already spent $${totalSpent.toFixed(2)}. Are you sure you want to reset your budget? This will clear all spending data.`
                        : 'Are you sure you want to reset your budget? This will clear all budget allocations.'
                    );
                    if (!confirmed) return;
                  }
                  
                  // Reset the budget to show setup screen again
                  setTotalBudget(0);
                  setBudgetCategories([]);
                  setBudgetPreferences('balanced');
                  // Clear localStorage
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem(`budget_${partyId}`);
                  }
                }}
                className="flex items-center gap-2"
              >
                <Edit3 className="h-4 w-4" />
                Edit Budget
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>Budget Progress</span>
              <span>{Math.round((totalSpent / totalBudget) * 100)}%</span>
            </div>
            <Progress value={(totalSpent / totalBudget) * 100} className="h-3" />
            
            {totalAllocated !== totalBudget && (
              <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span className="text-sm text-orange-700 dark:text-orange-300">
                  Budget allocation doesn't match total: ${Math.abs(totalAllocated - totalBudget).toFixed(2)} 
                  {totalAllocated > totalBudget ? ' over' : ' under'} budget
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Budget Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Allocation
          </TabsTrigger>
          <TabsTrigger value="shopping" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Live Deals
          </TabsTrigger>
          <TabsTrigger value="tracking" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Spending
          </TabsTrigger>
          <TabsTrigger value="local" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Local Options
          </TabsTrigger>
        </TabsList>

        {/* Budget Allocation Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {budgetCategories.map((category) => {
              const percentage = totalBudget > 0 ? (category.allocation / totalBudget) * 100 : 0;
              const spentPercentage = category.allocation > 0 ? (category.spent / category.allocation) * 100 : 0;
              
              return (
                <Card key={category.name} className="border-0 shadow-lg dark:bg-slate-800/90">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {category.icon}
                      {category.name}
                    </CardTitle>
                    <CardDescription>
                      {percentage.toFixed(1)}% of total budget
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Allocated</span>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={category.allocation}
                          onChange={(e) => updateCategoryAllocation(category.name, Number(e.target.value))}
                          className="w-20 h-8 text-sm"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Spent: ${category.spent.toFixed(2)}</span>
                        <span>{spentPercentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={spentPercentage} className="h-2" />
                    </div>

                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      ${(category.allocation - category.spent).toFixed(2)} remaining
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Live Deals Tab */}
        <TabsContent value="shopping" className="space-y-6">
          {budgetCategories.map((category) => (
            <Card key={`shopping-${category.name}`} className="border-0 shadow-lg dark:bg-slate-800/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {category.icon}
                  {category.name}
                  <Badge variant="outline" className="ml-auto">
                    ${category.allocation} budget
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {category.items.map((item) => (
                    <div key={item.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{item.name}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Estimated: ${item.estimatedCost}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => refreshDeals(item.id)}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Badge variant={item.status === 'purchased' ? 'default' : 'secondary'}>
                            {item.status}
                          </Badge>
                        </div>
                      </div>

                      {item.deals && item.deals.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-green-600" />
                            Best Deals Found
                          </h5>
                          <div className="grid gap-2">
                            {item.deals.slice(0, 3).map((deal) => (
                              <div key={deal.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <div>
                                    <div className="font-medium text-sm">{deal.retailer}</div>
                                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                      <span className="flex items-center gap-1">
                                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                        {deal.rating.toFixed(1)}
                                      </span>
                                      <span>{deal.shipping}</span>
                                      {deal.priceDropped && (
                                        <Badge variant="destructive" className="text-xs">
                                          <TrendingDown className="h-3 w-3 mr-1" />
                                          Price Drop!
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-green-600">
                                    ${deal.price.toFixed(2)}
                                  </div>
                                  {deal.originalPrice && (
                                    <div className="text-xs text-gray-500 line-through">
                                      ${deal.originalPrice.toFixed(2)}
                                    </div>
                                  )}
                                  <Button
                                    size="sm"
                                    className="mt-1 h-6 text-xs"
                                    onClick={() => {
                                      window.open(deal.url, '_blank');
                                      handleItemPurchase(item.id, deal.price);
                                    }}
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    Buy
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Spending Tracking Tab */}
        <TabsContent value="tracking" className="space-y-6">
          <div className="grid gap-6">
            {budgetCategories.map((category) => (
              <Card key={`tracking-${category.name}`} className="border-0 shadow-lg dark:bg-slate-800/90">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {category.icon}
                    {category.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-blue-600">
                          ${category.allocation}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Budgeted</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">
                          ${category.spent.toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Spent</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-purple-600">
                          ${(category.allocation - category.spent).toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Remaining</div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      {category.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-700 rounded">
                          <span className="text-sm">{item.name}</span>
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              {item.actualCost ? `$${item.actualCost}` : `~$${item.estimatedCost}`}
                            </div>
                            <Badge variant={item.status === 'purchased' ? 'default' : 'secondary'} className="text-xs">
                              {item.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Local Catering Tab */}
        <TabsContent value="local" className="space-y-6">
          <Card className="border-0 shadow-lg dark:bg-slate-800/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Local Catering Recommendations
              </CardTitle>
              <CardDescription>
                Kid-friendly restaurants and caterers in your area
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    name: "Pepperoni Pete's Pizza",
                    cuisine: "Pizza & Italian",
                    rating: 4.5,
                    price: "$$",
                    distance: "0.8 miles",
                    features: ["Kid-friendly", "Party packages", "Delivery available"],
                    phone: "(555) 123-4567"
                  },
                  {
                    name: "Rainbow Treats Bakery",
                    cuisine: "Bakery & Desserts",
                    rating: 4.8,
                    price: "$",
                    distance: "1.2 miles",
                    features: ["Custom cakes", "Allergy-friendly", "Same-day orders"],
                    phone: "(555) 987-6543"
                  },
                  {
                    name: "Happy Kids Catering",
                    cuisine: "Full-service catering",
                    rating: 4.6,
                    price: "$$$",
                    distance: "2.1 miles",
                    features: ["Party setup", "Themed menus", "Dietary restrictions"],
                    phone: "(555) 246-8135"
                  }
                ].map((place, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-lg">{place.name}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{place.cuisine}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            {place.rating}
                          </span>
                          <span>{place.price}</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {place.distance}
                          </span>
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <Button size="sm" variant="outline">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View Menu
                        </Button>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {place.phone}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {place.features.map((feature, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}