import { Check, Crown, Star, Zap, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

const pricingTiers = [
  {
    name: "🎉 Essential Party",
    price: 9.99,
    description: "Perfect for first-time users and simple celebrations",
    icon: Star,
    gradient: "from-purple-500 to-pink-500",
    bgGradient: "from-purple-50 to-pink-50",
    features: [
      "1 event creation",
      "Max 10 guests",
      "Basic themes & templates",
      "Simple checklist",
      "Community support"
    ],
    limitations: [
      "No email invitations",
      "No AI recommendations",
      "No custom themes",
      "No printables"
    ],
    cta: "Plan Essential Event",
    ctaVariant: "outline" as const,
    popular: false,
    bestFor: "First-time users & simple celebrations"
  },
  {
    name: "✨ Magical Party",
    price: 19.99,
    description: "Perfect for birthday celebrations - $19.99/one-time for 1 birthday in a calendar year",
    icon: Zap,
    gradient: "from-blue-500 to-cyan-500",
    bgGradient: "from-blue-50 to-cyan-50",
    features: [
      "All Essential features",
      "AI-powered theme suggestions",
      "Unlimited guests",
      "Premium templates & themes",
      "Vendor recommendations",
      "Custom theme creation",
      "Advanced RSVP tracking",
      "Shopping list integration",
      "Custom invitations",
      "Budget planning tools",
      "Printable decorations",
      "Email support"
    ],
    limitations: [],
    cta: "Plan My Event",
    ctaVariant: "default" as const,
    popular: true,
    bestFor: "Parents planning annual birthday celebrations"
  },
  {
    name: "👑 Ultimate Party",
    price: 39.99,
    description: "Premium package - $39.99/one-time for up to 3 birthdays in a calendar year",
    icon: Crown,
    gradient: "from-emerald-500 to-teal-500",
    bgGradient: "from-emerald-50 to-teal-50",
    features: [
      "All Magical features",
      "Multi-event management (up to 3 birthdays)",
      "Professional event coordination",
      "Premium vendor network access",
      "White-glove party concierge service",
      "Dedicated party planner consultation",
      "Advanced analytics & insights",
      "Professional photography referrals",
      "Premium entertainment booking",
      "Custom decoration design service",
      "Export capabilities & data backup",
      "Template sharing & collaboration",
      "API access for integrations",
      "Priority 24/7 support"
    ],
    limitations: [],
    cta: "Create Ultimate Event",
    ctaVariant: "default" as const,
    popular: false,
    bestFor: "Families with multiple children & premium service seekers"
  }
]

const faqs = [
  {
    question: "How does the annual birthday pricing work?",
    answer: "Our pricing is designed around birthday celebrations. Magical Party covers 1 birthday per calendar year for $19.99, while Ultimate Party covers up to 3 birthdays per calendar year for $39.99. Perfect for families with multiple children or special milestone birthdays."
  },
  {
    question: "What happens after I purchase a birthday package?",
    answer: "You get immediate access to all features included in your package for the entire calendar year. Plan your birthday parties, invite unlimited guests (except Essential), and create magical celebrations. Your access resets each January."
  },
  {
    question: "Can I upgrade my package after purchase?",
    answer: "Yes! You can upgrade to a higher-tier package at any time. We'll credit your original purchase toward the upgrade cost."
  },
  {
    question: "Do you offer refunds?",
    answer: "We offer a 7-day money-back guarantee. If you're not satisfied with your package, contact our support team for a full refund."
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards, debit cards, and PayPal through our secure payment processor DoDo Payments."
  },
  {
    question: "How long do I have access to my birthday events?",
    answer: "Your birthday events remain accessible for the entire calendar year plus 90 days after December 31st, giving you time to download photos, export guest lists, and save memories from all your year's celebrations."
  }
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header */}
      <div className="container mx-auto px-4 pt-20 pb-12">
        <div className="text-center max-w-3xl mx-auto">
          <Badge className="mb-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
            🎂 Annual birthday pricing. No monthly subscriptions.
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-6">
            Choose Your Perfect Birthday Package
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            From single birthday celebrations to multi-child families, we have the perfect annual package to make every birthday magical. Pay once per year, celebrate all year long.
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="container mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
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
                </div>
                <CardTitle className="text-xl font-bold text-gray-900">
                  {tier.name}
                </CardTitle>
                <CardDescription className="text-gray-600 text-sm">
                  {tier.description}
                </CardDescription>
                <div className="flex items-baseline mt-4">
                  <span className="text-3xl font-bold text-gray-900">
                    ${tier.price}
                  </span>
                  <span className="text-gray-600 ml-2 text-sm">
                    one-time
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xs text-gray-500 font-medium">
                    Best for: {tier.bestFor}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="p-4">
                <ul className="space-y-2 mb-6">
                  {tier.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start">
                      <Check className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 text-xs">{feature}</span>
                    </li>
                  ))}
                </ul>

                {tier.limitations.length > 0 && (
                  <div className="border-t pt-3 mb-4">
                    <p className="text-xs text-gray-500 mb-1">Limitations:</p>
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
          ))}
        </div>
      </div>

      {/* Feature Comparison */}
      <div className="container mx-auto px-4 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Compare All Packages
          </h2>
          <p className="text-gray-600">
            See what's included in each package to make the best choice for your event.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden max-w-6xl mx-auto">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-4 font-semibold text-gray-900">Features</th>
                  {pricingTiers.map((tier) => (
                    <th key={tier.name} className="text-center p-4">
                      <div className="font-semibold text-gray-900 text-sm">{tier.name}</div>
                      <div className="text-xs text-gray-500">${tier.price} one-time</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="p-4 font-medium text-gray-900">Events Included</td>
                  <td className="p-4 text-center">1</td>
                  <td className="p-4 text-center">1 birthday/year</td>
                  <td className="p-4 text-center">Up to 3 birthdays/year</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-4 font-medium text-gray-900">Maximum Guests</td>
                  <td className="p-4 text-center">10 guests</td>
                  <td className="p-4 text-center">Unlimited</td>
                  <td className="p-4 text-center">Unlimited</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-gray-900">Email Invitations</td>
                  <td className="p-4 text-center">—</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-4 font-medium text-gray-900">AI Theme Recommendations</td>
                  <td className="p-4 text-center">—</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-gray-900">Custom Themes & Printables</td>
                  <td className="p-4 text-center">—</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-4 font-medium text-gray-900">Vendor Recommendations</td>
                  <td className="p-4 text-center">—</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center">Premium Network</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-gray-900">Concierge & Consultation</td>
                  <td className="p-4 text-center">—</td>
                  <td className="p-4 text-center">—</td>
                  <td className="p-4 text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-4 font-medium text-gray-900">Support Level</td>
                  <td className="p-4 text-center">Community</td>
                  <td className="p-4 text-center">Email</td>
                  <td className="p-4 text-center">Priority 24/7</td>
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
              Ready to Create Magical Birthday Celebrations?
            </h2>
            <p className="text-xl mb-8 text-purple-100">
              Join thousands of happy parents who've planned unforgettable birthday parties with our annual packages.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-4 text-lg font-semibold"
                asChild
              >
                <Link href="/signup">Get Started</Link>
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