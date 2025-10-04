"use client";

import { useEffect, useState } from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Sparkles, Crown, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TrialStatusBanner() {
  const { trialStatus, currentPlan, fetchTrialStatus } = useSubscription();
  const router = useRouter();
  const [timeRemaining, setTimeRemaining] = useState(trialStatus.timeRemainingMinutes);

  // Update time remaining every minute
  useEffect(() => {
    if (trialStatus.isTrialActive && trialStatus.trialStatus === 'ACTIVE') {
      const interval = setInterval(() => {
        fetchTrialStatus(); // Refresh trial status
        setTimeRemaining(prev => Math.max(0, prev - 1));
      }, 60000); // Update every minute

      return () => clearInterval(interval);
    }
  }, [trialStatus.isTrialActive, trialStatus.trialStatus, fetchTrialStatus]);

  // Update local time remaining when trial status changes
  useEffect(() => {
    setTimeRemaining(trialStatus.timeRemainingMinutes);
  }, [trialStatus.timeRemainingMinutes]);

  // Don't show banner if user has a paid plan or trial is not started
  if (currentPlan !== 'PRO' && currentPlan !== 'FREE') {
    return null; // User has a paid plan
  }

  if (!trialStatus.hasUsedTrial && trialStatus.trialStatus === 'NOT_STARTED') {
    return null; // Trial not started, will be handled by onboarding
  }

  // Format time remaining
  const formatTimeRemaining = (minutes: number): string => {
    if (minutes <= 0) return '0 minutes';
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    
    return `${hours}h ${remainingMinutes}m`;
  };

  // Active trial banner
  if (trialStatus.isTrialActive && trialStatus.trialStatus === 'ACTIVE') {
    const isLowTime = timeRemaining < 120; // Less than 2 hours
    
    return (
      <Card className={`border-l-4 ${isLowTime ? 'border-l-orange-500 bg-orange-50' : 'border-l-purple-500 bg-purple-50'} mb-6`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {isLowTime ? (
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              ) : (
                <Sparkles className="h-5 w-5 text-purple-600" />
              )}
              <div>
                <h3 className={`font-semibold ${isLowTime ? 'text-orange-800' : 'text-purple-800'}`}>
                  {isLowTime ? '⏰ Trial Ending Soon!' : '🎉 Free Trial Active'}
                </h3>
                <p className={`text-sm ${isLowTime ? 'text-orange-700' : 'text-purple-700'}`}>
                  You have <strong>{formatTimeRemaining(timeRemaining)}</strong> of Pro access remaining
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className={`h-4 w-4 ${isLowTime ? 'text-orange-600' : 'text-purple-600'}`} />
              <span className={`text-sm font-mono ${isLowTime ? 'text-orange-800' : 'text-purple-800'}`}>
                {formatTimeRemaining(timeRemaining)}
              </span>
              <Button 
                onClick={() => router.push('/pricing')}
                size="sm"
                className={isLowTime ? 'bg-orange-600 hover:bg-orange-700' : 'bg-purple-600 hover:bg-purple-700'}
              >
                Upgrade Now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Expired trial banner
  if (trialStatus.hasUsedTrial && trialStatus.trialStatus === 'EXPIRED') {
    return (
      <Card className="border-l-4 border-l-red-500 bg-red-50 mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Crown className="h-5 w-5 text-red-600" />
              <div>
                <h3 className="font-semibold text-red-800">
                  Trial Expired - Upgrade to Continue
                </h3>
                <p className="text-sm text-red-700">
                  Your 24-hour Pro trial has ended. Upgrade to continue using all features.
                </p>
              </div>
            </div>
            <Button 
              onClick={() => router.push('/pricing')}
              className="bg-red-600 hover:bg-red-700"
            >
              View Plans
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}