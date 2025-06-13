#!/bin/bash

echo "" >> ../.env
echo "# Security Configuration (Added by security fixes)" >> ../.env
echo "DEV_DEBUG_TOKEN=910e10373b36a62a3fbd3d795466929a0f4d0f7cce7601476880b6de3f062460" >> ../.env
echo "SESSION_SECRET=57cde7f4b00d40f23d193f27c712d1e914ec61708924000d4f35ca3067966420" >> ../.env
echo "JWT_SECRET=8e71ebc3555c1c9127bc56435c6d41c78a9f06df0273a18835091dce15bbf0ac" >> ../.env
echo "REDIS_URL=redis://localhost:6379" >> ../.env
echo "SESSION_TTL=604800" >> ../.env
echo "SESSION_COOKIE_NAME=agentpay_session" >> ../.env
echo "SESSION_REGENERATE_ON_LOGIN=true" >> ../.env
echo "RATE_LIMIT_REDIS_PREFIX=agentpay_rl:" >> ../.env
echo "CORS_ORIGINS=http://localhost:3000,http://localhost:3001" >> ../.env

echo "✅ Added security environment variables to .env" 