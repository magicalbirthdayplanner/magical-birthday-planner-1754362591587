import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    console.log('🔍 Auth test - checking session...');
    
    const cookieStore = cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    
    // Get session first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('📋 Session check:', { hasSession: !!session, sessionError: sessionError?.message });
    
    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('👤 User check:', { hasUser: !!user, userError: userError?.message });
    
    // Check database connection
    let dbTest: { success: boolean; error?: string } = { success: false };
    try {
      const { data, error } = await supabase.from('users').select('count').limit(1);
      dbTest = { success: !error, error: error?.message };
    } catch (dbErr) {
      dbTest = { success: false, error: (dbErr as Error).message };
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      session: session ? {
        user_id: session.user.id,
        expires_at: session.expires_at,
        access_token: session.access_token?.substring(0, 20) + '...'
      } : null,
      user: user ? {
        id: user.id,
        email: user.email
      } : null,
      cookies: {
        total: cookieStore.getAll().length,
        authCookies: cookieStore.getAll().filter(c => c.name.includes('supabase')).map(c => c.name)
      },
      database: dbTest,
      errors: {
        session: sessionError?.message,
        user: userError?.message
      }
    });
    
  } catch (error) {
    console.error('❌ Auth test error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}