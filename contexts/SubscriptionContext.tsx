"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { useAuth } from './AuthContext';

export type SubscriptionPlan = 'FREE' | 'STARTER' | 'PLUS' | 'PRO' | 'PROFESSIONAL';

export interface SubscriptionStatus {
  isActive: boolean;
  planType: SubscriptionPlan;
  purchaseDate?: string;
  canUpgrade: boolean;
  canDowngrade: boolean;
  nextUpgradePlan: SubscriptionPlan | null;
}

export interface SubscriptionPlanDetails {
  name: string;
  displayName: string;
  description: string;
  price: string;
  features: string[];
  allowedTabs: string[];
}

// Map database plan values to our internal plan types
const PLAN_MAPPING: Record<string, SubscriptionPlan> = {
  'FREE': 'FREE',
  'STARTER': 'STARTER',
  'PLUS': 'PLUS',
  'PRO': 'PRO',
  'PROFESSIONAL': 'PRO' // Map PROFESSIONAL to PRO
};

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlan, SubscriptionPlanDetails> = {
  FREE: {
    name: 'FREE',
    displayName: 'Free',
    description: 'Create parties with basic wizard access only.',
    price: '$0',
    features: [
      'Party creation wizard',
      'Basic theme selection',
      'Guest count planning'
    ],
    allowedTabs: [] // No tabs allowed for free users
  },
  STARTER: {
    name: 'STARTER',
    displayName: 'Starter',
    description: 'Essential party planning tools for getting started.',
    price: '$9.99',
    features: [
      'Theme suggestions based on age',
      'Guest management & RSVP tracking',
      'Smart checklist & timeline',
      'Basic party overview',
      'Venue selection assistance',
    ],
    allowedTabs: ['overview', 'venue', 'themes', 'guests', 'timeline', 'checklist']
  },
  PLUS: {
    name: 'PLUS',
    displayName: 'Plus',
    description: 'Enhanced planning with activities and host management features.',
    price: '$19.99',
    features: [
      'Everything in Starter',
      'AI-powered activity suggestions',
      'Host Mode for party day management',
      'Advanced guest coordination',
      'Enhanced timeline features',
    ],
    allowedTabs: ['overview', 'venue', 'themes', 'guests', 'timeline', 'checklist', 'activities', 'host-mode']
  },
  PRO: {
    name: 'PRO',
    displayName: 'Pro',
    description: 'Complete party planning suite with vendor recommendations and comprehensive features.',
    price: '$29.99',
    features: [
      'Everything in Plus',
      'Vendor recommendations & suggestions',
      'Venue selection assistance',
      'Food & catering recommendations',
      'Complete party planning ecosystem',
      'Priority support',
    ],
    allowedTabs: ['overview', 'themes', 'guests', 'timeline', 'checklist', 'activities', 'host-mode', 'vendor-suggestions', 'venue', 'food']
  },
  // PROFESSIONAL is mapped to PRO, so we don't need a separate entry
};

interface SubscriptionContextType {
  currentPlan: SubscriptionPlan;
  planDetails: SubscriptionPlanDetails;
  subscriptionStatus: SubscriptionStatus;
  isTabAllowed: (tabName: string) => boolean;
  updateUserPlan: (newPlan: SubscriptionPlan) => Promise<void>;
  getRestrictedMessage: (tabName: string) => string;
  hasActiveSubscription: () => boolean;
  markPlanAsPurchased: (plan: SubscriptionPlan) => void;
  canUpgradeTo: (targetPlan: SubscriptionPlan) => boolean;
  getNextUpgradePlan: () => SubscriptionPlan | null;
  loading: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const { user } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan>('FREE');
  const [loading, setLoading] = useState(true);

  // Initialize plan from user data or localStorage
  useEffect(() => {
    const initializePlan = async () => {
      console.log('🔄 SubscriptionContext: Initializing plan...');
      
      // Check if user has purchased a plan
      const hasPurchased = localStorage.getItem('hasPurchasedPlan') === 'true';
      const storedPlan = localStorage.getItem('userSubscriptionPlan') as SubscriptionPlan;
      
      console.log('🔄 SubscriptionContext: localStorage values:', {
        hasPurchasedPlan: localStorage.getItem('hasPurchasedPlan'),
        userSubscriptionPlan: localStorage.getItem('userSubscriptionPlan'),
        userPlanPurchased: localStorage.getItem('userPlanPurchased'),
        hasValidSubscription: localStorage.getItem('hasValidSubscription')
      });
      
      let initialPlan: SubscriptionPlan = 'FREE';
      
      if (hasPurchased && storedPlan && SUBSCRIPTION_PLANS[storedPlan]) {
        initialPlan = storedPlan;
      }
      
      console.log('🔄 SubscriptionContext: Initial plan from localStorage:', initialPlan);
      setCurrentPlan(initialPlan);
      
      if (user) {
        console.log('🔄 SubscriptionContext: User authenticated, fetching plan from database...');
        console.log('🔄 SubscriptionContext: User ID:', user.id);
        try {
          // Try to fetch user's current plan from the database
          const response = await fetch('/api/user/subscription');
          console.log('🔄 SubscriptionContext: API response status:', response.status);
          
          if (response.ok) {
            const data = await response.json();
            console.log('🔄 SubscriptionContext: API response data:', data);
            
            // Map the database plan to our internal plan type
            console.log('🔄 SubscriptionContext: Looking up plan in PLAN_MAPPING:', data.currentPlan);
            const serverPlan = PLAN_MAPPING[data.currentPlan] || 'FREE';
            console.log('🔄 SubscriptionContext: Mapped server plan:', serverPlan);
            
            if (SUBSCRIPTION_PLANS[serverPlan]) {
              console.log('🔄 SubscriptionContext: Setting plan to:', serverPlan);
              setCurrentPlan(serverPlan);
              // Sync localStorage with server
              localStorage.setItem('userSubscriptionPlan', serverPlan);
              localStorage.setItem('hasPurchasedPlan', 'true');
              localStorage.setItem('hasValidSubscription', 'true');
            } else {
              console.log('🔄 SubscriptionContext: Invalid plan, not setting');
            }
          } else {
            console.error('🔄 SubscriptionContext: Failed to fetch user plan from server, status:', response.status);
            const errorData = await response.json().catch(() => ({}));
            console.error('🔄 SubscriptionContext: Error data:', errorData);
            
            // If it's an auth error, clear localStorage and reset to FREE
            if (response.status === 401) {
              console.log('🔄 SubscriptionContext: Clearing localStorage due to auth error');
              localStorage.removeItem('hasPurchasedPlan');
              localStorage.removeItem('userSubscriptionPlan');
              localStorage.removeItem('hasValidSubscription');
              localStorage.removeItem('userPlanPurchased');
              setCurrentPlan('FREE');
            }
          }
        } catch (error) {
          console.error('🔄 SubscriptionContext: Error fetching user plan from server:', error);
          // Continue using localStorage value
        }
      } else {
        console.log('🔄 SubscriptionContext: No user authenticated');
      }
      console.log('🔄 SubscriptionContext: Finished initialization');
      setLoading(false);
    };

    initializePlan();
  }, [user]);

  const planDetails = SUBSCRIPTION_PLANS[currentPlan];

  const isTabAllowed = (tabName: string): boolean => {
    return planDetails.allowedTabs.includes(tabName);
  };

  const getRestrictedMessage = (tabName: string): string => {
    const requiredPlan = getRequiredPlanForTab(tabName);
    const requiredPlanDetails = SUBSCRIPTION_PLANS[requiredPlan];
    return `This feature is only available on the ${requiredPlanDetails.displayName} plan. Upgrade to unlock!`;
  };

  const getRequiredPlanForTab = (tabName: string): SubscriptionPlan => {
    // Check which plan first includes this tab
    if (SUBSCRIPTION_PLANS.STARTER.allowedTabs.includes(tabName)) return 'STARTER';
    if (SUBSCRIPTION_PLANS.PLUS.allowedTabs.includes(tabName)) return 'PLUS';
    return 'PRO';
  };

  const markPlanAsPurchased = (plan: SubscriptionPlan): void => {
    localStorage.setItem('hasPurchasedPlan', 'true');
    localStorage.setItem('userPlanPurchased', plan);
    localStorage.setItem('hasValidSubscription', 'true');
    localStorage.setItem('userSubscriptionPlan', plan);
    localStorage.setItem('subscriptionPurchaseDate', new Date().toISOString());
    setCurrentPlan(plan);
    
    // Dispatch event for any components listening
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('subscription-purchased', {
        detail: { plan, planDetails: SUBSCRIPTION_PLANS[plan] }
      }));
    }
  };

  const canUpgradeTo = (targetPlan: SubscriptionPlan): boolean => {
    const planHierarchy = ['FREE', 'STARTER', 'PLUS', 'PRO'];
    const currentIndex = planHierarchy.indexOf(currentPlan);
    const targetIndex = planHierarchy.indexOf(targetPlan);
    return targetIndex > currentIndex;
  };

  const getNextUpgradePlan = (): SubscriptionPlan | null => {
    switch (currentPlan) {
      case 'FREE': return 'STARTER';
      case 'STARTER': return 'PLUS';
      case 'PLUS': return 'PRO';
      case 'PRO': return null;
      default: return null;
    }
  };

  const hasActiveSubscription = (): boolean => {
    // Check if user has purchased any plan
    // This should be set to 'true' after successful payment
    const hasPurchasedPlan = localStorage.getItem('hasPurchasedPlan') === 'true';
    
    // Also check for any subscription indicator in user data or localStorage
    const userPlanPurchased = localStorage.getItem('userPlanPurchased');
    const hasValidSubscription = localStorage.getItem('hasValidSubscription') === 'true';
    
    // Check if user has a non-FREE plan in the database
    const hasDatabasePlan = currentPlan !== 'FREE';
    
    console.log('🔄 SubscriptionContext: hasActiveSubscription checks:', {
      hasPurchasedPlan,
      userPlanPurchased,
      hasValidSubscription,
      hasDatabasePlan,
      currentPlan
    });
    
    // A user has an active subscription if:
    // 1. They have a non-FREE plan from the database, OR
    // 2. They have purchased a plan according to localStorage
    return hasDatabasePlan || hasPurchasedPlan || hasValidSubscription || !!userPlanPurchased;
  };

  // Calculate subscription status dynamically - this will update when currentPlan changes
  const subscriptionStatus = useMemo<SubscriptionStatus>(() => {
    const isActive = hasActiveSubscription();
    const status = {
      isActive,
      planType: currentPlan,
      purchaseDate: localStorage.getItem('subscriptionPurchaseDate') || undefined,
      canUpgrade: currentPlan !== 'PRO',
      canDowngrade: false, // No downgrades allowed
      nextUpgradePlan: getNextUpgradePlan()
    };
    
    console.log('🔄 SubscriptionContext: Calculated subscriptionStatus:', status);
    
    return status;
  }, [currentPlan]);

  const updateUserPlan = async (newPlan: SubscriptionPlan): Promise<void> => {
    try {
      setLoading(true);
      
      // Update local state and localStorage immediately for instant UI feedback
      setCurrentPlan(newPlan);
      localStorage.setItem('userSubscriptionPlan', newPlan);
      localStorage.setItem('hasPurchasedPlan', 'true');
      localStorage.setItem('hasValidSubscription', 'true');
      
      // Show success notification immediately
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('subscription-updated', {
          detail: { newPlan, planDetails: SUBSCRIPTION_PLANS[newPlan] }
        }));
      }
      
      // Try to update plan in database in background (optional)
      if (user) {
        try {
          const response = await fetch('/api/user/subscription', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ currentPlan: newPlan }),
          });

          if (!response.ok) {
            console.warn('Failed to update subscription plan on server, but continuing with local change');
          }
        } catch (error) {
          console.warn('Error updating subscription plan on server:', error);
          // Don't throw error - local update was successful
        }
      }
    } catch (error) {
      console.error('Error updating subscription plan:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <SubscriptionContext.Provider
      value={{
        currentPlan,
        planDetails,
        subscriptionStatus,
        isTabAllowed,
        updateUserPlan,
        getRestrictedMessage,
        hasActiveSubscription,
        markPlanAsPurchased,
        canUpgradeTo,
        getNextUpgradePlan,
        loading,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}