# 🔐 **AgentPay Secure Setup Guide**

## 🚀 **Quick Start (Secure Configuration)**

### **Step 1: Clone and Install**
```bash
git clone <your-agentpay-repo>
cd agentpay
npm install
cd agent-wallet && npm install
```

### **Step 2: Configure Environment (CRITICAL)**
```bash
# Copy the example environment file
cp env-example .env
cd agent-wallet && cp .env.example .env
```

### **Step 3: Set Your Secrets**
Edit both `.env` files with your actual credentials:

#### **Root `.env` file:**
```bash
# Stripe Configuration (REQUIRED)
STRIPE_SECRET_KEY=sk_test_your_stripe_test_key_here

# JWT Security (REQUIRED) 
JWT_SECRET=your-super-long-random-secret-minimum-32-chars

# Database (REQUIRED)
DATABASE_URL=file:./dev.db

# Lightning Network (OPTIONAL)
LN_MACAROON=your_lightning_macaroon_here
LN_SOCKET=your_lightning_node_address

# OpenAI (OPTIONAL)
OPENAI_API_KEY=your_openai_key_here
```

#### **agent-wallet/.env file:**
```bash
# Same configuration as root .env
STRIPE_SECRET_KEY=sk_test_your_stripe_test_key_here
JWT_SECRET=your-super-long-random-secret-minimum-32-chars
DATABASE_URL=file:./dev.db

# Optional features
LN_MACAROON=your_lightning_macaroon_here
LN_SOCKET=your_lightning_node_address
OPENAI_API_KEY=your_openai_key_here
```

---

## 🔑 **Getting Your Credentials**

### **Stripe Keys (REQUIRED)**
1. Visit [Stripe Dashboard](https://dashboard.stripe.com)
2. Go to **Developers** → **API Keys**
3. Copy your **Secret key** (starts with `sk_test_` for testing)
4. For production, use your **Live secret key** (`sk_live_`)

### **JWT Secret (REQUIRED)**
Generate a strong random secret:
```bash
# Option 1: Use OpenSSL
openssl rand -base64 32

# Option 2: Use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Option 3: Use online generator (not recommended for production)
# https://generate-secret.vercel.app/32
```

### **Lightning Network (OPTIONAL)**
If you want Lightning payments:
1. Set up a Lightning node (Voltage, LND, etc.)
2. Get your admin macaroon (hex encoded)
3. Get your node's socket address

---

## ⚡ **Start Development Server**
```bash
# Terminal 1: Start the main server
cd agent-wallet
npm run dev

# Terminal 2: (Optional) Start any additional services
# Your development environment is now running!
```

---

## 🛡️ **Security Checklist**

### **Before You Start Development**
- [ ] ✅ Created `.env` files from examples
- [ ] ✅ Set real Stripe test keys (not placeholder values)
- [ ] ✅ Generated strong JWT secret (32+ characters)
- [ ] ✅ Confirmed `.env` files are in `.gitignore`
- [ ] ✅ Never committed actual secrets to git

### **Before Production Deployment**
- [ ] ✅ Run security audit: `node security-audit-clean.js`
- [ ] ✅ Set environment variables in deployment platform
- [ ] ✅ Use live Stripe keys (`sk_live_`)
- [ ] ✅ Ensure strong production JWT secret
- [ ] ✅ Test all payment flows with real test cards

---

## 🚨 **Security Rules (CRITICAL)**

### **❌ NEVER DO THIS:**
```bash
# DON'T commit .env files
git add .env  # ❌ NEVER!

# DON'T hardcode secrets in source code
const STRIPE_KEY = "sk_live_actual_key";  // ❌ NEVER!

# DON'T share secrets in chat/email
"Here's my Stripe key: sk_live_..."  // ❌ NEVER!
```

### **✅ ALWAYS DO THIS:**
```bash
# DO use environment variables
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;  // ✅ CORRECT

# DO check .gitignore includes .env
echo ".env" >> .gitignore  # ✅ CORRECT

# DO run security audits
node security-audit-clean.js  # ✅ CORRECT
```

---

## 🔧 **Troubleshooting**

### **"STRIPE_SECRET_KEY environment variable is required"**
```bash
# Check your .env file exists and has the right key
cat .env | grep STRIPE_SECRET_KEY

# Make sure you're in the right directory
pwd  # Should be in agent-wallet/ when starting server
```

### **"JWT_SECRET environment variable is required"**
```bash
# Check your JWT secret is set and long enough
cat .env | grep JWT_SECRET
# Should be at least 32 characters long
```

### **Lightning features not working**
```bash
# Lightning is optional - check if macaroon is set
cat .env | grep LN_MACAROON
# If not set, Lightning features will be disabled (this is OK)
```

---

## 🚀 **Production Deployment**

### **Environment Variables Setup**
Most platforms (Vercel, Railway, Heroku) let you set environment variables:

1. **Don't upload `.env` files** to production
2. **Set variables in platform dashboard**:
   - `STRIPE_SECRET_KEY=sk_live_your_live_key`
   - `JWT_SECRET=your_production_secret`
   - `DATABASE_URL=your_production_db_url`

### **Final Security Check**
```bash
# Run this before any deployment
node security-audit-clean.js

# Should output:
# ✅ SECURITY STATUS: CLEAN
# 🎉 No critical security vulnerabilities detected!
```

---

## 📞 **Need Help?**

### **Security Issues**
- Run the security audit: `node security-audit-clean.js`
- Check that `.env` files are not in git: `git status`
- Verify environment variables are set correctly

### **Configuration Issues**  
- Check the example files: `env-example` and `agent-wallet/.env.example`
- Ensure all required variables are set
- Restart the server after changing `.env` files

---

**Remember: Security is not optional when handling real financial transactions!** 🔐

*Follow this guide exactly to ensure your AgentPay setup is secure and production-ready.* 