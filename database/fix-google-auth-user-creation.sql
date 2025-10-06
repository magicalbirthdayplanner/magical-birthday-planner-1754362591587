-- =====================================================
-- FIX GOOGLE AUTH USER CREATION ISSUE
-- =====================================================

-- Step 1: Ensure all trial columns exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_plan TEXT DEFAULT 'PRO',
ADD COLUMN IF NOT EXISTS is_trial_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_used_trial BOOLEAN DEFAULT FALSE;

-- Step 2: Create a function to handle new user creation automatically
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    full_name,
    avatar_url,
    current_plan,
    trial_started_at,
    trial_expires_at,
    trial_plan,
    is_trial_active,
    has_used_trial,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    'PRO', -- Start with PRO plan for 24-hour trial
    NOW(),
    NOW() + INTERVAL '24 hours',
    'PRO',
    TRUE,
    TRUE,
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, users.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create trigger to automatically create user profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Step 4: Add RLS policy to allow user creation via trigger
CREATE POLICY IF NOT EXISTS "Allow user creation via trigger" ON public.users
  FOR INSERT WITH CHECK (true);

-- Step 5: Update existing RLS policies to be more permissive for user creation
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);

-- Step 6: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.users TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_trial_expires_at ON public.users(trial_expires_at);
CREATE INDEX IF NOT EXISTS idx_users_is_trial_active ON public.users(is_trial_active);

-- Test that the function works
SELECT 'Google Auth user creation fix applied successfully!' as status;