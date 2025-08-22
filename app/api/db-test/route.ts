import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isVercel } from '@/lib/env-config';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        message: 'Missing environment variables',
        error: `URL: ${supabaseUrl ? 'Present' : 'Missing'}, Key: ${supabaseKey ? 'Present' : 'Missing'}`,
        environment: process.env.NODE_ENV,
        isVercel: isVercel,
        vercelUrl: process.env.VERCEL_URL,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    console.log('Testing connection with:', { 
      url: supabaseUrl, 
      keyPresent: !!supabaseKey,
      environment: process.env.NODE_ENV,
      isVercel: isVercel
    });

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to access a simple table
    const { data, error } = await supabase
      .from('activities')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({
        success: false,
        message: 'Database connection failed',
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        environment: process.env.NODE_ENV,
        isVercel: isVercel,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      data: data,
      environment: process.env.NODE_ENV,
      isVercel: isVercel,
      vercelUrl: process.env.VERCEL_URL,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({
      success: false,
      message: 'Unexpected error occurred',
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: process.env.NODE_ENV,
      isVercel: isVercel,
      vercelUrl: process.env.VERCEL_URL,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
