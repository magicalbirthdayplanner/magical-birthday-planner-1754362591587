"use client";

import { Check, Crown, Star, Zap, Sparkles, Users, PenTool, HeadphonesIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import Link from "next/link"
import { useState } from "react"

const pricingTiers = [
  {
    name: "🎯 Starter",
    price: 9.99,
    annualPrice: 9.99,
    description: "Perfect for single event planning",
    icon: Star,
    gradient: "from-purple-500 to-pink-500",
    bgGradient: "from-purple-50 to-pink-50",
    features: [
      "1 event",
      "Up to 15 guests",
      "Basic themes",
      "Basic checklist"
    ],
    limitations: [],
    cta: "Choose Plan",
    ctaVariant: "outline" as const,
    popular: false,
    bestFor: "Entry-level plan for new users or one-time parties",
    isOneTime: true
  },
  {
    name: "✨ Plus",
    price: 19.99,
    annualPrice: 19.99,
    description: "Everything you need for unlimited events",
    icon: Zap,
    gradient: "from-blue-500 to-cyan-500",
    bgGradient: "from-blue-50 to-cyan-50",
    features: [
      "Unlimited events",
      "Unlimited guests",
      "Premium themes",
      "AI-powered suggestions"
    ],
    limitations: [],
    cta: "Choose Plan",
    ctaVariant: "default" as const,
    popular: true,
    bestFor: "Unlimited parties after single payment",
    isOneTime: true
  },
  {
    name: "👑 Pro",
    price: 4.99,
    annualPrice: 39.99,
    description: "Advanced features with subscription benefits",
    icon: Crown,
    gradient: "from-emerald-500 to-teal-500",
    bgGradient: "from-emerald-50 to-teal-50",
    features: [
      "Everything in Plus",
      "Custom theme creation",
      "Vendor recommendations",
      "Priority support",
      "Admin/team tools"
    ],
    limitations: [],
    cta: "Choose Plan",
    ctaVariant: "default" as const,
    popular: false,
    bestFor: "Professional features with ongoing support",
    isSubscription: true
  }
]

const faqs = [
  {
    question: "What's the difference between one-time and subscription pricing?",
    answer: "Starter and Plus are one-time payments giving you permanent access. Pro is a subscription with ongoing premium features, priority support, and regular updates."
  },
  {
    question: "Can I upgrade between plans?",
    answer: "Yes! You can upgrade from Starter to Plus or Pro at any time. We'll credit your original purchase toward the upgrade cost."
  },
  {
    question: "What happens if I exceed plan limits?",
    answer: "For Starter, you'll be prompted to upgrade when you reach 15 guests or try to create a second event. Plus and Pro have no limits on events and guests."
  },
  {
    question: "Do you offer refunds?",
    answer: "We offer a 7-day risk-free trial period. If you're not satisfied, contact our support team for a full refund."
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards, debit cards, and PayPal through our secure payment processor DoDo Payments."
  },
  {
    question: "How does the Pro subscription work?",
    answer: "Pro offers monthly ($4.99) or annual ($39.99) billing with a 33% discount for annual payment. Cancel anytime with no long-term commitment."
  }
]

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header */}
      <div className="container mx-auto px-4 pt-20 pb-12">
        <div className="text-center max-w-3xl mx-auto">
          <Badge className="mb-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
            ✨ Clear, simple pricing. No hidden fees.
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-6">
            Choose Your Perfect Plan
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            From single events to unlimited parties, we have the perfect plan to make every celebration magical. Clear pricing, powerful features.
          </p>
          
          {/* Pricing Toggle for Pro Plan */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <span className={`text-sm ${!isAnnual ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
              Monthly
            </span>
            <Switch
              checked={isAnnual}
              onCheckedChange={setIsAnnual}
              className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-500 data-[state=checked]:to-pink-500"
            />
            <span className={`text-sm ${isAnnual ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
              Annual
            </span>
            {isAnnual && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Save 33%
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="container mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {pricingTiers.map((tier, index) => {
            const displayPrice = tier.isSubscription && isAnnual ? tier.annualPrice : tier.price
            const billingPeriod = tier.isOneTime ? 'one-time' : 
                                 tier.isSubscription ? (isAnnual ? '/year' : '/month') : 'one-time'
            
            return (
              <Card 
                key={tier.name} 
                className={`relative overflow-hidden border-2 transition-all duration-300 hover:scale-105 hover:shadow-xl ${
                  tier.popular ? 'border-blue-500 shadow-lg scale-105' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {tier.popular && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-center py-2 text-sm font-medium">
                    🌟 Most Popular
                  </div>
                )}
                
                <CardHeader className={`bg-gradient-to-br ${tier.bgGradient} ${tier.popular ? 'pt-12' : 'pt-6'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-full bg-gradient-to-r ${tier.gradient}`}>
                      <tier.icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-900">
                    {tier.name}
                  </CardTitle>
                  <CardDescription className="text-gray-600 text-sm">
                    {tier.description}
                  </CardDescription>
                  <div className="flex items-baseline mt-4">
                    <span className="text-3xl font-bold text-gray-900">
                      ${displayPrice}
                    </span>
                    <span className="text-gray-600 ml-2 text-sm">
                      {billingPeriod}
                    </span>
                  </div>
                  {tier.isSubscription && isAnnual && (
                    <div className="mt-1">
                      <span className="text-xs text-green-600 font-medium">
                        Save ${(tier.price * 12 - tier.annualPrice).toFixed(2)} annually
                      </span>
                    </div>
                  )}
                  <div className="mt-2">
                    <span className="text-xs text-gray-500 font-medium">
                      {tier.bestFor}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="p-4">
                  <ul className="space-y-2 mb-6">
                    {tier.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start">
                        <Check className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button 
                    className={`w-full text-sm ${
                      tier.popular 
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600' 
                        : tier.ctaVariant === 'outline' 
                          ? '' 
                          : `bg-gradient-to-r ${tier.gradient} hover:opacity-90`
                    }`}
                    variant={tier.ctaVariant}
                    asChild
                  >
                    <Link href={`/create-party?package=${tier.name.replace(/[^a-zA-Z]/g, '').toLowerCase()}`}>
                      {tier.cta}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Feature Comparison */}
      <div className="container mx-auto px-4 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Compare All Plans
          </h2>
          <p className="text-gray-600">
            See what's included in each plan to make the best choice for your needs.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden max-w-6xl mx-auto">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-4 font-semibold text-gray-900">Features</th>
                  <th className="text-center p-4">
                    <div className="font-semibold text-gray-900 text-sm">🎯 Starter</div>
                    <div className="text-xs text-gray-500">$9.99 one-time</div>
                  </th>
                  <th className="text-center p-4">
                    <div className="font-semibold text-gray-900 text-sm">✨ Plus</div>
                    <div className="text-xs text-gray-500">$19.99 one-time</div>
                  </th>
                  <th className="text-center p-4">
                    <div className="font-semibold text-gray-900 text-sm">👑 Pro</div>
                    <div className="text-xs text-gray-500">$4.99/mo or $39.99/year</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="p-4 font-medium text-gray-900">Events</td>
                  <td className="p-4 text-center text-sm">1 event</td>
                  <td className="p-4 text-center text-sm">Unlimited</td>
                  <td className="p-4 text-center text-sm">Unlimited</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-4 font-medium text-gray-900">Maximum Guests</td>
                  <td className="p-4 text-center text-sm">15 guests</td>
                  <td className="p-4 text-center text-sm">Unlimited</td>
                  <td className="p-4 text-center text-sm">Unlimited</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-gray-900">Basic Themes</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-4 font-medium text-gray-900">Premium Themes</td>
                  <td className="p-4 text-center text-gray-400">—</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-gray-900">AI-Powered Suggestions</td>
                  <td className="p-4 text-center text-gray-400">—</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-4 font-medium text-gray-900">Custom Theme Creation</td>
                  <td className="p-4 text-center text-gray-400">—</td>
                  <td className="p-4 text-center text-gray-400">—</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-gray-900">Vendor Recommendations</td>
                  <td className="p-4 text-center text-gray-400">—</td>
                  <td className="p-4 text-center text-gray-400">—</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-4 font-medium text-gray-900">Admin/Team Tools</td>
                  <td className="p-4 text-center text-gray-400">—</td>
                  <td className="p-4 text-center text-gray-400">—</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-gray-900">Support Level</td>
                  <td className="p-4 text-center text-sm">Community</td>
                  <td className="p-4 text-center text-sm">Email</td>
                  <td className="p-4 text-center text-sm">Priority Support</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="container mx-auto px-4 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-gray-600">
            Everything you need to know about our event-based pricing.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-6">
          {faqs.map((faq, index) => (
            <Card key={index} className="border border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  {faq.question}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">{faq.answer}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white">
        <div className="container mx-auto px-4 py-20">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold mb-6">
              Ready to Create Amazing Celebrations?
            </h2>
            <p className="text-xl mb-6 text-purple-100">
              Join thousands of happy families who've planned unforgettable parties with our simple, powerful tools.
            </p>
            
            {/* Risk-free guarantee */}
            <div className="bg-white/10 rounded-lg p-6 mb-8">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Check className="h-5 w-5 text-green-300" />
                <span className="font-semibold text-green-100">7-Day Risk-Free Guarantee</span>
              </div>
              <p className="text-sm text-purple-100">
                Try any paid plan risk-free. If you're not completely satisfied, we'll refund your money within 7 days. No questions asked.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-4 text-lg font-semibold"
                asChild
              >
                <Link href="/signup">Get Started Today</Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white text-white hover:bg-white hover:text-purple-600 px-8 py-4 text-lg font-semibold"
                asChild
              >
                <Link href="/pricing">Compare Plans</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}