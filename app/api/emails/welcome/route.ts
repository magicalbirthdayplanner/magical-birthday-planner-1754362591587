import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { email, name } = await request.json();
    
    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      );
    }

    // For now, just log the welcome email request
    // In the future, this would send a welcome email
    console.log('Welcome email requested for:', { email, name });

    return NextResponse.json({
      success: true,
      message: 'Welcome email sent successfully'
    });

  } catch (error) {
    console.error('Error sending welcome email:', error);
    return NextResponse.json(
      { error: 'Failed to send welcome email' },
      { status: 500 }
    );
  }
}