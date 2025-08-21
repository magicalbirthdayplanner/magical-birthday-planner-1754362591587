# 🚀 Supabase Integration Setup Guide

This guide will help you set up Supabase integration for the Magical Birthday Planner application.

## 📋 Prerequisites

- [Supabase Account](https://supabase.com) (free tier available)
- Node.js 18+ installed
- Access to your project's environment variables

## 🏗️ Step 1: Create Supabase Project

1. **Go to [Supabase Dashboard](https://supabase.com/dashboard)**
2. **Click "New Project"**
3. **Choose your organization**
4. **Fill in project details:**
   - Name: `magical-birthday-planner`
   - Database Password: Generate a strong password
   - Region: Choose closest to your users
5. **Click "Create new project"**
6. **Wait for project setup to complete (2-3 minutes)**

## 🔑 Step 2: Get API Keys

1. **Go to Project Settings → API**
2. **Copy the following values:**
   - **Project URL**: `https://[project-id].supabase.co`
   - **anon public**: This is your public API key
   - **service_role**: This is your admin API key (keep secret!)

## 🗄️ Step 3: Database Setup

### Option A: Using Prisma (Recommended)

1. **Update your `.env` file with Supabase credentials:**

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]

# Database URLs
DATABASE_URL=postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

2. **Push the database schema:**

```bash
npx prisma db push
```

3. **Generate Prisma client:**

```bash
npx prisma generate
```

### Option B: Manual SQL Setup

1. **Go to SQL Editor in Supabase Dashboard**
2. **Run the following SQL to create tables:**

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  display_name TEXT,
  current_plan TEXT DEFAULT 'FREE',
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMP WITH TIME ZONE,
  password_reset_requested BOOLEAN DEFAULT FALSE,
  password_reset_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  theme TEXT DEFAULT 'light',
  email_notifications BOOLEAN DEFAULT TRUE,
  party_reminders BOOLEAN DEFAULT TRUE,
  marketing_emails BOOLEAN DEFAULT FALSE
);

-- Create parties table
CREATE TABLE parties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_name TEXT NOT NULL,
  child_age INTEGER NOT NULL,
  child_gender TEXT,
  party_date TIMESTAMP WITH TIME ZONE NOT NULL,
  party_time TEXT,
  party_location TEXT,
  theme TEXT NOT NULL,
  interests TEXT[] DEFAULT '{}',
  favorite_colors TEXT[] DEFAULT '{}',
  guest_count INTEGER,
  max_guests INTEGER,
  budget DECIMAL(10,2),
  checklist_data JSONB,
  package_type TEXT DEFAULT 'LITE_PARTY',
  status TEXT DEFAULT 'PLANNING',
  rsvp_deadline TIMESTAMP WITH TIME ZONE,
  host_name TEXT,
  host_email TEXT,
  host_phone TEXT,
  custom_instructions TEXT,
  share_token TEXT UNIQUE,
  is_shared BOOLEAN DEFAULT FALSE,
  shared_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_purchase_id UUID,
  adult_count INTEGER,
  kid_count INTEGER
);

-- Create activities table
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  full_description TEXT,
  supplies_needed TEXT[] DEFAULT '{}',
  setup_time INTEGER DEFAULT 0,
  helpers_required INTEGER DEFAULT 0,
  step_by_step_instructions TEXT NOT NULL,
  host_script TEXT NOT NULL,
  age_group TEXT[] DEFAULT '{}',
  venue_type TEXT[] DEFAULT '{}',
  duration TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  theme_compatibility TEXT[] DEFAULT '{}',
  effort_level TEXT NOT NULL,
  participant_range TEXT NOT NULL,
  min_participants INTEGER NOT NULL,
  max_participants INTEGER NOT NULL,
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create activity_favorites table
CREATE TABLE activity_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, activity_id)
);

-- Create selected_activities table
CREATE TABLE selected_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  party_id UUID REFERENCES parties(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  is_selected BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, party_id, activity_id)
);

-- Create indexes for better performance
CREATE INDEX idx_parties_user_id ON parties(user_id);
CREATE INDEX idx_activities_category ON activities(category);
CREATE INDEX idx_activities_duration ON activities(duration);
CREATE INDEX idx_activity_favorites_user_id ON activity_favorites(user_id);
CREATE INDEX idx_selected_activities_party_id ON selected_activities(party_id);
```

## 🌱 Step 4: Seed Activities Data

1. **Install dependencies if not already done:**

```bash
npm install
```

2. **Run the seeding script:**

```bash
node scripts/seed-activities-to-supabase.js
```

**Note:** Make sure your `.env` file has the `SUPABASE_SERVICE_ROLE_KEY` set for this to work.

## 🔐 Step 5: Authentication Setup

1. **Go to Authentication → Settings in Supabase Dashboard**
2. **Configure the following:**

### Site URL
```
http://localhost:3000 (for development)
https://yourdomain.com (for production)
```

### Redirect URLs
```
http://localhost:3000/auth/callback
https://yourdomain.com/auth/callback
```

### Email Templates
- Customize welcome, verification, and password reset emails
- Set your brand colors and logo

## 🚀 Step 6: Test the Integration

1. **Start your development server:**

```bash
npm run dev
```

2. **Check the database connection:**

Visit `/env-check` in your browser to see the configuration status.

3. **Test activities loading:**

Visit `/activities` to see if activities are loaded from Supabase.

## 📊 Step 7: Monitor and Optimize

1. **Go to Supabase Dashboard → Analytics**
2. **Monitor:**
   - Database performance
   - API usage
   - Authentication events
   - Storage usage

## 🔧 Troubleshooting

### Common Issues

1. **"Invalid API key" error:**
   - Check that your API keys are copied correctly
   - Ensure no extra spaces or characters

2. **"Database connection failed":**
   - Verify your DATABASE_URL format
   - Check if your IP is allowed (if using IP restrictions)

3. **"Table doesn't exist":**
   - Run `npx prisma db push` to create tables
   - Or run the manual SQL setup

4. **"Permission denied":**
   - Check Row Level Security (RLS) policies
   - Ensure you're using the correct API key

### RLS Policies

If you encounter permission issues, you may need to set up Row Level Security policies:

```sql
-- Example: Allow users to see only their own data
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own parties" ON parties
  FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE activity_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own favorites" ON activity_favorites
  FOR ALL USING (auth.uid() = user_id);
```

## 📚 Next Steps

1. **Set up email templates** for better user experience
2. **Configure webhooks** for real-time updates
3. **Set up monitoring** and alerting
4. **Optimize database queries** based on usage patterns

## 🆘 Need Help?

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord Community](https://discord.supabase.com)
- [GitHub Issues](https://github.com/your-repo/issues)

---

**🎉 Congratulations!** Your Magical Birthday Planner is now connected to Supabase and ready for production use!
