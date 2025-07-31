import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PartyPopper, Sparkles, Users, Calendar, CheckCircle2, Star } from "lucide-react";
import Link from "next/link";

export default function Home() {
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-yellow-600/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 rounded-full">
                <PartyPopper className="h-12 w-12 text-white" />
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-yellow-600 bg-clip-text text-transparent mb-6">
              Magical Birthday Parties
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Create unforgettable birthday celebrations for kids aged 0-12 with AI-powered suggestions, beautiful themes, and stress-free planning tools designed for busy parents.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/create-party">
                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 text-lg">
                  Start Planning Now
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="border-purple-300 text-purple-700 hover:bg-purple-50 px-8 py-3 text-lg">
                View Themes
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Themes Preview */}
      <section className="py-16 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Popular Party Themes</h2>
            <p className="text-lg text-gray-600">Choose from our collection of trending themes loved by kids</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {themes.map((theme, index) => (
              <Card key={index} className="group cursor-pointer hover:scale-105 transition-transform duration-200 border-0 shadow-lg">
                <CardContent className="p-0">
                  <div className={`${theme.color} h-24 rounded-t-lg flex items-center justify-center text-4xl`}>
                    {theme.emoji}
                  </div>
                  <div className="p-4 text-center">
                    <h3 className="font-semibold text-gray-900">{theme.name}</h3>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything You Need</h2>
            <p className="text-lg text-gray-600">Powerful features to make party planning effortless</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="text-center border-0 shadow-lg hover:shadow-xl transition-shadow duration-200">
                <CardHeader>
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 w-12 h-12 rounded-full flex items-center justify-center text-white mx-auto mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-lg text-gray-600">Simple steps to create the perfect party</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Tell Us About Your Child</h3>
              <p className="text-gray-600">Share your child's name, age, and party date to get started</p>
            </div>
            <div className="text-center">
              <div className="bg-gradient-to-r from-pink-600 to-yellow-600 w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Pick a Theme</h3>
              <p className="text-gray-600">Choose from our curated collection of kid-friendly themes</p>
            </div>
            <div className="text-center">
              <div className="bg-gradient-to-r from-yellow-600 to-orange-600 w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Get Your Plan</h3>
              <p className="text-gray-600">Receive personalized suggestions, checklists, and inspiration</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-purple-600 via-pink-600 to-yellow-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Create Magic?
          </h2>
          <p className="text-xl text-purple-100 mb-8">
            Join thousands of parents who trust us to make their children's birthdays unforgettable
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/create-party">
              <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-3 text-lg font-semibold">
                Start Planning Now
              </Button>
            </Link>
            <div className="flex items-center justify-center gap-2 text-white">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-current" />
                ))}
              </div>
              <span className="text-purple-100">Trusted by 10,000+ parents</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
