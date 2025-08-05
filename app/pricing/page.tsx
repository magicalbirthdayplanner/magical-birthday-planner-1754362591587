import { Check, Crown, Star, Zap, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

const pricingTiers = [
  {
    name: "Free",
    price: 0,
    description: "Perfect for trying out party planning",
    icon: Star,
    gradient: "from-purple-500 to-pink-500",
    bgGradient: "from-purple-50 to-pink-50",
    features: [
      "1 party plan per month",
      "Up to 10 guests per party",
      "Basic themes & templates",
      "Simple checklist management",
      "Email invitations",
      "Community support"
    ],
    limitations: [
      "Limited AI recommendations",
      "No custom themes",
      "No advanced analytics"
    ],
    cta: "Get Started Free",
    ctaVariant: "outline" as const,
    popular: false
  },
  {
    name: "Starter",
    price: 9.99,
    description: "Ideal for occasional party planners",
    icon: Zap,
    gradient: "from-blue-500 to-cyan-500",
    bgGradient: "from-blue-50 to-cyan-50",
    features: [
      "5 party plans per month",
      "Up to 25 guests per party",
      "All premium themes",
      "AI-powered theme recommendations",
      "Advanced checklist templates",
      "Custom invitation templates",
      "Guest RSVP tracking",
      "Shopping list integration",
      "Email support"
    ],
    limitations: [
      "Limited vendor recommendations"
    ],
    cta: "Start Planning",
    ctaVariant: "default" as const,
    popular: true
  },
  {
    name: "Professional",
    price: 19.99,
    description: "For frequent party organizers & small businesses",
    icon: Crown,
    gradient: "from-emerald-500 to-teal-500",
    bgGradient: "from-emerald-50 to-teal-50",
    features: [
      "15 party plans per month",
      "Up to 100 guests per party",
      "All features from Starter",
      "Custom theme creation",
      "Advanced AI recommendations",
      "Vendor recommendation system",
      "Budget tracking & analytics",
      "Bulk invitation management",
      "Party timeline automation",
      "Export guest lists & reports",
      "Priority email support"
    ],
    limitations: [],
    cta: "Go Professional",
    ctaVariant: "default" as const,
    popular: false
  },
  {
    name: "Premium",
    price: 39.99,
    description: "Ultimate solution for event planners & agencies",
    icon: Sparkles,
    gradient: "from-violet-500 to-purple-500",
    bgGradient: "from-violet-50 to-purple-50",
    features: [
      "Unlimited party plans",
      "Unlimited guests",
      "All features from Professional",
      "White-label customization",
      "Advanced analytics dashboard",
      "Multi-user team management",
      "API access for integrations",
      "Custom integrations support",
      "Dedicated account manager",
      "24/7 phone & chat support",
      "Custom training sessions"
    ],
    limitations: [],
    cta: "Contact Sales",
    ctaVariant: "default" as const,
    popular: false
  }
]

const faqs = [
  {
    question: "Can I change my plan anytime?",
    answer: "Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately and we'll prorate any charges."
  },
  {
    question: "What happens if I exceed my plan limits?",
    answer: "We'll notify you when you're approaching your limits. You can upgrade your plan or wait for the next billing cycle when limits reset."
  },
  {
    question: "Is there a free trial for paid plans?",
    answer: "Yes! All paid plans come with a 14-day free trial. No credit card required to start your trial."
  },
  {
    question: "Do you offer refunds?",
    answer: "We offer a 30-day money-back guarantee. If you're not satisfied, contact our support team for a full refund."
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards, debit cards, and PayPal through our secure payment processor DoDo Payments."
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer: "Absolutely! You can cancel your subscription at any time. Your account will remain active until the end of your current billing period."
  }
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header */}
      <div className="container mx-auto px-4 pt-20 pb-12">
        <div className="text-center max-w-3xl mx-auto">
          <Badge className="mb-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
            🎉 Limited Time: 50% Off First 3 Months
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-6">
            Choose Your Perfect Plan
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            From casual party planning to professional event management, we have the perfect plan to make every celebration magical.
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="container mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {pricingTiers.map((tier, index) => (
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
                  {tier.name === "Premium" && (
                    <Badge variant="secondary" className="text-xs">
                      Custom
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">
                  {tier.name}
                </CardTitle>
                <CardDescription className="text-gray-600">
                  {tier.description}
                </CardDescription>
                <div className="flex items-baseline mt-4">
                  <span className="text-4xl font-bold text-gray-900">
                    ${tier.price}
                  </span>
                  <span className="text-gray-600 ml-2">
                    {tier.price > 0 ? "/month" : "forever"}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {tier.limitations.length > 0 && (
                  <div className="border-t pt-4 mb-6">
                    <p className="text-xs text-gray-500 mb-2">Limitations:</p>
                    <ul className="space-y-1">
                      {tier.limitations.map((limitation, limitIndex) => (
                        <li key={limitIndex} className="text-xs text-gray-400">
                          • {limitation}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button 
                  className={`w-full ${
                    tier.popular 
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600' 
                      : tier.ctaVariant === 'outline' 
                        ? '' 
                        : `bg-gradient-to-r ${tier.gradient} hover:opacity-90`
                  }`}
                  variant={tier.ctaVariant}
                  asChild
                >
                  <Link href={tier.name === "Free" ? "/signup" : "/signup?plan=" + tier.name.toLowerCase()}>
                    {tier.cta}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Feature Comparison */}
      <div className="container mx-auto px-4 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Compare All Features
          </h2>
          <p className="text-gray-600">
            See what's included in each plan to make the best choice for your needs.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden max-w-5xl mx-auto">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-6 font-semibold text-gray-900">Features</th>
                  {pricingTiers.map((tier) => (
                    <th key={tier.name} className="text-center p-6">
                      <div className="font-semibold text-gray-900">{tier.name}</div>
                      <div className="text-sm text-gray-500">${tier.price}/mo</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="p-6 font-medium text-gray-900">Party Plans per Month</td>
                  <td className="p-6 text-center">1</td>
                  <td className="p-6 text-center">5</td>
                  <td className="p-6 text-center">15</td>
                  <td className="p-6 text-center">Unlimited</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-6 font-medium text-gray-900">Maximum Guests</td>
                  <td className="p-6 text-center">10</td>
                  <td className="p-6 text-center">25</td>
                  <td className="p-6 text-center">100</td>
                  <td className="p-6 text-center">Unlimited</td>
                </tr>
                <tr>
                  <td className="p-6 font-medium text-gray-900">AI Theme Recommendations</td>
                  <td className="p-6 text-center">Basic</td>
                  <td className="p-6 text-center"><Check className="h-5 w-5 text-green-500 mx-auto" /></td>
                  <td className="p-6 text-center"><Check className="h-5 w-5 text-green-500 mx-auto" /></td>
                  <td className="p-6 text-center"><Check className="h-5 w-5 text-green-500 mx-auto" /></td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-6 font-medium text-gray-900">Custom Themes</td>
                  <td className="p-6 text-center">—</td>
                  <td className="p-6 text-center">—</td>
                  <td className="p-6 text-center"><Check className="h-5 w-5 text-green-500 mx-auto" /></td>
                  <td className="p-6 text-center"><Check className="h-5 w-5 text-green-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-6 font-medium text-gray-900">Analytics & Reports</td>
                  <td className="p-6 text-center">—</td>
                  <td className="p-6 text-center">Basic</td>
                  <td className="p-6 text-center">Advanced</td>
                  <td className="p-6 text-center">Enterprise</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-6 font-medium text-gray-900">Support Level</td>
                  <td className="p-6 text-center">Community</td>
                  <td className="p-6 text-center">Email</td>
                  <td className="p-6 text-center">Priority Email</td>
                  <td className="p-6 text-center">24/7 Phone & Chat</td>
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
            Everything you need to know about our pricing and plans.
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
              Ready to Create Magical Celebrations?
            </h2>
            <p className="text-xl mb-8 text-purple-100">
              Join thousands of happy parents who've already planned unforgettable parties with our platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-4 text-lg font-semibold"
                asChild
              >
                <Link href="/signup">Start Free Trial</Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white text-white hover:bg-white hover:text-purple-600 px-8 py-4 text-lg font-semibold"
                asChild
              >
                <Link href="/contact">Contact Sales</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}