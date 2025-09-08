-- =====================================================
-- VENUES DATABASE SCHEMA FOR GOOGLE PLACES API CACHING
-- =====================================================
-- Run this script in your Supabase SQL Editor to create venue tables

-- Create venues table for caching Google Places data
CREATE TABLE IF NOT EXISTS public.venues (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    place_id TEXT UNIQUE NOT NULL, -- Google Places ID
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    formatted_address TEXT,
    phone TEXT,
    website TEXT,
    rating DECIMAL(2,1),
    reviews_count INTEGER DEFAULT 0,
    price_level INTEGER, -- 0-4 from Google Places
    category TEXT NOT NULL, -- indoor, outdoor, specialty, community
    types TEXT[] DEFAULT ARRAY[]::TEXT[], -- Google Places types
    business_status TEXT, -- OPERATIONAL, CLOSED_TEMPORARILY, etc.
    
    -- Location data
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    zip_code TEXT,
    city TEXT,
    state TEXT,
    country TEXT DEFAULT 'US',
    
    -- Additional venue details
    description TEXT,
    photos TEXT[] DEFAULT ARRAY[]::TEXT[], -- Photo references from Google Places
    opening_hours JSONB, -- Store opening hours as JSON
    accessibility_info TEXT,
    parking_info TEXT,
    
    -- Party-specific information
    party_packages_available BOOLEAN DEFAULT FALSE,
    max_capacity INTEGER,
    age_restrictions TEXT,
    amenities TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Caching and validation
    last_validated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_freshness_days INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create venue searches table for caching search results
CREATE TABLE IF NOT EXISTS public.venue_searches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    zip_code TEXT NOT NULL,
    category TEXT NOT NULL,
    radius_miles INTEGER DEFAULT 20,
    search_query TEXT, -- Optional search term
    min_rating DECIMAL(2,1) DEFAULT 0,
    
    -- Results metadata
    total_results INTEGER DEFAULT 0,
    search_completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(zip_code, category, radius_miles, search_query, min_rating)
);

-- Create venue search results junction table
CREATE TABLE IF NOT EXISTS public.venue_search_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    search_id UUID REFERENCES public.venue_searches(id) ON DELETE CASCADE NOT NULL,
    venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE NOT NULL,
    distance_miles DECIMAL(5,2),
    search_rank INTEGER, -- Order in search results
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(search_id, venue_id)
);

-- Create selected venues table to track party venue selections
CREATE TABLE IF NOT EXISTS public.party_venues (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    party_id UUID REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
    venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Custom venue details (for home venues or custom entries)
    custom_name TEXT,
    custom_address TEXT,
    custom_notes TEXT,
    
    -- Selection details
    selected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_custom BOOLEAN DEFAULT FALSE, -- TRUE for home/custom venues
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(party_id) -- Each party can only have one venue
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_venues_place_id ON public.venues(place_id);
CREATE INDEX IF NOT EXISTS idx_venues_category ON public.venues(category);
CREATE INDEX IF NOT EXISTS idx_venues_zip_code ON public.venues(zip_code);
CREATE INDEX IF NOT EXISTS idx_venues_rating ON public.venues(rating);
CREATE INDEX IF NOT EXISTS idx_venues_location ON public.venues(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_venues_last_validated ON public.venues(last_validated_at);

CREATE INDEX IF NOT EXISTS idx_venue_searches_zip_category ON public.venue_searches(zip_code, category);
CREATE INDEX IF NOT EXISTS idx_venue_searches_expires ON public.venue_searches(expires_at);

CREATE INDEX IF NOT EXISTS idx_venue_search_results_search ON public.venue_search_results(search_id);
CREATE INDEX IF NOT EXISTS idx_venue_search_results_venue ON public.venue_search_results(venue_id);

CREATE INDEX IF NOT EXISTS idx_party_venues_party ON public.party_venues(party_id);
CREATE INDEX IF NOT EXISTS idx_party_venues_venue ON public.party_venues(venue_id);

-- Enable Row Level Security
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_search_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_venues ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for venues (public read access for venue data)
CREATE POLICY "Venues are viewable by everyone" ON public.venues FOR SELECT USING (true);
CREATE POLICY "Only system can insert venues" ON public.venues FOR INSERT WITH CHECK (false); -- Will be handled by service role

-- Create RLS policies for venue searches (public read access)
CREATE POLICY "Venue searches are viewable by everyone" ON public.venue_searches FOR SELECT USING (true);
CREATE POLICY "Anyone can create venue searches" ON public.venue_searches FOR INSERT WITH CHECK (true);

-- Create RLS policies for venue search results (public read access)
CREATE POLICY "Venue search results are viewable by everyone" ON public.venue_search_results FOR SELECT USING (true);
CREATE POLICY "Anyone can create venue search results" ON public.venue_search_results FOR INSERT WITH CHECK (true);

-- Create RLS policies for party venues (user can only access their own)
CREATE POLICY "Users can view their own party venues" ON public.party_venues FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own party venues" ON public.party_venues FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own party venues" ON public.party_venues FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own party venues" ON public.party_venues FOR DELETE USING (auth.uid() = user_id);

-- Create update trigger for venues
CREATE OR REPLACE FUNCTION update_venues_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language plpgsql;

CREATE TRIGGER venues_updated_at
    BEFORE UPDATE ON public.venues
    FOR EACH ROW
    EXECUTE FUNCTION update_venues_updated_at();

-- Create update trigger for party venues
CREATE TRIGGER party_venues_updated_at
    BEFORE UPDATE ON public.party_venues
    FOR EACH ROW
    EXECUTE FUNCTION update_venues_updated_at();

-- Create function to clean expired venue searches
CREATE OR REPLACE FUNCTION cleanup_expired_venue_searches()
RETURNS void AS $$
BEGIN
    DELETE FROM public.venue_searches WHERE expires_at < NOW();
END;
$$ language plpgsql;

-- Create function to refresh stale venue data
CREATE OR REPLACE FUNCTION mark_stale_venues()
RETURNS void AS $$
BEGIN
    UPDATE public.venues 
    SET is_active = false 
    WHERE last_validated_at < (NOW() - INTERVAL '30 days');
END;
$$ language plpgsql;

COMMENT ON TABLE public.venues IS 'Cached venue data from Google Places API';
COMMENT ON TABLE public.venue_searches IS 'Cached search queries and metadata';
COMMENT ON TABLE public.venue_search_results IS 'Junction table linking searches to venue results';
COMMENT ON TABLE public.party_venues IS 'Selected venues for specific parties';