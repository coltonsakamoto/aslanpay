#!/usr/bin/env node

const SecurityTests = require('./security-tests');

console.log('🔐 Starting Security Test Suite...\n');
console.log('📋 Make sure your server is running on http://localhost:3000\n');

const tester = new SecurityTests();

// Add timeout to prevent hanging
const timeout = setTimeout(() => {
    console.error('\n⏱️  Tests timed out after 30 seconds');
    process.exit(1);
}, 30000);

tester.runAllTests()
    .then(() => {
        clearTimeout(timeout);
        
        // Exit with appropriate code
        const score = Math.round((tester.testResults.passed / (tester.testResults.passed + tester.testResults.failed)) * 100);
        
        if (score === 100) {
            console.log('\n🎉 PERFECT SECURITY SCORE ACHIEVED! 🎉');
            process.exit(0);
        } else {
            console.log(`\n💪 Security score: ${score}% - Keep improving!`);
            process.exit(1);
        }
    })
    .catch((error) => {
        clearTimeout(timeout);
        console.error('\n❌ Test suite error:', error);
        process.exit(1);
    }); 