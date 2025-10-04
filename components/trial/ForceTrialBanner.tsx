"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ForceTrialBanner() {
  const { user } = useAuth();
  const [diagnostics, setDiagnostics] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const runDiagnostics = async () => {
      const results: any = {
        timestamp: new Date().toISOString(),
        user: user ? {
          id: user.id,
          email: user.email,
          metadata: user.user_metadata
        } : null,
        environment: {
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL
        }
      };

      // Test API endpoints
      if (user) {
        try {
          console.log('🔍 Testing /api/user/trial...');
          const trialResponse = await fetch('/api/user/trial');
          results.trialAPI = {
            status: trialResponse.status,
            ok: trialResponse.ok,
            statusText: trialResponse.statusText
          };
          
          if (trialResponse.ok) {
            try {
              const trialData = await trialResponse.json();
              results.trialData = trialData;
            } catch (e) {
              results.trialData = 'Failed to parse JSON';
            }
          } else {
            try {
              results.trialError = await trialResponse.text();
            } catch (e) {
              results.trialError = 'Failed to read error';
            }
          }
        } catch (error) {
          results.trialAPI = {
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }

        // Test subscription API
        try {
          console.log('🔍 Testing /api/user/subscription...');
          const subResponse = await fetch('/api/user/subscription');
          results.subscriptionAPI = {
            status: subResponse.status,
            ok: subResponse.ok
          };
          
          if (subResponse.ok) {
            try {
              const subData = await subResponse.json();
              results.subscriptionData = subData;
            } catch (e) {
              results.subscriptionData = 'Failed to parse JSON';
            }
          }
        } catch (error) {
          results.subscriptionAPI = {
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }

        // Test profile API
        try {
          console.log('🔍 Testing /api/user/profile...');
          const profileResponse = await fetch('/api/user/profile');
          results.profileAPI = {
            status: profileResponse.status,
            ok: profileResponse.ok
          };
          
          if (profileResponse.ok) {
            try {
              const profileData = await profileResponse.json();
              results.profileData = {
                currentPlan: profileData.currentPlan,
                id: profileData.id,
                email: profileData.email
              };
            } catch (e) {
              results.profileData = 'Failed to parse JSON';
            }
          }
        } catch (error) {
          results.profileAPI = {
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }

      setDiagnostics(results);
      setLoading(false);
    };

    runDiagnostics();
  }, [user]);

  const setupDatabase = async () => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/setup-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: user.email })
      });
      
      const result = await response.json();
      console.log('Database setup result:', result);
      
      if (response.ok) {
        alert('✅ Database setup complete and trial activated!\n\nYou now have 24 hours of Pro access.');
        window.location.reload();
      } else {
        alert(`❌ Setup failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Database setup error:', error);
      alert(`❌ Network error: ${error}`);
    }
  };

  // Always show this banner for debugging
  return (
    <Card className="border-l-4 border-l-red-500 bg-red-50 mb-6">
      <CardContent className="p-4">
        <div className="space-y-4">
          <h3 className="font-semibold text-red-800">🚨 TRIAL SYSTEM DIAGNOSTICS</h3>
          
          {loading ? (
            <div className="text-sm text-red-700">Running diagnostics...</div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm">
                <strong>User Status:</strong> {user ? '✅ Logged In' : '❌ Not Logged In'}
              </div>
              
              {user && (
                <>
                  <div className="text-sm">
                    <strong>User Email:</strong> {user.email}
                  </div>
                  
                  <div className="text-sm">
                    <strong>Trial API Status:</strong> {
                      diagnostics.trialAPI?.ok ? '✅ Working' : 
                      diagnostics.trialAPI?.status ? `❌ HTTP ${diagnostics.trialAPI.status}` : 
                      '❌ Failed'
                    }
                  </div>
                  
                  {diagnostics.trialData && (
                    <div className="bg-green-100 p-2 rounded text-xs">
                      <strong>Trial Data:</strong>
                      <pre>{JSON.stringify(diagnostics.trialData, null, 2)}</pre>
                    </div>
                  )}
                  
                  {diagnostics.profileData && (
                    <div className="text-sm">
                      <strong>Current Plan:</strong> {diagnostics.profileData.currentPlan || 'Unknown'}
                    </div>
                  )}
                  
                  {diagnostics.trialError && (
                    <div className="bg-red-100 p-2 rounded text-xs">
                      <strong>Trial API Error:</strong>
                      <pre>{diagnostics.trialError}</pre>
                    </div>
                  )}
                </>
              )}
              
              <div className="bg-gray-100 p-2 rounded text-xs">
                <strong>Full Diagnostics:</strong>
                <pre className="max-h-40 overflow-auto">
                  {JSON.stringify(diagnostics, null, 2)}
                </pre>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <Button 
                  size="sm" 
                  onClick={() => window.location.reload()}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Refresh
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/auth-test');
                      const result = await response.json();
                      console.log('Auth test result:', result);
                      alert('Check browser console for auth test results');
                    } catch (error) {
                      console.error('Auth test error:', error);
                    }
                  }}
                >
                  Test Auth
                </Button>
                {user && (
                  <Button 
                    size="sm" 
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={setupDatabase}
                  >
                    🔧 Setup Database & Activate Trial
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}