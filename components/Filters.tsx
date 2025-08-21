"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Filter, 
  X, 
  Search,
  Clock,
  Package,
  Tag
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  timeFilter: string;
  onTimeFilterChange: (filter: string) => void;
  materialsFilter: string;
  onMaterialsFilterChange: (filter: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (filter: string) => void;
  onClearFilters: () => void;
  totalActivities: number;
  filteredCount: number;
}

export default function Filters({
  searchQuery,
  onSearchChange,
  timeFilter,
  onTimeFilterChange,
  materialsFilter,
  onMaterialsFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  onClearFilters,
  totalActivities,
  filteredCount
}: FiltersProps) {
  const timeOptions = [
    { value: "all", label: "All Times" },
    { value: "short", label: "Quick (<15 mins)" },
    { value: "medium", label: "Medium (15-30 mins)" },
    { value: "long", label: "Long (>30 mins)" }
  ];

  const materialsOptions = [
    { value: "all", label: "All Materials" },
    { value: "none", label: "No Prep" },
    { value: "simple", label: "Simple Prep" },
    { value: "advanced", label: "Advanced Prep" }
  ];

  const categoryOptions = [
    { value: "all", label: "All Categories" },
    { value: "Games & Competitions", label: "Games & Competitions" },
    { value: "Creative & Crafty", label: "Creative & Crafty" },
    { value: "Performance & Entertainment", label: "Performance & Entertainment" },
    { value: "Interactive Play", label: "Interactive Play" },
    { value: "Calm & Relax", label: "Calm & Relax" }
  ];

  const hasActiveFilters = timeFilter !== "all" || materialsFilter !== "all" || categoryFilter !== "all" || searchQuery;

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search activities by name, description, or tags..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-4 py-3 text-base"
        />
      </div>

      {/* Filter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Time Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Time Required
          </label>
          <Select value={timeFilter} onValueChange={onTimeFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              {timeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Materials Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Package className="h-4 w-4" />
            Materials Needed
          </label>
          <Select value={materialsFilter} onValueChange={onMaterialsFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select materials level" />
            </SelectTrigger>
            <SelectContent>
              {materialsOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Category
          </label>
          <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Active filters:</span>
            
            {timeFilter !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Time: {timeOptions.find(opt => opt.value === timeFilter)?.label}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                  onClick={() => onTimeFilterChange("all")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            
            {materialsFilter !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Materials: {materialsOptions.find(opt => opt.value === materialsFilter)?.label}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                  onClick={() => onMaterialsFilterChange("all")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            
            {categoryFilter !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Category: {categoryOptions.find(opt => opt.value === categoryFilter)?.label}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                  onClick={() => onCategoryFilterChange("all")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            
            {searchQuery && (
              <Badge variant="secondary" className="gap-1">
                Search: "{searchQuery}"
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                  onClick={() => onSearchChange("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="text-gray-600 hover:text-gray-800"
          >
            Clear All
          </Button>
        </div>
      )}

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>
          Showing {filteredCount} of {totalActivities} activities
        </span>
        {hasActiveFilters && (
          <span className="text-purple-600 dark:text-purple-400 font-medium">
            Filtered results
          </span>
        )}
      </div>
    </div>
  );
}
