#!/usr/bin/env node

console.log('🚀 Starting AgentPay server...');

try {
    require('ts-node/register');
    require('./src/index.ts');
} catch (error) {
    console.error('❌ Server startup error:', error.message);
    process.exit(1);
} 