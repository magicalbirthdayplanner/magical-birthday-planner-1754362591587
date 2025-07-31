"use client";

import Link from 'next/link';
import { Home } from 'lucide-react';
import { ThemeSwitcher } from './ThemeSwitcher';

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Home Link - Left Side */}
          <Link 
            href="/" 
            className="flex items-center space-x-2 text-gray-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors duration-200"
          >
            <Home className="h-5 w-5" />
            <span className="font-semibold text-lg">Home</span>
          </Link>

          {/* Theme Switcher - Right Side */}
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}