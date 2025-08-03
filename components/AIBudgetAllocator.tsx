"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, RefreshCw, Edit3, Check, X } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface BudgetCategory {
  name: string;
  key: string;
  amount: number;
  percentage: number;
  icon: string;
  color: string;
}

interface AIBudgetAllocatorProps {
  totalBudget: number;
  childAge: number;
  onAllocationComplete: (categories: BudgetCategory[]) => void;
}

const AIBudgetAllocator: React.FC<AIBudgetAllocatorProps> = ({ 
  totalBudget, 
  childAge, 
  onAllocationComplete 
}) => {
  const [preferences, setPreferences] = useState('');
  const [allocation, setAllocation] = useState<BudgetCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [viewMode, setViewMode] = useState<'pie' | 'bar'>('pie');
  const [aiGenerated, setAiGenerated] = useState(false);

  const generateAllocation = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/budget-allocation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          totalBudget,
          preferences,
          childAge
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate allocation');
      }

      const data = await response.json();
      setAllocation(data.categories);
      setAiGenerated(data.aiGenerated);
    } catch (error) {
      console.error('Error generating allocation:', error);
      // Fallback to default allocation
      generateFallbackAllocation();
    } finally {
      setIsLoading(false);
    }
  };

  const generateFallbackAllocation = () => {
    const defaultCategories: BudgetCategory[] = [
      { name: 'Food/Catering', key: 'food', amount: Math.round(totalBudget * 0.35), percentage: 35, icon: '🍰', color: '#8B5CF6' },
      { name: 'Gifts/Return Gifts', key: 'gifts', amount: Math.round(totalBudget * 0.15), percentage: 15, icon: '🎁', color: '#EC4899' },
      { name: 'Decor/Supplies', key: 'decor', amount: Math.round(totalBudget * 0.25), percentage: 25, icon: '🎈', color: '#10B981' },
      { name: 'Entertainment', key: 'entertainment', amount: Math.round(totalBudget * 0.25), percentage: 25, icon: '🎪', color: '#F59E0B' }
    ];
    setAllocation(defaultCategories);
    setAiGenerated(false);
  };

  const startEdit = (category: BudgetCategory) => {
    setEditingCategory(category.key);
    setEditAmount(category.amount.toString());
  };

  const saveEdit = () => {
    if (!editingCategory) return;
    
    const newAmount = parseInt(editAmount) || 0;
    const updatedAllocation = allocation.map(cat => {
      if (cat.key === editingCategory) {
        return {
          ...cat,
          amount: newAmount,
          percentage: Math.round((newAmount / totalBudget) * 100)
        };
      }
      return cat;
    });
    
    // Auto-rebalance other categories proportionally if budget is exceeded
    const totalAllocated = updatedAllocation.reduce((sum, cat) => sum + cat.amount, 0);
    if (totalAllocated > totalBudget) {
      const excess = totalAllocated - totalBudget;
      const otherCategories = updatedAllocation.filter(cat => cat.key !== editingCategory);
      const totalOthers = otherCategories.reduce((sum, cat) => sum + cat.amount, 0);
      
      if (totalOthers > 0) {
        const rebalancedAllocation = updatedAllocation.map(cat => {
          if (cat.key === editingCategory) {
            return cat; // Keep the manually edited category as is
          } else {
            const reduction = Math.round((cat.amount / totalOthers) * excess);
            const newAmount = Math.max(0, cat.amount - reduction);
            return {
              ...cat,
              amount: newAmount,
              percentage: Math.round((newAmount / totalBudget) * 100)
            };
          }
        });
        setAllocation(rebalancedAllocation);
      } else {
        setAllocation(updatedAllocation);
      }
    } else {
      setAllocation(updatedAllocation);
    }
    
    setEditingCategory(null);
    setEditAmount('');
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    setEditAmount('');
  };

  const handleApplyAllocation = () => {
    onAllocationComplete(allocation);
  };

  useEffect(() => {
    if (totalBudget > 0) {
      generateFallbackAllocation();
    }
  }, [totalBudget]);

  const remainingBudget = totalBudget - allocation.reduce((sum, cat) => sum + cat.amount, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI Budget Allocation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Tell us your preferences (optional)
            </label>
            <Textarea
              placeholder="e.g., 'Focus more on activities than decor', 'We want the best cake', 'Prioritize entertainment for 8-year-olds'"
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              className="min-h-20"
            />
          </div>
          
          <Button 
            onClick={generateAllocation} 
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Smart Allocation...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate AI Budget Allocation
              </>
            )}
          </Button>

          {allocation.length > 0 && (
            <div className="flex gap-2">
              <Badge variant={aiGenerated ? "default" : "secondary"}>
                {aiGenerated ? "AI Generated" : "Smart Default"}
              </Badge>
              {remainingBudget !== 0 && (
                <Badge variant={remainingBudget > 0 ? "outline" : "destructive"}>
                  {remainingBudget > 0 ? `$${remainingBudget} remaining` : `$${Math.abs(remainingBudget)} over budget`}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {allocation.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Budget Breakdown</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'pie' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('pie')}
                >
                  Pie Chart
                </Button>
                <Button
                  variant={viewMode === 'bar' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('bar')}
                >
                  Bar Chart
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  {viewMode === 'pie' ? (
                    <PieChart>
                      <Pie
                        data={allocation}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="amount"
                      >
                        {allocation.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value) => [`$${value}`, 'Amount']}
                        labelFormatter={(label, payload) => {
                          const item = payload?.[0]?.payload;
                          return item ? `${item.icon} ${item.name}` : label;
                        }}
                      />
                    </PieChart>
                  ) : (
                    <BarChart data={allocation}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        fontSize={12}
                      />
                      <YAxis />
                      <Tooltip 
                        formatter={(value) => [`$${value}`, 'Amount']}
                        labelFormatter={(label, payload) => {
                          const item = payload?.[0]?.payload;
                          return item ? `${item.icon} ${item.name}` : label;
                        }}
                      />
                      <Bar dataKey="amount" fill="#8B5CF6" />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                {allocation.map((category) => (
                  <div 
                    key={category.key}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{category.icon}</span>
                      <div>
                        <div className="font-medium">{category.name}</div>
                        <div className="text-sm text-gray-500">{category.percentage}% of budget</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {editingCategory === category.key ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-20 h-8"
                            min="0"
                          />
                          <Button size="sm" variant="ghost" onClick={saveEdit}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">${category.amount}</span>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => startEdit(category)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button 
                onClick={generateAllocation}
                variant="outline"
                disabled={isLoading}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate
              </Button>
              
              <Button 
                onClick={handleApplyAllocation}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
              >
                Apply This Allocation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AIBudgetAllocator;