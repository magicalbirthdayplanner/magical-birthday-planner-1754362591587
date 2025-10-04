# 🚨 IMMEDIATE TRIAL SYSTEM FIX - PRODUCTION

You can't see trial features because the database schema hasn't been updated yet. Here's the step-by-step fix:

## Step 1: Execute Database Migration (REQUIRED)

**Copy and paste this ENTIRE SQL script in your Supabase Dashboard → SQL Editor:**

```sql
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
```

## Step 2: Deploy the Frontend Code

The code is already pushed. Deploy it to Vercel:

1. **Commit and push** (if not already done):
```bash
git add .
git commit -m "Add 24-hour trial system"
git push origin main
```

2. **Vercel will auto-deploy** - wait for deployment to complete

## Step 3: Test the Trial System

After running the SQL and deploying:

1. **Clear browser cache** completely
2. **Visit your deployed app**
3. **You should immediately see:**
   - ✅ Blue debug banner at top of dashboard
   - ✅ Trial status information
   - ✅ Access to create parties
   - ✅ Pro plan features unlocked

## Step 4: What You Should See

### In the Debug Banner:
```json
{
  "userId": "your-user-id",
  "trialStatus": "ACTIVE", 
  "isTrialActive": true,
  "hasUsedTrial": true,
  "trialPlan": "PRO",
  "timeRemainingMinutes": 1440,
  "currentPlan": "PRO"
}
```

### Pro Features Unlocked:
- ✅ **Create Party** button should work
- ✅ **Vendor Suggestions** tab available
- ✅ **Host Mode** tab available 
- ✅ **Food & Catering** features
- ✅ All premium features accessible

## Troubleshooting

### If you still can't create parties:
1. Check the debug banner data
2. Look for any console errors in browser dev tools
3. Verify your user's current_plan is 'PRO' in the database

### If debug banner shows errors:
1. Check that the SQL migration ran successfully
2. Verify no SQL syntax errors in Supabase logs
3. Check API route is accessible at `/api/user/trial`

### If no trial data appears:
1. Refresh the page completely 
2. Clear all browser data and cookies
3. Check network tab for API call failures

## Expected Result

After following these steps, you should have:
- ✅ **24-hour Pro trial active**
- ✅ **Debug banner showing trial info**
- ✅ **Ability to create parties**
- ✅ **All Pro features unlocked**
- ✅ **Trial countdown timer**

The system will automatically expire the trial after 24 hours and show upgrade prompts.

---

## 🚀 Quick Fix Summary

1. **Run the SQL** in Supabase Dashboard
2. **Deploy the code** (if not already deployed) 
3. **Clear browser cache** and test
4. **You should see trial features immediately**

The debug banner will help us see exactly what's happening with your trial status!