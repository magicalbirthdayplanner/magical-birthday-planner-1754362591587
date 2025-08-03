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
  AlertTriangle
} from "lucide-react";

interface BudgetItem {
  id: string;
  name: string;
  amount: number;
}

interface SimpleBudgetTrackerProps {
  partyId: string;
  initialBudget?: number;
}

export default function SimpleBudgetTracker({
  partyId,
  initialBudget = 0
}: SimpleBudgetTrackerProps) {
  const [totalBudget, setTotalBudget] = useState<number>(initialBudget);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState<string>(initialBudget.toString());
  const [expenses, setExpenses] = useState<BudgetItem[]>([]);
  const [newExpense, setNewExpense] = useState({ name: '', amount: '' });
  const [showAddExpense, setShowAddExpense] = useState(false);

  // Load saved data from localStorage
  useEffect(() => {
    const savedData = localStorage.getItem(`simple_budget_${partyId}`);
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setExpenses(data.expenses || []);
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
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem(`simple_budget_${partyId}`, JSON.stringify(data));
  }, [totalBudget, expenses, partyId]);

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
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Budget Input */}
          <div className="bg-gray-50 dark:bg-slate-700/50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <span className="font-medium">Total Budget</span>
              {isEditingBudget ? (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="number"
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                      className="pl-8 w-32"
                      min="0"
                      step="0.01"
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
                <span className="text-2xl font-bold text-green-600">
                  ${totalBudget.toFixed(2)}
                </span>
              )}
            </div>

            {/* Budget Progress */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Spent: ${totalSpent.toFixed(2)}</span>
                <span className={`font-medium ${getStatusColor()}`}>
                  Remaining: ${remaining.toFixed(2)}
                </span>
              </div>
              <div className="space-y-2">
                <Progress 
                  value={Math.min(spentPercentage, 100)} 
                  className="h-3"
                />
                {spentPercentage > 100 && (
                  <div className="flex items-center gap-2 text-red-600 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Over budget by ${Math.abs(remaining).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Add Expense */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Expenses</h3>
              <Button
                size="sm"
                onClick={() => setShowAddExpense(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Expense
              </Button>
            </div>

            {showAddExpense && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Expense name"
                    value={newExpense.name}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, name: e.target.value }))}
                    className="flex-1"
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
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addExpense}>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                  <Button 
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
              </div>
            )}

            {/* Expenses List */}
            <div className="space-y-2">
              {expenses.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No expenses added yet</p>
                  <p className="text-sm">Click "Add Expense" to start tracking spending</p>
                </div>
              ) : (
                expenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border rounded-lg">
                    <span className="font-medium">{expense.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        ${expense.amount.toFixed(2)}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeExpense(expense.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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