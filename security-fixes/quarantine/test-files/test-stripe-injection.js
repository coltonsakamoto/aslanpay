#!/usr/bin/env node

/**
 * Test script to verify Stripe key injection into HTML files
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Stripe Key Injection');
console.log('===============================\n');

// Check environment variables
console.log('1. Environment Variables:');
console.log(`   STRIPE_PUBLISHABLE_KEY: ${process.env.STRIPE_PUBLISHABLE_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`   STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}\n`);

// Test HTML files for proper Stripe key usage
console.log('2. HTML File Analysis:');

const htmlFiles = [
    'public/checkout.html',
    'agent-wallet/public/wallet.html'
];

htmlFiles.forEach(filePath => {
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        console.log(`\n   📄 ${filePath}:`);
        
        // Check for hardcoded keys
        const hasHardcodedLive = content.includes('pk_live_') && !content.includes('window.STRIPE_PUBLISHABLE_KEY');
        const hasHardcodedTest = content.includes('pk_test_') && content.includes('YOUR_STRIPE_PUBLISHABLE_KEY');
        
        if (hasHardcodedLive) {
            console.log(`      ❌ Contains hardcoded live key - SECURITY RISK!`);
        } else if (hasHardcodedTest) {
            console.log(`      ⚠️  Contains placeholder test key`);
        } else {
            console.log(`      ✅ No hardcoded keys found`);
        }
        
        // Check for environment variable usage
        const usesEnvVar = content.includes('window.STRIPE_PUBLISHABLE_KEY');
        if (usesEnvVar) {
            console.log(`      ✅ Uses environment variable injection`);
        } else {
            console.log(`      ❌ Does not use environment variable injection`);
        }
        
        // Check for fallback
        const hasFallback = content.includes('pk_test_placeholder');
        if (hasFallback) {
            console.log(`      ✅ Has secure fallback for development`);
        }
        
    } else {
        console.log(`\n   📄 ${filePath}: ❌ File not found`);
    }
});

console.log('\n3. Security Status:');
const isSecure = !htmlFiles.some(filePath => {
    if (!fs.existsSync(filePath)) return false;
    const content = fs.readFileSync(filePath, 'utf8');
    return content.includes('pk_live_') && !content.includes('window.STRIPE_PUBLISHABLE_KEY');
});

if (isSecure) {
    console.log('   ✅ All HTML files are secure - no hardcoded live keys found');
} else {
    console.log('   ❌ SECURITY ISSUE: Hardcoded live keys detected!');
}

console.log('\n4. Next Steps:');
console.log('   1. Start your server: npm start');
console.log('   2. Check a page source to verify injection: curl http://localhost:3000/ | grep STRIPE_PUBLISHABLE_KEY');
console.log('   3. Set STRIPE_PUBLISHABLE_KEY in Railway environment variables');

console.log('\n🎉 Test complete!'); 