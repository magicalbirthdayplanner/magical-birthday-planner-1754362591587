'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle, 
  XCircle, 
  HelpCircle, 
  Calendar, 
  Clock, 
  MapPin, 
  Users,
  Gift,
  Cake
} from 'lucide-react';

interface PartyDetails {
  id: string;
  child_name: string;
  child_age: number;
  theme: string;
  selected_theme: string;
  party_date: string;
  party_time: string;
  venue: string;
  duration: string;
}

interface GuestDetails {
  id: string;
  name: string;
  email: string;
  type: string;
}

interface InvitationDetails {
  id: string;
  party: PartyDetails;
  guest: GuestDetails;
  status: string;
  token: string;
}

export default function RSVPPage() {
  const params = useParams();
  const token = params.token as string;
  
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [dietaryRestrictions, setDietaryRestrictions] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchInvitation();
    }
  }, [token]);

  const fetchInvitation = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/rsvp/${token}`);
      const data = await response.json();
      
      if (data.success) {
        setInvitation(data.invitation);
        setSelectedStatus(data.invitation.status || '');
      } else {
        setError(data.error || 'Failed to load invitation');
      }
    } catch (err) {
      setError('Failed to load invitation details');
      console.error('Error fetching invitation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRSVP = async () => {
    if (!selectedStatus) {
      setError('Please select an RSVP status');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      const response = await fetch(`/api/rsvp/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: selectedStatus,
          notes,
          dietaryRestrictions
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || 'Failed to submit RSVP');
      }
    } catch (err) {
      setError('Failed to submit RSVP');
      console.error('Error submitting RSVP:', err);
    } finally {
      setSubmitting(false);
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Oops!</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">RSVP Submitted!</h2>
            <p className="text-gray-600 mb-4">
              Thank you for responding to {invitation?.party.child_name}'s birthday party invitation.
            </p>
            <Badge variant={
              selectedStatus === 'CONFIRMED' ? 'default' : 
              selectedStatus === 'DECLINED' ? 'destructive' : 'secondary'
            }>
              {selectedStatus}
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-gray-600">Invitation not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Party Invitation Header */}
        <Card className="mb-6">
          <CardHeader className="text-center">
            <div className="mb-4">
              <Cake className="w-16 h-16 text-pink-500 mx-auto mb-2" />
              <CardTitle className="text-2xl font-bold text-gray-800">
                🎉 You're Invited! 🎉
              </CardTitle>
            </div>
            <h2 className="text-xl text-gray-700">
              {invitation.party.child_name}'s {invitation.party.child_age}th Birthday Party
            </h2>
            <Badge variant="outline" className="mt-2">
              {invitation.party.selected_theme || invitation.party.theme}
            </Badge>
          </CardHeader>
        </Card>

        {/* Party Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Party Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                <span className="font-medium">Date:</span>
                <span className="ml-2">{formatDate(invitation.party.party_date)}</span>
              </div>
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-2 text-gray-500" />
                <span className="font-medium">Time:</span>
                <span className="ml-2">{invitation.party.party_time}</span>
              </div>
              <div className="flex items-center">
                <MapPin className="w-4 h-4 mr-2 text-gray-500" />
                <span className="font-medium">Venue:</span>
                <span className="ml-2">{invitation.party.venue}</span>
              </div>
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-2 text-gray-500" />
                <span className="font-medium">Duration:</span>
                <span className="ml-2">{invitation.party.duration}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* RSVP Form */}
        <Card>
          <CardHeader>
            <CardTitle>RSVP for {invitation.guest.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* RSVP Status Selection */}
            <div>
              <h4 className="font-medium mb-3">Will you be attending?</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button
                  variant={selectedStatus === 'CONFIRMED' ? 'default' : 'outline'}
                  onClick={() => setSelectedStatus('CONFIRMED')}
                  className="justify-start h-auto p-4"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  <div>
                    <div className="font-medium">Yes, I'll be there!</div>
                    <div className="text-xs opacity-75">Can't wait to celebrate</div>
                  </div>
                </Button>
                
                <Button
                  variant={selectedStatus === 'MAYBE' ? 'default' : 'outline'}
                  onClick={() => setSelectedStatus('MAYBE')}
                  className="justify-start h-auto p-4"
                >
                  <HelpCircle className="w-5 h-5 mr-2" />
                  <div>
                    <div className="font-medium">Maybe</div>
                    <div className="text-xs opacity-75">I'll try my best</div>
                  </div>
                </Button>
                
                <Button
                  variant={selectedStatus === 'DECLINED' ? 'destructive' : 'outline'}
                  onClick={() => setSelectedStatus('DECLINED')}
                  className="justify-start h-auto p-4"
                >
                  <XCircle className="w-5 h-5 mr-2" />
                  <div>
                    <div className="font-medium">Sorry, can't make it</div>
                    <div className="text-xs opacity-75">Maybe next time</div>
                  </div>
                </Button>
              </div>
            </div>

            <Separator />

            {/* Additional Information */}
            {selectedStatus === 'CONFIRMED' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Dietary Restrictions (Optional)
                  </label>
                  <Textarea
                    value={dietaryRestrictions}
                    onChange={(e) => setDietaryRestrictions(e.target.value)}
                    placeholder="Please let us know about any allergies or dietary requirements..."
                    rows={2}
                  />
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Additional Notes (Optional)
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional comments or messages for the host..."
                rows={3}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleSubmitRSVP}
              disabled={!selectedStatus || submitting}
              className="w-full"
              size="lg"
            >
              {submitting ? 'Submitting...' : 'Submit RSVP'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}