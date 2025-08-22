# 🚀 Vercel Deployment Guide - Fix Common Issues

This guide will help you resolve Vercel deployment issues for the Magical Birthday Planner application.

## 🚨 Common Vercel Deployment Issues & Fixes

### 1. **Environment Variables Missing**
**Error:** "Environment variables not set" or "Missing required environment variables"

**Fix:**
1. Go to your Vercel project dashboard
2. Navigate to **Settings → Environment Variables**
3. Add ALL the variables from `vercel-env-template.txt`
4. Make sure to set `NODE_ENV=production` for production

### 2. **Database Connection Timeouts**
**Error:** "Database connection failed" or "Connection timeout"

**Fix:**
- Use the optimized database URLs with shorter timeouts:
  ```
  DATABASE_URL=postgresql://postgres:MagicalBirthdayPlanner@db.nwgqmsuaoflklrgrxfwy.supabase.co:5432/postgres?sslmode=require&connect_timeout=10&pool_timeout=10&statement_timeout=30000
  ```

### 3. **Base URL Configuration Issues**
**Error:** "Invalid redirect URL" or authentication failures

**Fix:**
- Set `NEXT_PUBLIC_BASE_URL` to your actual Vercel domain
- Example: `https://your-project.vercel.app`

### 4. **Serverless Function Limits**
**Error:** "Function execution timeout" or "Memory limit exceeded"

**Fix:**
- Optimized database connection parameters
- Reduced timeout values for serverless environment

## 📋 Required Environment Variables for Vercel

Copy these to your Vercel dashboard:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://nwgqmsuaoflklrgrxfwy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_iIt7SvwainnqP3GnsZxp2w_1StIzQ9R
SUPABASE_SERVICE_ROLE_KEY=sbp_a389e618b0b361314c5422c7959c4737ca19f9d9

# Database URLs (Vercel optimized)
DATABASE_URL=postgresql://postgres:MagicalBirthdayPlanner@db.nwgqmsuaoflklrgrxfwy.supabase.co:5432/postgres?sslmode=require&connect_timeout=10&pool_timeout=10&statement_timeout=30000
DIRECT_URL=postgresql://postgres:MagicalBirthdayPlanner@db.nwgqmsuaoflklrgrxfwy.supabase.co:5432/postgres?sslmode=require&connect_timeout=10&pool_timeout=10&statement_timeout=30000

# Application Configuration
NODE_ENV=production
NEXT_PUBLIC_BASE_URL=https://your-vercel-domain.vercel.app

# Vercel-specific
VERCEL_ENV=production
```

## 🔧 Step-by-Step Fix Process

### Step 1: Update Environment Variables
1. Copy the environment variables above
2. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
3. Add each variable (one per line)
4. Set `NODE_ENV=production` for production deployments

### Step 2: Update Base URL
1. Replace `https://your-vercel-domain.vercel.app` with your actual Vercel domain
2. You can find this in your Vercel project overview

### Step 3: Redeploy
1. Go to Vercel Dashboard → Your Project → Deployments
2. Click "Redeploy" on your latest deployment
3. Wait for the build to complete

### Step 4: Test the Fix
1. Visit your Vercel deployment URL
2. Navigate to `/api/db-test` to test database connection
3. Check the response for any remaining errors

## 🧪 Testing Your Deployment

### Test Database Connection
```bash
curl https://your-vercel-domain.vercel.app/api/db-test
```

### Test Activities API
```bash
curl https://your-vercel-domain.vercel.app/api/activities?limit=3
```

### Expected Responses
- **Database Test**: Should return `{"success": true, "message": "Database connection successful"}`
- **Activities API**: Should return a list of activities with proper data structure

## 🚨 Troubleshooting

### If Still Getting Errors:

1. **Check Vercel Logs**
   - Go to Vercel Dashboard → Your Project → Functions
   - Check the logs for specific error messages

2. **Verify Environment Variables**
   - Ensure all variables are set correctly
   - Check for typos or extra spaces

3. **Test Locally First**
   - Make sure the app works locally with `npm run dev`
   - Verify database connection locally

4. **Check Supabase Dashboard**
   - Ensure your Supabase project is active
   - Verify API keys are correct

## 📞 Support

If you're still experiencing issues:

1. **Check Vercel Status**: https://vercel-status.com
2. **Review Vercel Documentation**: https://vercel.com/docs
3. **Check Supabase Status**: https://status.supabase.com

## ✅ Success Checklist

- [ ] All environment variables added to Vercel
- [ ] `NODE_ENV` set to `production`
- [ ] `NEXT_PUBLIC_BASE_URL` set to your Vercel domain
- [ ] Database connection working (`/api/db-test` returns success)
- [ ] Activities API working (`/api/activities` returns data)
- [ ] No build errors in Vercel deployment

---

**🎉 Once all items are checked, your Vercel deployment should be working perfectly!**
