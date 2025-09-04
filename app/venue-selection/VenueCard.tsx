'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VenueCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onSelect: () => void;
  className?: string;
}

export default function VenueCard({ 
  title, 
  description, 
  icon, 
  onSelect,
  className 
}: VenueCardProps) {
  return (
    <Card 
      className={cn(
        "group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 border-2 hover:border-purple-300 dark:hover:border-purple-600",
        className
      )}
      onClick={onSelect}
    >
      <CardHeader className="text-center pb-4">
        <div className="mx-auto mb-4 p-4 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900 group-hover:from-purple-200 group-hover:to-pink-200 dark:group-hover:from-purple-800 dark:group-hover:to-pink-800 transition-all duration-200">
          <div className="text-purple-600 dark:text-purple-400">
            {icon}
          </div>
        </div>
        <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
          {title}
        </CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Button 
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {title === 'Home Venue' ? 'Choose' : 'Browse'}
        </Button>
      </CardContent>
    </Card>
  );
}
