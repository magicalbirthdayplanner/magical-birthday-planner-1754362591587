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
    const loadUserTheme = async () => {
      if (typeof window === 'undefined') return;
      
      // Check if user is authenticated and load theme from database
      try {
        const response = await fetch('/api/user/theme');
        if (response.ok) {
          const data = await response.json();
          if (data.theme && (data.theme === 'light' || data.theme === 'dark')) {
            setTheme(data.theme);
            return;
          }
        }
      } catch (error) {
        console.warn('Failed to load user theme from database, using system preference:', error);
      }
      
      // Fallback to system preference if database is unavailable or user not authenticated
      try {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          setTheme('dark');
        } else {
          setTheme('light');
        }
      } catch (mediaError) {
        console.warn('Error checking system theme preference:', mediaError);
        setTheme('light');
      }
    };

    loadUserTheme();
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
    }
  }, [theme]);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    
    // Save to database if user is authenticated
    try {
      await fetch('/api/user/theme', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ theme: newTheme }),
      });
    } catch (error) {
      console.warn('Failed to save theme preference to database:', error);
      // Theme is still applied locally even if database save fails
    }
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