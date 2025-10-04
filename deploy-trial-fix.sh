#!/bin/bash

echo "🚀 Deploying Trial System Fix to Production"
echo "Following user preference for production testing"

# Add all changes
git add .

# Commit with descriptive message
git commit -m "Add comprehensive trial system diagnostics and force trial banner

- Add ForceTrialBanner for production debugging
- Add TrialDebugBanner for API testing
- Add production-trial-fix.js for automated database fixes
- Include comprehensive diagnostic information
- Force trial activation capability for testing"

# Push to main branch (triggers Vercel deployment)
git push origin main

echo "✅ Trial system fix deployed to production"
echo ""
echo "🎯 Next Steps:"
echo "1. Wait for Vercel deployment to complete"
echo "2. Visit your app URL"
echo "3. Look for RED diagnostic banner at top"
echo "4. Check diagnostic information"
echo "5. Use 'Force Start Trial' button if needed"
echo ""
echo "📱 You should now see:"
echo "   • Red diagnostic banner (always visible)"
echo "   • Blue debug banner (if trial API works)"
echo "   • Trial status information"
echo "   • Ability to force-activate trials"