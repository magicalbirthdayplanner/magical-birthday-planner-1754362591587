-- =====================================================
-- MAGICAL BIRTHDAY PLANNER - 24-HOUR TRIAL SYSTEM
-- =====================================================

-- Add trial-related columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_plan TEXT DEFAULT 'PRO',
ADD COLUMN IF NOT EXISTS is_trial_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_used_trial BOOLEAN DEFAULT FALSE;

-- Create index for efficient trial queries
CREATE INDEX IF NOT EXISTS idx_users_trial_expires_at ON public.users(trial_expires_at);
CREATE INDEX IF NOT EXISTS idx_users_is_trial_active ON public.users(is_trial_active);

-- Function to start a 24-hour trial for a user
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

-- Function to check if trial is expired and update status
CREATE OR REPLACE FUNCTION check_and_expire_trial(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  trial_expired BOOLEAN := FALSE;
BEGIN
  -- Check if trial is active and expired
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

-- Function to get user's trial status
CREATE OR REPLACE FUNCTION get_trial_status(user_id UUID)
RETURNS TABLE(
  is_trial_active BOOLEAN,
  trial_started_at TIMESTAMP WITH TIME ZONE,
  trial_expires_at TIMESTAMP WITH TIME ZONE,
  trial_plan TEXT,
  has_used_trial BOOLEAN,
  time_remaining_minutes INTEGER,
  current_plan TEXT
) AS $$
BEGIN
  -- First check and expire trial if needed
  PERFORM check_and_expire_trial(user_id);
  
  -- Return trial status
  RETURN QUERY
  SELECT 
    u.is_trial_active,
    u.trial_started_at,
    u.trial_expires_at,
    u.trial_plan,
    u.has_used_trial,
    CASE 
      WHEN u.is_trial_active AND u.trial_expires_at > NOW() 
      THEN EXTRACT(EPOCH FROM (u.trial_expires_at - NOW()))::INTEGER / 60
      ELSE 0
    END as time_remaining_minutes,
    u.current_plan
  FROM public.users u
  WHERE u.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS policy for trial functions
CREATE POLICY "Users can access own trial functions" ON public.users
FOR ALL USING (auth.uid() = id);

-- Create a view for easy trial status checking
CREATE OR REPLACE VIEW user_trial_status AS
SELECT 
  id,
  email,
  current_plan,
  is_trial_active,
  trial_started_at,
  trial_expires_at,
  trial_plan,
  has_used_trial,
  CASE 
    WHEN is_trial_active AND trial_expires_at > NOW() 
    THEN EXTRACT(EPOCH FROM (trial_expires_at - NOW()))::INTEGER / 60
    ELSE 0
  END as time_remaining_minutes,
  CASE
    WHEN is_trial_active AND trial_expires_at > NOW() THEN 'ACTIVE'
    WHEN has_used_trial AND trial_expires_at < NOW() THEN 'EXPIRED'
    WHEN has_used_trial AND NOT is_trial_active THEN 'EXPIRED'
    ELSE 'NOT_STARTED'
  END as trial_status
FROM public.users;

-- Grant permissions
GRANT SELECT ON user_trial_status TO authenticated;
GRANT EXECUTE ON FUNCTION start_24_hour_trial(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_expire_trial(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trial_status(UUID) TO authenticated;

-- Add comment to track migration
COMMENT ON COLUMN public.users.trial_started_at IS '24-hour trial system: When trial started';
COMMENT ON COLUMN public.users.trial_expires_at IS '24-hour trial system: When trial expires';
COMMENT ON COLUMN public.users.trial_plan IS '24-hour trial system: Plan during trial (PRO)';
COMMENT ON COLUMN public.users.is_trial_active IS '24-hour trial system: Whether trial is currently active';
COMMENT ON COLUMN public.users.has_used_trial IS '24-hour trial system: Whether user has used their trial';

SELECT 'Trial system migration completed successfully!' as status;