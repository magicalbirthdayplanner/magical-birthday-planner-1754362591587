import { NextResponse } from 'next/server';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return NextResponse.json({
    supabaseUrl: supabaseUrl || 'MISSING',
    supabaseKeyPresent: !!supabaseKey,
    supabaseKeyLength: supabaseKey?.length || 0,
    supabaseKeyFormat: supabaseKey ? supabaseKey.startsWith('eyJ') : false,
    serviceKeyPresent: !!serviceKey,
    serviceKeyLength: serviceKey?.length || 0,
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
}