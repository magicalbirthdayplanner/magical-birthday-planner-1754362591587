import { NextResponse } from 'next/server'
import { getUserParties } from '@/lib/party-actions'

// Force dynamic rendering for this API route since it uses cookies
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await getUserParties()
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      parties: result.parties 
    })
  } catch (error) {
    console.error('Error in parties API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch parties' },
      { status: 500 }
    )
  }
}