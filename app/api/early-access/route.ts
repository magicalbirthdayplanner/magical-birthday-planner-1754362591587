import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { email, name, interests } = await request.json();
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // For now, just return success
    // In the future, this could store early access requests in a database
    console.log('Early access request:', { email, name, interests });

    return NextResponse.json({
      success: true,
      message: 'Thank you for your interest! We\'ll be in touch soon.',
      email
    });

  } catch (error) {
    console.error('Error processing early access request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}