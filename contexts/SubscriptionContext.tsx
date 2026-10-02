"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { useAuth } from './AuthContext';

export type SubscriptionPlan = 'FREE' | 'STARTER' | 'PLUS' | 'PRO' | 'PROFESSIONAL';

export interface TrialStatus {
  isTrialActive: boolean;
  trialStartedAt?: string;
  trialExpiresAt?: string;
  trialPlan?: SubscriptionPlan;
  hasUsedTrial: boolean;
  timeRemainingMinutes: number;
  trialStatus: 'NOT_STARTED' | 'ACTIVE' | 'EXPIRED';
}

export interface SubscriptionStatus {
  isActive: boolean;
  planType: SubscriptionPlan;
  purchaseDate?: string;
  canUpgrade: boolean;
  canDowngrade: boolean;
  nextUpgradePlan: SubscriptionPlan | null;
  trial: TrialStatus;
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
  PROFESSIONAL: {
    name: 'PROFESSIONAL',
    displayName: 'Professional',
    description: 'Complete party planning ecosystem with vendor recommendations.',
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
  trialStatus: TrialStatus;
  fetchTrialStatus: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

interface SubscriptionProviderProps {
  children: ReactNode;
}

const LEGACY_PLAN_KEYS = ['hasPurchasedPlan', 'userSubscriptionPlan', 'userPlanPurchased', 'hasValidSubscription', 'subscriptionPurchaseDate', 'superadmin_plan', 'lastPurchase'];

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const { user } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan>('FREE');
  const [loading, setLoading] = useState(true);
  const [trialStatus, setTrialStatus] = useState<TrialStatus>({
    isTrialActive: false,
    hasUsedTrial: false,
    timeRemainingMinutes: 0,
    trialStatus: 'NOT_STARTED'
  });

  // Fetch trial status from API
  const fetchTrialStatus = async () => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/user/trial');
      if (response.ok) {
        const data = await response.json();
        setTrialStatus({
          isTrialActive: data.isTrialActive,
          trialStartedAt: data.trialStartedAt,
          trialExpiresAt: data.trialExpiresAt,
          trialPlan: data.trialPlan,
          hasUsedTrial: data.hasUsedTrial,
          timeRemainingMinutes: data.timeRemainingMinutes,
          trialStatus: data.trialStatus
        });
        
        // Update current plan based on trial status
        if (data.isTrialActive && data.trialStatus === 'ACTIVE') {
          setCurrentPlan(data.trialPlan || 'PRO');
        } else {
          setCurrentPlan(data.currentPlan || 'FREE');
        }
      }
    } catch (error) {
      console.error('Error fetching trial status:', error);
    }
  };

  // Initialize plan from user data or localStorage
  useEffect(() => {
    const initializePlan = async () => {
      console.log('🔄 SubscriptionContext: Initializing plan...');
      
      // Plan state is server-authoritative. Legacy localStorage flags used to grant
      // paid plans client-side; they are ignored and cleared.
      if (typeof window !== 'undefined') {
        for (const k of LEGACY_PLAN_KEYS) localStorage.removeItem(k);
      }
      const initialPlan: SubscriptionPlan = 'FREE';

      setCurrentPlan(initialPlan);
      
      if (user) {
        console.log('🔄 SubscriptionContext: User authenticated, fetching plan and trial status from database...');
        console.log('🔄 SubscriptionContext: User ID:', user.id);
        
        // Fetch trial status first
        await fetchTrialStatus();
        
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
            
            // Check if user has an active trial that should override the server plan
            if (trialStatus.isTrialActive && trialStatus.trialStatus === 'ACTIVE') {
              console.log('🔄 SubscriptionContext: User has active trial, using trial plan:', trialStatus.trialPlan);
              setCurrentPlan(trialStatus.trialPlan || 'PRO');
            } else if (SUBSCRIPTION_PLANS[serverPlan]) {
              console.log('🔄 SubscriptionContext: Setting plan to:', serverPlan);
              setCurrentPlan(serverPlan);
            } else {
              console.log('🔄 SubscriptionContext: Invalid plan, not setting');
            }
          } else {
            console.error('🔄 SubscriptionContext: Failed to fetch user plan from server, status:', response.status);
            const errorData = await response.json().catch(() => ({}));
            console.error('🔄 SubscriptionContext: Error data:', errorData);
            
            // If it's an auth error, clear localStorage and reset to FREE
            if (errorData.message?.includes('Authentication required')) {
              console.log('🔄 SubscriptionContext: Clearing localStorage due to auth error');
              if (typeof window !== 'undefined') {
                localStorage.removeItem('hasPurchasedPlan');
                localStorage.removeItem('userSubscriptionPlan');
                localStorage.removeItem('hasValidSubscription');
                localStorage.removeItem('userPlanPurchased');
              }
              // Check if trial is active before setting to FREE
              if (!(trialStatus.isTrialActive && trialStatus.trialStatus === 'ACTIVE')) {
                setCurrentPlan('FREE');
              }
            }
          }
        } catch (error) {
          console.error('🔄 SubscriptionContext: Error fetching user plan from server:', error);
          // Fail closed: stay on FREE (or the server-confirmed trial).
        }
      } else {
        console.log('🔄 SubscriptionContext: No user authenticated');
      }
      console.log('🔄 SubscriptionContext: Finished initialization');
      setLoading(false);
    };

    initializePlan();
  }, [user, trialStatus.isTrialActive]);

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

  // A checkout redirect is NOT proof of payment. The plan only changes once the
  // payment provider's signed webhook updates it server-side; here we just re-read it.
  const markPlanAsPurchased = (plan: SubscriptionPlan): void => {
    void refreshPlanFromServer();
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('subscription-purchase-pending', {
        detail: { plan, planDetails: SUBSCRIPTION_PLANS[plan] }
      }));
    }
  };

  const refreshPlanFromServer = async (): Promise<void> => {
    if (!user) return;
    await fetchTrialStatus();
    try {
      const response = await fetch('/api/user/subscription');
      if (response.ok) {
        const data = await response.json();
        const serverPlan = PLAN_MAPPING[data.currentPlan] || 'FREE';
        if (!(trialStatus.isTrialActive && trialStatus.trialStatus === 'ACTIVE') && SUBSCRIPTION_PLANS[serverPlan]) {
          setCurrentPlan(serverPlan);
        }
      }
    } catch {
      /* keep current server-derived state */
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
    // Only server-derived state counts: an active trial or a non-FREE plan from the database.
    const hasActiveTrial = trialStatus.isTrialActive && trialStatus.trialStatus === 'ACTIVE';
    return hasActiveTrial || currentPlan !== 'FREE';
  };

  // Calculate subscription status dynamically - this will update when currentPlan changes
  const subscriptionStatus = useMemo<SubscriptionStatus>(() => {
    const isActive = hasActiveSubscription();
    const status = {
      isActive,
      planType: currentPlan,
      purchaseDate: undefined,
      canUpgrade: currentPlan !== 'PRO',
      canDowngrade: false, // No downgrades allowed
      nextUpgradePlan: getNextUpgradePlan(),
      trial: trialStatus
    };
    
    console.log('🔄 SubscriptionContext: Calculated subscriptionStatus:', status);
    
    return status;
  }, [currentPlan, trialStatus]);

  // Plans cannot be changed from the browser (the server rejects it). Kept for API
  // compatibility with the legacy account page; it re-syncs and reports the refusal.
  const updateUserPlan = async (_newPlan: SubscriptionPlan): Promise<void> => {
    await refreshPlanFromServer();
    throw new Error('Plan changes are managed by billing and cannot be made from the app.');
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
        trialStatus,
        fetchTrialStatus,
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