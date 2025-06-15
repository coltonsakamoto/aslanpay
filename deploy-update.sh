#!/bin/bash

# AslanPay Deployment Script
echo "🚀 Deploying AslanPay Updates"

# Check if we're in the right directory
if [ ! -f "server-production.js" ]; then
    echo "❌ Error: Not in AslanPay root directory"
    exit 1
fi

# Add updated files
echo "📂 Adding updated files..."
git add server-production.js
git add public/dashboard.html
git add deploy-update.sh

# Create deployment commit
echo "📝 Creating deployment commit..."
git commit -m "Update authentication flow and dashboard improvements

- Enhanced user session handling
- Improved dashboard error messaging  
- Added session validation debugging tools
- Updated authentication endpoints
- Refined user experience flow"

echo "📤 Pushing updates to production..."
git push origin main

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo "⏰ Railway will redeploy automatically"
echo ""
echo "🧪 Test the updated authentication flow:"
echo "1. Visit https://aslanpay.xyz/auth"
echo "2. Complete signup/login process"
echo "3. Verify dashboard access works correctly"
echo ""
echo "📊 Monitor deployment: https://railway.app/dashboard" 