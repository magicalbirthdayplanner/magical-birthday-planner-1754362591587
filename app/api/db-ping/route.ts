import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/lib/supabase-client';

export async function GET() {
  try {
    const healthCheck = await checkDatabaseHealth();
    
    if (healthCheck.success) {
      return NextResponse.json({
        success: true,
        message: 'Database connection successful',
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Database connection failed',
        error: healthCheck.error,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Database health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}