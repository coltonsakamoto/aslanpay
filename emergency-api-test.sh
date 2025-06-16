#!/bin/bash

echo "🚨 EMERGENCY API DIAGNOSTIC - FINDING THE EXACT FAILURE"

BASE_URL="https://aslanpay.xyz"

echo "1️⃣ Testing server health..."
curl -s "$BASE_URL/health" | jq . || echo "❌ Health check failed"

echo "2️⃣ Testing API status..."
curl -s "$BASE_URL/api/status" | jq . || echo "❌ API status failed"

echo "3️⃣ Creating test user to get working API key..."
TEST_RESPONSE=$(curl -s -X POST "$BASE_URL/debug/create-test-user")
echo "Test user response: $TEST_RESPONSE"

API_KEY=$(echo "$TEST_RESPONSE" | jq -r '.apiKey // empty')
echo "Extracted API key: $API_KEY"

if [ -z "$API_KEY" ] || [ "$API_KEY" = "null" ]; then
    echo "❌ CRITICAL: Cannot create API key - database issue"
    exit 1
fi

echo "4️⃣ Testing API key validation..."
curl -s -H "Authorization: Bearer $API_KEY" "$BASE_URL/api/v1/test" | jq . || echo "❌ API key test failed"

echo "5️⃣ Testing payment authorization..."
curl -s -X POST "$BASE_URL/api/v1/authorize" \
     -H "Authorization: Bearer $API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"amount":2500,"description":"Emergency test payment"}' | jq . || echo "❌ Authorization failed"

echo "📊 DIAGNOSTIC COMPLETE" 