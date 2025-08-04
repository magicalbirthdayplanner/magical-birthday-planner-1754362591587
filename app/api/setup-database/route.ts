import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null

export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ 
        success: false, 
        error: 'Supabase not configured - check environment variables' 
      }, { status: 500 })
    }

    // Check if tables already exist first
    const { data: existingTables, error: checkError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')

    if (checkError) {
      console.error('Error checking existing tables:', checkError)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to check existing tables',
        details: checkError 
      }, { status: 500 })
    }

    const tableNames = existingTables?.map(t => t.table_name) || []
    const requiredTables = ['users', 'parties', 'guests', 'invitations']
    const missingTables = requiredTables.filter(table => !tableNames.includes(table))

    if (missingTables.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'All required tables already exist',
        existingTables: tableNames.filter(name => requiredTables.includes(name))
      })
    }

    // For now, since we can't directly execute SQL via Supabase client,
    // we'll return instructions for the user to manually create tables
    const instructions = `
Database tables are missing. Please go to your Supabase dashboard:

1. Go to https://supabase.com/dashboard/project/${supabaseUrl?.split('//')[1]?.split('.')[0]}/editor
2. Create the following tables using the SQL Editor:

-- First create the enums
CREATE TYPE "GuestType" AS ENUM ('ADULT', 'CHILD');
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'SENT', 'ACCEPTED', 'DECLINED', 'MAYBE');

-- Create tables with proper structure
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE parties (
  id TEXT PRIMARY KEY,
  child_name TEXT NOT NULL,
  child_age INTEGER NOT NULL,
  child_gender TEXT,
  party_date TIMESTAMP WITH TIME ZONE NOT NULL,
  theme TEXT NOT NULL,
  interests TEXT[] DEFAULT '{}',
  favorite_colors TEXT[] DEFAULT '{}',
  guest_count INTEGER,
  budget DECIMAL,
  location TEXT,
  checklist_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE guests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  type "GuestType" DEFAULT 'ADULT',
  age INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  party_id TEXT REFERENCES parties(id) ON DELETE CASCADE
);

CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  status "InvitationStatus" DEFAULT 'PENDING',
  sent_at TIMESTAMP WITH TIME ZONE,
  responded_at TIMESTAMP WITH TIME ZONE,
  message TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  party_id TEXT REFERENCES parties(id) ON DELETE CASCADE,
  guest_id TEXT REFERENCES guests(id) ON DELETE CASCADE,
  UNIQUE(party_id, guest_id)
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic versions)
CREATE POLICY "Users can manage own data" ON users FOR ALL USING (auth.uid()::text = id);
CREATE POLICY "Users can manage own parties" ON parties FOR ALL USING (auth.uid()::text = user_id);
CREATE POLICY "Users can manage guests for own parties" ON guests FOR ALL USING (EXISTS (SELECT 1 FROM parties WHERE parties.id = guests.party_id AND parties.user_id = auth.uid()::text));
CREATE POLICY "Users can manage invitations for own parties" ON invitations FOR ALL USING (EXISTS (SELECT 1 FROM parties WHERE parties.id = invitations.party_id AND parties.user_id = auth.uid()::text));

3. After creating the tables, test this API endpoint again.
    `

    return NextResponse.json({ 
      success: false, 
      message: 'Database tables need to be created manually',
      instructions,
      missingTables 
    })

  } catch (error) {
    console.error('Error setting up database:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Database setup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ 
        success: false, 
        error: 'Supabase not configured' 
      }, { status: 500 })
    }

    // Check if tables exist by querying table information
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['users', 'parties', 'guests', 'invitations'])

    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to check table existence',
        details: error 
      }, { status: 500 })
    }

    const existingTables = tables?.map(t => t.table_name) || []
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