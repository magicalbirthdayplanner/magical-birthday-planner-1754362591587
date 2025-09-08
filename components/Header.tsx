"use client";

import Link from 'next/link';
import { Home, User, LogOut, Calendar, Loader2, Settings, Star, Zap, Crown, CreditCard, ChevronRight } from 'lucide-react';
import { ThemeSwitcher } from './ThemeSwitcher';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

const planIcons = {
  FREE: User,
  STARTER: Star,
  PLUS: Zap,
  PRO: Crown,
};

const planColors = {
  FREE: {
    color: "text-gray-700 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-800",
  },
  STARTER: {
    color: "text-purple-700 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  PLUS: {
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  PRO: {
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  }
};

export function Header() {
  const { user, signOut, isSigningOut } = useAuth();
  const { currentPlan, planDetails, subscriptionStatus, updateUserPlan, canUpgradeTo, loading } = useSubscription();
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);
  const [userDisplayName, setUserDisplayName] = useState<string>('');

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

  // Plan changes now redirect to pricing page for payment
  // Actual plan updates happen after successful payment via checkout-success page

  // Initialize display name and listen for profile updates
  useEffect(() => {
    if (user) {
      setUserDisplayName(user.user_metadata?.display_name || user.email?.split('@')[0] || 'Account');
    }

    // Listen for profile updates
    const handleProfileUpdate = (event: CustomEvent) => {
      const { displayName, name } = event.detail;
      setUserDisplayName(displayName || name || user?.email?.split('@')[0] || 'Account');
    };

    window.addEventListener('profileUpdated', handleProfileUpdate as EventListener);

    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate as EventListener);
    };
  }, [user]);

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
                    <Button variant="ghost" size="sm" className="flex items-center space-x-2 px-3 sm:px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 rounded-lg">
                      <User className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                      <span className="hidden md:inline text-sm font-medium text-gray-900 dark:text-gray-100 max-w-32 truncate">
                        {userDisplayName}
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

                    <DropdownMenuItem asChild>
                      <Link href="/account" className="flex items-center">
                        <Settings className="mr-2 h-4 w-4" />
                        Profile Management
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    
                    {/* Plan Display and Management */}
                    <div className="px-2 py-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {(() => {
                            const PlanIcon = planIcons[currentPlan];
                            const colors = planColors[currentPlan];
                            return (
                              <>
                                <div className={`p-1 rounded-full ${colors.bgColor}`}>
                                  <PlanIcon className={`h-3 w-3 ${colors.color}`} />
                                </div>
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                  {planDetails.displayName} Plan
                                </span>
                              </>
                            );
                          })()}
                        </div>
                        {subscriptionStatus.isActive ? (
                          <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs px-2 py-0.5">
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs px-2 py-0.5">
                            Free
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Plan Management Submenu */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="flex items-center">
                        <CreditCard className="mr-2 h-4 w-4" />
                        <span>Manage Plan</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-48">
                        {/* Show current plan */}
                        {currentPlan !== 'FREE' && (
                          <div className="px-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                {(() => {
                                  const PlanIcon = planIcons[currentPlan];
                                  const colors = planColors[currentPlan];
                                  return (
                                    <>
                                      <div className={`p-1 rounded-full ${colors.bgColor}`}>
                                        <PlanIcon className={`h-3 w-3 ${colors.color}`} />
                                      </div>
                                      <span className="text-sm font-medium">{planDetails.displayName}</span>
                                    </>
                                  );
                                })()}
                              </div>
                              <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 text-xs">
                                Current
                              </Badge>
                            </div>
                          </div>
                        )}
                        
                        {/* Show upgrade options */}
                        {subscriptionStatus.canUpgrade && (
                          <>
                            {currentPlan !== 'FREE' && <DropdownMenuSeparator />}
                            <div className="px-2 py-1">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {currentPlan === 'FREE' ? 'Choose Plan' : 'Upgrade Options'}
                              </span>
                            </div>
                            {(['STARTER', 'PLUS', 'PRO'] as const).map((planKey) => {
                              if (!canUpgradeTo(planKey)) return null;
                              
                              const PlanIcon = planIcons[planKey];
                              const colors = planColors[planKey];
                              const plan = { displayName: planKey === 'STARTER' ? 'Starter' : planKey === 'PLUS' ? 'Plus' : 'Pro' };
                              
                              return (
                                <DropdownMenuItem
                                  key={planKey}
                                  asChild
                                  className="flex items-center justify-between cursor-pointer"
                                >
                                  <Link href={`/pricing?upgrade=${planKey.toLowerCase()}`}>
                                    <div className="flex items-center space-x-2">
                                      <div className={`p-1 rounded-full ${colors.bgColor}`}>
                                        <PlanIcon className={`h-3 w-3 ${colors.color}`} />
                                      </div>
                                      <span className="text-sm">{plan.displayName}</span>
                                    </div>
                                    <ChevronRight className="h-3 w-3 text-gray-400" />
                                  </Link>
                                </DropdownMenuItem>
                              );
                            })}
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/pricing" className="flex items-center justify-between">
                            <span>View All Plans</span>
                            <ChevronRight className="h-3 w-3" />
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

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