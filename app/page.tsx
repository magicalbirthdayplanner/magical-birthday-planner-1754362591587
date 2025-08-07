"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PartyPopper, Sparkles, Users, Calendar, CheckCircle2, Star, Calendar as CalendarIcon, User, Crown, Zap, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const { user, loading } = useAuth();
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
      title: "Guest Management",
      description: "Easily manage invitations and track RSVPs in one place"
    },
    {
      icon: <Calendar className="h-6 w-6" />,
      title: "Timeline & Reminders",
      description: "Stay organized with automated reminders and timeline planning"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
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
                <Link href="/dashboard" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 sm:px-8 py-3 text-base sm:text-lg">
                    <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Go to Dashboard
                  </Button>
                </Link>
                <Link href="/create-party" className="w-full sm:w-auto">
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
                  <Link href="/signup" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 sm:px-8 py-3 text-base sm:text-lg">
                      Get Started Free
                    </Button>
                  </Link>
                  <Link href="/create-party" className="w-full sm:w-auto">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-400 dark:text-purple-400 dark:hover:bg-purple-900/20 px-6 sm:px-8 py-3 text-base sm:text-lg">
                      Try Demo
                    </Button>
                  </Link>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                  Already have an account? <Link href="/signin" className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium">Sign in</Link>
                </p>
              </>
            )}
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
            <Link href="/create-party">
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
              <p className="text-gray-600 dark:text-gray-300">Receive personalized suggestions, checklists, and inspiration</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Preview Section */}
      <section className="py-16 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
              🎂 Annual birthday pricing. No monthly subscriptions.
            </Badge>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Choose Your Perfect Package
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              From single birthday celebrations to multi-child families, find the annual package that makes every birthday magical
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Essential Party (Free) */}
            <Card className="relative border-2 border-gray-200 hover:border-gray-300 transition-all duration-300 hover:scale-105">
              <CardHeader className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
                    <Star className="h-6 w-6 text-white" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  🎈 Starter
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  A quick and easy starting point for parents seeking basic help.
                </CardDescription>
                <div className="flex items-baseline mt-4">
                  <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">$9.99</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-2">(One-Time)</span>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Theme suggestions based on age</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Smart checklist & timeline</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Simple invitation creator</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Email support (72-hour response)</span>
                  </li>
                </ul>
                <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90" asChild>
                  <Link href="/create-party?package=starter">Choose Starter</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Magical Party - Most Popular */}
            <Card className="relative border-2 border-blue-500 shadow-lg scale-105">
              <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-center py-2 text-sm font-medium">
                🌟 Most Popular
              </div>
              <CardHeader className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 pt-12">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500">
                    <Zap className="h-6 w-6 text-white" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  🧁 Plus
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  Smart and simple AI-powered birthday planning for busy parents.
                </CardDescription>
                <div className="flex items-baseline mt-4">
                  <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">$14.99</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-2">(One-Time)</span>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">Includes everything in Starter, plus:</div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Personalized activity ideas</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300 text-sm">RSVP tracking</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Task reminders</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Basic budget tracker (manual input)</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Email support (48-hour response)</span>
                  </li>
                </ul>
                <Button className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600" asChild>
                  <Link href="/signup?plan=plus">Choose Plus</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Ultimate Party */}
            <Card className="relative border-2 border-gray-200 hover:border-gray-300 transition-all duration-300 hover:scale-105">
              <CardHeader className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500">
                    <Crown className="h-6 w-6 text-white" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  ✨ Pro
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  All-in-one planning experience with advanced support and recommendations.
                </CardDescription>
                <div className="flex items-baseline mt-4">
                  <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">$29.99</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-2">(One-Time)</span>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">Includes everything in Plus, plus:</div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Vendor recommendations (cakes, decor, entertainment)</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Personalized food suggestions by age & theme</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Smart budget tracker with cost insights</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Priority email support (24-hour response)</span>
                  </li>
                </ul>
                <Button className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600" asChild>
                  <Link href="/signup?plan=pro">Choose Pro</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-12">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Ready to plan your perfect celebration? Choose the package that fits your event needs.
            </p>
            <Button variant="outline" size="lg" asChild>
              <Link href="/pricing" className="inline-flex items-center">
                View All Packages & Features
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
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
                <Link href="/dashboard" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto bg-white text-purple-600 hover:bg-gray-100 px-6 sm:px-8 py-3 text-base sm:text-lg font-semibold">
                    <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    View My Dashboard
                  </Button>
                </Link>
                <Link href="/create-party" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto border-white text-white hover:bg-white hover:text-purple-600 px-6 sm:px-8 py-3 text-base sm:text-lg font-semibold">
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
                Join thousands of parents who trust us to make their children's birthdays unforgettable
              </p>
              <div className="flex flex-col gap-4 justify-center items-center">
                <Link href="/signup" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto bg-white text-purple-600 hover:bg-gray-100 px-6 sm:px-8 py-3 text-base sm:text-lg font-semibold">
                    Create Your Account
                  </Button>
                </Link>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-white">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 sm:h-5 sm:w-5 fill-current" />
                    ))}
                  </div>
                  <span className="text-purple-100 text-sm sm:text-base text-center">Trusted by 10,000+ parents</span>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
