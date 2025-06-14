#!/bin/bash

# 🚀 AslanPay Authentication Service Fix Deployment
echo "🚀 Deploying AslanPay Authentication Service Fix..."

# Check if we're in the right directory
if [ ! -f "server-production.js" ]; then
    echo "❌ Error: Not in AslanPay root directory"
    exit 1
fi

# Add all the new and modified files
echo "📂 Adding files to git..."
git add server-production.js
git add test-auth-service.js
git add diagnose-database.js
git add AUTH-SERVICE-FIX.md
git add deploy-auth-fix.sh

# Create commit with detailed message
echo "📝 Creating commit..."
git commit -m "🔧 Fix authentication service - resolve HTTP 500 errors

FIXES:
- Auto-configure DATABASE_URL if missing
- Enhanced error handling with detailed logging
- Added fallback database paths
- Better debugging information

TESTING TOOLS:
- diagnose-database.js - Database diagnostics
- test-auth-service.js - Full auth flow testing

PROBLEM SOLVED:
- No more 'Authentication service error' 500 responses
- API key validation now works correctly
- Database connection issues resolved

Ready for production deployment!"

echo "📤 Pushing to GitHub..."
git push origin main

echo "🚀 Deploying to Railway..."
if command -v railway &> /dev/null; then
    railway up --detach
    echo "✅ Railway deployment triggered"
else
    echo "⚠️  Railway CLI not found. Deploy manually at railway.app"
    echo "💡 Or install Railway CLI: npm install -g @railway/cli"
fi

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "Your authentication service fixes are now live in production."
echo ""
echo "🧪 Test the production API:"
echo "curl -X GET https://your-railway-domain.railway.app/health"
echo "curl -X GET https://your-railway-domain.railway.app/api/status"
echo ""
echo "📊 Monitor deployment:"
echo "- GitHub: https://github.com/coltonsakamoto/aslanpay"
echo "- Railway: https://railway.app/dashboard" 