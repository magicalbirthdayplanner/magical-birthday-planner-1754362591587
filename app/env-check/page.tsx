/*
 * Environment Variables Checker Page
 * 
 * This page displays all environment variables needed for the application
 * and their current status. When AI adds new env variables to the codebase,
 * it should automatically update the ENV_VARIABLES array in lib/env-config.ts.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Code, Settings, Save, ArrowRight } from 'lucide-react';
import { getConfigSummary, validateAllConfig } from '@/lib/env-config';
import Link from 'next/link';

export default function EnvCheckPage() {
  // Get configuration summary
  const configSummary = getConfigSummary();
  
  // Count missing and optional configurations
  const missingCount = Object.values(configSummary.supabase).filter(status => 
    typeof status === 'string' && status.includes('❌')
  ).length;
  const optionalCount = Object.values(configSummary).filter(config => 
    typeof config === 'object' && config !== null && 
    Object.values(config).some(status => typeof status === 'string' && status.includes('⚠️'))
  ).length;

  const getStatusIcon = (status: string) => {
    if (status.includes('✅')) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    } else if (status.includes('❌')) {
      return <XCircle className="h-5 w-5 text-red-500" />;
    } else {
      return <XCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    if (status.includes('✅')) {
      return <Badge variant="default" className="bg-green-500">Configured</Badge>;
    } else if (status.includes('❌')) {
      return <Badge variant="destructive">Missing</Badge>;
    } else {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Optional</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Environment Variables Status</h1>
        <p className="text-base mt-2 text-muted-foreground flex items-center flex-wrap gap-1">
          <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-md font-semibold">Configuration Status</span>
          This page shows the current status of your application configuration. Required configurations must be set for the app to function properly.
        </p>
      </div>

      {missingCount > 0 && (
        <>
          <Alert className="mb-3 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100 p-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 flex-shrink-0" />
              <AlertDescription>
                <strong>{missingCount} environment variable{missingCount > 1 ? 's are' : ' is'} missing.</strong>
              </AlertDescription>
            </div>
          </Alert>
          <p className="text-sm text-muted-foreground mb-6">
            Please configure {missingCount > 1 ? 'these variables' : 'this variable'} to ensure proper application functionality.
          </p>
        </>
      )}

      {missingCount === 0 && (
        <Alert className="mb-6 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/50 dark:text-green-100 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>✅ Core functionality ready!</strong>
                {optionalCount > 0 && (
                  <span className="text-sm ml-2">
                    - {optionalCount} optional variable{optionalCount > 1 ? 's' : ''} available for enhanced features
                  </span>
                )}
              </AlertDescription>
            </div>
            <Link href="/">
              <Button className="bg-green-600 hover:bg-green-700 text-white">
                Go to App
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </Alert>
      )}

      <div className="grid gap-4">
        {/* Supabase Configuration */}
        <Card className="relative">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Supabase Configuration</CardTitle>
                <Badge variant="destructive" className="text-xs">Required</Badge>
              </div>
            </div>
            <CardDescription>Database and authentication configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(configSummary.supabase).map(([key, status]) => (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status)}
                    {getStatusBadge(status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Database Configuration */}
        <Card className="relative">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Database Configuration</CardTitle>
                <Badge variant="destructive" className="text-xs">Required</Badge>
              </div>
            </div>
            <CardDescription>Database connection settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">Database URL</span>
                <div className="flex items-center gap-2">
                  {getStatusIcon(configSummary.database.url)}
                  {getStatusBadge(configSummary.database.url)}
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 border rounded-lg">
                <span className="font-medium">Database Type:</span>
                <Badge variant="outline">{configSummary.database.type}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Optional Configurations */}
        <Card className="relative">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Enhanced Features</CardTitle>
                <Badge variant="secondary" className="text-xs">Optional</Badge>
              </div>
            </div>
            <CardDescription>Additional features and integrations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">Azure OpenAI API</span>
                <div className="flex items-center gap-2">
                  {getStatusIcon(configSummary.azureOpenAI.apiKey)}
                  {getStatusBadge(configSummary.azureOpenAI.apiKey)}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">Stripe Payments</span>
                <div className="flex items-center gap-2">
                  {getStatusIcon(configSummary.stripe.secretKey)}
                  {getStatusBadge(configSummary.stripe.secretKey)}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">Email Service</span>
                <div className="flex items-center gap-2">
                  {getStatusIcon(configSummary.email.resendKey)}
                  {getStatusBadge(configSummary.email.resendKey)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Environment Info */}
        <Card className="relative">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Environment Information</CardTitle>
            <CardDescription>Current application configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">Environment</span>
                <Badge variant="outline">{configSummary.environment}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">Base URL</span>
                <Badge variant="outline">{configSummary.baseUrl}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">Vercel Environment</span>
                <Badge variant="outline">{configSummary.vercel.isVercel ? 'Deployed' : 'Local'}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}