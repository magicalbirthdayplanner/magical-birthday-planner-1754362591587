'use client';

import React, { useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThemeSelectionSplashProps {
  isOpen: boolean;
  onClose: () => void;
  theme: {
    id: string;
    name: string;
    description: string;
    emoji: string;
    colorPalette?: string[];
    decorations?: string[];
    activities?: string[];
    whyRecommended?: string;
    matchScore?: number;
    isCustom?: boolean;
  } | null;
  childName?: string;
}

export default function ThemeSelectionSplash({ 
  isOpen, 
  onClose, 
  theme,
  childName = "your child"
}: ThemeSelectionSplashProps) {
  // Auto-close after 4 seconds
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!theme) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md mx-auto p-0 overflow-hidden border-none bg-transparent shadow-none">
        <div className="relative">
          {/* Background with gradient and theme colors */}
          <div 
            className="absolute inset-0 rounded-2xl opacity-90"
            style={{
              background: theme.colorPalette && theme.colorPalette.length > 0
                ? `linear-gradient(135deg, ${theme.colorPalette[0]} 0%, ${theme.colorPalette[1] || theme.colorPalette[0]} 50%, ${theme.colorPalette[2] || theme.colorPalette[0]} 100%)`
                : 'linear-gradient(135deg, #FF69B4 0%, #9370DB 50%, #4169E1 100%)'
            }}
          />
          
          {/* Content */}
          <div className="relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-2xl p-8 text-center space-y-6 border border-white/20">
            {/* Close button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="absolute top-4 right-4 h-8 w-8 p-0 rounded-full bg-white/20 hover:bg-white/30 text-gray-700 dark:text-gray-200"
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Theme emoji with animation */}
            <div className="relative">
              <div className="text-8xl animate-bounce mb-4">
                {theme.emoji}
              </div>
              <div className="absolute -top-2 -right-2">
                <Sparkles className="h-8 w-8 text-yellow-400 animate-pulse" />
              </div>
            </div>

            {/* Success message */}
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                🎉 Theme Selected!
              </h2>
              <p className="text-lg text-gray-700 dark:text-gray-300 font-medium">
                <span className="text-purple-600 dark:text-purple-400">{theme.name}</span> 
                {' '}is perfect for {childName}!
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
                {theme.description}
              </p>
            </div>

            {/* Theme badges */}
            <div className="flex justify-center gap-2 flex-wrap">
              {theme.isCustom && (
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI Generated
                </Badge>
              )}
              {theme.matchScore && (
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  <Star className="w-3 h-3 mr-1 fill-current" />
                  {theme.matchScore}% Match
                </Badge>
              )}
              <Badge variant="outline" className="border-purple-300 text-purple-700 dark:border-purple-600 dark:text-purple-300">
                Theme Applied
              </Badge>
            </div>

            {/* Color palette preview */}
            {theme.colorPalette && theme.colorPalette.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  Your Party Colors
                </p>
                <div className="flex justify-center gap-2">
                  {theme.colorPalette.slice(0, 5).map((color, index) => (
                    <div
                      key={index}
                      className="w-8 h-8 rounded-full border-2 border-white shadow-lg transform hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Quick highlights */}
            <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
              {theme.decorations && theme.decorations.length > 0 && (
                <p>✨ {theme.decorations.length} decoration ideas included</p>
              )}
              {theme.activities && theme.activities.length > 0 && (
                <p>🎈 {theme.activities.length} fun activities planned</p>
              )}
              {theme.whyRecommended && (
                <p className="italic">"{theme.whyRecommended.slice(0, 80)}..."</p>
              )}
            </div>

            {/* Progress indicator */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse"
                style={{ width: '100%' }}
              />
            </div>
            
            <p className="text-xs text-gray-500 dark:text-gray-400">
              This splash will close automatically in a few seconds...
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}