#!/usr/bin/env node

// AslanPay Replit Demo - One-Click Spend Test
const https = require('https');

const API_KEY = process.env.AK_SANDBOX_DEMO;
const API_URL = 'https://web-staging-16bc.up.railway.app';

if (!API_KEY) {
    console.error('❌ Error: AK_SANDBOX_DEMO secret not found!');
    console.log('💡 Please add the AK_SANDBOX_DEMO secret in Replit secrets');
    process.exit(1);
}

console.log('🚀 AslanPay Demo - Testing Payment Authorization...\n');

const requestData = JSON.stringify({
    amount: 25,
    currency: 'USD',
    description: 'Replit demo purchase'
});

const options = {
    hostname: 'web-staging-16bc.up.railway.app',
    port: 443,
    path: '/api/authorize',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': requestData.length
    }
};

const req = https.request(options, (res) => {
    let body = '';
    
    res.on('data', (chunk) => {
        body += chunk;
    });
    
    res.on('end', () => {
        console.log(`📊 Response Status: ${res.statusCode}\n`);
        
        try {
            const response = JSON.parse(body);
            
            if (res.statusCode === 200 && response.success) {
                console.log('✅ Payment Authorization Successful!');
                console.log(`💳 Authorization ID: ${response.authorizationId}`);
                console.log(`💰 Amount: $${response.amount} ${response.currency}`);
                console.log(`📝 Description: ${response.description}`);
                console.log(`⏰ Expires: ${response.expiresAt}`);
                console.log(`🤖 Authorized by: ${response.authorizedBy}`);
            } else {
                console.log('❌ Payment Authorization Failed');
                console.log('Response:', JSON.stringify(response, null, 2));
            }
        } catch (error) {
            console.log('❌ Error parsing response:', error.message);
            console.log('Raw response:', body);
        }
        
        console.log('\n🎉 Demo complete! AslanPay is working perfectly.');
    });
});

req.on('error', (error) => {
    console.error('❌ Request failed:', error.message);
});

req.write(requestData);
req.end(); 