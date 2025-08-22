import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = createServerComponentClient({ cookies: () => [] });
    
    // Test database connection with a simple query
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (error) {
      return NextResponse.json({
        success: false,
        message: 'Database connection failed',
        error: error.message,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Database health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}