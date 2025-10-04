"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function TrialDebugBanner() {
  const { user } = useAuth();
  const [trialData, setTrialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrialStatus = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        console.log('🔍 Fetching trial status for user:', user.email);
        const response = await fetch('/api/user/trial');
        
        console.log('📡 Trial API response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Trial data received:', data);
          setTrialData(data);
        } else {
          const errorData = await response.text();
          console.error('❌ Trial API error:', errorData);
          setError(`API Error: ${response.status} - ${errorData}`);
        }
      } catch (err) {
        console.error('💥 Trial fetch error:', err);
        setError(`Network Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchTrialStatus();
  }, [user]);

  // Force show the debug banner for testing
  return (
    <Card className="border-l-4 border-l-blue-500 bg-blue-50 mb-6">
      <CardContent className="p-4">
        <div className="space-y-3">
          <h3 className="font-semibold text-blue-800">🔧 Trial System Debug Info</h3>
          
          <div className="text-sm space-y-2">
            <div><strong>User:</strong> {user ? user.email : 'Not logged in'}</div>
            <div><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</div>
            <div><strong>Error:</strong> {error || 'None'}</div>
            
            {trialData && (
              <div className="bg-blue-100 p-3 rounded">
                <strong>Trial Data:</strong>
                <pre className="text-xs mt-1 overflow-auto">
                  {JSON.stringify(trialData, null, 2)}
                </pre>
              </div>
            )}
            
            {!trialData && !loading && !error && (
              <div className="text-orange-600">
                ⚠️ No trial data received - API might not be working
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button 
              size="sm" 
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Refresh Page
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                setLoading(true);
                setError(null);
                setTrialData(null);
                // Refetch
                setTimeout(() => {
                  const fetchTrialStatus = async () => {
                    try {
                      const response = await fetch('/api/user/trial');
                      if (response.ok) {
                        const data = await response.json();
                        setTrialData(data);
                      } else {
                        setError(`API Error: ${response.status}`);
                      }
                    } catch (err) {
                      setError(`Network Error: ${err}`);
                    } finally {
                      setLoading(false);
                    }
                  };
                  fetchTrialStatus();
                }, 100);
              }}
            >
              Test API
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}