import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        message: 'Missing environment variables'
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to get all activities with detailed error logging
    const { data, error, count } = await supabase
      .from('activities')
      .select('*')
      .limit(5);

    if (error) {
      console.error('Supabase error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      
      return NextResponse.json({
        success: false,
        message: 'Failed to fetch activities',
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      }, { status: 500 });
    }

    // Log the data structure
    console.log('Activities data structure:', {
      count: data?.length || 0,
      firstRecord: data?.[0] ? Object.keys(data[0]) : 'No data',
      sampleData: data?.[0] || null
    });

    return NextResponse.json({
      success: true,
      message: 'Activities fetched successfully',
      count: data?.length || 0,
      data: data,
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
