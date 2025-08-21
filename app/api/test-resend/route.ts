import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      message: 'Test endpoint working - email service not configured yet',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Test endpoint failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}