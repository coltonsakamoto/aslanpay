#!/usr/bin/env node

/**
 * Railway Setup Script for Aslan
 * Provides instructions for Railway deployment without exposing secrets
 */

console.log('🦁 Aslan Railway Setup Script');
console.log('=====================================\n');

console.log('🔐 Generate Secure Secrets:');
console.log('---------------------------');
console.log('Run these commands to generate secure secrets:');
console.log('');
console.log('# Generate JWT_SECRET:');
console.log('node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
console.log('');
console.log('# Generate SESSION_SECRET:');
console.log('node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');

console.log('\n📋 Required Environment Variables for Railway:');
console.log('----------------------------------------------');

const requiredVars = [
    'NODE_ENV=production',
    'PORT=3000',
    'JWT_SECRET=<GENERATE_WITH_COMMAND_ABOVE>',
    'SESSION_SECRET=<GENERATE_WITH_COMMAND_ABOVE>',
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
console.log('1. Generate secrets using the commands above');
console.log('2. Copy the environment variables above');
console.log('3. Go to your Railway project dashboard');
console.log('4. Navigate to the Variables tab');
console.log('5. Add each variable one by one');
console.log('6. Replace placeholder values with your actual keys');
console.log('7. Deploy your application');

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