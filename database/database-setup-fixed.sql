-- =====================================================
-- MAGICAL BIRTHDAY PLANNER - FIXED DATABASE SETUP
-- =====================================================

-- First, let's clean up any existing tables that might have wrong types
DROP TABLE IF EXISTS public.activity_favorites CASCADE;
DROP TABLE IF EXISTS public.theme_preferences CASCADE;
DROP TABLE IF EXISTS public.party_activities CASCADE;
DROP TABLE IF EXISTS public.invitations CASCADE;
DROP TABLE IF EXISTS public.guests CASCADE;
DROP TABLE IF EXISTS public.parties CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.activities CASCADE;
DROP TABLE IF EXISTS public.email_logs CASCADE;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- CORE TABLES (in correct order for foreign keys)
-- =====================================================

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    current_plan TEXT DEFAULT 'FREE' CHECK (current_plan IN ('FREE', 'STARTER', 'PLUS', 'PRO')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activities table (no foreign key dependencies)
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    full_description TEXT,
    supplies_needed TEXT[],
    setup_time INTEGER NOT NULL,
    helpers_required INTEGER DEFAULT 0,
    step_by_step_instructions TEXT NOT NULL,
    host_script TEXT,
    age_group TEXT[],
    venue_type TEXT[],
    duration TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    theme_compatibility TEXT[],
    effort_level TEXT NOT NULL,
    participant_range TEXT,
    min_participants INTEGER DEFAULT 1,
    max_participants INTEGER,
    category TEXT NOT NULL,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Parties table (references users)
CREATE TABLE IF NOT EXISTS public.parties (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    child_name TEXT NOT NULL,
    child_age INTEGER NOT NULL,
    child_gender TEXT,
    party_date DATE NOT NULL,
    party_time TIME,
    party_location TEXT,
    zip_code TEXT,
    guest_count INTEGER DEFAULT 0,
    budget DECIMAL(10,2),
    theme TEXT,
    colors TEXT[],
    venue_type TEXT,
    status TEXT DEFAULT 'PLANNING' CHECK (status IN ('PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
    is_shared BOOLEAN DEFAULT FALSE,
    share_token TEXT UNIQUE,
    shared_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Guests table (references parties and users)
CREATE TABLE IF NOT EXISTS public.guests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    party_id UUID REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    type TEXT DEFAULT 'GUEST' CHECK (type IN ('GUEST', 'HELPER', 'HOST')),
    age INTEGER,
    notes TEXT,
    rsvp_status TEXT DEFAULT 'PENDING' CHECK (rsvp_status IN ('PENDING', 'CONFIRMED', 'DECLINED', 'MAYBE')),
    dietary_restrictions TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invitations table (references parties, guests, and users)
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    party_id UUID REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
    guest_id UUID REFERENCES public.guests(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    token TEXT UNIQUE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    opened_at TIMESTAMP WITH TIME ZONE,
    responded_at TIMESTAMP WITH TIME ZONE,
    email_sent BOOLEAN DEFAULT FALSE,
    email_opened BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Party Activities table (references parties, users, and activities)
CREATE TABLE IF NOT EXISTS public.party_activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    party_id UUID REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE NOT NULL,
    is_selected BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    custom_notes TEXT,
    estimated_time INTEGER,
    people_required INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(party_id, activity_id)
);

-- Activity Favorites table (references users and activities)
CREATE TABLE IF NOT EXISTS public.activity_favorites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, activity_id)
);

-- Theme Preferences table (references users)
CREATE TABLE IF NOT EXISTS public.theme_preferences (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    theme_name TEXT NOT NULL,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, theme_name)
);

-- Email Logs table (references users and parties)
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    party_id UUID REFERENCES public.parties(id) ON DELETE CASCADE,
    email_type TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'SENT' CHECK (status IN ('SENT', 'DELIVERED', 'FAILED', 'BOUNCED')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_current_plan ON public.users(current_plan);

-- Parties indexes
CREATE INDEX IF NOT EXISTS idx_parties_user_id ON public.parties(user_id);
CREATE INDEX IF NOT EXISTS idx_parties_status ON public.parties(status);
CREATE INDEX IF NOT EXISTS idx_parties_share_token ON public.parties(share_token);
CREATE INDEX IF NOT EXISTS idx_parties_party_date ON public.parties(party_date);

-- Activities indexes
CREATE INDEX IF NOT EXISTS idx_activities_category ON public.activities(category);
CREATE INDEX IF NOT EXISTS idx_activities_duration ON public.activities(duration);
CREATE INDEX IF NOT EXISTS idx_activities_effort_level ON public.activities(effort_level);
CREATE INDEX IF NOT EXISTS idx_activities_age_group ON public.activities USING GIN(age_group);
CREATE INDEX IF NOT EXISTS idx_activities_venue_type ON public.activities USING GIN(venue_type);
CREATE INDEX IF NOT EXISTS idx_activities_tags ON public.activities USING GIN(tags);

-- Guests indexes
CREATE INDEX IF NOT EXISTS idx_guests_party_id ON public.guests(party_id);
CREATE INDEX IF NOT EXISTS idx_guests_user_id ON public.guests(user_id);
CREATE INDEX IF NOT EXISTS idx_guests_rsvp_status ON public.guests(rsvp_status);

-- Invitations indexes
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_party_id ON public.invitations(party_id);
CREATE INDEX IF NOT EXISTS idx_invitations_guest_id ON public.invitations(guest_id);

-- Party Activities indexes
CREATE INDEX IF NOT EXISTS idx_party_activities_party_id ON public.party_activities(party_id);
CREATE INDEX IF NOT EXISTS idx_party_activities_user_id ON public.party_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_party_activities_activity_id ON public.party_activities(activity_id);

-- Activity Favorites indexes
CREATE INDEX IF NOT EXISTS idx_activity_favorites_user_id ON public.activity_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_favorites_activity_id ON public.activity_favorites(activity_id);

-- Theme Preferences indexes
CREATE INDEX IF NOT EXISTS idx_theme_preferences_user_id ON public.theme_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_theme_preferences_is_favorite ON public.theme_preferences(is_favorite);

-- Email Logs indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON public.email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_party_id ON public.email_logs(party_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON public.email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON public.email_logs(sent_at);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Parties policies
CREATE POLICY "Users can view own parties" ON public.parties
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own parties" ON public.parties
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own parties" ON public.parties
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own parties" ON public.parties
    FOR DELETE USING (auth.uid() = user_id);

-- Public read access to shared parties
CREATE POLICY "Anyone can view shared parties" ON public.parties
    FOR SELECT USING (is_shared = true);

-- Activities policies (public read access)
CREATE POLICY "Anyone can view activities" ON public.activities
    FOR SELECT USING (true);

-- Guests policies
CREATE POLICY "Users can view guests for their parties" ON public.guests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.parties 
            WHERE parties.id = guests.party_id 
            AND parties.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert guests for their parties" ON public.guests
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.parties 
            WHERE parties.id = guests.party_id 
            AND parties.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update guests for their parties" ON public.guests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.parties 
            WHERE parties.id = guests.party_id 
            AND parties.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete guests for their parties" ON public.guests
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.parties 
            WHERE parties.id = guests.party_id 
            AND parties.user_id = auth.uid()
        )
    );

-- Invitations policies
CREATE POLICY "Users can view invitations for their parties" ON public.invitations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.parties 
            WHERE parties.id = invitations.party_id 
            AND parties.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert invitations for their parties" ON public.invitations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.parties 
            WHERE parties.id = invitations.party_id 
            AND parties.user_id = auth.uid()
        )
    );

-- Party Activities policies
CREATE POLICY "Users can view party activities for their parties" ON public.party_activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.parties 
            WHERE parties.id = party_activities.party_id 
            AND parties.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert party activities for their parties" ON public.party_activities
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.parties 
            WHERE parties.id = party_activities.party_id 
            AND parties.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update party activities for their parties" ON public.party_activities
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.parties 
            WHERE parties.id = party_activities.party_id 
            AND parties.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete party activities for their parties" ON public.party_activities
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.parties 
            WHERE parties.id = party_activities.party_id 
            AND parties.user_id = auth.uid()
        )
    );

-- Activity Favorites policies
CREATE POLICY "Users can view own activity favorites" ON public.activity_favorites
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity favorites" ON public.activity_favorites
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own activity favorites" ON public.activity_favorites
    FOR DELETE USING (auth.uid() = user_id);

-- Theme Preferences policies
CREATE POLICY "Users can view own theme preferences" ON public.theme_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own theme preferences" ON public.theme_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own theme preferences" ON public.theme_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own theme preferences" ON public.theme_preferences
    FOR DELETE USING (auth.uid() = user_id);

-- Email Logs policies
CREATE POLICY "Users can view own email logs" ON public.email_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email logs" ON public.email_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parties_updated_at BEFORE UPDATE ON public.parties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON public.activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guests_updated_at BEFORE UPDATE ON public.guests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invitations_updated_at BEFORE UPDATE ON public.invitations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_party_activities_updated_at BEFORE UPDATE ON public.party_activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SAMPLE DATA
-- =====================================================

-- Sample data will be inserted separately after table creation
-- For now, just create the tables with proper structure

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.users IS 'User profiles extending Supabase auth.users';
COMMENT ON TABLE public.parties IS 'Birthday party information and details';
COMMENT ON TABLE public.activities IS 'Available activities for parties';
COMMENT ON TABLE public.guests IS 'Guest information for parties';
COMMENT ON TABLE public.invitations IS 'Party invitations and RSVP tracking';
COMMENT ON TABLE public.party_activities IS 'Activities selected for specific parties';
COMMENT ON TABLE public.activity_favorites IS 'User favorite activities';
COMMENT ON TABLE public.theme_preferences IS 'User theme preferences and favorites';
COMMENT ON TABLE public.email_logs IS 'Email sending history and status';

COMMENT ON COLUMN public.users.current_plan IS 'User subscription plan: FREE, STARTER, or PROFESSIONAL';
COMMENT ON COLUMN public.parties.status IS 'Party status: PLANNING, ACTIVE, COMPLETED, or CANCELLED';
COMMENT ON COLUMN public.activities.effort_level IS 'Activity difficulty: Low, Medium, or High';
COMMENT ON COLUMN public.guests.rsvp_status IS 'Guest response: PENDING, CONFIRMED, DECLINED, or MAYBE';

-- =====================================================
-- SETUP COMPLETE
-- =====================================================

-- Verify all tables were created
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'parties', 'activities', 'guests', 'invitations', 'party_activities', 'activity_favorites', 'theme_preferences', 'email_logs')
ORDER BY tablename;
