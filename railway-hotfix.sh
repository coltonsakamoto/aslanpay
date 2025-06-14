#!/bin/bash

# 🚨 AslanPay Railway Database Hotfix
echo "🚨 CRITICAL HOTFIX: Railway Database URL Issue"

# Check if we're in the right directory
if [ ! -f "server-production.js" ]; then
    echo "❌ Error: Not in AslanPay root directory"
    exit 1
fi

# Add the hotfix
echo "📂 Adding hotfix files..."
git add server-production.js
git add railway-hotfix.sh

# Create hotfix commit
echo "📝 Creating hotfix commit..."
git commit -m "🚨 HOTFIX: Force SQLite in Railway production

CRITICAL FIX:
- Railway sets DATABASE_URL to PostgreSQL by default
- Prisma schema expects SQLite with file: protocol
- Server now forces file:./prisma/dev.db regardless of Railway setting
- Added automatic database migration for production
- Ensures database directory exists

SOLVES:
- 'the URL must start with the protocol file:' error
- Database initialization failures in Railway
- Prisma validation errors

This hotfix is critical for production functionality."

echo "📤 Pushing hotfix to production..."
git push origin main

echo ""
echo "🚨 HOTFIX DEPLOYED!"
echo "⏰ Railway will redeploy automatically in ~2 minutes"
echo ""
echo "🔍 Check Railway logs for these success messages:"
echo "✅ 'Forcing SQLite DATABASE_URL to: file:./prisma/dev.db'"
echo "✅ 'Database migrations completed'"
echo "✅ 'Persistent database initialized successfully'"
echo ""
echo "📊 Monitor deployment: https://railway.app/dashboard" 