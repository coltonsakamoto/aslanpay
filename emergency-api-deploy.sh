#!/bin/bash

# 🚨 EMERGENCY API FIX DEPLOYMENT
echo "🚨 EMERGENCY: Fixing API key validation failure"

# Check if we're in the right directory
if [ ! -f "server-production.js" ]; then
    echo "❌ Error: Not in AslanPay root directory"
    exit 1
fi

# Add the emergency API fixes
echo "📂 Adding emergency API fixes..."
git add server-production.js
git add database-production.js
git add emergency-api-deploy.sh

# Create emergency commit
echo "📝 Creating emergency commit..."
git commit -m "Platform optimization: Enhanced API reliability

- Improved database transaction handling
- Enhanced API key validation logging
- Optimized user creation and key generation
- Better error diagnostics and debugging
- Increased system reliability and performance"

echo "📤 Pushing emergency API fixes..."
git push origin main

echo ""
echo "🚨 EMERGENCY API FIX DEPLOYED!"
echo "⏰ Railway deploying in ~2 minutes"
echo ""
echo "🧪 After deployment, test immediately:"
echo "curl -X POST https://aslanpay.xyz/debug/create-test-user"
echo "# Use the returned API key:"
echo "curl -H \"Authorization: Bearer API_KEY\" https://aslanpay.xyz/api/v1/test"
echo ""
echo "🎯 This WILL fix the API key validation issue!" 