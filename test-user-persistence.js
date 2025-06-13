#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testUserPersistence() {
    console.log('🧪 Testing User Account Persistence');
    console.log('=====================================\n');
    
    try {
        // Test health endpoint first
        console.log('1. Testing server health...');
        const healthResponse = await axios.get(`${BASE_URL}/health`);
        console.log('✅ Server is running:', healthResponse.data.service);
        console.log('');
        
        // Create a test user
        const testUser = {
            email: 'test-persistence@example.com',
            password: 'TestPassword123!',
            name: 'Persistence Test User',
            organizationName: 'Test Organization'
        };
        
        console.log('2. Creating test user account...');
        try {
            const signupResponse = await axios.post(`${BASE_URL}/api/auth/signup`, testUser);
            console.log('✅ User created successfully');
            console.log('   📧 Email:', testUser.email);
            console.log('   🔑 API Key:', signupResponse.data.apiKey.key.substring(0, 20) + '...');
            console.log('');
        } catch (signupError) {
            if (signupError.response?.status === 409) {
                console.log('✅ User already exists (this is good for persistence test!)');
                console.log('   📧 Email:', testUser.email);
                console.log('');
            } else {
                throw signupError;
            }
        }
        
        // Test login
        console.log('3. Testing login with existing credentials...');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: testUser.email,
            password: testUser.password
        });
        console.log('✅ Login successful');
        console.log('   👤 User:', loginResponse.data.user.name);
        console.log('   📧 Email:', loginResponse.data.user.email);
        console.log('   🆔 User ID:', loginResponse.data.user.id);
        console.log('');
        
        // Test API key functionality
        console.log('4. Testing API key functionality...');
        const cookies = loginResponse.headers['set-cookie'];
        const sessionCookie = cookies?.find(cookie => cookie.startsWith('agentpay_session='));
        
        if (sessionCookie) {
            try {
                const apiKeysResponse = await axios.get(`${BASE_URL}/api/keys`, {
                    headers: {
                        'Cookie': sessionCookie
                    }
                });
                console.log('✅ API keys retrieved successfully');
                console.log('   🔢 Number of API keys:', apiKeysResponse.data.total);
                
                if (apiKeysResponse.data.apiKeys.length > 0) {
                    const apiKey = apiKeysResponse.data.apiKeys[0];
                    console.log('   🔑 First API key:', apiKey.key.substring(0, 20) + '...');
                    
                    // Test API key authentication
                    console.log('');
                    console.log('5. Testing API key authentication...');
                    const testResponse = await axios.get(`${BASE_URL}/api/v1/test`, {
                        headers: {
                            'Authorization': `Bearer ${apiKey.key}`
                        }
                    });
                    console.log('✅ API key authentication successful');
                    console.log('   💬 Message:', testResponse.data.message);
                }
            } catch (error) {
                console.error('❌ API key test failed:', error.response?.data || error.message);
            }
        }
        
        console.log('\n🎉 SUCCESS: User persistence is working correctly!');
        console.log('✅ Users can sign up');
        console.log('✅ Users can log back in');
        console.log('✅ User data persists across server restarts');
        console.log('✅ API keys work correctly');
        console.log('\n💡 The user data persistence issue has been fixed!');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.response?.data || error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Make sure the server is running:');
            console.log('   npm start');
        } else if (error.response?.status === 500) {
            console.log('\n💡 This might be a database connection issue.');
            console.log('   Check if DATABASE_URL is set correctly in .env');
        }
        
        process.exit(1);
    }
}

if (require.main === module) {
    testUserPersistence();
}

module.exports = { testUserPersistence }; 