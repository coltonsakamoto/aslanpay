# Railway Environment Variables Setup

## Essential Variables (Must Have)

```bash
# Core Application
NODE_ENV=production
PORT=3000

# Database (Critical - get from Railway PostgreSQL service)
DATABASE_URL=postgresql://postgres:password@host:port/railway
DIRECT_URL=postgresql://postgres:password@host:port/railway

# Security (Generate strong secrets!)
JWT_SECRET=your_super_secure_jwt_secret_minimum_256_bits
SESSION_SECRET=your_session_secret_change_in_production

# Stripe (Production keys)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# CORS (Your Railway domain)
CORS_ORIGINS=https://your-app-name.railway.app,https://aslanpay.xyz

# Security Settings
TRUST_PROXY=true
SECURE_COOKIES=true
ENFORCE_HTTPS=true
```

## Generate Secure Secrets

Run locally to generate secure secrets:

```bash
# Generate JWT_SECRET
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Generate SESSION_SECRET  
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

## Database URL Setup

1. Go to your Railway PostgreSQL service
2. Click on "Variables" tab
3. Copy the `DATABASE_URL` value
4. Set both `DATABASE_URL` and `DIRECT_URL` to the same value

## Verification Commands

After deployment, test:

```bash
# Check health
curl https://your-app-name.railway.app/health

# Check full status  
curl https://your-app-name.railway.app/api/status

# Check status page
curl https://your-app-name.railway.app/status
```

## Common Database Issues & Fixes

### Issue: "Database connection failed"
**Fix**: Verify DATABASE_URL is correct and PostgreSQL service is running

### Issue: "Table doesn't exist" 
**Fix**: Ensure migrations run with updated railway.json startCommand

### Issue: "Connection pool exhausted"
**Fix**: Add DIRECT_URL variable for connection pooling

### Issue: "Prisma client not generated"
**Fix**: Add to package.json: "postinstall": "npx prisma generate" 