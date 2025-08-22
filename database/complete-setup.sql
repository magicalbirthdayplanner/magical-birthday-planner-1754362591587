-- =====================================================
-- MAGICAL BIRTHDAY PLANNER - COMPLETE DATABASE SETUP
-- =====================================================
-- Run this script in your Supabase SQL Editor to complete the database setup

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- STEP 1: ADD MISSING COLUMNS TO ACTIVITIES TABLE
-- =====================================================

-- Add duration_minutes column
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30;

-- Add venue_type column
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS venue_type TEXT[] DEFAULT ARRAY['INDOOR']::TEXT[];

-- Add supplies_needed column
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS supplies_needed TEXT[] DEFAULT ARRAY['Basic supplies']::TEXT[];

-- Add participant_range column
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS participant_range TEXT DEFAULT '2-10';

-- Add min_participants column
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS min_participants INTEGER DEFAULT 2;

-- Add max_participants column
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS max_participants INTEGER DEFAULT 10;

-- Add age_group column
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS age_group TEXT[] DEFAULT ARRAY['5-12']::TEXT[];

-- Add theme_compatibility column
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS theme_compatibility TEXT[] DEFAULT ARRAY['General']::TEXT[];

-- Add tags column
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[];

-- =====================================================
-- STEP 2: CREATE MISSING TABLES
-- =====================================================

-- Create guests table
CREATE TABLE IF NOT EXISTS public.guests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    party_id UUID REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
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
    party_id UUID REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
    activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'SELECTED' CHECK (status IN ('SELECTED', 'COMPLETED', 'SKIPPED')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(party_id, activity_id)
);

-- Create activity_favorites table
CREATE TABLE IF NOT EXISTS public.activity_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, activity_id)
);

-- Create invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    party_id UUID REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
    guest_id UUID REFERENCES public.guests(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    token TEXT UNIQUE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    opened_at TIMESTAMP WITH TIME ZONE,
    responded_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'ACCEPTED', 'DECLINED', 'MAYBE')),
    message TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create theme_preferences table
CREATE TABLE IF NOT EXISTS public.theme_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    favorite_themes TEXT[] DEFAULT ARRAY[]::TEXT[],
    preferred_colors TEXT[] DEFAULT ARRAY[]::TEXT[],
    activity_preferences TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create email_logs table
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    recipient_email TEXT NOT NULL,
    email_type TEXT NOT NULL,
    subject TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'SENT' CHECK (status IN ('SENT', 'DELIVERED', 'FAILED', 'BOUNCED')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- STEP 3: UPDATE EXISTING ACTIVITY WITH PROPER DATA
-- =====================================================

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

-- =====================================================
-- STEP 4: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Activities table indexes
CREATE INDEX IF NOT EXISTS idx_activities_category ON public.activities(category);
CREATE INDEX IF NOT EXISTS idx_activities_age_group ON public.activities USING GIN(age_group);
CREATE INDEX IF NOT EXISTS idx_activities_theme_compatibility ON public.activities USING GIN(theme_compatibility);
CREATE INDEX IF NOT EXISTS idx_activities_tags ON public.activities USING GIN(tags);

-- Guests table indexes
CREATE INDEX IF NOT EXISTS idx_guests_party_id ON public.guests(party_id);
CREATE INDEX IF NOT EXISTS idx_guests_user_id ON public.guests(user_id);
CREATE INDEX IF NOT EXISTS idx_guests_rsvp_status ON public.guests(rsvp_status);

-- Party activities indexes
CREATE INDEX IF NOT EXISTS idx_party_activities_party_id ON public.party_activities(party_id);
CREATE INDEX IF NOT EXISTS idx_party_activities_activity_id ON public.party_activities(activity_id);
CREATE INDEX IF NOT EXISTS idx_party_activities_user_id ON public.party_activities(user_id);

-- Activity favorites indexes
CREATE INDEX IF NOT EXISTS idx_activity_favorites_user_id ON public.activity_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_favorites_activity_id ON public.activity_favorites(activity_id);

-- Invitations indexes
CREATE INDEX IF NOT EXISTS idx_invitations_party_id ON public.invitations(party_id);
CREATE INDEX IF NOT EXISTS idx_invitations_guest_id ON public.invitations(guest_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);

-- =====================================================
-- STEP 5: ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 6: CREATE RLS POLICIES
-- =====================================================

-- Activities: Public read access
CREATE POLICY "Activities are viewable by everyone" ON public.activities
    FOR SELECT USING (true);

-- Users: Users can only access their own data
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid()::text = id);
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid()::text = id);
CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid()::text = id);

-- Parties: Users can only access their own parties
CREATE POLICY "Users can view own parties" ON public.parties
    FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can create own parties" ON public.parties
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own parties" ON public.parties
    FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own parties" ON public.parties
    FOR DELETE USING (auth.uid()::text = user_id);

-- Guests: Users can access guests of their own parties
CREATE POLICY "Users can view guests of own parties" ON public.guests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.parties 
            WHERE public.parties.id = public.guests.party_id 
            AND public.parties.user_id = auth.uid()::text
        )
    );
CREATE POLICY "Users can manage guests of own parties" ON public.guests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.parties 
            WHERE public.parties.id = public.guests.party_id 
            AND public.parties.user_id = auth.uid()::text
        )
    );

-- Party activities: Users can access activities of their own parties
CREATE POLICY "Users can view party activities of own parties" ON public.party_activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.parties 
            WHERE public.parties.id = public.party_activities.party_id 
            AND public.parties.user_id = auth.uid()::text
        )
    );
CREATE POLICY "Users can manage party activities of own parties" ON public.party_activities
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.parties 
            WHERE public.parties.id = public.party_activities.party_id 
            AND public.parties.user_id = auth.uid()::text
        )
    );

-- Activity favorites: Users can only access their own favorites
CREATE POLICY "Users can view own favorites" ON public.activity_favorites
    FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can manage own favorites" ON public.activity_favorites
    FOR ALL USING (auth.uid()::text = user_id);

-- Invitations: Users can access invitations for their own parties
CREATE POLICY "Users can view invitations for own parties" ON public.invitations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.parties 
            WHERE public.parties.id = public.invitations.party_id 
            AND public.parties.user_id = auth.uid()::text
        )
    );
CREATE POLICY "Users can manage invitations for own parties" ON public.invitations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.parties 
            WHERE public.parties.id = public.invitations.party_id 
            AND public.parties.user_id = auth.uid()::text
        )
    );

-- Theme preferences: Users can only access their own preferences
CREATE POLICY "Users can view own theme preferences" ON public.theme_preferences
    FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can manage own theme preferences" ON public.theme_preferences
    FOR ALL USING (auth.uid()::text = user_id);

-- Email logs: Users can only access their own email logs
CREATE POLICY "Users can view own email logs" ON public.email_logs
    FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can manage own email logs" ON public.email_logs
    FOR ALL USING (auth.uid()::text = user_id);

-- =====================================================
-- STEP 7: CREATE TRIGGERS FOR AUTOMATIC TIMESTAMPS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_parties_updated_at BEFORE UPDATE ON public.parties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guests_updated_at BEFORE UPDATE ON public.guests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_party_activities_updated_at BEFORE UPDATE ON public.party_activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invitations_updated_at BEFORE UPDATE ON public.invitations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_theme_preferences_updated_at BEFORE UPDATE ON public.theme_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STEP 8: INSERT SAMPLE DATA
-- =====================================================

-- Insert sample activities (if they don't exist)
INSERT INTO public.activities (id, name, description, category, duration, effort_level, duration_minutes, venue_type, supplies_needed, participant_range, min_participants, max_participants, age_group, theme_compatibility, tags)
VALUES 
    (gen_random_uuid(), 'Craft Station', 'Creative arts and crafts activities', 'Creative', '45 minutes', 'Low', 45, ARRAY['INDOOR']::TEXT[], ARRAY['Paper', 'Scissors', 'Glue', 'Markers']::TEXT[], '3-8', 3, 8, ARRAY['4-12']::TEXT[], ARRAY['Creative', 'Arts']::TEXT[], ARRAY['crafts', 'creative', 'art']::TEXT[]),
    (gen_random_uuid(), 'Dance Party', 'High-energy dance and music activities', 'Entertainment', '30 minutes', 'Medium', 30, ARRAY['INDOOR']::TEXT[], ARRAY['Music player', 'Speakers', 'Dance props']::TEXT[], '4-12', 4, 12, ARRAY['3-12']::TEXT[], ARRAY['Party', 'Music']::TEXT[], ARRAY['dance', 'music', 'party']::TEXT[]),
    (gen_random_uuid(), 'Science Experiments', 'Fun and safe science activities', 'Educational', '60 minutes', 'High', 60, ARRAY['INDOOR']::TEXT[], ARRAY['Safety goggles', 'Simple chemicals', 'Measuring tools']::TEXT[], '2-6', 2, 6, ARRAY['8-14']::TEXT[], ARRAY['Educational', 'Science']::TEXT[], ARRAY['science', 'experiments', 'learning']::TEXT[])
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

-- This will show in the results
SELECT '🎉 DATABASE SETUP COMPLETE!' as status,
       'Your Magical Birthday Planner database is now fully configured!' as message,
       NOW() as completed_at;
