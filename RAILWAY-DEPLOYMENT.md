# Railway Deployment Guide for Aslan 🦁

This guide will help you deploy your Aslan payment infrastructure to Railway.

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **GitHub Repository**: Your Aslan code should be in a GitHub repository
3. **PostgreSQL Database**: You already have this running on Railway ✅

## Step 1: Connect Your Repository

1. Go to [railway.app](https://railway.app) and sign in
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your Aslan repository
5. Railway will automatically detect it's a Node.js project

## Step 2: Configure Environment Variables

In your Railway project dashboard, go to the **Variables** tab and add these environment variables:

### Required Variables

```bash
# Application
NODE_ENV=production
PORT=3000

# Security (CRITICAL - Generate strong secrets!)
JWT_SECRET=your_super_secure_jwt_secret_minimum_256_bits
SESSION_SECRET=your_session_secret_change_in_production

# Database (Use your Railway PostgreSQL URL)
DATABASE_URL=postgresql://postgres:password@host:port/railway

# Stripe (Your production keys)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# CORS (Your domain)
CORS_ORIGINS=https://your-app-name.railway.app,https://aslanpay.xyz

# Security
TRUST_PROXY=true
SECURE_COOKIES=true
ENFORCE_HTTPS=true
```

### Optional Variables (for full functionality)

```bash
# Real Purchase APIs
NAMECHEAP_API_KEY=your_namecheap_api_key
NAMECHEAP_API_USER=your_namecheap_username
NAMECHEAP_CLIENT_IP=your_server_ip

# AWS
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# Twilio
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_number

# OpenAI
OPENAI_API_KEY=your_openai_key

# Email
SENDGRID_API_KEY=your_sendgrid_key
FROM_EMAIL=noreply@aslanpay.xyz
```

## Step 3: Get Your Database URL

1. In Railway, go to your PostgreSQL service
2. Go to the **Variables** tab
3. Copy the `DATABASE_URL` value
4. Add it to your main Aslan service variables

The URL format should be:
```
postgresql://postgres:password@host:port/railway
```

## Step 4: Generate Secure Secrets

Run this locally to generate secure secrets:

```bash
# Generate JWT_SECRET (64 characters)
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Generate SESSION_SECRET (64 characters)  
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

Copy these values to your Railway environment variables.

## Step 5: Deploy

1. Railway will automatically deploy when you push to your main branch
2. Monitor the build logs in the Railway dashboard
3. Once deployed, your app will be available at: `https://your-app-name.railway.app`

## Step 6: Verify Deployment

1. Visit your app URL
2. Check the health endpoint: `https://your-app-name.railway.app/health`
3. Test the demo page: `https://your-app-name.railway.app/demo.html`

## Step 7: Set Up Custom Domain (Optional)

1. In Railway, go to your service **Settings**
2. Click **Domains**
3. Add your custom domain (e.g., `aslanpay.xyz`)
4. Update your DNS records as instructed
5. Update `CORS_ORIGINS` to include your custom domain

## Troubleshooting

### Build Fails
- Check that all required environment variables are set
- Ensure `DATABASE_URL` is correct
- Check build logs for specific errors

### App Won't Start
- Verify `PORT=3000` is set
- Check that `DATABASE_URL` is accessible
- Ensure `JWT_SECRET` and `SESSION_SECRET` are set

### Database Connection Issues
- Verify your PostgreSQL service is running
- Check the `DATABASE_URL` format
- Ensure the database allows connections from your app

### CORS Errors
- Add your Railway domain to `CORS_ORIGINS`
- Format: `https://your-app-name.railway.app`
- Separate multiple domains with commas

## Security Checklist

- ✅ Strong `JWT_SECRET` (32+ characters)
- ✅ Strong `SESSION_SECRET` (32+ characters)  
- ✅ Production Stripe keys
- ✅ `NODE_ENV=production`
- ✅ `TRUST_PROXY=true`
- ✅ `SECURE_COOKIES=true`
- ✅ Correct `CORS_ORIGINS`

## Next Steps

1. **Set up Stripe webhooks** pointing to your Railway URL
2. **Configure your custom domain** 
3. **Test all functionality** with the demo page
4. **Monitor logs** in Railway dashboard

## Support

- Railway Docs: [docs.railway.app](https://docs.railway.app)
- Aslan Support: support@aslanpay.xyz
- GitHub Issues: [Your repository issues]

---

🦁 **Like the great lion of Narnia, Aslan guides your AI agents to accomplish their missions in production!** 