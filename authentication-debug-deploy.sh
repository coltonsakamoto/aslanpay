#!/bin/bash

# 🚨 AslanPay Authentication Debug Deployment
echo "🚨 CRITICAL: Debugging Authentication Service"

# Check if we're in the right directory
if [ ! -f "server-production.js" ]; then
    echo "❌ Error: Not in AslanPay root directory"
    exit 1
fi

# Add the debug enhancements
echo "📂 Adding authentication debug enhancements..."
git add server-production.js
git add authentication-debug-deploy.sh

# Create debug commit
echo "📝 Creating debug commit..."
git commit -m "🔍 AUTHENTICATION DEBUG: Add comprehensive debugging

DEBUGGING ENHANCEMENTS:
- Show database user/API key counts on startup
- Auto-create test user if database is empty
- Detailed API key validation logging
- Show sample keys when validation fails
- Added /debug/create-test-user endpoint for immediate testing

WILL SOLVE:
- Identify if database is empty (no API keys to validate)
- Show exact API key validation failures
- Provide immediate test API key creation
- Clear error messages for debugging

This will identify the root cause of 500 authentication errors."

echo "📤 Pushing debug version to production..."
git push origin main

echo ""
echo "🔍 AUTHENTICATION DEBUG DEPLOYED!"
echo "⏰ Railway will redeploy in ~2 minutes"
echo ""
echo "🧪 Once deployed, check Railway logs for:"
echo "✅ '📊 Database contents: X users, Y API keys'"
echo "✅ '🔑 Test API Key: ak_live_...'"
echo "✅ '📊 Database has X total API keys, Y active'"
echo ""
echo "🚀 Create test API key immediately:"
echo "POST https://your-railway-domain.railway.app/debug/create-test-user"
echo ""
echo "🎯 This will show us EXACTLY what's failing in authentication" 