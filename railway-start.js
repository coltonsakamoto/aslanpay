#!/usr/bin/env node

console.log('🚀 Starting Railway deployment for AslanPay...');

// Set production environment
process.env.NODE_ENV = 'production';

// Generate secrets if not provided
if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = require('crypto').randomBytes(32).toString('hex');
    console.log('✅ Generated JWT_SECRET');
}

if (!process.env.SESSION_SECRET) {
    process.env.SESSION_SECRET = require('crypto').randomBytes(32).toString('hex');
    console.log('✅ Generated SESSION_SECRET');
}

// Try to generate Prisma client safely
try {
    console.log('🔄 Generating Prisma client...');
    require('child_process').execSync('npx prisma generate', { stdio: 'pipe' });
    console.log('✅ Prisma client generated');
} catch (error) {
    console.warn('⚠️  Prisma generation failed, continuing without database:', error.message);
}

// Start the main server
console.log('🦁 Starting AslanPay server...');
require('./server-production.js'); 