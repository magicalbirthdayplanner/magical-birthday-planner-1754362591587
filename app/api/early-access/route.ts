import { NextRequest, NextResponse } from 'next/server';
import { safeJson } from '@/lib/server/safe-json';
import { createServerComponentClient } from '@/lib/supabase';

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

export async function POST(request: NextRequest) {
  try {
    const { email, name, interests } = await request.json();
    
    if (!email) {
      return safeJson(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // For now, just return success
    // In the future, this could store early access requests in a database
    console.log('Early access request:', { email, name, interests });

    return safeJson({
      success: true,
      message: 'Thank you for your interest! We\'ll be in touch soon.',
      email
    });

  } catch (error) {
    console.error('Error processing early access request:', error);
    return safeJson(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
