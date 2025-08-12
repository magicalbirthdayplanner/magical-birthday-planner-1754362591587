"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { 
  PartyPopper, 
  Users, 
  MapPin, 
  Calendar,
  Clock,
  Gift,
  CheckCircle2,
  AlertTriangle,
  Home,
  Palette,
  DollarSign
} from "lucide-react";

interface SharedParty {
  id: string;
  childName: string;
  age: number;
  theme: string;
  date: string;
  location?: string;
  guestCount?: number;
  budget: number;
  currency: string;
  venueType?: string;
  duration?: string;
  interests: string[];
  favoriteColors: string[];
  themeDescription?: string;
  decorations?: string[];
  activities?: string[];
  food?: string[];
  guestSummary: {
    total: number;
    adults: number;
    children: number;
  };
  completedTasks: number;
  totalTasks: number;
  sharedAt: string;
}

export default function SharedPartyPage() {
  const params = useParams();
  const token = params.token as string;
  
  const [party, setParty] = useState<SharedParty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSharedParty = async () => {
      try {
        const response = await fetch(`/api/party/share?token=${encodeURIComponent(token)}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError("This party plan is no longer available or the link has expired.");
          } else {
            setError("Failed to load party details. Please try again later.");
          }
          return;
        }

        const data = await response.json();
        if (data.success && data.party) {
          setParty(data.party);
        } else {
          setError("Party plan not found.");
        }
      } catch (err) {
        console.error("Error fetching shared party:", err);
        setError("Failed to load party details. Please check your connection and try again.");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchSharedParty();
    }
  }, [token]);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getThemeGradient = (theme: string) => {
    const themeColors = {
      'superhero': 'from-red-500 to-blue-500',
      'princess': 'from-pink-500 to-purple-500',
      'dinosaur': 'from-green-500 to-emerald-500',
      'space': 'from-purple-500 to-indigo-500',
      'safari': 'from-yellow-500 to-orange-500',
      'ocean': 'from-blue-500 to-cyan-500',
      'pirate': 'from-amber-500 to-red-500',
      'unicorn': 'from-pink-500 to-violet-500',
    };
    return themeColors[theme.toLowerCase() as keyof typeof themeColors] || 'from-purple-500 to-pink-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center space-y-4">
          <PartyPopper className="h-12 w-12 mx-auto animate-bounce text-purple-600" />
          <p className="text-lg text-gray-600 dark:text-gray-300">Loading party details...</p>
        </div>
      </div>
    );
  }

  if (error || !party) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <CardTitle>Party Not Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600 dark:text-gray-300">
              {error || "The party plan you're looking for is not available."}
            </p>
            <Button 
              onClick={() => window.location.href = '/'}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white"
            >
              <Home className="h-4 w-4 mr-2" />
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center px-6 py-3 rounded-full bg-gradient-to-r ${getThemeGradient(party.theme)} text-white mb-4`}>
            <PartyPopper className="h-6 w-6 mr-2" />
            <span className="font-semibold capitalize">{party.theme} Party</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            {party.childName}'s {party.age === 1 ? '1st' : `${party.age}th`} Birthday Party
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            You're invited to celebrate with us!
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Party Details */}
          <Card className="md:col-span-2 lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Party Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="font-medium">Date</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {formatDate(party.date)}
                    </p>
                  </div>
                </div>
                
                {party.location && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="font-medium">Location</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {party.location}
                      </p>
                    </div>
                  </div>
                )}
                
                {party.duration && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="font-medium">Duration</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {party.duration}
                      </p>
                    </div>
                  </div>
                )}
                
                {party.venueType && (
                  <div className="flex items-center gap-3">
                    <Gift className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="font-medium">Venue Type</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {party.venueType}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {party.themeDescription && (
                <div>
                  <p className="font-medium mb-2">Theme Description</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {party.themeDescription}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Party Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Party Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Total Guests</span>
                <Badge variant="secondary">{party.guestSummary.total}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Adults</span>
                <Badge variant="outline">{party.guestSummary.adults}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Children</span>
                <Badge variant="outline">{party.guestSummary.children}</Badge>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Planning Progress</span>
                <Badge className="bg-green-600">
                  {party.completedTasks}/{party.totalTasks} tasks
                </Badge>
              </div>
              
              {party.budget > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Budget</span>
                  <Badge variant="outline">
                    {party.currency} {party.budget.toLocaleString()}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Additional Details */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Interests */}
          {party.interests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  {party.childName}'s Interests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {party.interests.map((interest, index) => (
                    <Badge key={index} variant="secondary">
                      {interest}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Favorite Colors */}
          {party.favoriteColors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Favorite Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {party.favoriteColors.map((color, index) => (
                    <Badge key={index} variant="outline">
                      {color}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* RSVP Notice */}
          <Card className="md:col-span-2 lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                RSVP
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Please contact the host directly to confirm your attendance.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            This party plan was shared on {formatDate(party.sharedAt)}
          </p>
          <Button 
            onClick={() => window.location.href = '/'}
            variant="outline"
          >
            <PartyPopper className="h-4 w-4 mr-2" />
            Create Your Own Party Plan
          </Button>
        </div>
      </div>
    </div>
  );
}