import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // For now, just return success to avoid database dependency
    // This will fallback to localStorage in the auto-save hook
    return NextResponse.json({ success: true, message: 'Auto-save will use localStorage until database is configured' })
  } catch (error) {
    console.error('Error in party data API:', error)
    return NextResponse.json({ error: 'API error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // For now, return empty array to trigger localStorage fallback
    return NextResponse.json({ parties: [] })
  } catch (error) {
    console.error('Error in party data API:', error)
    return NextResponse.json({ error: 'API error' }, { status: 500 })
  }
}