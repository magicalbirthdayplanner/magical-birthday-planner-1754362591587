import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Log the webhook data for debugging
    console.log('n8n webhook received:', body)
    
    // Process the webhook data here
    // You can add your business logic based on the webhook payload
    
    return NextResponse.json({ 
      success: true, 
      message: 'Webhook processed successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error processing n8n webhook:', error)
    
    return NextResponse.json(
      { success: false, error: 'Failed to process webhook' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'n8n webhook endpoint is active',
    timestamp: new Date().toISOString()
  })
}