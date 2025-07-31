"use client";

import Link from 'next/link';
import { Home, User, LogOut, Calendar } from 'lucide-react';
import { ThemeSwitcher } from './ThemeSwitcher';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Header() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

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

          {/* Right Side - Authentication & Theme */}
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                {/* Dashboard Link */}
                <Link 
                  href="/dashboard"
                  className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors duration-200"
                >
                  <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>

                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                      <User className="h-4 w-4" />
                      <span className="hidden sm:inline">
                        {user.user_metadata?.display_name || user.email?.split('@')[0] || 'Account'}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard" className="flex items-center">
                        <Calendar className="mr-2 h-4 w-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                {/* Sign In / Sign Up Links */}
                <Link 
                  href="/signin"
                  className="text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors duration-200"
                >
                  Sign In
                </Link>
                <Button asChild size="sm" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </>
            )}
            
            {/* Theme Switcher */}
            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}