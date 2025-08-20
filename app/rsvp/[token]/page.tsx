'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, Clock, MapPin, Calendar, Users, Heart } from 'lucide-react';

interface RSVPData {
  guestName: string;
  childName: string;
  childAge: number;
  partyTheme: string;
  partyDate: string;
  partyTime: string;
  partyLocation: string;
  hostName: string;
  currentStatus: string;
  customMessage?: string;
}

export default function RSVPPage() {
  const { token } = useParams();
  const [rsvpData, setRSVPData] = useState<RSVPData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (token) {
      fetchRSVPData();
    }
  }, [token]);

  const fetchRSVPData = async () => {
    try {
      const response = await fetch(`/api/rsvp/${token}`);
      const data = await response.json();

      if (data.success) {
        setRSVPData(data.rsvp);
        setSelectedStatus(data.rsvp.currentStatus === 'PENDING' ? '' : data.rsvp.currentStatus);
        setSubmitted(data.rsvp.currentStatus !== 'PENDING');
      } else {
        setError(data.error || 'Invalid RSVP link');
      }
    } catch (err) {
      setError('Failed to load RSVP details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedStatus) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/rsvp/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: selectedStatus,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSubmitted(true);
        setError(null);
      } else {
        setError(data.error || 'Failed to submit RSVP');
      }
    } catch (err) {
      setError('Failed to submit RSVP');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-100 to-pink-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">Oops!</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!rsvpData) return null;

  const getThemeColors = (theme: string) => {
    const themeMap: Record<string, { from: string; to: string; accent: string }> = {
      superhero: { from: 'from-red-400', to: 'to-blue-600', accent: 'text-red-600' },
      princess: { from: 'from-pink-400', to: 'to-purple-600', accent: 'text-pink-600' },
      dinosaur: { from: 'from-green-400', to: 'to-emerald-600', accent: 'text-green-600' },
      space: { from: 'from-purple-400', to: 'to-indigo-600', accent: 'text-purple-600' },
      safari: { from: 'from-yellow-400', to: 'to-orange-600', accent: 'text-yellow-600' },
      ocean: { from: 'from-blue-400', to: 'to-cyan-600', accent: 'text-blue-600' },
      pirate: { from: 'from-amber-400', to: 'to-red-600', accent: 'text-amber-600' },
      unicorn: { from: 'from-pink-400', to: 'to-violet-600', accent: 'text-pink-600' },
    };

    return themeMap[theme.toLowerCase()] || themeMap.superhero;
  };

  const themeColors = getThemeColors(rsvpData.partyTheme);

  if (submitted) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${themeColors.from} ${themeColors.to} flex items-center justify-center p-4`}>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Thank You!</CardTitle>
            <CardDescription>
              Your RSVP has been recorded for {rsvpData.childName}'s birthday party.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
              selectedStatus === 'ACCEPTED' ? 'bg-green-100 text-green-800' :
              selectedStatus === 'DECLINED' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {selectedStatus === 'ACCEPTED' ? '✅ You\'re Coming!' :
               selectedStatus === 'DECLINED' ? '❌ Can\'t Make It' :
               '🤔 Maybe'}
            </div>
            <p className="text-sm text-gray-600">
              {rsvpData.hostName} has been notified of your response.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${themeColors.from} ${themeColors.to} py-8 px-4`}>
      <div className="max-w-2xl mx-auto">
        {/* Party Details Card */}
        <Card className="mb-6">
          <CardHeader className="text-center">
            <div className="text-4xl mb-2">🎉</div>
            <CardTitle className="text-3xl">You're Invited!</CardTitle>
            <CardDescription className="text-xl">
              {rsvpData.childName} is turning {rsvpData.childAge}!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3">
                <Calendar className={`w-5 h-5 ${themeColors.accent}`} />
                <div>
                  <p className="font-medium">Date</p>
                  <p className="text-gray-600">{rsvpData.partyDate}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Clock className={`w-5 h-5 ${themeColors.accent}`} />
                <div>
                  <p className="font-medium">Time</p>
                  <p className="text-gray-600">{rsvpData.partyTime}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 md:col-span-2">
                <MapPin className={`w-5 h-5 ${themeColors.accent}`} />
                <div>
                  <p className="font-medium">Location</p>
                  <p className="text-gray-600">{rsvpData.partyLocation}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Users className={`w-5 h-5 ${themeColors.accent}`} />
                <div>
                  <p className="font-medium">Theme</p>
                  <p className="text-gray-600 capitalize">{rsvpData.partyTheme} Party</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Heart className={`w-5 h-5 ${themeColors.accent}`} />
                <div>
                  <p className="font-medium">Host</p>
                  <p className="text-gray-600">{rsvpData.hostName}</p>
                </div>
              </div>
            </div>

            {rsvpData.customMessage && (
              <div className="bg-gray-50 rounded-lg p-4 mt-4">
                <p className="font-medium mb-2">Personal Message:</p>
                <p className="text-gray-700 italic">"{rsvpData.customMessage}"</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* RSVP Response Card */}
        <Card>
          <CardHeader>
            <CardTitle>Hi {rsvpData.guestName}! 👋</CardTitle>
            <CardDescription>
              Please let us know if you can join the celebration!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* RSVP Options */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Will you be attending?</Label>
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => setSelectedStatus('ACCEPTED')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    selectedStatus === 'ACCEPTED'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">🎉</span>
                    <div>
                      <p className="font-medium">Yes, I'll be there!</p>
                      <p className="text-sm text-gray-600">Can't wait to celebrate!</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setSelectedStatus('DECLINED')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    selectedStatus === 'DECLINED'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 hover:border-red-300 hover:bg-red-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">😢</span>
                    <div>
                      <p className="font-medium">Sorry, I can't make it</p>
                      <p className="text-sm text-gray-600">I'll be there in spirit!</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setSelectedStatus('MAYBE')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    selectedStatus === 'MAYBE'
                      ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                      : 'border-gray-200 hover:border-yellow-300 hover:bg-yellow-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">🤔</span>
                    <div>
                      <p className="font-medium">Maybe / Not sure yet</p>
                      <p className="text-sm text-gray-600">I'll try my best to make it!</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any dietary restrictions, special requests, or messages for the host..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!selectedStatus || submitting}
              className="w-full"
              size="lg"
            >
              {submitting ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Submitting...</span>
                </div>
              ) : (
                'Submit RSVP'
              )}
            </Button>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}