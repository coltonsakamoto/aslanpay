# 🔒 MANUAL STEPS TO COMPLETE SECURITY IMPLEMENTATION

## ✅ What I've Done For You:

1. **Installed Dependencies**: Redis, ioredis, and rate-limit-redis
2. **Applied Security Fixes**: Updated your server.js with all security modules
3. **Created Backup**: Your original server.js is backed up at `security-fixes/server.js.backup`
4. **Generated Secure Tokens**: Created `.env.security-template` with secure values

## 🚨 What You Need To Do (In Order):

### Step 1: Stop Your Current Server
```bash
# Your server is running as process 3888
kill 3888
```

### Step 2: Update Your .env File
Add these lines from `.env.security-template` to your `.env` file:

```bash
# Security Configuration
DEV_DEBUG_TOKEN=910e10373b36a62a3fbd3d795466929a0f4d0f7cce7601476880b6de3f062460
SESSION_SECRET=57cde7f4b00d40f23d193f27c712d1e914ec61708924000d4f35ca3067966420
JWT_SECRET=8e71ebc3555c1c9127bc56435c6d41c78a9f06df0273a18835091dce15bbf0ac

# Redis Configuration (optional but recommended)
REDIS_URL=redis://localhost:6379

# Session Configuration
SESSION_TTL=604800
SESSION_COOKIE_NAME=agentpay_session
SESSION_REGENERATE_ON_LOGIN=true

# Rate Limiting
RATE_LIMIT_REDIS_PREFIX=agentpay_rl:

# CORS Origins (update for production)
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Step 3: Start Redis (Optional but Recommended)
```bash
# Using Docker:
docker run -d -p 6379:6379 redis:alpine

# Or using Homebrew (Mac):
brew install redis
brew services start redis

# Or download from: https://redis.io/download
```

### Step 4: Restart Your Server
```bash
npm start
```

### Step 5: Run Security Tests
```bash
# First, install axios if not already installed
npm install axios

# Then run the security tests
node security-fixes/test-security-fixes.js
```

## 🔍 What to Look For:

When you run the tests, you should see:
- ✅ Rate limiting working (blocks after 5 login attempts)
- ✅ Debug endpoint returning 404
- ✅ Dev database endpoint removed
- ✅ Test files quarantined
- ✅ XSS prevention working
- ✅ IDOR prevention active

## ⚠️ Important Notes:

1. **Session Cookie Change**: The session cookie name changed from `session` to `agentpay_session`. Users will need to log in again.

2. **Rate Limits**: Much stricter now. Update any client code that might hit rate limits:
   - Login: 5 attempts per 15 minutes
   - Password reset: 3 attempts per hour
   - API: 100 requests per 15 minutes

3. **Redis**: The system works without Redis (uses in-memory storage) but Redis is highly recommended for production.

## 🚀 Phase 2 Tasks (Next 24 Hours):

After verifying Phase 1 is working, implement:
1. Webhook security improvements
2. Password reset token security
3. Enhanced CSRF protection
4. Input validation on all endpoints

## 🆘 Troubleshooting:

If the server doesn't start:
1. Check that all dependencies installed correctly
2. Verify your .env file has all required variables
3. Check `security-fixes/server.js.backup` if you need to restore

If tests fail:
1. Make sure server is running on port 3000
2. Check Redis is running (if using)
3. Review server logs for errors

## 📞 Quick Test Commands:

```bash
# Test rate limiting
for i in {1..6}; do curl -X POST http://localhost:3000/api/auth/login -d '{"email":"test@test.com","password":"test"}' -H "Content-Type: application/json"; echo ""; done

# Test debug endpoint (should return 404)
curl http://localhost:3000/debug

# Test health endpoint
curl http://localhost:3000/api/health | jq
```

---

**Ready to proceed?** Follow the steps above in order, and your application will be significantly more secure! 🔒 