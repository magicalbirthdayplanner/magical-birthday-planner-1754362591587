import { NextResponse } from 'next/server'
import { safeJson } from '@/lib/server/safe-json';

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return safeJson({
      status: 'healthy',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return safeJson({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
