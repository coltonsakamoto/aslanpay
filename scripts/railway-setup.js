#!/usr/bin/env node

/**
 * Railway Setup Script for Aslan
 * Generates secure environment variables for Railway deployment
 */

const crypto = require('crypto');

console.log('🦁 Aslan Railway Setup Script');
console.log('=====================================\n');

console.log('🔐 Generated Secure Secrets:');
console.log('-----------------------------');

// Generate secure secrets
const jwtSecret = crypto.randomBytes(32).toString('hex');
const sessionSecret = crypto.randomBytes(32).toString('hex');

console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`SESSION_SECRET=${sessionSecret}`);

console.log('\n📋 Required Environment Variables for Railway:');
console.log('----------------------------------------------');

const requiredVars = [
    'NODE_ENV=production',
    'PORT=3000',
    `JWT_SECRET=${jwtSecret}`,
    `SESSION_SECRET=${sessionSecret}`,
    'DATABASE_URL=postgresql://postgres:password@host:port/railway',
    'STRIPE_SECRET_KEY=sk_live_...',
    'STRIPE_PUBLISHABLE_KEY=pk_live_...',
    'STRIPE_WEBHOOK_SECRET=whsec_...',
    'CORS_ORIGINS=https://your-app-name.railway.app,https://aslanpay.xyz',
    'TRUST_PROXY=true',
    'SECURE_COOKIES=true',
    'ENFORCE_HTTPS=true'
];

requiredVars.forEach(variable => {
    console.log(variable);
});

console.log('\n🔧 Optional Variables (for full functionality):');
console.log('-----------------------------------------------');

const optionalVars = [
    'NAMECHEAP_API_KEY=your_namecheap_api_key',
    'NAMECHEAP_API_USER=your_namecheap_username',
    'NAMECHEAP_CLIENT_IP=your_server_ip',
    'AWS_ACCESS_KEY_ID=your_aws_access_key',
    'AWS_SECRET_ACCESS_KEY=your_aws_secret_key',
    'TWILIO_ACCOUNT_SID=your_twilio_sid',
    'TWILIO_AUTH_TOKEN=your_twilio_token',
    'TWILIO_PHONE_NUMBER=your_twilio_number',
    'OPENAI_API_KEY=your_openai_key',
    'SENDGRID_API_KEY=your_sendgrid_key',
    'FROM_EMAIL=noreply@aslanpay.xyz'
];

optionalVars.forEach(variable => {
    console.log(variable);
});

console.log('\n📝 Next Steps:');
console.log('-------------');
console.log('1. Copy the environment variables above');
console.log('2. Go to your Railway project dashboard');
console.log('3. Navigate to the Variables tab');
console.log('4. Add each variable one by one');
console.log('5. Replace placeholder values with your actual keys');
console.log('6. Deploy your application');

console.log('\n🚀 Railway Deployment Commands:');
console.log('-------------------------------');
console.log('# If you have Railway CLI installed:');
console.log('railway login');
console.log('railway link');
console.log('railway up');

console.log('\n🔗 Useful Links:');
console.log('---------------');
console.log('• Railway Dashboard: https://railway.app/dashboard');
console.log('• Stripe Dashboard: https://dashboard.stripe.com');
console.log('• Aslan Docs: See RAILWAY-DEPLOYMENT.md');

console.log('\n🦁 Like the great lion of Narnia, Aslan will guide your AI agents in production!'); 