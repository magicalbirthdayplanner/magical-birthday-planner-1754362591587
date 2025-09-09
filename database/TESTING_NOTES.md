# Test Users for Magical Birthday Planner

## Created Test Users

The following test users have been created for testing different subscription plan features:

| User Type | Email | Password | Plan | Notes |
|-----------|-------|----------|------|-------|
| Free User | `freeuser.test.1757381672912@gmail.com` | `12345678` | FREE | Basic features only |
| Starter User | `starteruser.test.1757381672912@gmail.com` | `12345678` | STARTER | Enhanced planning features |
| Plus User | `plususer.test.1757381672912@gmail.com` | `12345678` | STARTER* | *Using STARTER plan due to database constraint |
| Pro User | `prouser.test.1757381672912@gmail.com` | `12345678` | PROFESSIONAL | Full feature access |

## Database Constraint Update

To properly support all subscription plans, you need to update the database constraints.

### Step 1: Update Database Constraints

Run the following SQL in your Supabase dashboard:

```sql
-- Drop the existing constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_current_plan_check;

-- Add the new constraint with all plan types
ALTER TABLE public.users ADD CONSTRAINT users_current_plan_check 
CHECK (current_plan IN ('FREE', 'STARTER', 'PLUS', 'PRO', 'PROFESSIONAL'));
```

### Step 2: Update User Plans

After updating the constraints, run the following script to update user plans to their intended subscription levels:

```bash
node database/fix-user-plans.js
```

Or run these SQL commands directly:

```sql
-- Update the Plus user to use PLUS plan
UPDATE public.users 
SET current_plan = 'PLUS' 
WHERE email = 'plususer.test.1757381672912@gmail.com';

-- Update the Pro user to use PRO plan (instead of PROFESSIONAL)
UPDATE public.users 
SET current_plan = 'PRO' 
WHERE email = 'prouser.test.1757381672912@gmail.com';
```

## Testing Features

With these test users, you can now test:

1. **Free Plan Features**: Limited access to party planning tools
2. **Starter Plan Features**: Enhanced planning with basic AI suggestions
3. **Plus Plan Features**: Advanced planning with host mode and coordination
4. **Pro Plan Features**: Complete suite with vendor recommendations

## Next Steps

1. Run the SQL commands in Step 1 above in your Supabase dashboard to fix the constraints
2. Run the script in Step 2 or the SQL commands to update user plans
3. Test the subscription management features with each user account