# Test Users Setup Guide

This guide explains how to set up dummy users with different subscription plans for testing the Magical Birthday Planner application.

## Prerequisites

1. Ensure your Supabase project is set up and running
2. Make sure the environment variables are configured in your `.env` file:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Test Users

Four test users will be created with the following credentials:

| User Type | Email           | Password | Plan        |
|-----------|-----------------|----------|-------------|
| Free      | free@test.com   | 12345678 | FREE        |
| Starter   | starter@test.com| 12345678 | STARTER     |
| Plus      | plus@test.com   | 12345678 | PLUS        |
| Pro       | pro@test.com    | 12345678 | PRO         |

## Setup Steps

### 1. Update Database Constraints (if needed)

If your database was created with the old plan values, run:

```bash
node database/update-plan-constraints.js
```

### 2. Fix Existing User Plans (if needed)

If you have existing users with 'PROFESSIONAL' plan values, run:

```bash
node database/fix-user-plans.js
```

### 3. Create Test Users

Run the test user creation script:

```bash
node database/create-test-users.js
```

This script will:
- Create four users with the credentials listed above
- Assign each user to a different subscription plan
- Set up their profiles in the database

## Testing Features

After running the scripts, you can log in with each user to test different subscription features:

1. **Free User** (`free@test.com`): Limited access to basic features
2. **Starter User** (`starter@test.com`): Access to starter plan features
3. **Plus User** (`plus@test.com`): Access to plus plan features
4. **Pro User** (`pro@test.com`): Full access to all features

## Troubleshooting

### User Already Exists

If you run the script multiple times, it will update existing users rather than creating duplicates.

### Database Connection Errors

Ensure your `.env` file contains the correct Supabase credentials:
- Check that `NEXT_PUBLIC_SUPABASE_URL` points to your Supabase project
- Verify that `SUPABASE_SERVICE_ROLE_KEY` is the service role key (not the anon key)

### Plan Constraint Errors

If you see errors about plan constraints, run the update-plan-constraints.js script first.