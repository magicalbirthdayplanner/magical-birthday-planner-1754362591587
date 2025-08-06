"use client";

import Link from 'next/link';
import { Home, User, LogOut, Calendar, Loader2, Settings, Star, Zap, Crown } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';

const planDetails = {
  FREE: {
    name: "Essential",
    icon: Star,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
  STARTER: {
    name: "Magical",
    icon: Zap,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  PROFESSIONAL: {
    name: "Ultimate",
    icon: Crown,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
  }
};

type PlanType = 'FREE' | 'STARTER' | 'PROFESSIONAL';

export function Header() {
  const { user, signOut, isSigningOut } = useAuth();
  const [userPlan, setUserPlan] = useState<PlanType>('FREE');

  // Listen for plan changes from localStorage or account page
  useEffect(() => {
    if (user) {
      // Check if user is superadmin for plan switching functionality
      const isSupeadmin = user.email === "arunexprasad@gmail.com";
      if (isSupeadmin) {
        // Listen for plan changes stored in localStorage for superadmin
        const storedPlan = localStorage.getItem('superadmin_plan') as PlanType;
        if (storedPlan && planDetails[storedPlan]) {
          setUserPlan(storedPlan);
        }
        
        // Set up event listener for plan changes
        const handlePlanChange = (event: CustomEvent) => {
          setUserPlan(event.detail.plan);
        };
        
        window.addEventListener('planChanged', handlePlanChange as EventListener);
        
        return () => {
          window.removeEventListener('planChanged', handlePlanChange as EventListener);
        };
      }
    }
  }, [user]);

  const handleSignOut = async () => {
    if (isSigningOut) return; // Prevent multiple clicks
    
    try {
      const { error } = await signOut();
      if (!error) {
        // Redirect to home page after successful signout
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Unexpected error during signout:', error);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Home Link - Left Side */}
          <Link 
            href="/" 
            className="flex items-center space-x-1 sm:space-x-2 text-gray-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors duration-200"
          >
            <Home className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="font-semibold text-base sm:text-lg">Home</span>
          </Link>

          {/* Right Side - Authentication & Theme */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {user ? (
              <>
                {/* Dashboard Link */}
                <Link 
                  href="/dashboard"
                  className="flex items-center space-x-1 sm:space-x-2 text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors duration-200"
                >
                  <Calendar className="h-4 w-4" />
                  <span className="hidden md:inline text-sm">Dashboard</span>
                </Link>

                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex flex-col items-start space-y-0 px-2 sm:px-3 py-1">
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        <User className="h-4 w-4" />
                        <span className="hidden md:inline text-sm max-w-32 truncate">
                          {user.user_metadata?.display_name || user.email?.split('@')[0] || 'Account'}
                        </span>
                      </div>
                      {/* Subtle plan indication */}
                      <div className="hidden md:flex items-center space-x-1 ml-5">
                        {(() => {
                          const plan = planDetails[userPlan];
                          const PlanIcon = plan.icon;
                          return (
                            <>
                              <PlanIcon className={`h-3 w-3 ${plan.color}`} />
                              <span className={`text-xs ${plan.color} font-medium`}>
                                {plan.name}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard" className="flex items-center">
                        <Calendar className="mr-2 h-4 w-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/account" className="flex items-center">
                        <Settings className="mr-2 h-4 w-4" />
                        Profile Management
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={handleSignOut} 
                      className="text-red-600"
                      disabled={isSigningOut}
                    >
                      {isSigningOut ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <LogOut className="mr-2 h-4 w-4" />
                      )}
                      {isSigningOut ? 'Signing Out...' : 'Sign Out'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                {/* Sign In / Sign Up Links */}
                <Link 
                  href="/signin"
                  className="text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors duration-200 text-sm sm:text-base"
                >
                  Sign In
                </Link>
                <Button asChild size="default" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-3 sm:px-4 text-sm">
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