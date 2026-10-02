import { NextResponse } from 'next/server'
import { safeJson } from '@/lib/server/safe-json';
import { getUserParties } from '@/lib/party-actions'

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

// Force dynamic rendering for this API route since it uses cookies
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await getUserParties()
    
    if (!result.success) {
      return safeJson(
        { error: result.error },
        { status: 500 }
      )
    }

    return safeJson({ 
      success: true,
      parties: result.parties 
    })
  } catch (error) {
    console.error('Error in parties API:', error)
    return safeJson(
      { error: 'Failed to fetch parties' },
      { status: 500 }
    )
  }
}
