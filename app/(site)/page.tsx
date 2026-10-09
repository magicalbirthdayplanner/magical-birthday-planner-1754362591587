"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PartyPopper, Sparkles, Users, Calendar, CheckCircle2, Calendar as CalendarIcon, User, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { PlanCards } from "@/components/billing/PlanCards";
import { FoundingOffer } from "@/components/billing/FoundingOffer";
import { track } from "@/lib/analytics/client";

export default function Home() {
  const { user, loading } = useAuth();

  useEffect(() => {
    track("landing_page_view", { signedIn: !!user })
  }, [user]);

  const themes = [
    { name: "Superhero", color: "bg-gradient-to-r from-red-500 to-blue-600", emoji: "🦸‍♂️" },
    { name: "Princess", color: "bg-gradient-to-r from-pink-400 to-purple-600", emoji: "👸" },
    { name: "Dinosaur", color: "bg-gradient-to-r from-green-500 to-emerald-600", emoji: "🦕" },
    { name: "Space", color: "bg-gradient-to-r from-purple-600 to-indigo-800", emoji: "🚀" },
    { name: "Safari", color: "bg-gradient-to-r from-yellow-500 to-orange-600", emoji: "🦁" },
    { name: "Ocean", color: "bg-gradient-to-r from-blue-400 to-cyan-600", emoji: "🐙" },
  ];

  const features = [
    {
      icon: <Sparkles className="h-6 w-6" />,
      title: "AI-Powered Suggestions",
      description: "Get personalized party ideas tailored to your child's age and interests"
    },
    {
      icon: <CheckCircle2 className="h-6 w-6" />,
      title: "Smart Checklists",
      description: "Never forget a detail with our comprehensive party planning checklists"
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Guests & RSVP",
      description: "Share one invitation link and see who's coming at a glance"
    },
    {
      icon: <Calendar className="h-6 w-6" />,
      title: "Party-Day Timeline",
      description: "Turn your plan into a simple schedule for the big day"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <style jsx>{`
        .pricing-card {
          --mouse-x: 0px;
          --mouse-y: 0px;
          --opacity: 0;
          position: relative;
        }
        .pricing-card::before {
          content: '';
          position: absolute;
          top: -2px;
          left: -2px;
          right: -2px;
          bottom: -2px;
          border-radius: 12px;
          background: radial-gradient(
            600px circle at var(--mouse-x) var(--mouse-y),
            rgba(29, 209, 161, 0.4),
            rgba(56, 189, 248, 0.4),
            rgba(147, 51, 234, 0.4),
            transparent 40%
          );
          opacity: var(--opacity);
          transition: opacity 0.3s ease;
          z-index: -1;
        }
        .pricing-card-plus::before {
          background: radial-gradient(
            600px circle at var(--mouse-x) var(--mouse-y),
            rgba(59, 130, 246, 0.5),
            rgba(34, 197, 94, 0.5),
            rgba(168, 85, 247, 0.5),
            transparent 40%
          );
        }
        .pricing-card-pro::before {
          background: radial-gradient(
            600px circle at var(--mouse-x) var(--mouse-y),
            rgba(34, 197, 94, 0.5),
            rgba(251, 191, 36, 0.5),
            rgba(239, 68, 68, 0.5),
            transparent 40%
          );
        }
      `}</style>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-yellow-600/10 dark:from-purple-400/20 dark:via-pink-400/20 dark:to-yellow-400/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24">
          <div className="text-center">
            <div className="flex justify-center mb-4 sm:mb-6">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 sm:p-4 rounded-full">
                <PartyPopper className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-white" />
              </div>
            </div>
{user ? (
              <>
                <div className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-full px-6 py-2 mb-6 inline-block">
                  <p className="text-purple-700 dark:text-purple-300 font-medium">
                    <User className="h-4 w-4 inline mr-2" />
                    Welcome back, {user.user_metadata?.display_name || user.email?.split('@')[0]}!
                  </p>
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-yellow-600 bg-clip-text text-transparent mb-4 sm:mb-6 leading-tight">
                  Ready for Another Magical Party?
                </h1>
                <p className="text-base sm:text-lg lg:text-xl text-gray-600 dark:text-gray-300 mb-6 sm:mb-8 max-w-3xl mx-auto px-2">
                  Continue planning amazing birthday celebrations or start a new party with our AI-powered suggestions and beautiful themes.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-yellow-600 bg-clip-text text-transparent mb-4 sm:mb-6 leading-tight">
                  Magical Birthday Planner
                </h1>
                <p className="text-base sm:text-lg lg:text-xl text-gray-600 dark:text-gray-300 mb-6 sm:mb-8 max-w-3xl mx-auto px-2">
                  Create unforgettable birthday celebrations for kids aged 0-12 with AI-powered suggestions, beautiful themes, and stress-free planning tools designed for busy parents.
                </p>
              </>
            )}
            {loading ? (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            ) : user ? (
              // Authenticated user CTAs
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
                <Link href="/home" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 sm:px-8 py-3 text-base sm:text-lg">
                    <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Go to Dashboard
                  </Button>
                </Link>
                <Link href="/start" className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-400 dark:text-purple-400 dark:hover:bg-purple-900/20 px-6 sm:px-8 py-3 text-base sm:text-lg">
                    <PartyPopper className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Create New Party
                  </Button>
                </Link>
              </div>
            ) : (
              // Unauthenticated user CTAs
              <>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
                  <Link href="/start" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 sm:px-8 py-3 text-base sm:text-lg">
                      Get Started Free
                    </Button>
                  </Link>
                  <Link href="/start" className="w-full sm:w-auto">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-400 dark:text-purple-400 dark:hover:bg-purple-900/20 px-6 sm:px-8 py-3 text-base sm:text-lg">
                      Try Demo
                    </Button>
                  </Link>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                  Already have an account? <Link href="/login" className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium">Sign in</Link>
                </p>
              </>
            )}
            <FoundingOffer className="mt-8" />
          </div>
        </div>
      </section>

      {/* Popular Themes Preview */}
      <section className="py-16 bg-white/50 dark:bg-slate-800/50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">Popular Party Themes</h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">Choose from our collection of trending themes loved by kids</p>
          </div>
          
          {/* Ribbon-styled horizontal scrolling container */}
          <div className="relative">
            {/* Gradient overlays for ribbon effect */}
            <div className="absolute left-0 top-0 w-20 h-full bg-gradient-to-r from-white/50 to-transparent dark:from-slate-800/50 dark:to-transparent z-10 pointer-events-none"></div>
            <div className="absolute right-0 top-0 w-20 h-full bg-gradient-to-l from-white/50 to-transparent dark:from-slate-800/50 dark:to-transparent z-10 pointer-events-none"></div>
            
            {/* Scrolling container */}
            <div className="overflow-hidden rounded-xl shadow-inner bg-gradient-to-r from-purple-100/50 via-pink-100/50 to-yellow-100/50 dark:from-purple-900/30 dark:via-pink-900/30 dark:to-yellow-900/30 py-6">
              <div className="flex gap-6 animate-scroll-ribbon">
                {/* First set of themes */}
                {themes.map((theme, index) => (
                  <div key={`first-${index}`} className="flex-shrink-0">
                    <Card className="group cursor-pointer hover:scale-105 transition-all duration-300 border-0 shadow-lg hover:shadow-xl w-40">
                      <CardContent className="p-0">
                        <div className={`${theme.color} h-24 rounded-t-lg flex items-center justify-center text-4xl shadow-inner`}>
                          {theme.emoji}
                        </div>
                        <div className="p-4 text-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{theme.name}</h3>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
                {/* Duplicate set for seamless loop */}
                {themes.map((theme, index) => (
                  <div key={`second-${index}`} className="flex-shrink-0">
                    <Card className="group cursor-pointer hover:scale-105 transition-all duration-300 border-0 shadow-lg hover:shadow-xl w-40">
                      <CardContent className="p-0">
                        <div className={`${theme.color} h-24 rounded-t-lg flex items-center justify-center text-4xl shadow-inner`}>
                          {theme.emoji}
                        </div>
                        <div className="p-4 text-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{theme.name}</h3>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="text-center mt-8">
            <Link href="/start">
              <Button variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-400 dark:text-purple-400 dark:hover:bg-purple-900/20">
                {user ? "Create New Party" : "Explore All Themes"}
              </Button>
            </Link>
          </div>
        </div>
        
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">Everything You Need</h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">Powerful features to make party planning effortless</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="text-center border-0 shadow-lg hover:shadow-xl transition-shadow duration-200">
                <CardHeader>
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 w-12 h-12 rounded-full flex items-center justify-center text-white mx-auto mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">How It Works</h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">Simple steps to create the perfect party</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="text-center">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2 dark:text-gray-100">Tell Us About Your Child</h3>
              <p className="text-gray-600 dark:text-gray-300">Share your child's name, age, and party date to get started</p>
            </div>
            <div className="text-center">
              <div className="bg-gradient-to-r from-pink-600 to-yellow-600 w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2 dark:text-gray-100">Pick a Theme</h3>
              <p className="text-gray-600 dark:text-gray-300">Choose from our curated collection of kid-friendly themes</p>
            </div>
            <div className="text-center">
              <div className="bg-gradient-to-r from-yellow-600 to-orange-600 w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2 dark:text-gray-100">Get Your Plan</h3>
              <p className="text-gray-600 dark:text-gray-300">Receive personalized suggestions and checklists</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Preview Section */}
      <section className="py-16 bg-white dark:bg-slate-900" aria-labelledby="home-plans">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <Badge className="mb-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
              Priced per party · No subscriptions
            </Badge>
            <h2 id="home-plans" className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">Explore. Plan. Organize. Experience.</h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">Start free. Add AI when you want help with the plan, the details, or the day itself.</p>
          </div>
          <PlanCards />
          <div className="mt-8 text-center">
            <Link href="/pricing" className="inline-flex min-h-[44px] items-center gap-2 font-semibold text-purple-700 hover:underline">
              Compare plans and FAQ <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-purple-600 via-pink-600 to-yellow-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          {user ? (
            <>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
                Let's Plan Your Next Celebration!
              </h2>
              <p className="text-base sm:text-lg lg:text-xl text-purple-100 mb-6 sm:mb-8">
                Your personalized dashboard is ready with all your party planning tools
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
                <Link href="/home" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto bg-white text-purple-600 hover:bg-gray-100 px-6 sm:px-8 py-3 text-base sm:text-lg font-semibold">
                    <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    View My Dashboard
                  </Button>
                </Link>
                <Link href="/start" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto border-white text-purple-600 hover:bg-white hover:text-purple-600 px-6 sm:px-8 py-3 text-base sm:text-lg font-semibold bg-white">
                    <PartyPopper className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Start New Party
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
                Ready to Create Magic?
              </h2>
              <p className="text-base sm:text-lg lg:text-xl text-purple-100 mb-6 sm:mb-8">
                Find the place, plan the day and keep every detail in one spot — free to start.
              </p>
              <div className="flex flex-col gap-4 justify-center items-center">
                <Link href="/start" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto bg-white text-purple-600 hover:bg-gray-100 px-6 sm:px-8 py-3 text-base sm:text-lg font-semibold">
                    Create Your Account
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
