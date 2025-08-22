import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        message: 'Missing environment variables',
        error: `URL: ${supabaseUrl ? 'Present' : 'Missing'}, Key: ${supabaseKey ? 'Present' : 'Missing'}`
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test different tables to see what exists
    const tableTests = [
      { name: 'activities', test: () => supabase.from('activities').select('id').limit(1) },
      { name: 'users', test: () => supabase.from('users').select('id').limit(1) },
      { name: 'parties', test: () => supabase.from('parties').select('id').limit(1) },
      { name: 'guests', test: () => supabase.from('guests').select('id').limit(1) },
      { name: 'party_activities', test: () => supabase.from('party_activities').select('id').limit(1) },
      { name: 'activity_favorites', test: () => supabase.from('activity_favorites').select('id').limit(1) }
    ];

    const results = {};

    for (const tableTest of tableTests) {
      try {
        const { data, error } = await tableTest.test();
        results[tableTest.name] = {
          exists: !error,
          error: error?.message || null,
          hasData: data && data.length > 0,
          sampleData: data ? data.slice(0, 2) : null
        };
      } catch (e) {
        results[tableTest.name] = {
          exists: false,
          error: 'Table does not exist or access denied',
          hasData: false,
          sampleData: null
        };
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Database structure check completed',
      tableStatus: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({
      success: false,
      message: 'Unexpected error occurred',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
