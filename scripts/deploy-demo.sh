#!/bin/bash

# 🚀 AgentPay Demo Deployment Script
# Deploys the public demo to agentpay.com/demo

set -e

echo "🚀 AgentPay Demo Deployment Starting..."

# Check requirements
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed. Aborting." >&2; exit 1; }

# Build and prepare demo
echo "📦 Building demo assets..."
mkdir -p dist/demo
cp public/demo.html dist/demo/index.html

# Copy static assets
echo "📁 Copying static assets..."
cp -r public/assets dist/demo/ 2>/dev/null || echo "ℹ️ No assets directory found, skipping..."

# Generate demo configuration
echo "⚙️ Generating demo configuration..."
cat > dist/demo/config.js << 'EOF'
// AgentPay Demo Configuration
window.AGENTPAY_CONFIG = {
  apiUrl: 'https://api.agentpay.com',
  demoMode: true,
  environment: 'production'
};
EOF

# Deployment options
echo ""
echo "🎯 Demo deployment ready!"
echo ""
echo "📁 Demo files are in: ./dist/demo/"
echo ""
echo "🌐 Deployment Options:"
echo ""
echo "1. 📦 Vercel (Recommended):"
echo "   npx vercel --prod ./dist/demo"
echo ""
echo "2. 🚀 Netlify:"
echo "   npx netlify deploy --prod --dir ./dist/demo"
echo ""
echo "3. ☁️ AWS S3:"
echo "   aws s3 sync ./dist/demo s3://agentpay-demo --delete"
echo ""
echo "4. 🔥 Firebase:"
echo "   firebase deploy --only hosting"
echo ""

# Optional: Auto-deploy to Vercel if token exists
if [ ! -z "$VERCEL_TOKEN" ]; then
  echo "🚀 Auto-deploying to Vercel..."
  npx vercel --token $VERCEL_TOKEN --prod ./dist/demo --yes
  echo "✅ Demo deployed to Vercel!"
else
  echo "💡 Set VERCEL_TOKEN environment variable for auto-deployment"
fi

echo ""
echo "✅ Demo deployment prepared!"
echo "🌐 Your demo will be live at: https://agentpay.com/demo" 