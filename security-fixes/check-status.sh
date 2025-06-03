#!/bin/bash

echo "🔍 Checking Security Implementation Status..."
echo "==========================================="
echo ""

# Check if server is running
echo "1️⃣ Checking if server is running on port 3000..."
if lsof -ti:3000 > /dev/null 2>&1; then
    echo "   ✅ Server is running on port 3000"
    PID=$(lsof -ti:3000)
    echo "   Process ID: $PID"
else
    echo "   ❌ Server is NOT running on port 3000"
    echo "   Run: npm start"
fi
echo ""

# Check if Redis is running
echo "2️⃣ Checking if Redis is running..."
if redis-cli ping > /dev/null 2>&1; then
    echo "   ✅ Redis is running"
else
    echo "   ⚠️  Redis is NOT running (optional but recommended)"
    echo "   Run: brew services start redis"
    echo "   Or: docker run -d -p 6379:6379 redis:alpine"
fi
echo ""

# Check if dependencies are installed
echo "3️⃣ Checking dependencies..."
if [ -d "../node_modules/redis" ]; then
    echo "   ✅ redis module installed"
else
    echo "   ❌ redis module NOT installed"
fi

if [ -d "../node_modules/rate-limit-redis" ]; then
    echo "   ✅ rate-limit-redis module installed"
else
    echo "   ⚠️  rate-limit-redis module NOT installed (optional)"
fi
echo ""

# Check environment variables
echo "4️⃣ Checking environment variables in .env..."
if grep -q "JWT_SECRET" ../.env; then
    echo "   ✅ JWT_SECRET found in .env"
else
    echo "   ❌ JWT_SECRET NOT found in .env"
fi

if grep -q "DEV_DEBUG_TOKEN" ../.env; then
    echo "   ✅ DEV_DEBUG_TOKEN found in .env"
else
    echo "   ❌ DEV_DEBUG_TOKEN NOT found in .env"
fi

if grep -q "SESSION_SECRET" ../.env; then
    echo "   ✅ SESSION_SECRET found in .env"
else
    echo "   ❌ SESSION_SECRET NOT found in .env"
fi
echo ""

# Quick server test
echo "5️⃣ Testing server endpoint..."
if curl -s http://localhost:3000/test > /dev/null 2>&1; then
    echo "   ✅ Server is responding to requests"
    RESPONSE=$(curl -s http://localhost:3000/test)
    echo "   Response: $RESPONSE"
else
    echo "   ❌ Server is not responding"
fi
echo ""

echo "==========================================="
echo "📋 Next Steps:"
if ! lsof -ti:3000 > /dev/null 2>&1; then
    echo "1. Start the server: npm start"
    echo "2. Wait 5 seconds for it to fully start"
    echo "3. Run tests: node test-security-fixes.js"
else
    echo "✅ Server is running! You can now run:"
    echo "   node test-security-fixes.js"
fi 