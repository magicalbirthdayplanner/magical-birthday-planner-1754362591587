"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedTheme = localStorage.getItem('theme') as Theme | null;
        if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
          setTheme(savedTheme);
        } else {
          // Check system preference safely
          try {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
              setTheme('dark');
            }
          } catch (mediaError) {
            console.warn('Error checking system theme preference:', mediaError);
            // Fallback to light theme
            setTheme('light');
          }
        }
      } catch (storageError) {
        console.warn('Error accessing localStorage for theme:', storageError);
        // Fallback to light theme
        setTheme('light');
      }
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
    }
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('theme', theme);
      } catch (error) {
        console.warn('Error saving theme to localStorage:', error);
      }
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}