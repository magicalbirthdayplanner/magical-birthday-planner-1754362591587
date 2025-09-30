-- Fix users table for authentication
-- Run this in Supabase SQL Editor

-- First, check if users table exists and show its structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public';

-- Check current RLS status
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE tablename = 'users' 
AND schemaname = 'public';

-- Temporarily disable RLS to allow user creation
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

-- Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create proper RLS policies for users table
CREATE POLICY "Enable read access for authenticated users" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Enable insert for authenticated users" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for users based on id" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Test query to see existing users
SELECT id, email, full_name, created_at FROM public.users;

-- Check if the specific user exists
SELECT * FROM public.users WHERE email = 'magicalbirthdayplanner@gmail.com';