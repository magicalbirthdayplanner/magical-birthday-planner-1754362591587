-- =====================================================
-- MAGICAL BIRTHDAY PLANNER - SIMPLE DATABASE SETUP
-- =====================================================

-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.activity_favorites CASCADE;
DROP TABLE IF EXISTS public.theme_preferences CASCADE;
DROP TABLE IF EXISTS public.party_activities CASCADE;
DROP TABLE IF EXISTS public.invitations CASCADE;
DROP TABLE IF EXISTS public.guests CASCADE;
DROP TABLE IF EXISTS public.parties CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.activities CASCADE;
DROP TABLE IF EXISTS public.email_logs CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    current_plan TEXT DEFAULT 'FREE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create parties table
CREATE TABLE public.parties (
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
    status TEXT DEFAULT 'PLANNING',
    is_shared BOOLEAN DEFAULT FALSE,
    share_token TEXT UNIQUE,
    shared_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create activities table
CREATE TABLE public.activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    duration TEXT NOT NULL,
    effort_level TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create basic indexes
CREATE INDEX idx_parties_user_id ON public.parties(user_id);
CREATE INDEX idx_parties_status ON public.parties(status);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own parties" ON public.parties
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own parties" ON public.parties
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view activities" ON public.activities
    FOR SELECT USING (true);

-- Insert one sample activity
INSERT INTO public.activities (name, description, category, duration, effort_level) VALUES
('Treasure Hunt', 'Exciting adventure to find hidden treasures!', 'Games', '30 minutes', 'Medium');

-- Verify tables were created
SELECT 'Tables created successfully!' as status;
