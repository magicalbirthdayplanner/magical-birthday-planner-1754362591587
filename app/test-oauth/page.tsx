"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase-client'

export default function TestOAuthPage() {
  const [testResults, setTestResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testOAuthConfig = async () => {
    setLoading(true)
    setTestResults(null)

    try {
      // Test 1: Check current session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      
      // Test 2: Check current user
      const { data: userData, error: userError } = await supabase.auth.getUser()
      
      // Test 3: Test OAuth URL generation
      const baseUrl = window.location.origin
      const redirectTo = `${baseUrl}/auth/callback`
      
      console.log('OAuth Test - Redirect URL:', redirectTo)
      
      // Test 4: Check Supabase config
      const configResponse = await fetch('/api/check-supabase-config')
      const configData = await configResponse.json()

      setTestResults({
        session_test: {
          hasSession: !!sessionData.session,
          error: sessionError?.message
        },
        user_test: {
          hasUser: !!userData.user,
          error: userError?.message,
          userEmail: userData.user?.email
        },
        oauth_config: {
          redirectUrl: redirectTo,
          baseUrl: baseUrl
        },
        supabase_config: configData,
        browser_info: {
          userAgent: navigator.userAgent,
          cookiesEnabled: navigator.cookieEnabled,
          localStorage: typeof Storage !== 'undefined'
        }
      })
    } catch (error) {
      console.error('OAuth test error:', error)
      setTestResults({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  const initiateOAuth = async () => {
    try {
      const baseUrl = window.location.origin
      const redirectTo = `${baseUrl}/auth/callback`
      
      console.log('Initiating OAuth with redirect:', redirectTo)
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          },
          scopes: 'openid email profile'
        }
      })
      
      if (error) {
        console.error('OAuth initiation error:', error)
        alert(`OAuth Error: ${error.message}`)
      } else {
        console.log('OAuth initiated successfully:', data)
      }
    } catch (error) {
      console.error('OAuth exception:', error)
      alert(`OAuth Exception: ${error}`)
    }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>OAuth Debugging Test Page</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button onClick={testOAuthConfig} disabled={loading}>
                {loading ? 'Testing...' : 'Run OAuth Config Test'}
              </Button>
              <Button onClick={initiateOAuth} variant="outline">
                Test OAuth Flow
              </Button>
            </div>
            
            {testResults && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">Test Results:</h3>
                <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
                  {JSON.stringify(testResults, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}