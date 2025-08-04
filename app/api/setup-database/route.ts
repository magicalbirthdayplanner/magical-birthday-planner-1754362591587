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

    // Provide comprehensive SQL instructions for fresh database setup
    const instructions = `
🎉 MAGICAL BIRTHDAY PLANNER - FRESH DATABASE SETUP

As requested, please FIRST DELETE any existing tables if they exist, then create fresh ones.

1. Go to your Supabase dashboard SQL Editor: 
   https://supabase.com/dashboard/project/${supabaseUrl?.split('//')[1]?.split('.')[0]}/editor

2. FIRST - Drop existing tables and types if they exist (run this first):

-- Drop existing tables in correct order (foreign keys first)
DROP TABLE IF EXISTS invitations CASCADE;
DROP TABLE IF EXISTS guests CASCADE; 
DROP TABLE IF EXISTS parties CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop existing types
DROP TYPE IF EXISTS "InvitationStatus" CASCADE;
DROP TYPE IF EXISTS "GuestType" CASCADE;

3. NOW - Create fresh database schema:

-- Step 1: Create enums
CREATE TYPE "GuestType" AS ENUM ('ADULT', 'CHILD');
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'SENT', 'ACCEPTED', 'DECLINED', 'MAYBE');

-- Step 2: Create users table  
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- Step 3: Create parties table
CREATE TABLE "parties" (
    "id" TEXT NOT NULL,
    "childName" TEXT NOT NULL,
    "childAge" INTEGER NOT NULL,
    "childGender" TEXT,
    "partyDate" TIMESTAMP(3) NOT NULL,
    "theme" TEXT NOT NULL,
    "interests" TEXT[],
    "favoriteColors" TEXT[],
    "guestCount" INTEGER,
    "budget" DOUBLE PRECISION,
    "location" TEXT,
    "checklistData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- Step 4: Create guests table
CREATE TABLE "guests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "type" "GuestType" NOT NULL DEFAULT 'ADULT',
    "age" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partyId" TEXT NOT NULL,
    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- Step 5: Create invitations table
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "message" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partyId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- Step 6: Create indexes
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "invitations_partyId_guestId_key" ON "invitations"("partyId", "guestId");

-- Step 7: Add foreign key constraints
ALTER TABLE "parties" ADD CONSTRAINT "parties_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "guests" ADD CONSTRAINT "guests_partyId_fkey" 
    FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invitations" ADD CONSTRAINT "invitations_partyId_fkey" 
    FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invitations" ADD CONSTRAINT "invitations_guestId_fkey" 
    FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 8: Enable Row Level Security
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parties" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "guests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;

-- Step 9: Create RLS policies for users
CREATE POLICY "Users can view own profile" ON "users"
    FOR SELECT USING (auth.uid()::text = id);
CREATE POLICY "Users can update own profile" ON "users"
    FOR UPDATE USING (auth.uid()::text = id);
CREATE POLICY "Users can insert own profile" ON "users"
    FOR INSERT WITH CHECK (auth.uid()::text = id);

-- Step 10: Create RLS policies for parties
CREATE POLICY "Users can view own parties" ON "parties"
    FOR SELECT USING (auth.uid()::text = "userId");
CREATE POLICY "Users can create own parties" ON "parties"
    FOR INSERT WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Users can update own parties" ON "parties"
    FOR UPDATE USING (auth.uid()::text = "userId");
CREATE POLICY "Users can delete own parties" ON "parties"
    FOR DELETE USING (auth.uid()::text = "userId");

-- Step 11: Create RLS policies for guests
CREATE POLICY "Users can view guests of own parties" ON "guests"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "parties" 
            WHERE "parties"."id" = "guests"."partyId" 
            AND "parties"."userId" = auth.uid()::text
        )
    );
CREATE POLICY "Users can create guests for own parties" ON "guests"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM "parties" 
            WHERE "parties"."id" = "guests"."partyId" 
            AND "parties"."userId" = auth.uid()::text
        )
    );
CREATE POLICY "Users can update guests of own parties" ON "guests"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM "parties" 
            WHERE "parties"."id" = "guests"."partyId" 
            AND "parties"."userId" = auth.uid()::text
        )
    );
CREATE POLICY "Users can delete guests of own parties" ON "guests"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM "parties" 
            WHERE "parties"."id" = "guests"."partyId" 
            AND "parties"."userId" = auth.uid()::text
        )
    );

-- Step 12: Create RLS policies for invitations
CREATE POLICY "Users can view invitations for own parties" ON "invitations"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "parties" 
            WHERE "parties"."id" = "invitations"."partyId" 
            AND "parties"."userId" = auth.uid()::text
        )
    );
CREATE POLICY "Users can create invitations for own parties" ON "invitations"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM "parties" 
            WHERE "parties"."id" = "invitations"."partyId" 
            AND "parties"."userId" = auth.uid()::text
        )
    );
CREATE POLICY "Users can update invitations for own parties" ON "invitations"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM "parties" 
            WHERE "parties"."id" = "invitations"."partyId" 
            AND "parties"."userId" = auth.uid()::text
        )
    );
CREATE POLICY "Users can delete invitations for own parties" ON "invitations"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM "parties" 
            WHERE "parties"."id" = "invitations"."partyId" 
            AND "parties"."userId" = auth.uid()::text
        )
    );

-- Step 13: Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON "users"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_parties_updated_at BEFORE UPDATE ON "parties"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guests_updated_at BEFORE UPDATE ON "guests"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invitations_updated_at BEFORE UPDATE ON "invitations"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

🎊 DATABASE SETUP COMPLETE! Your fresh database is ready for the birthday planner app.

4. After running all SQL commands, visit your dashboard to confirm the tables exist.
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