/**
 * n8n Integration Utilities
 * Provides helper functions for integrating with n8n workflows
 */

export interface N8nWebhookResponse {
  success: boolean
  data?: any
  error?: string
}

export interface N8nTriggerData {
  workflowId?: string
  event: string
  data: Record<string, any>
  timestamp: string
}

/**
 * Trigger an n8n workflow via webhook
 * @param webhookUrl - The n8n webhook URL
 * @param data - The data to send to the workflow
 * @returns Promise with the response
 */
export async function triggerN8nWorkflow(
  webhookUrl: string,
  data: Record<string, any>
): Promise<N8nWebhookResponse> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
        source: 'magical-birthday-planner'
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    
    return {
      success: true,
      data: result
    }
  } catch (error) {
    console.error('Error triggering n8n workflow:', error)
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Send party creation data to n8n workflow
 * @param webhookUrl - The n8n webhook URL
 * @param partyData - The party data to process
 */
export async function sendPartyDataToN8n(
  webhookUrl: string,
  partyData: {
    id: string
    childName: string
    childAge: number
    theme: string
    date: string
    guestCount: number
    budget?: number
  }
): Promise<N8nWebhookResponse> {
  return triggerN8nWorkflow(webhookUrl, {
    event: 'party_created',
    party: partyData
  })
}

/**
 * Send guest RSVP data to n8n workflow
 * @param webhookUrl - The n8n webhook URL
 * @param rsvpData - The RSVP data to process
 */
export async function sendRSVPDataToN8n(
  webhookUrl: string,
  rsvpData: {
    partyId: string
    guestName: string
    guestEmail: string
    status: 'accepted' | 'declined' | 'maybe' | 'pending'
    timestamp: string
  }
): Promise<N8nWebhookResponse> {
  return triggerN8nWorkflow(webhookUrl, {
    event: 'rsvp_received',
    rsvp: rsvpData
  })
}

/**
 * Process n8n webhook payload
 * @param payload - The incoming webhook payload
 * @returns Processed data
 */
export function processN8nWebhook(payload: any): N8nTriggerData {
  return {
    workflowId: payload.workflowId,
    event: payload.event || 'unknown',
    data: payload.data || payload,
    timestamp: payload.timestamp || new Date().toISOString()
  }
}

/**
 * Validate n8n webhook signature (if using authentication)
 * @param payload - The webhook payload
 * @param signature - The signature header
 * @param secret - The webhook secret
 * @returns Whether the signature is valid
 */
export function validateN8nSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // Implement signature validation if needed
  // This is a placeholder for webhook authentication
  return true
}

/**
 * Get n8n webhook URLs from environment
 */
export const N8N_WEBHOOKS = {
  PARTY_CREATED: process.env.N8N_PARTY_WEBHOOK_URL,
  RSVP_RECEIVED: process.env.N8N_RSVP_WEBHOOK_URL,
  GUEST_ADDED: process.env.N8N_GUEST_WEBHOOK_URL,
  INVITATION_SENT: process.env.N8N_INVITATION_WEBHOOK_URL,
} as const