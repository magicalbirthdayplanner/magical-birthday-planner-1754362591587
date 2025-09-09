-- =====================================================
-- MANUAL VENUE DATABASE SETUP
-- =====================================================
-- Copy and paste these commands into your Supabase SQL Editor
-- Run them one by one to set up the venue system

-- 1. Create venues table
CREATE TABLE IF NOT EXISTS public.venues (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    place_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    formatted_address TEXT,
    phone TEXT,
    website TEXT,
    rating DECIMAL(2,1),
    reviews_count INTEGER DEFAULT 0,
    price_level INTEGER,
    category TEXT NOT NULL,
    types TEXT[] DEFAULT ARRAY[]::TEXT[],
    business_status TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    zip_code TEXT,
    city TEXT,
    state TEXT,
    country TEXT DEFAULT 'US',
    description TEXT,
    photos TEXT[] DEFAULT ARRAY[]::TEXT[],
    opening_hours JSONB,
    accessibility_info TEXT,
    parking_info TEXT,
    party_packages_available BOOLEAN DEFAULT FALSE,
    max_capacity INTEGER,
    age_restrictions TEXT,
    amenities TEXT[] DEFAULT ARRAY[]::TEXT[],
    last_validated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_freshness_days INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create party_venues table for tracking venue selections
CREATE TABLE IF NOT EXISTS public.party_venues (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    party_id UUID REFERENCES public.parties(id) ON DELETE CASCADE NOT NULL,
    venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    custom_name TEXT,
    custom_address TEXT,
    custom_notes TEXT,
    selected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_custom BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(party_id)
);

-- 3. Create venue_searches table for caching search queries
CREATE TABLE IF NOT EXISTS public.venue_searches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    zip_code TEXT NOT NULL,
    category TEXT NOT NULL,
    radius_miles INTEGER DEFAULT 20,
    search_query TEXT,
    min_rating DECIMAL(2,1) DEFAULT 0,
    total_results INTEGER DEFAULT 0,
    search_completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(zip_code, category, radius_miles, search_query, min_rating)
);

-- 4. Create venue_search_results table for caching individual results
CREATE TABLE IF NOT EXISTS public.venue_search_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    search_id UUID REFERENCES public.venue_searches(id) ON DELETE CASCADE NOT NULL,
    venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE NOT NULL,
    distance_miles DECIMAL(5,2),
    search_rank INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(search_id, venue_id)
);

-- 5. Create indexes for performance
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

-- 6. Enable Row Level Security
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_search_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_venues ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies for venues (public read access)
CREATE POLICY "Venues are viewable by everyone" ON public.venues FOR SELECT USING (true);

-- 8. Create RLS policies for venue searches (public access)
CREATE POLICY "Venue searches are viewable by everyone" ON public.venue_searches FOR SELECT USING (true);
CREATE POLICY "Anyone can create venue searches" ON public.venue_searches FOR INSERT WITH CHECK (true);

-- 9. Create RLS policies for venue search results (public access)
CREATE POLICY "Venue search results are viewable by everyone" ON public.venue_search_results FOR SELECT USING (true);
CREATE POLICY "Anyone can create venue search results" ON public.venue_search_results FOR INSERT WITH CHECK (true);

-- 10. Create RLS policies for party venues (user-specific access)
CREATE POLICY "Users can view their own party venues" ON public.party_venues FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own party venues" ON public.party_venues FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own party venues" ON public.party_venues FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own party venues" ON public.party_venues FOR DELETE USING (auth.uid() = user_id);

-- 11. Create update trigger function
CREATE OR REPLACE FUNCTION update_venues_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language plpgsql;

-- 12. Create triggers for updated_at columns
CREATE TRIGGER venues_updated_at
    BEFORE UPDATE ON public.venues
    FOR EACH ROW
    EXECUTE FUNCTION update_venues_updated_at();

CREATE TRIGGER party_venues_updated_at
    BEFORE UPDATE ON public.party_venues
    FOR EACH ROW
    EXECUTE FUNCTION update_venues_updated_at();

-- 13. Add table comments
COMMENT ON TABLE public.venues IS 'Cached venue data from Google Places API';
COMMENT ON TABLE public.venue_searches IS 'Cached search queries and metadata';
COMMENT ON TABLE public.venue_search_results IS 'Junction table linking searches to venue results';
COMMENT ON TABLE public.party_venues IS 'Selected venues for specific parties';

-- =====================================================
-- SETUP COMPLETE
-- =====================================================
-- After running all these commands, your venue system will be ready!
-- The application will now be able to:
-- 1. Search for venues using Google Places API
-- 2. Cache venue data to avoid repeated API calls
-- 3. Allow users to select venues for their parties
-- 4. Store venue selections in the database
-- =====================================================