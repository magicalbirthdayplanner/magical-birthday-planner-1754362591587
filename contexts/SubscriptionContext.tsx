"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

export type SubscriptionPlan = 'FREE' | 'STARTER' | 'PROFESSIONAL';

export interface SubscriptionPlanDetails {
  name: string;
  displayName: string;
  description: string;
  price: string;
  features: string[];
  allowedTabs: string[];
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlan, SubscriptionPlanDetails> = {
  FREE: {
    name: 'FREE',
    displayName: 'Starter',
    description: 'A quick and easy starting point for parents seeking basic help.',
    price: 'Free',
    features: [
      'Theme suggestions based on age',
      'Smart checklist & timeline',
      'Simple invitation creator',
    ],
    allowedTabs: ['overview', 'guests', 'timeline', 'checklist']
  },
  STARTER: {
    name: 'STARTER',
    displayName: 'Plus',
    description: 'Smart and simple AI-powered birthday planning for busy parents.',
    price: '$14.99',
    features: [
      'Everything in Starter',
      'RSVP tracking',
      'Task reminders',
      'Basic budget tracker (manual input)',
    ],
    allowedTabs: ['overview', 'budget', 'guests', 'timeline', 'checklist']
  },
  PROFESSIONAL: {
    name: 'PROFESSIONAL',
    displayName: 'Pro',
    description: 'All-in-one planning experience with advanced support and recommendations.',
    price: '$29.99',
    features: [
      'Everything in Plus',
      'Vendor recommendations (cakes, decor, entertainment)',
      'Personalized food suggestions by age & theme',
      'Advanced budget tracking',
      'Premium support',
    ],
    allowedTabs: ['overview', 'budget', 'shopping', 'venue', 'food', 'cake', 'guests', 'timeline', 'checklist']
  }
};

interface SubscriptionContextType {
  currentPlan: SubscriptionPlan;
  planDetails: SubscriptionPlanDetails;
  isTabAllowed: (tabName: string) => boolean;
  updateUserPlan: (newPlan: SubscriptionPlan) => Promise<void>;
  getRestrictedMessage: (tabName: string) => string;
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
      if (user) {
        try {
          // Fetch user's current plan from the database
          const response = await fetch('/api/user/subscription');
          if (response.ok) {
            const data = await response.json();
            setCurrentPlan(data.currentPlan || 'FREE');
          }
        } catch (error) {
          console.error('Error fetching user plan:', error);
          // Fallback to localStorage or default
          const storedPlan = localStorage.getItem('userSubscriptionPlan') as SubscriptionPlan;
          if (storedPlan && SUBSCRIPTION_PLANS[storedPlan]) {
            setCurrentPlan(storedPlan);
          }
        }
      } else {
        // For non-authenticated users, use localStorage or default to FREE
        const storedPlan = localStorage.getItem('userSubscriptionPlan') as SubscriptionPlan;
        setCurrentPlan(storedPlan || 'FREE');
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
    if (SUBSCRIPTION_PLANS.FREE.allowedTabs.includes(tabName)) return 'FREE';
    if (SUBSCRIPTION_PLANS.STARTER.allowedTabs.includes(tabName)) return 'STARTER';
    return 'PROFESSIONAL';
  };

  const updateUserPlan = async (newPlan: SubscriptionPlan): Promise<void> => {
    try {
      setLoading(true);
      
      if (user) {
        // Update plan in database
        const response = await fetch('/api/user/subscription', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ currentPlan: newPlan }),
        });

        if (!response.ok) {
          throw new Error('Failed to update subscription plan');
        }
      }

      // Update local state and localStorage
      setCurrentPlan(newPlan);
      localStorage.setItem('userSubscriptionPlan', newPlan);

      // Show success notification
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('subscription-updated', {
          detail: { newPlan, planDetails: SUBSCRIPTION_PLANS[newPlan] }
        }));
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
        isTabAllowed,
        updateUserPlan,
        getRestrictedMessage,
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