"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Webhook, Zap, CheckCircle, XCircle } from 'lucide-react'
import { triggerN8nWorkflow } from '@/lib/n8n'

interface WorkflowTriggerProps {
  webhookUrl?: string
  title: string
  description: string
  eventType: string
  data: Record<string, any>
}

export function WorkflowTrigger({ 
  webhookUrl, 
  title, 
  description, 
  eventType, 
  data 
}: WorkflowTriggerProps) {
  const [isTriggering, setIsTriggering] = useState(false)
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleTrigger = async () => {
    if (!webhookUrl) {
      setLastResult({ success: false, message: 'Webhook URL not configured' })
      return
    }

    setIsTriggering(true)
    setLastResult(null)

    try {
      const result = await triggerN8nWorkflow(webhookUrl, {
        event: eventType,
        ...data
      })

      setLastResult({
        success: result.success,
        message: result.success ? 'Workflow triggered successfully' : result.error || 'Failed to trigger workflow'
      })
    } catch (error) {
      setLastResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    } finally {
      setIsTriggering(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Webhook className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <Badge variant={webhookUrl ? "default" : "secondary"}>
            {webhookUrl ? "Configured" : "Not Configured"}
          </Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          <p><strong>Event Type:</strong> {eventType}</p>
          <p><strong>Payload Preview:</strong></p>
          <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>

        {lastResult && (
          <div className={`flex items-center space-x-2 p-3 rounded-lg ${
            lastResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {lastResult.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <span className="text-sm">{lastResult.message}</span>
          </div>
        )}

        <Button 
          onClick={handleTrigger}
          disabled={!webhookUrl || isTriggering}
          className="w-full"
        >
          {isTriggering ? (
            <>
              <Zap className="h-4 w-4 mr-2 animate-spin" />
              Triggering...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Trigger Workflow
            </>
          )}
        </Button>

        {!webhookUrl && (
          <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
            Configure the webhook URL in your environment variables to enable this automation.
          </p>
        )}
      </CardContent>
    </Card>
  )
}