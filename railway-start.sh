#!/bin/bash
set -e

echo "🚀 Starting Railway deployment for Aslan..."

# Check if we're in production
if [ "$NODE_ENV" = "production" ]; then
    echo "📦 Production environment detected"
    
    # Check if DATABASE_URL is set
    if [ -z "$DATABASE_URL" ]; then
        echo "❌ ERROR: DATABASE_URL not set"
        exit 1
    fi
    
    echo "🔄 Generating Prisma client..."
    npx prisma generate
    
    echo "🔄 Running database migrations..."
    npx prisma migrate deploy
    
    echo "✅ Database setup complete"
else
    echo "🧪 Development environment detected - skipping migrations"
    npx prisma generate
fi

echo "🦁 Starting Aslan server..."
npm start 