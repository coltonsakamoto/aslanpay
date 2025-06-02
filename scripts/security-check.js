#!/usr/bin/env node

/**
 * Security Check Script for Aslan
 * Validates JWT secrets and scans for security issues
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ANSI color codes
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function colorize(text, color) {
    return colors[color] + text + colors.reset;
}

function printSuccess(message) {
    console.log(colorize('✅ ' + message, 'green'));
}

function printError(message) {
    console.log(colorize('❌ ' + message, 'red'));
}

function printWarning(message) {
    console.log(colorize('⚠️  ' + message, 'yellow'));
}

function printInfo(message) {
    console.log(colorize('ℹ️  ' + message, 'blue'));
}

// Weak patterns that should never appear in code
const WEAK_PATTERNS = [
    'your-jwt-secret',
    'your_jwt_secret',
    'jwt-secret-change',
    'your-super-secure-jwt-secret',
    'test-jwt-secret',
    'dev-jwt-secret',
    'development-secret',
    'password123',
    'secret123',
    'jwt123'
];

// Files to scan for weak patterns
const FILES_TO_SCAN = [
    'server.js',
    'middleware/auth.js',
    'agent-wallet/src/index.ts',
    'agent-wallet/src/services/scopedTokenService.ts',
    'config/security.js'
];

function scanFileForWeakSecrets(filePath) {
    if (!fs.existsSync(filePath)) {
        printWarning(`File not found: ${filePath}`);
        return false;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    let foundIssues = false;

    for (const pattern of WEAK_PATTERNS) {
        if (content.toLowerCase().includes(pattern.toLowerCase())) {
            printError(`Weak secret pattern found in ${filePath}: "${pattern}"`);
            foundIssues = true;
        }
    }

    return foundIssues;
}

function validateJWTSecret() {
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
        printError('JWT_SECRET environment variable not set');
        return false;
    }

    if (jwtSecret.length < 32) {
        printError(`JWT_SECRET too short: ${jwtSecret.length} characters (minimum 32)`);
        return false;
    }

    if (jwtSecret.length < 64) {
        printWarning(`JWT_SECRET could be stronger: ${jwtSecret.length} characters (recommended 64+)`);
    } else {
        printSuccess(`JWT_SECRET length is strong: ${jwtSecret.length} characters`);
    }

    // Check for weak patterns in the actual secret
    for (const pattern of WEAK_PATTERNS) {
        if (jwtSecret.toLowerCase().includes(pattern.toLowerCase())) {
            printError(`JWT_SECRET contains weak pattern: "${pattern}"`);
            return false;
        }
    }

    // Calculate entropy
    const entropy = calculateEntropy(jwtSecret);
    if (entropy > 4.0) {
        printSuccess(`JWT_SECRET has good entropy: ${entropy.toFixed(2)} bits per character`);
    } else {
        printWarning(`JWT_SECRET has low entropy: ${entropy.toFixed(2)} bits per character`);
    }

    return true;
}

function calculateEntropy(str) {
    const freq = {};
    for (let char of str) {
        freq[char] = (freq[char] || 0) + 1;
    }
    
    let entropy = 0;
    const len = str.length;
    
    for (let char in freq) {
        const p = freq[char] / len;
        entropy -= p * Math.log2(p);
    }
    
    return entropy;
}

function generateSecureSecret(length = 64) {
    return crypto.randomBytes(length / 2).toString('hex');
}

function main() {
    console.log(colorize('\n🔒 ASLAN SECURITY CHECK', 'bold'));
    console.log(colorize('========================\n', 'bold'));

    let hasIssues = false;

    // 1. Scan files for weak patterns
    printInfo('Scanning files for weak secret patterns...');
    for (const file of FILES_TO_SCAN) {
        if (scanFileForWeakSecrets(file)) {
            hasIssues = true;
        }
    }

    if (!hasIssues) {
        printSuccess('No weak secret patterns found in code files');
    }

    // 2. Validate environment JWT secret
    printInfo('\nValidating JWT_SECRET environment variable...');
    if (!validateJWTSecret()) {
        hasIssues = true;
    }

    // 3. Summary and recommendations
    console.log(colorize('\n📋 SECURITY SUMMARY', 'bold'));
    console.log(colorize('==================\n', 'bold'));

    if (hasIssues) {
        printError('Security issues found! Please fix before deploying.');
        console.log('\n' + colorize('🔧 RECOMMENDED ACTIONS:', 'yellow'));
        console.log('1. Generate a new JWT secret:');
        console.log(colorize('   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"', 'cyan'));
        console.log('2. Set it in your environment:');
        console.log(colorize('   export JWT_SECRET=<generated_secret>', 'cyan'));
        console.log('3. Update Railway environment variables');
        console.log('4. Remove any weak patterns from code');
        
        process.exit(1);
    } else {
        printSuccess('All security checks passed!');
        console.log('\n' + colorize('🛡️  Security recommendations:', 'blue'));
        console.log('• Rotate secrets regularly (every 90 days)');
        console.log('• Use different secrets for different environments');
        console.log('• Monitor for unauthorized access');
        console.log('• Keep dependencies updated');
    }

    console.log('\n' + colorize('🔐 Generate new secrets:', 'cyan'));
    console.log('Run these commands to generate secure secrets:');
    console.log('node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"  # For JWT_SECRET');
    console.log('node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"  # For SESSION_SECRET');
}

if (require.main === module) {
    main();
}

module.exports = {
    scanFileForWeakSecrets,
    validateJWTSecret,
    generateSecureSecret,
    calculateEntropy
}; 