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

-- The main issue: users table has foreign key constraint to auth.users
-- But OAuth users don't get inserted into auth.users immediately
-- Let's temporarily remove the foreign key constraint for testing

-- Disable RLS to allow operations
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Drop the foreign key constraint that's causing issues
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Add it back but with ON DELETE CASCADE and less strict
ALTER TABLE public.users ADD CONSTRAINT users_id_fkey 
  FOREIGN KEY (id) REFERENCES auth.users(id) 
  ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.users;

-- Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create very permissive policies for testing
CREATE POLICY "Allow authenticated users to do everything" ON public.users
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Test query to see existing users
SELECT id, email, full_name, created_at FROM public.users;

-- Check if the specific user exists
SELECT * FROM public.users WHERE email = 'magicalbirthdayplanner@gmail.com';

-- Test inserting a user manually (this should work now)
INSERT INTO public.users (id, email, full_name, created_at, updated_at) 
VALUES (gen_random_uuid(), 'test-manual@example.com', 'Manual Test User', NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET updated_at = NOW();

-- Clean up test user
DELETE FROM public.users WHERE email = 'test-manual@example.com';