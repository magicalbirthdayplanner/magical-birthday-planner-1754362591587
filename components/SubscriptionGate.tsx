"use client";

import { CheckoutButton } from '@/components/billing/CheckoutButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Zap, Star, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

const planDetails = [
  {
    key: 'STARTER',
    name: "🎈 Starter",
    price: "$9.99",
    description: "Essential party planning tools for getting started.",
    icon: Star,
    gradient: "from-purple-500 to-pink-500",
    bgGradient: "from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20",
    features: [
      "Theme suggestions based on age",
      "Guest management & RSVP tracking", 
      "Smart checklist & timeline",
      "Basic party overview",
      "Venue selection assistance"
    ],
    popular: false
  },
  {
    key: 'PLUS',
    name: "🧁 Plus",
    price: "$19.99", 
    description: "Enhanced planning with activities and host management features.",
    icon: Zap,
    gradient: "from-blue-500 to-cyan-500",
    bgGradient: "from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20",
    features: [
      "Everything in Starter",
      "AI-powered activity suggestions",
      "Host Mode for party day management", 
      "Advanced guest coordination",
      "Enhanced timeline features"
    ],
    popular: true
  },
  {
    key: 'PRO',
    name: "✨ Pro",
    price: "$29.99",
    description: "Complete party planning suite with vendor recommendations.",
    icon: Crown,
    gradient: "from-emerald-500 to-teal-500", 
    bgGradient: "from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20",
    features: [
      "Everything in Plus",
      "Vendor recommendations & suggestions",
      "Food & catering recommendations",
      "Complete party planning ecosystem",
      "Priority support"
    ],
    popular: false
  }
];

interface SubscriptionGateProps {
  onClose?: () => void;
  title?: string;
  description?: string;
  showPartyCreationSuccess?: boolean;
}

export default function SubscriptionGate({ 
  onClose, 
  title = "Unlock Your Party Planning Tools",
  description = "Continue planning your magical birthday celebration with full access to all our features.",
  showPartyCreationSuccess = false 
}: SubscriptionGateProps) {
  const { user } = useAuth();

  // Get current URL for return after purchase

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-6xl mx-auto">
        {/* Success Message for Party Creation */}
        {showPartyCreationSuccess && (
          <Card className="mb-8 border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                  🎉 Party Created Successfully!
                </h3>
              </div>
              <p className="text-green-700 dark:text-green-300">
                Your party details have been saved. Now choose a plan to access the full party management dashboard and start detailed planning.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
            🎂 Pay per party. No monthly subscriptions.
          </Badge>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-4">
            {title}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {description}
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {planDetails.map((plan) => {
            const PlanIcon = plan.icon;
            return (
              <Card 
                key={plan.key}
                className={`relative overflow-hidden border-2 transition-all duration-300 hover:scale-105 hover:shadow-xl ${
                  plan.popular 
                    ? 'border-blue-500 shadow-lg scale-105' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-center py-2 text-sm font-medium">
                    🌟 Most Popular
                  </div>
                )}
                
                <CardHeader className={`bg-gradient-to-br ${plan.bgGradient} ${plan.popular ? 'pt-12' : 'pt-6'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-full bg-gradient-to-r ${plan.gradient}`}>
                      <PlanIcon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {plan.name}
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    {plan.description}
                  </CardDescription>
                  <div className="flex items-baseline mt-4">
                    <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                      {plan.price}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400 ml-2 text-sm">
                      per party
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="p-6">
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <CheckoutButton
                    plan={plan.key as 'STARTER' | 'PLUS' | 'PRO'}
                    className={`text-sm ${
                      plan.popular
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                        : `bg-gradient-to-r ${plan.gradient} hover:opacity-90`
                    }`}
                  >
                    Choose {plan.key === 'STARTER' ? 'Starter' : plan.key === 'PLUS' ? 'Plus' : 'Pro'}
                  </CheckoutButton>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="text-center space-y-4">
          {user ? (
            <>
              <p className="text-gray-600 dark:text-gray-400">
                After purchasing, you'll get instant access to all your party planning tools.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link href="/dashboard" className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium">
                  ← Back to Dashboard
                </Link>
                <Link href="/pricing" className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium inline-flex items-center">
                  Compare All Plans
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Don't have an account yet?
              </p>
              <Button variant="outline" size="lg" asChild>
                <Link href="/signup">
                  Sign Up Free & Continue Planning
                </Link>
              </Button>
            </>
          )}
        </div>

        {/* Support note */}
        <div className="mt-12 text-center">
          <Card className="bg-gradient-to-r from-purple-100/50 to-pink-100/50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
            <CardContent className="p-4">
              <p className="text-sm text-purple-700 dark:text-purple-300">
                💝 <strong>Risk-free guarantee:</strong> If you're not completely satisfied with your party planning experience, 
                contact us within 7 days for a full refund. We're here to make your celebration magical!
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}