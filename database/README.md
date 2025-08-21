# Database Setup and Management

This folder contains all database-related files for the Magical Birthday Planner application.

## Quick Setup

For a fresh database setup, use:
```bash
node database/simple-db-setup.js
```

## File Descriptions

### Setup Scripts
- **`simple-db-setup.js`** - Main database setup script (recommended)
- **`direct-db-setup.js`** - Alternative setup script with better error handling
- **`setup-database.js`** - Legacy setup script

### SQL Files
- **`database-simple.sql`** - Simple database schema (recommended)
- **`database-setup.sql`** - Comprehensive database schema
- **`database-setup-fixed.sql`** - Fixed version of comprehensive schema

### Seeding Scripts
- **`seed-activities.ts`** - TypeScript activity seeding
- **`seed-activities-to-supabase.js`** - JavaScript Supabase seeding
- **`seed-156-activities.js`** - Large activity dataset
- **`seed-birthday-activities.js`** - Birthday-specific activities

### Testing and Debug
- **`test-database.js`** - Database connection test
- **`test-activities-debug.js`** - Activity debugging script

## Usage

1. **Fresh Setup**: Run `node database/simple-db-setup.js`
2. **Manual SQL**: Copy `database-simple.sql` to Supabase SQL Editor
3. **Test Connection**: Run `node database/test-database.js`

## Notes

- Use `database-simple.sql` for production
- Keep backup scripts for development/testing
- All scripts require proper `.env` configuration
