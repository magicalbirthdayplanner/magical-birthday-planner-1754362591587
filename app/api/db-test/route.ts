import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-client';

export async function GET() {
  try {
    const supabase = createAdminClient();
    
    // Test basic database operations
    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select('count')
      .limit(1);
    
    if (activitiesError) {
      throw new Error(`Activities query failed: ${activitiesError.message}`);
    }

    // Test parties table
    const { data: parties, error: partiesError } = await supabase
      .from('parties')
      .select('count')
      .limit(1);
    
    if (partiesError) {
      throw new Error(`Parties query failed: ${partiesError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Database test successful',
      tables: {
        activities: 'OK',
        parties: 'OK'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Database test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
