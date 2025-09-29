import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

export async function POST() {
  try {
    const cookieStore = cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })
    
    const results: Array<{
      operation: string
      status: string
      details?: string
    }> = []
    
    // Create profiles table
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.profiles (
          id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT,
          full_name TEXT,
          avatar TEXT,
          subscription_plan TEXT DEFAULT 'FREE' CHECK (subscription_plan IN ('FREE', 'STARTER', 'PLUS', 'PRO')),
          subscription_status TEXT DEFAULT 'INACTIVE' CHECK (subscription_status IN ('ACTIVE', 'INACTIVE', 'EXPIRED')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    })
    
    if (createError) {
      results.push({
        operation: 'Create profiles table',
        status: 'Failed',
        details: createError.message
      })
    } else {
      results.push({
        operation: 'Create profiles table',
        status: 'Success'
      })
    }
    
    // Enable RLS on profiles table
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
        DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
        DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
        
        -- Create RLS policies
        CREATE POLICY "Users can view own profile" ON public.profiles
          FOR SELECT USING (auth.uid() = id);
          
        CREATE POLICY "Users can update own profile" ON public.profiles
          FOR UPDATE USING (auth.uid() = id);
          
        CREATE POLICY "Users can insert own profile" ON public.profiles
          FOR INSERT WITH CHECK (auth.uid() = id);
      `
    })
    
    if (rlsError) {
      results.push({
        operation: 'Setup RLS policies',
        status: 'Failed',
        details: rlsError.message
      })
    } else {
      results.push({
        operation: 'Setup RLS policies',
        status: 'Success'
      })
    }
    
    // Migrate existing users data to profiles if users table exists
    const { error: migrateError } = await supabase.rpc('exec_sql', {
      sql: `
        INSERT INTO public.profiles (id, email, name, full_name, created_at, updated_at)
        SELECT id, email, full_name, full_name, created_at, updated_at
        FROM public.users
        WHERE NOT EXISTS (
          SELECT 1 FROM public.profiles WHERE profiles.id = users.id
        );
      `
    })
    
    if (migrateError) {
      results.push({
        operation: 'Migrate users to profiles',
        status: 'Failed',
        details: migrateError.message
      })
    } else {
      results.push({
        operation: 'Migrate users to profiles',
        status: 'Success'
      })
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      setup_results: results,
      success: results.every(r => r.status === 'Success'),
      message: results.every(r => r.status === 'Success') 
        ? 'Profiles table setup completed successfully'
        : 'Some operations failed - check details'
    })
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}