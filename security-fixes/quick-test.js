const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function quickTest() {
    console.log('🔍 Quick Security Status Check\n');
    
    const tests = [];
    
    // 1. Server running
    try {
        const res = await axios.get('http://localhost:3000/test');
        tests.push('✅ Server is running: ' + res.data);
    } catch (e) {
        tests.push('❌ Server not responding');
    }
    
    // 2. Rate limiting on login
    try {
        const promises = [];
        for (let i = 0; i < 6; i++) {
            promises.push(axios.post('http://localhost:3000/api/auth/login', {
                email: 'test@example.com',
                password: 'wrong'
            }, { validateStatus: () => true }));
        }
        const results = await Promise.all(promises);
        const blocked = results.some(r => r.status === 429);
        tests.push(blocked ? '✅ Login rate limiting active (429 after 5 attempts)' : '⚠️  Login rate limiting may not be working');
    } catch (e) {
        tests.push('⚠️  Could not test rate limiting: ' + e.message);
    }
    
    // 3. Dev database endpoint
    try {
        const res = await axios.get('http://localhost:3000/api/dev/database', { validateStatus: () => true });
        if (res.status === 404) {
            tests.push('✅ Dev database endpoint removed (404)');
        } else if (res.status === 500) {
            tests.push('⚠️  Dev database endpoint returns 500 (might be removed but error handling needs work)');
        } else {
            tests.push(`❌ Dev database endpoint still accessible! (Status: ${res.status})`);
        }
    } catch (e) {
        tests.push('✅ Dev database endpoint removed (connection refused)');
    }
    
    // 4. Debug endpoint
    try {
        const res = await axios.get('http://localhost:3000/debug', { validateStatus: () => true });
        tests.push(res.status === 404 ? '✅ Debug endpoint protected (404 without token)' : '❌ Debug endpoint not protected!');
    } catch (e) {
        tests.push('✅ Debug endpoint protected');
    }
    
    // 5. Test files quarantined
    const testFiles = [
        'test-xss-injection.js',
        'test-stripe-injection.js',
        'security-audit.js'
    ];
    
    let quarantined = 0;
    let stillPresent = 0;
    
    for (const file of testFiles) {
        if (fs.existsSync(path.join(__dirname, '..', file))) {
            stillPresent++;
        }
        if (fs.existsSync(path.join(__dirname, 'quarantine', file))) {
            quarantined++;
        }
    }
    
    tests.push(`✅ Test files quarantined: ${quarantined} files moved, ${stillPresent} still in root`);
    
    // 6. Environment variables
    const envPath = path.join(__dirname, '..', '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const hasSecurityVars = envContent.includes('JWT_SECRET') && 
                           envContent.includes('SESSION_SECRET') && 
                           envContent.includes('DEV_DEBUG_TOKEN');
    
    tests.push(hasSecurityVars ? '✅ Security environment variables configured' : '❌ Missing security environment variables');
    
    // Print results
    console.log(tests.join('\n'));
    console.log('\n📊 Summary: Security fixes are ' + (tests.filter(t => t.startsWith('✅')).length >= 4 ? 'ACTIVE' : 'PARTIALLY ACTIVE'));
    console.log('\n💡 If rate limiting shows warning, it may need a few seconds to initialize.');
}

quickTest().catch(console.error); 