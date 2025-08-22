-- =====================================================
-- MAGICAL BIRTHDAY PLANNER - STEP BY STEP SETUP
-- =====================================================
-- This script will check existing structures and create missing tables safely

-- Step 1: Check existing table structures
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'parties', 'activities')
ORDER BY table_name, ordinal_position;

-- Step 2: Add missing columns to activities table (one by one to avoid errors)
DO $$ 
BEGIN
    -- Add duration_minutes column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'duration_minutes') THEN
        ALTER TABLE public.activities ADD COLUMN duration_minutes INTEGER DEFAULT 30;
        RAISE NOTICE 'Added duration_minutes column';
    END IF;
    
    -- Add venue_type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'venue_type') THEN
        ALTER TABLE public.activities ADD COLUMN venue_type TEXT[] DEFAULT ARRAY['INDOOR']::TEXT[];
        RAISE NOTICE 'Added venue_type column';
    END IF;
    
    -- Add supplies_needed column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'supplies_needed') THEN
        ALTER TABLE public.activities ADD COLUMN supplies_needed TEXT[] DEFAULT ARRAY['Basic supplies']::TEXT[];
        RAISE NOTICE 'Added supplies_needed column';
    END IF;
    
    -- Add participant_range column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'participant_range') THEN
        ALTER TABLE public.activities ADD COLUMN participant_range TEXT DEFAULT '2-10';
        RAISE NOTICE 'Added participant_range column';
    END IF;
    
    -- Add min_participants column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'min_participants') THEN
        ALTER TABLE public.activities ADD COLUMN min_participants INTEGER DEFAULT 2;
        RAISE NOTICE 'Added min_participants column';
    END IF;
    
    -- Add max_participants column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'max_participants') THEN
        ALTER TABLE public.activities ADD COLUMN max_participants INTEGER DEFAULT 10;
        RAISE NOTICE 'Added max_participants column';
    END IF;
    
    -- Add age_group column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'age_group') THEN
        ALTER TABLE public.activities ADD COLUMN age_group TEXT[] DEFAULT ARRAY['5-12']::TEXT[];
        RAISE NOTICE 'Added age_group column';
    END IF;
    
    -- Add theme_compatibility column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'theme_compatibility') THEN
        ALTER TABLE public.activities ADD COLUMN theme_compatibility TEXT[] DEFAULT ARRAY['General']::TEXT[];
        RAISE NOTICE 'Added theme_compatibility column';
    END IF;
    
    -- Add tags column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'tags') THEN
        ALTER TABLE public.activities ADD COLUMN tags TEXT[] DEFAULT ARRAY[]::TEXT[];
        RAISE NOTICE 'Added tags column';
    END IF;
    
END $$;

-- Step 3: Update existing activity with proper data
UPDATE public.activities 
SET 
    duration_minutes = 30,
    venue_type = ARRAY['INDOOR', 'OUTDOOR']::TEXT[],
    supplies_needed = ARRAY['Treasure chest', 'Small toys', 'Clue cards', 'Map']::TEXT[],
    participant_range = '4-8',
    min_participants = 4,
    max_participants = 8,
    age_group = ARRAY['5-10']::TEXT[],
    theme_compatibility = ARRAY['Adventure', 'Pirate', 'Explorer']::TEXT[],
    tags = ARRAY['treasure', 'adventure', 'search', 'teamwork']::TEXT[]
WHERE id = '35d96825-8fb5-43cc-99a3-a408134ff479';

-- Step 4: Create missing tables (checking existing ones first)
-- Create guests table
CREATE TABLE IF NOT EXISTS public.guests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    party_id UUID,
    user_id UUID,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    type TEXT DEFAULT 'GUEST' CHECK (type IN ('GUEST', 'HELPER', 'HOST')),
    age INTEGER,
    notes TEXT,
    rsvp_status TEXT DEFAULT 'PENDING' CHECK (rsvp_status IN ('PENDING', 'CONFIRMED', 'DECLINED', 'MAYBE')),
    dietary_restrictions TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create party_activities table
CREATE TABLE IF NOT EXISTS public.party_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    party_id UUID,
    activity_id UUID,
    user_id UUID,
    status TEXT DEFAULT 'SELECTED' CHECK (status IN ('SELECTED', 'COMPLETED', 'SKIPPED')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(party_id, activity_id)
);

-- Create activity_favorites table
CREATE TABLE IF NOT EXISTS public.activity_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    activity_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, activity_id)
);

-- Step 5: Add foreign key constraints (only if tables exist and columns match)
DO $$ 
BEGIN
    -- Add foreign key for guests.party_id if parties table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'parties') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'guests_party_id_fkey') THEN
            ALTER TABLE public.guests ADD CONSTRAINT guests_party_id_fkey 
                FOREIGN KEY (party_id) REFERENCES public.parties(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added foreign key constraint for guests.party_id';
        END IF;
    END IF;
    
    -- Add foreign key for guests.user_id if users table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'guests_user_id_fkey') THEN
            ALTER TABLE public.guests ADD CONSTRAINT guests_user_id_fkey 
                FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added foreign key constraint for guests.user_id';
        END IF;
    END IF;
    
    -- Add foreign key for party_activities.party_id if parties table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'parties') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'party_activities_party_id_fkey') THEN
            ALTER TABLE public.party_activities ADD CONSTRAINT party_activities_party_id_fkey 
                FOREIGN KEY (party_id) REFERENCES public.parties(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added foreign key constraint for party_activities.party_id';
        END IF;
    END IF;
    
    -- Add foreign key for party_activities.activity_id if activities table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activities') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'party_activities_activity_id_fkey') THEN
            ALTER TABLE public.party_activities ADD CONSTRAINT party_activities_activity_id_fkey 
                FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added foreign key constraint for party_activities.activity_id';
        END IF;
    END IF;
    
    -- Add foreign key for party_activities.user_id if users table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'party_activities_user_id_fkey') THEN
            ALTER TABLE public.party_activities ADD CONSTRAINT party_activities_user_id_fkey 
                FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added foreign key constraint for party_activities.user_id';
        END IF;
    END IF;
    
    -- Add foreign key for activity_favorites.user_id if users table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'activity_favorites_user_id_fkey') THEN
            ALTER TABLE public.activity_favorites ADD CONSTRAINT activity_favorites_user_id_fkey 
                FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added foreign key constraint for activity_favorites.user_id';
        END IF;
    END IF;
    
    -- Add foreign key for activity_favorites.activity_id if activities table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activities') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'activity_favorites_activity_id_fkey') THEN
            ALTER TABLE public.activity_favorites ADD CONSTRAINT activity_favorites_activity_id_fkey 
                FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added foreign key constraint for activity_favorites.activity_id';
        END IF;
    END IF;
    
END $$;

-- Step 6: Create indexes
CREATE INDEX IF NOT EXISTS idx_activities_category ON public.activities(category);
CREATE INDEX IF NOT EXISTS idx_activities_age_group ON public.activities USING GIN(age_group);
CREATE INDEX IF NOT EXISTS idx_activities_theme_compatibility ON public.activities USING GIN(theme_compatibility);
CREATE INDEX IF NOT EXISTS idx_activities_tags ON public.activities USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_guests_party_id ON public.guests(party_id);
CREATE INDEX IF NOT EXISTS idx_guests_user_id ON public.guests(user_id);
CREATE INDEX IF NOT EXISTS idx_guests_rsvp_status ON public.guests(rsvp_status);

CREATE INDEX IF NOT EXISTS idx_party_activities_party_id ON public.party_activities(party_id);
CREATE INDEX IF NOT EXISTS idx_party_activities_activity_id ON public.party_activities(activity_id);
CREATE INDEX IF NOT EXISTS idx_party_activities_user_id ON public.party_activities(user_id);

CREATE INDEX IF NOT EXISTS idx_activity_favorites_user_id ON public.activity_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_favorites_activity_id ON public.activity_favorites(activity_id);

-- Step 7: Insert sample activities
INSERT INTO public.activities (id, name, description, category, duration, effort_level, duration_minutes, venue_type, supplies_needed, participant_range, min_participants, max_participants, age_group, theme_compatibility, tags)
VALUES 
    (gen_random_uuid(), 'Craft Station', 'Creative arts and crafts activities', 'Creative', '45 minutes', 'Low', 45, ARRAY['INDOOR']::TEXT[], ARRAY['Paper', 'Scissors', 'Glue', 'Markers']::TEXT[], '3-8', 3, 8, ARRAY['4-12']::TEXT[], ARRAY['Creative', 'Arts']::TEXT[], ARRAY['crafts', 'creative', 'art']::TEXT[]),
    (gen_random_uuid(), 'Dance Party', 'High-energy dance and music activities', 'Entertainment', '30 minutes', 'Medium', 30, ARRAY['INDOOR']::TEXT[], ARRAY['Music player', 'Speakers', 'Dance props']::TEXT[], '4-12', 4, 12, ARRAY['3-12']::TEXT[], ARRAY['Party', 'Music']::TEXT[], ARRAY['dance', 'music', 'party']::TEXT[]),
    (gen_random_uuid(), 'Science Experiments', 'Fun and safe science activities', 'Educational', '60 minutes', 'High', 60, ARRAY['INDOOR']::TEXT[], ARRAY['Safety goggles', 'Simple chemicals', 'Measuring tools']::TEXT[], '2-6', 2, 6, ARRAY['8-14']::TEXT[], ARRAY['Educational', 'Science']::TEXT[], ARRAY['science', 'experiments', 'learning']::TEXT[])
ON CONFLICT (id) DO NOTHING;

-- Step 8: Show completion status
SELECT '🎉 STEP-BY-STEP SETUP COMPLETED!' as status,
       'Your database structure has been updated!' as message,
       NOW() as completed_at;
