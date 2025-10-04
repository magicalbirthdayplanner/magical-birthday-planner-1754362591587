-- =====================================================
-- INSTANT TRIAL SYSTEM FIX FOR PRODUCTION
-- Execute this entire script in Supabase Dashboard → SQL Editor
-- =====================================================

-- Step 1: Add trial columns to users table (if not exists)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_plan TEXT DEFAULT 'PRO',
ADD COLUMN IF NOT EXISTS is_trial_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_used_trial BOOLEAN DEFAULT FALSE;

-- Step 2: Create performance indexes
CREATE INDEX IF NOT EXISTS idx_users_trial_expires_at ON public.users(trial_expires_at);
CREATE INDEX IF NOT EXISTS idx_users_is_trial_active ON public.users(is_trial_active);

-- Step 3: Create trial management functions
CREATE OR REPLACE FUNCTION start_24_hour_trial(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.users 
  SET 
    trial_started_at = NOW(),
    trial_expires_at = NOW() + INTERVAL '24 hours',
    trial_plan = 'PRO',
    is_trial_active = TRUE,
    has_used_trial = TRUE,
    current_plan = 'PRO',
    updated_at = NOW()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_and_expire_trial(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  trial_expired BOOLEAN := FALSE;
BEGIN
  UPDATE public.users 
  SET 
    is_trial_active = FALSE,
    current_plan = 'FREE',
    updated_at = NOW()
  WHERE id = user_id 
    AND is_trial_active = TRUE 
    AND trial_expires_at < NOW()
  RETURNING TRUE INTO trial_expired;
  
  RETURN COALESCE(trial_expired, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION start_24_hour_trial(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_expire_trial(UUID) TO authenticated;

-- Step 5: INSTANT FIX - Activate trial for all current FREE users
UPDATE public.users 
SET 
  trial_started_at = NOW(),
  trial_expires_at = NOW() + INTERVAL '24 hours',
  trial_plan = 'PRO',
  is_trial_active = TRUE,
  has_used_trial = TRUE,
  current_plan = 'PRO',
  updated_at = NOW()
WHERE current_plan = 'FREE' 
  AND (has_used_trial IS NULL OR has_used_trial = FALSE);

-- Step 6: Fix any users who might be stuck in FREE plan but should have trials
UPDATE public.users 
SET 
  current_plan = 'PRO',
  is_trial_active = TRUE
WHERE has_used_trial = TRUE 
  AND is_trial_active = TRUE 
  AND trial_expires_at > NOW() 
  AND current_plan = 'FREE';

-- Step 7: Verification - Show current trial status for all users
SELECT 
  email,
  current_plan,
  has_used_trial,
  is_trial_active,
  trial_started_at,
  trial_expires_at,
  CASE 
    WHEN is_trial_active AND trial_expires_at > NOW() THEN 'ACTIVE TRIAL'
    WHEN has_used_trial AND trial_expires_at < NOW() THEN 'EXPIRED TRIAL'
    WHEN has_used_trial = FALSE OR has_used_trial IS NULL THEN 'NO TRIAL YET'
    ELSE 'UNKNOWN'
  END as trial_status,
  CASE 
    WHEN is_trial_active AND trial_expires_at > NOW() THEN 
      EXTRACT(EPOCH FROM (trial_expires_at - NOW()))/60
    ELSE 0
  END as minutes_remaining
FROM public.users 
ORDER BY created_at DESC 
LIMIT 10;