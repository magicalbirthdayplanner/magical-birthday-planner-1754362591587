import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role for admin operations

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        message: 'Missing environment variables',
        error: `URL: ${supabaseUrl ? 'Present' : 'Missing'}, Service Key: ${supabaseKey ? 'Present' : 'Missing'}`
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: { operation: string; status: string; error?: string }[] = [];

    // 1. Add missing columns to activities table
    try {
      console.log('Adding missing columns to activities table...');
      
      // Add duration_minutes column
      const { error: durationError } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30;`
      });
      if (durationError) results.push({ operation: 'Add duration_minutes', status: 'Failed', error: durationError.message });
      else results.push({ operation: 'Add duration_minutes', status: 'Success' });

      // Add venue_type column
      const { error: venueError } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS venue_type TEXT[] DEFAULT ARRAY['INDOOR'];`
      });
      if (venueError) results.push({ operation: 'Add venue_type', status: 'Failed', error: venueError.message });
      else results.push({ operation: 'Add venue_type', status: 'Success' });

      // Add supplies_needed column
      const { error: suppliesError } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS supplies_needed TEXT[] DEFAULT ARRAY['Basic supplies'];`
      });
      if (suppliesError) results.push({ operation: 'Add supplies_needed', status: 'Failed', error: suppliesError.message });
      else results.push({ operation: 'Add supplies_needed', status: 'Success' });

      // Add participant_range column
      const { error: participantError } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS participant_range TEXT DEFAULT '2-10';`
      });
      if (participantError) results.push({ operation: 'Add participant_range', status: 'Failed', error: participantError.message });
      else results.push({ operation: 'Add participant_range', status: 'Success' });

      // Add min_participants column
      const { error: minError } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS min_participants INTEGER DEFAULT 2;`
      });
      if (minError) results.push({ operation: 'Add min_participants', status: 'Failed', error: minError.message });
      else results.push({ operation: 'Add min_participants', status: 'Success' });

      // Add max_participants column
      const { error: maxError } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS max_participants INTEGER DEFAULT 10;`
      });
      if (maxError) results.push({ operation: 'Add max_participants', status: 'Failed', error: maxError.message });
      else results.push({ operation: 'Add max_participants', status: 'Success' });

      // Add age_group column
      const { error: ageError } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS age_group TEXT[] DEFAULT ARRAY['5-12'];`
      });
      if (ageError) results.push({ operation: 'Add age_group', status: 'Failed', error: ageError.message });
      else results.push({ operation: 'Add age_group', status: 'Success' });

      // Add theme_compatibility column
      const { error: themeError } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS theme_compatibility TEXT[] DEFAULT ARRAY['General'];`
      });
      if (themeError) results.push({ operation: 'Add theme_compatibility', status: 'Failed', error: themeError.message });
      else results.push({ operation: 'Add theme_compatibility', status: 'Success' });

      // Add tags column
      const { error: tagsError } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[];`
      });
      if (tagsError) results.push({ operation: 'Add tags', status: 'Failed', error: tagsError.message });
      else results.push({ operation: 'Add tags', status: 'Success' });

    } catch (error) {
      results.push({ operation: 'Add columns to activities', status: 'Failed', error: error instanceof Error ? error.message : 'Unknown error' });
    }

    // 2. Create missing tables
    try {
      console.log('Creating missing tables...');
      
      // Create guests table
      const { error: guestsError } = await supabase.rpc('exec_sql', {
        sql: `
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
            dietary_restrictions TEXT[],
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      });
      if (guestsError) results.push({ operation: 'Create guests table', status: 'Failed', error: guestsError.message });
      else results.push({ operation: 'Create guests table', status: 'Success' });

      // Create party_activities table
      const { error: partyActivitiesError } = await supabase.rpc('exec_sql', {
        sql: `
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
        `
      });
      if (partyActivitiesError) results.push({ operation: 'Create party_activities table', status: 'Failed', error: partyActivitiesError.message });
      else results.push({ operation: 'Create party_activities table', status: 'Success' });

      // Create activity_favorites table
      const { error: favoritesError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS public.activity_favorites (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
            activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(user_id, activity_id)
          );
        `
      });
      if (favoritesError) results.push({ operation: 'Create activity_favorites table', status: 'Failed', error: favoritesError.message });
      else results.push({ operation: 'Create activity_favorites table', status: 'Success' });

    } catch (error) {
      results.push({ operation: 'Create missing tables', status: 'Failed', error: error instanceof Error ? error.message : 'Unknown error' });
    }

    // 3. Update existing activity with proper data
    try {
      console.log('Updating existing activity with proper data...');
      
      const { error: updateError } = await supabase
        .from('activities')
        .update({
          duration_minutes: 30,
          venue_type: ['INDOOR', 'OUTDOOR'],
          supplies_needed: ['Treasure chest', 'Small toys', 'Clue cards', 'Map'],
          participant_range: '4-8',
          min_participants: 4,
          max_participants: 8,
          age_group: ['5-10'],
          theme_compatibility: ['Adventure', 'Pirate', 'Explorer'],
          tags: ['treasure', 'adventure', 'search', 'teamwork']
        })
        .eq('id', '35d96825-8fb5-43cc-99a3-a408134ff479');

      if (updateError) results.push({ operation: 'Update existing activity', status: 'Failed', error: updateError.message });
      else results.push({ operation: 'Update existing activity', status: 'Success' });

    } catch (error) {
      results.push({ operation: 'Update existing activity', status: 'Failed', error: error instanceof Error ? error.message : 'Unknown error' });
    }

    return NextResponse.json({
      success: true,
      message: 'Database setup completed',
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Database setup error:', error);
    return NextResponse.json({
      success: false,
      message: 'Database setup failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'Supabase not configured' 
      }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if tables exist by trying to query them directly
    let existingTables: string[] = []
    const tablesToCheck = ['users', 'parties', 'guests', 'invitations']
    
    for (const tableName of tablesToCheck) {
      try {
        const { error } = await supabase
          .from(tableName)
          .select('id')
          .limit(1)
        
        if (!error) {
          existingTables.push(tableName)
        }
      } catch (e) {
        // Table doesn't exist or permission issue
        console.log(`Table ${tableName} check failed in GET:`, e)
      }
    }
    const requiredTables = ['users', 'parties', 'guests', 'invitations']
    const missingTables = requiredTables.filter(table => !existingTables.includes(table))

    return NextResponse.json({ 
      success: true,
      tablesExist: missingTables.length === 0,
      existingTables,
      missingTables,
      message: missingTables.length === 0 
        ? 'All required tables exist' 
        : `Missing tables: ${missingTables.join(', ')}`
    })

  } catch (error) {
    console.error('Error checking database status:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Database status check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}