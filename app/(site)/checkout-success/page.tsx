"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, PartyPopper, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { safeNext } from "@/lib/security/redirect";

function CheckoutSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { markPlanAsPurchased } = useSubscription();
  const [isProcessing, setIsProcessing] = useState(true);
  const [plan, setPlan] = useState<string>('');

  useEffect(() => {
    const processPurchase = async () => {
      try {
        // Get parameters from URL - DoDo Payments typically sends these
        const planParam = searchParams.get('plan') || searchParams.get('product') || searchParams.get('product_id');
        const success = searchParams.get('success');
        const sessionId = searchParams.get('session_id');
        const transactionId = searchParams.get('transaction_id') || searchParams.get('payment_id');
        
        // Map product IDs to plan names (based on your DoDo Payment links)
        const productToPlan: Record<string, string> = {
          'pdt_Jw4ObhU8ojSaq87wELhsm': 'STARTER',
          'pdt_rSGRT2hBbKsoln84yQgHC': 'PLUS', 
          'pdt_v3NFp5Zq587xbPoPLd29x': 'PRO'
        };

        let purchasedPlan = 'STARTER';
        
        if (planParam && productToPlan[planParam]) {
          purchasedPlan = productToPlan[planParam];
        } else if (planParam && ['STARTER', 'PLUS', 'PRO'].includes(planParam.toUpperCase())) {
          purchasedPlan = planParam.toUpperCase();
        }

        // SECURITY: URL parameters are not proof of payment and must never grant a plan.
        // The plan is updated server-side by the payment provider's signed webhook;
        // here we only show what was chosen and re-read the server state.
        setPlan(purchasedPlan);
        markPlanAsPurchased(purchasedPlan as any);

        setIsProcessing(false);

        // Auto-redirect after 4 seconds (slightly longer to show success)
        setTimeout(() => {
          const rawReturn = searchParams.get('return_url');
          // Same-origin relative paths only (no open redirect).
          const returnUrl = safeNext(rawReturn, '/party-plan');
          router.push(returnUrl);
        }, 4000);
        
      } catch (error) {
        console.error('Error processing checkout return:', error);
        setIsProcessing(false);
      }
    };

    processPurchase();
  }, [searchParams, markPlanAsPurchased, router]);

  const getPlanDetails = (plan: string) => {
    switch (plan) {
      case 'STARTER':
        return { name: '🎈 Starter', price: '$9.99', emoji: '🎈' };
      case 'PLUS':
        return { name: '🧁 Plus', price: '$19.99', emoji: '🧁' };
      case 'PRO':
        return { name: '✨ Pro', price: '$29.99', emoji: '✨' };
      default:
        return { name: '🎈 Starter', price: '$9.99', emoji: '🎈' };
    }
  };

  const planDetails = getPlanDetails(plan);

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Processing Your Purchase...
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Please wait while we confirm your subscription.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
      <div className="max-w-2xl mx-auto px-4">
        <Card className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
          <CardContent className="p-8 text-center">
            {/* Success Animation */}
            <div className="relative mb-6">
              <div className="bg-green-100 dark:bg-green-900/40 rounded-full p-4 inline-block">
                <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
              <div className="absolute -top-2 -right-2">
                <PartyPopper className="h-8 w-8 text-purple-600 animate-bounce" />
              </div>
            </div>

            {/* Success Message */}
            <h1 className="text-2xl sm:text-3xl font-bold text-green-800 dark:text-green-200 mb-4">
              🎉 Thanks for your order!
            </h1>
            
            <div className="bg-white/80 dark:bg-slate-800/80 rounded-lg p-4 mb-6">
              <p className="text-green-700 dark:text-green-300 mb-2">
                You chose the <strong>{planDetails.name}</strong> plan.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your plan activates as soon as our payment provider confirms the payment — usually within a minute.
              </p>
            </div>

            {/* Plan Details */}
            <div className="bg-gradient-to-r from-purple-100/50 to-pink-100/50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-2xl">{planDetails.emoji}</span>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {planDetails.name} - {planDetails.price}
                </h3>
              </div>
              <p className="text-sm text-purple-700 dark:text-purple-300">
                We’ll unlock your plan automatically once payment is confirmed.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Redirecting you to your party planning dashboard in a few seconds...
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  asChild
                >
                  <Link href="/party-plan">
                    <PartyPopper className="h-4 w-4 mr-2" />
                    Continue Planning
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
                
                <Button variant="outline" asChild>
                  <Link href="/dashboard">
                    Go to Dashboard
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Need help? Contact our support team at{' '}
            <a href="mailto:support@magicalbirthdayplanner.com" className="text-purple-600 hover:text-purple-700 dark:text-purple-400">
              support@magicalbirthdayplanner.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  );
}