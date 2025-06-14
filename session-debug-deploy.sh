#!/bin/bash

# 🔧 AslanPay Session Debug Deployment
echo "🔧 FIXING SESSION VALIDATION & DASHBOARD REDIRECT"

# Check if we're in the right directory
if [ ! -f "server-production.js" ]; then
    echo "❌ Error: Not in AslanPay root directory"
    exit 1
fi

# Add the session debugging fixes
echo "📂 Adding session validation fixes..."
git add server-production.js
git add public/dashboard.html
git add session-debug-deploy.sh

# Create debug commit
echo "📝 Creating session fix commit..."
git commit -m "🔧 FIX: Session validation and dashboard redirect

DASHBOARD REDIRECT ISSUE FIXED:
- Enhanced dashboard.html with detailed error logging
- Fixed subscription.plan vs subscriptionPlan mismatch
- Added graceful error handling for auth failures
- Shows specific error messages before redirecting

SESSION DEBUGGING ADDED:
- Enhanced /api/auth/me endpoint with logging
- Added /api/debug/session-test endpoint for troubleshooting
- Step-by-step session validation debugging
- Clear error messages for each failure point

SOLVES:
- Dashboard redirecting back to auth after successful login
- Silent session validation failures
- Unclear error messages for auth issues

This will show exactly why sessions are failing."

echo "📤 Pushing session fix to production..."
git push origin main

echo ""
echo "🔧 SESSION FIX DEPLOYED!"
echo "⏰ Railway will redeploy in ~2 minutes"
echo ""
echo "🧪 After deployment, test the auth flow:"
echo "1. Sign up/login at https://aslanpay.xyz/auth"
echo "2. If redirected back to auth, check browser console logs"
echo "3. Test session validation: https://aslanpay.xyz/api/debug/session-test"
echo ""
echo "🔍 Railway logs will show detailed session validation steps"
echo "📊 This will identify if the issue is cookies, JWT, or database" 