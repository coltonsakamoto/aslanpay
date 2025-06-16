#!/bin/bash

# 🚨 IMMEDIATE 500 ERROR FIX
echo "🚨 FIXING 500 INTERNAL SERVER ERROR ON /api/v1/test"

git add server-production.js
git add fix-500-error-deploy.sh

git commit -m "Critical endpoint stability fix

Enhanced API test endpoint with proper error handling
and safe property access to prevent server errors."

git push origin main

echo ""
echo "🚨 500 ERROR FIX DEPLOYED!"
echo "⏰ Railway deploying now..."
echo ""
echo "🧪 Test in 60 seconds:"
echo "curl -H \"Authorization: Bearer ak_live_efee3abb52ef6462eeeb1bdeca996419805c4a06948df81d1d5158ad84f4f0c7\" https://aslanpay.xyz/api/v1/test" 