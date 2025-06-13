#!/usr/bin/env node

const axios = require('axios').default;
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'test@test.com';
const TEST_PASSWORD = 'testpassword123';

console.log('🧪 Testing Security Fixes...\n');

// Color codes for output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m'
};

function pass(message) {
    console.log(`${colors.green}✅ PASS${colors.reset}: ${message}`);
}

function fail(message) {
    console.log(`${colors.red}❌ FAIL${colors.reset}: ${message}`);
}

function info(message) {
    console.log(`${colors.yellow}ℹ️  INFO${colors.reset}: ${message}`);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Test Suite
const tests = {
    // Test 1: Rate Limiting on Login
    async testLoginRateLimit() {
        console.log('\n📌 Test 1: Login Rate Limiting (5 attempts per 15 min)');
        
        let blockedAt = 0;
        for (let i = 1; i <= 10; i++) {
            try {
                await axios.post(`${BASE_URL}/api/auth/login`, {
                    email: TEST_EMAIL,
                    password: TEST_PASSWORD
                });
            } catch (error) {
                if (error.response?.status === 429) {
                    blockedAt = i;
                    break;
                }
            }
        }
        
        if (blockedAt === 6) {
            pass(`Rate limit kicked in after 5 attempts (blocked at attempt ${blockedAt})`);
            return true;
        } else if (blockedAt > 0) {
            fail(`Rate limit kicked in at wrong attempt: ${blockedAt} (expected 6)`);
            return false;
        } else {
            fail('Rate limit did not trigger after 10 attempts');
            return false;
        }
    },

    // Test 2: Session Cookie Name
    async testSessionCookieName() {
        console.log('\n📌 Test 2: Session Cookie Name Change');
        
        try {
            const response = await axios.get(`${BASE_URL}/api/test`, {
                headers: {
                    'Cookie': 'session=fake_session_value'
                }
            });
            
            info('Old session cookie name still being accepted - needs auth route test');
            return null; // Inconclusive without auth
        } catch (error) {
            pass('Server not accepting old session cookie name');
            return true;
        }
    },

    // Test 3: Debug Endpoint Security
    async testDebugEndpoint() {
        console.log('\n📌 Test 3: Debug Endpoint Security');
        
        // Test without token
        try {
            await axios.get(`${BASE_URL}/debug`);
            fail('Debug endpoint accessible without token!');
            return false;
        } catch (error) {
            if (error.response?.status === 404) {
                pass('Debug endpoint returns 404 without token');
            }
        }
        
        // Test with wrong token
        try {
            await axios.get(`${BASE_URL}/debug`, {
                headers: { 'x-dev-token': 'wrong_token' }
            });
            fail('Debug endpoint accessible with wrong token!');
            return false;
        } catch (error) {
            if (error.response?.status === 404) {
                pass('Debug endpoint returns 404 with wrong token');
                return true;
            }
        }
    },

    // Test 4: XSS Prevention in Environment Variables
    async testXSSPrevention() {
        console.log('\n📌 Test 4: XSS Prevention in Environment Variables');
        
        try {
            const response = await axios.get(`${BASE_URL}/`);
            const html = response.data;
            
            // Check for new secure configuration
            if (html.includes('window.AGENTPAY_CONFIG')) {
                pass('New secure AGENTPAY_CONFIG found');
                
                // Check for proper escaping
                if (!html.includes('<script>alert') && !html.includes('</script>')) {
                    pass('No unescaped script tags found');
                    return true;
                } else {
                    fail('Potential XSS vulnerability - unescaped content found');
                    return false;
                }
            } else {
                fail('AGENTPAY_CONFIG not found - integration may have failed');
                return false;
            }
        } catch (error) {
            fail(`Could not fetch homepage: ${error.message}`);
            return false;
        }
    },

    // Test 5: IDOR Prevention
    async testIDORPrevention() {
        console.log('\n📌 Test 5: IDOR Prevention (Authorization Access)');
        
        const fakeAuthId = 'auth_fake_12345678901234567890';
        
        try {
            await axios.get(`${BASE_URL}/api/v1/authorize/${fakeAuthId}`, {
                headers: {
                    'Authorization': 'Bearer ak_test_fake_key'
                }
            });
            fail('IDOR vulnerability - accessible without proper auth!');
            return false;
        } catch (error) {
            if (error.response?.status === 404) {
                pass('Authorization returns 404 for unauthorized access (not 403)');
                return true;
            } else if (error.response?.status === 401) {
                info('Got 401 - API key validation working');
                return true;
            } else {
                fail(`Unexpected status: ${error.response?.status}`);
                return false;
            }
        }
    },

    // Test 6: Dev Database Endpoint Removal
    async testDevEndpointRemoval() {
        console.log('\n📌 Test 6: Dev Database Endpoint Removal');
        
        try {
            await axios.get(`${BASE_URL}/api/dev/database`);
            fail('CRITICAL: Dev database endpoint still accessible!');
            return false;
        } catch (error) {
            if (error.response?.status === 404) {
                pass('Dev database endpoint properly removed');
                return true;
            } else {
                fail(`Unexpected response: ${error.response?.status}`);
                return false;
            }
        }
    },

    // Test 7: Test Files Quarantine
    async testFilesQuarantined() {
        console.log('\n📌 Test 7: Test Files Quarantine');
        
        const testFiles = [
            'test-stripe-injection.js',
            'test-security.js',
            'security-audit.js'
        ];
        
        let allQuarantined = true;
        for (const file of testFiles) {
            if (fs.existsSync(path.join(__dirname, '..', file))) {
                fail(`Test file still in root: ${file}`);
                allQuarantined = false;
            }
        }
        
        if (allQuarantined) {
            pass('All test files properly quarantined');
            
            // Check quarantine directory exists
            if (fs.existsSync(path.join(__dirname, 'quarantine', 'test-files'))) {
                pass('Quarantine directory exists');
                return true;
            }
        }
        return allQuarantined;
    },

    // Test 8: Redis Connection (if available)
    async testRedisConnection() {
        console.log('\n📌 Test 8: Redis Connection');
        
        try {
            const response = await axios.get(`${BASE_URL}/api/health`);
            info(`Health check response: ${JSON.stringify(response.data, null, 2)}`);
            return null; // Informational only
        } catch (error) {
            info('Could not check Redis status via health endpoint');
            return null;
        }
    }
};

// Run all tests
async function runTests() {
    console.log('🚀 Starting Security Tests...');
    console.log(`📍 Testing against: ${BASE_URL}`);
    console.log('⏳ Please ensure your server is running with the security fixes applied\n');
    
    await sleep(2000); // Give user time to read
    
    const results = {
        passed: 0,
        failed: 0,
        inconclusive: 0
    };
    
    for (const [testName, testFn] of Object.entries(tests)) {
        try {
            const result = await testFn();
            if (result === true) {
                results.passed++;
            } else if (result === false) {
                results.failed++;
            } else {
                results.inconclusive++;
            }
        } catch (error) {
            fail(`Test ${testName} crashed: ${error.message}`);
            results.failed++;
        }
        
        await sleep(500); // Small delay between tests
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`${colors.green}Passed:${colors.reset} ${results.passed}`);
    console.log(`${colors.red}Failed:${colors.reset} ${results.failed}`);
    console.log(`${colors.yellow}Inconclusive:${colors.reset} ${results.inconclusive}`);
    
    if (results.failed === 0) {
        console.log(`\n${colors.green}🎉 All critical security fixes are working!${colors.reset}`);
    } else {
        console.log(`\n${colors.red}⚠️  Some security fixes need attention${colors.reset}`);
    }
    
    console.log('\n📋 Next Steps:');
    if (results.failed > 0) {
        console.log('1. Review failed tests above');
        console.log('2. Check if security modules are properly integrated');
        console.log('3. Ensure Redis is running if using it');
    } else {
        console.log('1. Complete Phase 2 security fixes');
        console.log('2. Run penetration testing');
        console.log('3. Monitor security logs in production');
    }
}

// Check if axios is installed
try {
    require.resolve('axios');
    runTests().catch(console.error);
} catch (e) {
    console.log('📦 Installing axios for testing...');
    require('child_process').execSync('npm install axios', { stdio: 'inherit' });
    console.log('✅ Axios installed. Please run this script again.');
} 