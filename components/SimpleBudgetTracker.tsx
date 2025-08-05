"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  Edit3, 
  Plus,
  Trash2,
  Save,
  X,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Target
} from "lucide-react";
import AIBudgetAllocator from './AIBudgetAllocator';

interface BudgetItem {
  id: string;
  name: string;
  amount: number;
}

interface BudgetCategory {
  name: string;
  key: string;
  amount: number;
  percentage: number;
  icon: string;
  color: string;
}

interface SimpleBudgetTrackerProps {
  partyId: string;
  initialBudget?: number;
  childAge?: number;
}

export default function SimpleBudgetTracker({
  partyId,
  initialBudget = 0,
  childAge = 5
}: SimpleBudgetTrackerProps) {
  const [totalBudget, setTotalBudget] = useState<number>(initialBudget);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState<string>(initialBudget.toString());
  const [expenses, setExpenses] = useState<BudgetItem[]>([]);
  const [newExpense, setNewExpense] = useState({ name: '', amount: '' });
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAIAllocator, setShowAIAllocator] = useState(false);
  const [aiCategories, setAiCategories] = useState<BudgetCategory[]>([]);
  const [editingExpense, setEditingExpense] = useState<string | null>(null);
  const [editExpenseData, setEditExpenseData] = useState({ name: '', amount: '' });

  // Load saved data from localStorage
  useEffect(() => {
    const savedData = localStorage.getItem(`simple_budget_${partyId}`);
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setExpenses(data.expenses || []);
        setAiCategories(data.aiCategories || []);
        // Only use saved budget if no initialBudget provided
        if (!initialBudget && data.totalBudget) {
          setTotalBudget(data.totalBudget);
          setBudgetInput(data.totalBudget.toString());
        }
      } catch (error) {
        console.error('Error loading budget data:', error);
      }
    }
  }, [partyId, initialBudget]);

  // Save data to localStorage
  useEffect(() => {
    const data = {
      totalBudget,
      expenses,
      aiCategories,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem(`simple_budget_${partyId}`, JSON.stringify(data));
  }, [totalBudget, expenses, aiCategories, partyId]);

  const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const remaining = totalBudget - totalSpent;
  const spentPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const handleBudgetSave = () => {
    const amount = parseFloat(budgetInput);
    if (!isNaN(amount) && amount >= 0) {
      setTotalBudget(amount);
      setIsEditingBudget(false);
    }
  };

  const handleBudgetCancel = () => {
    setBudgetInput(totalBudget.toString());
    setIsEditingBudget(false);
  };

  const addExpense = () => {
    const amount = parseFloat(newExpense.amount);
    if (newExpense.name.trim() && !isNaN(amount) && amount > 0) {
      const expense: BudgetItem = {
        id: Date.now().toString(),
        name: newExpense.name.trim(),
        amount
      };
      setExpenses(prev => [...prev, expense]);
      setNewExpense({ name: '', amount: '' });
      setShowAddExpense(false);
    }
  };

  const removeExpense = (id: string) => {
    setExpenses(prev => prev.filter(expense => expense.id !== id));
  };

  const startEditExpense = (expense: BudgetItem) => {
    setEditingExpense(expense.id);
    setEditExpenseData({ name: expense.name, amount: expense.amount.toString() });
  };

  const saveExpenseEdit = () => {
    const amount = parseFloat(editExpenseData.amount);
    if (editExpenseData.name.trim() && !isNaN(amount) && amount > 0) {
      setExpenses(prev => prev.map(expense => 
        expense.id === editingExpense 
          ? { ...expense, name: editExpenseData.name.trim(), amount }
          : expense
      ));
      setEditingExpense(null);
      setEditExpenseData({ name: '', amount: '' });
    }
  };

  const cancelExpenseEdit = () => {
    setEditingExpense(null);
    setEditExpenseData({ name: '', amount: '' });
  };

  const handleAIAllocationComplete = (categories: BudgetCategory[]) => {
    setAiCategories(categories);
    // Convert AI categories to expenses for seamless integration
    const categoryExpenses = categories.map(cat => ({
      id: `ai-${cat.key}-${Date.now()}`,
      name: `${cat.icon} ${cat.name}`,
      amount: cat.amount
    }));
    setExpenses(categoryExpenses);
    setShowAIAllocator(false);
  };

  const getStatusColor = () => {
    if (remaining < 0) return 'text-red-600';
    if (remaining < totalBudget * 0.1) return 'text-orange-600';
    return 'text-green-600';
  };

  const getProgressColor = () => {
    if (spentPercentage > 100) return 'bg-red-500';
    if (spentPercentage > 90) return 'bg-orange-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6">
      {/* Budget Overview */}
      <Card className="border-0 shadow-lg dark:bg-slate-800/90 dark:backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <DollarSign className="h-6 w-6 text-green-600" />
                Budget Tracker
              </CardTitle>
              <CardDescription>
                Simple and effective budget management
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingBudget(true)}
                className="flex items-center gap-2"
              >
                <Edit3 className="h-4 w-4" />
                Edit Budget
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Budget Input */}
          <div className="bg-gray-100 dark:bg-slate-700/70 p-4 rounded-lg border border-gray-200 dark:border-slate-600">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-gray-900 dark:text-gray-100 text-lg">Total Budget</span>
              {isEditingBudget ? (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="number"
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                      className="pl-8 w-32 font-semibold"
                      min="0"
                      step="1"
                      autoFocus
                    />
                  </div>
                  <Button size="sm" onClick={handleBudgetSave}>
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleBudgetCancel}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">
                  ${Math.round(totalBudget)}
                </span>
              )}
            </div>

            {/* Budget Progress */}
            <div className="space-y-3">
              <div className="flex justify-between text-base text-gray-900 dark:text-gray-100 font-semibold">
                <span>Spent: <span className="text-orange-600 dark:text-orange-400">${Math.round(totalSpent)}</span></span>
                <span className={`font-bold ${getStatusColor()} text-lg`}>
                  Remaining: ${Math.round(remaining)}
                </span>
              </div>
              <div className="space-y-2">
                <Progress 
                  value={Math.min(spentPercentage, 100)} 
                  className="h-4 bg-gray-200 dark:bg-gray-600"
                />
                <div className="flex justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
                  <span>{Math.round(spentPercentage)}% used</span>
                  <span>${Math.round(totalBudget - totalSpent)} left</span>
                </div>
                {spentPercentage > 100 && (
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-base font-semibold">
                    <AlertTriangle className="h-5 w-5" />
                    <span>Over budget by ${Math.round(Math.abs(remaining))}</span>
                  </div>
                )}
              </div>
            </div>
            
          </div>

          {/* AI Budget Allocator Modal */}
          {showAIAllocator && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-slate-800 rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto w-full">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-500" />
                      AI Budget Allocation
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAIAllocator(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <AIBudgetAllocator
                    totalBudget={totalBudget}
                    childAge={childAge}
                    onAllocationComplete={handleAIAllocationComplete}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Add Expense */}
          <div className="border-t border-gray-300 dark:border-gray-600 pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">Expenses</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => setShowAddExpense(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Expense
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAIAllocator(true)}
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border-purple-200 text-purple-600"
                >
                  <Sparkles className="h-4 w-4" />
                  AI Allocate
                </Button>
              </div>
            </div>

            {/* Quick Add Category Templates - Always Available */}
            {!showAddExpense && (
              <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-800 dark:text-purple-300">Quick Start Categories</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { name: "🏢 Venue", amount: Math.round(totalBudget * 0.3) },
                    { name: "🍰 Food & Cake", amount: Math.round(totalBudget * 0.25) },
                    { name: "🎈 Decorations", amount: Math.round(totalBudget * 0.2) },
                    { name: "🎁 Party Favors", amount: Math.round(totalBudget * 0.15) },
                    { name: "🎪 Entertainment", amount: Math.round(totalBudget * 0.1) },
                    { name: "📸 Photography", amount: Math.round(totalBudget * 0.05) },
                    { name: "🍕 Catering", amount: Math.round(totalBudget * 0.3) },
                    { name: "🎵 Music/DJ", amount: Math.round(totalBudget * 0.15) }
                  ].map((template) => (
                    <Button
                      key={template.name}
                      variant="outline"
                      size="sm"
                      className="flex flex-col items-center gap-1 h-auto p-2 text-xs hover:bg-purple-50 dark:hover:bg-purple-900/20"
                      onClick={() => {
                        const expense: BudgetItem = {
                          id: Date.now().toString(),
                          name: template.name,
                          amount: template.amount
                        };
                        setExpenses(prev => [...prev, expense]);
                      }}
                    >
                      <span className="font-medium">{template.name}</span>
                      <span className="text-gray-500">${template.amount}</span>
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 text-center">
                  Click to quickly add common party categories, or use "Add Expense" for custom items
                </p>
              </div>
            )}

            {showAddExpense && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    addExpense();
                  }}
                  className="space-y-3"
                >
                  <div className="flex gap-2">
                    <Input
                      placeholder="Expense name"
                      value={newExpense.name}
                      onChange={(e) => setNewExpense(prev => ({ ...prev, name: e.target.value }))}
                      className="flex-1"
                      required
                    />
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={newExpense.amount}
                        onChange={(e) => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
                        className="pl-8 w-32"
                        min="0"
                        step="1"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      type="submit" 
                      size="sm"
                      disabled={!newExpense.name.trim() || !newExpense.amount || isNaN(parseFloat(newExpense.amount)) || parseFloat(newExpense.amount) <= 0}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                    <Button 
                      type="button"
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        setShowAddExpense(false);
                        setNewExpense({ name: '', amount: '' });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* Expenses List */}
            <div className="space-y-3">
              {expenses.length === 0 ? (
                <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                  <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-base font-medium">No expenses added yet</p>
                  <p className="text-sm">Click "Add Expense" to start tracking spending</p>
                </div>
              ) : (
                expenses.map((expense) => (
                  <div key={expense.id} className="p-4 bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-600 rounded-lg shadow-sm">
                    {editingExpense === expense.id ? (
                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          saveExpenseEdit();
                        }}
                        className="space-y-3"
                      >
                        <div className="flex gap-2">
                          <Input
                            placeholder="Expense name"
                            value={editExpenseData.name}
                            onChange={(e) => setEditExpenseData(prev => ({ ...prev, name: e.target.value }))}
                            className="flex-1 font-medium"
                            required
                          />
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              type="number"
                              placeholder="0"
                              value={editExpenseData.amount}
                              onChange={(e) => setEditExpenseData(prev => ({ ...prev, amount: e.target.value }))}
                              className="pl-8 w-28 font-semibold"
                              min="0"
                              step="1"
                              required
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            type="submit" 
                            size="sm"
                            disabled={!editExpenseData.name.trim() || !editExpenseData.amount || isNaN(parseFloat(editExpenseData.amount)) || parseFloat(editExpenseData.amount) <= 0}
                          >
                            <Save className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                          <Button 
                            type="button"
                            size="sm" 
                            variant="outline" 
                            onClick={cancelExpenseEdit}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900 dark:text-gray-100 text-base">{expense.name}</span>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-bold text-base px-3 py-1">
                            ${Math.round(expense.amount)}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditExpense(expense)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeExpense(expense.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}