import { NextResponse } from 'next/server'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const timestamp = new Date().toISOString()
    
    // Basic environment check
    const envCheck = {
      NODE_ENV: process.env.NODE_ENV || 'undefined',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'defined' : 'undefined',
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL ? 'defined' : 'undefined'
    }
    
    return NextResponse.json({
      status: 'healthy',
      timestamp,
      message: 'Application is running',
      environment: envCheck,
      version: '1.0.0'
    })
    
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}