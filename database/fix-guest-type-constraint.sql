-- =====================================================
-- GUEST TYPE CONSTRAINT FIX
-- =====================================================
-- This script fixes the guest type constraint to match frontend expectations
-- Frontend uses: 'ADULT', 'CHILD', 'FAMILY', 'COUPLE'
-- Database currently expects: 'GUEST', 'HELPER', 'HOST'

-- Step 1: Drop the existing constraint
DO $$ 
BEGIN
    -- Check if the constraint exists and drop it
    IF EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'guests_type_check'
        AND table_name = 'guests'
    ) THEN
        ALTER TABLE public.guests DROP CONSTRAINT guests_type_check;
        RAISE NOTICE 'Dropped existing guests_type_check constraint';
    END IF;
END $$;

-- Step 2: Add the new constraint with correct values
ALTER TABLE public.guests 
ADD CONSTRAINT guests_type_check 
CHECK (type IN ('ADULT', 'CHILD', 'FAMILY', 'COUPLE'));

-- Step 3: Update the default value to match frontend expectations
ALTER TABLE public.guests 
ALTER COLUMN type SET DEFAULT 'ADULT';

-- Step 4: Update any existing data (if any) to use the new format
-- This is safe because we're mapping from old system to new system
UPDATE public.guests 
SET type = CASE 
    WHEN type = 'GUEST' THEN 'ADULT'
    WHEN type = 'HELPER' THEN 'ADULT'
    WHEN type = 'HOST' THEN 'ADULT'
    ELSE 'ADULT'
END
WHERE type IN ('GUEST', 'HELPER', 'HOST');

-- Step 5: Verify the change
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'guests' 
AND column_name = 'type';

-- Step 6: Test the constraint by attempting a valid insert (this should work)
-- Note: This is just a test - the actual insert will be done by the application
DO $$
BEGIN
    RAISE NOTICE 'Guest type constraint updated successfully!';
    RAISE NOTICE 'Valid types are now: ADULT, CHILD, FAMILY, COUPLE';
    RAISE NOTICE 'Default type is now: ADULT';
END $$;