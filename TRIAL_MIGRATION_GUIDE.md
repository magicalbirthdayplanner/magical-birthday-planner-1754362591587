# 24-Hour Trial System Migration Guide

## Quick Migration (Copy & Paste into Supabase SQL Editor)

**IMPORTANT**: Copy and paste the following SQL directly into your Supabase Dashboard → SQL Editor → New Query

```sql
-- =====================================================
-- MAGICAL BIRTHDAY PLANNER - 24-HOUR TRIAL SYSTEM
-- Execute this in Supabase Dashboard SQL Editor
-- =====================================================

-- Step 1: Add trial-related columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_plan TEXT DEFAULT 'PRO',
ADD COLUMN IF NOT EXISTS is_trial_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_used_trial BOOLEAN DEFAULT FALSE;

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_trial_expires_at ON public.users(trial_expires_at);
CREATE INDEX IF NOT EXISTS idx_users_is_trial_active ON public.users(is_trial_active);

-- Step 3: Function to start a 24-hour trial for a user
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

-- Step 4: Function to check if trial is expired and update status
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

-- Step 5: Grant permissions for authenticated users
GRANT EXECUTE ON FUNCTION start_24_hour_trial(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_expire_trial(UUID) TO authenticated;

-- Step 6: Verify the migration worked
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('trial_started_at', 'trial_expires_at', 'trial_plan', 'is_trial_active', 'has_used_trial')
ORDER BY column_name;
```

## Manual Execution Steps

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project: `magical-birthday-planner`

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste SQL**
   - Copy the entire SQL block above
   - Paste it into the SQL editor
   - Click "Run" button

4. **Verify Success**
   - You should see a table showing the new columns
   - Check that all 5 trial-related columns are listed

## What This Migration Does

- ✅ **Adds trial tracking columns** to the users table
- ✅ **Creates database functions** for trial management
- ✅ **Adds performance indexes** for trial queries
- ✅ **Sets up permissions** for authenticated users
- ✅ **Provides verification** to confirm migration success

## Next Steps After Migration

Once the SQL is executed successfully:
1. The database will be ready for trial functionality
2. New users will automatically start with a 24-hour PRO trial
3. Trial expiration will be handled automatically
4. Application code can check trial status in real-time

## Rollback (If Needed)

To remove the trial system:

```sql
-- Remove trial columns (use with caution)
ALTER TABLE public.users 
DROP COLUMN IF EXISTS trial_started_at,
DROP COLUMN IF EXISTS trial_expires_at,
DROP COLUMN IF EXISTS trial_plan,
DROP COLUMN IF EXISTS is_trial_active,
DROP COLUMN IF EXISTS has_used_trial;

-- Remove functions
DROP FUNCTION IF EXISTS start_24_hour_trial(UUID);
DROP FUNCTION IF EXISTS check_and_expire_trial(UUID);
```

---

**Status**: Ready for manual execution in Supabase Dashboard