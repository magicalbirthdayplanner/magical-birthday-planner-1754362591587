-- Fix the users table schema to match the API expectations
-- The API route expects 'name' and 'displayName' but the database has 'full_name'

-- First, let's add the required columns
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS "displayName" TEXT,
ADD COLUMN IF NOT EXISTS "emailNotifications" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "partyReminders" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "marketingEmails" BOOLEAN DEFAULT false;

-- Migrate existing data from full_name to name if it exists
UPDATE public.users 
SET name = full_name 
WHERE full_name IS NOT NULL AND name IS NULL;

-- Update the current_plan column to match expected values
UPDATE public.users 
SET current_plan = 'STARTER' 
WHERE current_plan = 'FREE';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_name ON public.users(name);
CREATE INDEX IF NOT EXISTS idx_users_display_name ON public.users("displayName");

-- Drop the old full_name column if it exists (after data migration)
-- We'll keep it for now to ensure no data loss
-- ALTER TABLE public.users DROP COLUMN IF EXISTS full_name;

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;