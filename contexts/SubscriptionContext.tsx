"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

export type SubscriptionPlan = 'FREE' | 'STARTER' | 'PLUS' | 'PRO';

export interface SubscriptionPlanDetails {
  name: string;
  displayName: string;
  description: string;
  price: string;
  features: string[];
  allowedTabs: string[];
}

export interface SubscriptionStatus {
  isActive: boolean;
  planType: SubscriptionPlan;
  purchaseDate?: string;
  canUpgrade: boolean;
  canDowngrade: boolean;
  nextUpgradePlan?: SubscriptionPlan;
}

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
  }
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
      // Check if user has purchased a plan
      const hasPurchased = localStorage.getItem('hasPurchasedPlan') === 'true';
      const storedPlan = localStorage.getItem('userSubscriptionPlan') as SubscriptionPlan;
      
      let initialPlan: SubscriptionPlan = 'FREE';
      
      if (hasPurchased && storedPlan && SUBSCRIPTION_PLANS[storedPlan]) {
        initialPlan = storedPlan;
      }
      
      setCurrentPlan(initialPlan);
      
      if (user) {
        try {
          // Try to fetch user's current plan from the database
          const response = await fetch('/api/user/subscription');
          if (response.ok) {
            const data = await response.json();
            const serverPlan = data.currentPlan || 'STARTER';
            if (SUBSCRIPTION_PLANS[serverPlan]) {
              setCurrentPlan(serverPlan);
              // Sync localStorage with server
              localStorage.setItem('userSubscriptionPlan', serverPlan);
            }
          }
        } catch (error) {
          console.error('Error fetching user plan from server:', error);
          // Continue using localStorage value
        }
      }
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
    
    return hasPurchasedPlan || hasValidSubscription || !!userPlanPurchased;
  };

  const subscriptionStatus: SubscriptionStatus = {
    isActive: hasActiveSubscription(),
    planType: currentPlan,
    purchaseDate: localStorage.getItem('subscriptionPurchaseDate') || undefined,
    canUpgrade: currentPlan !== 'PRO',
    canDowngrade: false, // No downgrades allowed
    nextUpgradePlan: getNextUpgradePlan()
  };

  const updateUserPlan = async (newPlan: SubscriptionPlan): Promise<void> => {
    try {
      setLoading(true);
      
      // Update local state and localStorage immediately for instant UI feedback
      setCurrentPlan(newPlan);
      localStorage.setItem('userSubscriptionPlan', newPlan);
      
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