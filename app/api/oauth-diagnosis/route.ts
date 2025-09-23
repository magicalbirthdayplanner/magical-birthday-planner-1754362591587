import { NextResponse } from 'next/server'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'undefined'
    const hasNewline = baseUrl.includes('\n')
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      status: 'OAuth diagnosis',
      environment: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'undefined',
        NEXT_PUBLIC_BASE_URL: baseUrl,
        has_newline_issue: hasNewline
      },
      issue: hasNewline ? 'Newline character detected in NEXT_PUBLIC_BASE_URL' : 'Environment looks clean',
      fix: hasNewline ? 'Fix NEXT_PUBLIC_BASE_URL in Vercel environment variables' : 'Check Supabase OAuth configuration'
    })
    
  } catch (error) {
    console.error('OAuth diagnosis error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}