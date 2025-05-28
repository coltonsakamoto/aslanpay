#!/usr/bin/env node

/**
 * Security Validation Script
 * Run this before deploying to production to validate security configuration
 */

require('dotenv').config();
const security = require('../config/security');
const crypto = require('crypto');

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

function colorize(text, color) {
    return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(title) {
    console.log('');
    console.log(colorize('='.repeat(60), 'cyan'));
    console.log(colorize(`  ${title}`, 'bold'));
    console.log(colorize('='.repeat(60), 'cyan'));
}

function printSection(title) {
    console.log('');
    console.log(colorize(`📋 ${title}`, 'blue'));
    console.log('-'.repeat(40));
}

function printSuccess(message) {
    console.log(colorize(`✅ ${message}`, 'green'));
}

function printWarning(message) {
    console.log(colorize(`⚠️  ${message}`, 'yellow'));
}

function printError(message) {
    console.log(colorize(`❌ ${message}`, 'red'));
}

function printInfo(message) {
    console.log(colorize(`ℹ️  ${message}`, 'cyan'));
}

async function validateSecurity() {
    let hasErrors = false;
    let hasWarnings = false;

    printHeader('AgentPay Security Validation');
    
    // Environment validation
    printSection('Environment Variables');
    const envValidation = security.validateEnvironment();
    
    if (envValidation.errors.length === 0) {
        printSuccess('All required environment variables are present');
    } else {
        hasErrors = true;
        envValidation.errors.forEach(error => printError(error));
    }
    
    if (envValidation.warnings.length > 0) {
        hasWarnings = true;
        envValidation.warnings.forEach(warning => printWarning(warning));
    }

    // Secret strength validation
    printSection('Secret Strength Analysis');
    
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret) {
        if (jwtSecret.length >= 64) {
            printSuccess(`JWT_SECRET is strong (${jwtSecret.length} characters)`);
        } else if (jwtSecret.length >= 32) {
            printWarning(`JWT_SECRET is acceptable but could be stronger (${jwtSecret.length} characters)`);
            hasWarnings = true;
        } else {
            printError(`JWT_SECRET is too weak (${jwtSecret.length} characters, minimum 32)`);
            hasErrors = true;
        }

        // Check if secret has good entropy
        const entropy = calculateEntropy(jwtSecret);
        if (entropy >= 4.0) {
            printSuccess(`JWT_SECRET has good entropy (${entropy.toFixed(2)} bits per character)`);
        } else {
            printWarning(`JWT_SECRET has low entropy (${entropy.toFixed(2)} bits per character)`);
            hasWarnings = true;
        }
    }

    const sessionSecret = process.env.SESSION_SECRET;
    if (sessionSecret && sessionSecret !== jwtSecret) {
        if (sessionSecret.length >= 32) {
            printSuccess(`SESSION_SECRET is strong (${sessionSecret.length} characters)`);
        } else {
            printError(`SESSION_SECRET is too weak (${sessionSecret.length} characters, minimum 32)`);
            hasErrors = true;
        }
    } else if (sessionSecret === jwtSecret) {
        printWarning('SESSION_SECRET is the same as JWT_SECRET (should be different)');
        hasWarnings = true;
    }

    // Production-specific checks
    if (process.env.NODE_ENV === 'production') {
        printSection('Production Security Checks');
        
        // CORS origins
        if (process.env.CORS_ORIGINS) {
            const origins = process.env.CORS_ORIGINS.split(',');
            printSuccess(`CORS origins configured (${origins.length} domains)`);
            origins.forEach(origin => {
                if (origin.trim().startsWith('https://')) {
                    printSuccess(`  • ${origin.trim()} (HTTPS)`);
                } else {
                    printError(`  • ${origin.trim()} (not HTTPS)`);
                    hasErrors = true;
                }
            });
        } else {
            printError('CORS_ORIGINS not configured for production');
            hasErrors = true;
        }

        // Database URL
        if (process.env.DATABASE_URL) {
            if (process.env.DATABASE_URL.startsWith('postgresql://')) {
                printSuccess('Database URL configured for PostgreSQL');
            } else {
                printWarning('Database URL is not PostgreSQL (recommended for production)');
                hasWarnings = true;
            }
        }

        // Stripe keys
        if (process.env.STRIPE_SECRET_KEY) {
            if (process.env.STRIPE_SECRET_KEY.startsWith('sk_live_')) {
                printSuccess('Stripe live secret key configured');
            } else {
                printWarning('Stripe test key detected in production environment');
                hasWarnings = true;
            }
        }

        if (process.env.STRIPE_WEBHOOK_SECRET) {
            printSuccess('Stripe webhook secret configured');
        } else {
            printWarning('Stripe webhook secret not configured');
            hasWarnings = true;
        }
    }

    // Security features check
    printSection('Security Features');
    const report = security.getSecurityReport();
    
    Object.entries(report.features).forEach(([feature, enabled]) => {
        if (enabled) {
            printSuccess(`${feature}: enabled`);
        } else {
            printWarning(`${feature}: disabled`);
            hasWarnings = true;
        }
    });

    // Rate limiting check
    printSection('Rate Limiting Configuration');
    const rateLimitConfig = security.getRateLimitConfig();
    printInfo(`Window: ${rateLimitConfig.windowMs / 1000 / 60} minutes`);
    printInfo(`Max requests: ${rateLimitConfig.max} per window`);
    
    if (rateLimitConfig.max > 1000) {
        printWarning('Rate limit might be too high for production');
        hasWarnings = true;
    } else {
        printSuccess('Rate limiting configured appropriately');
    }

    // Security recommendations
    printSection('Security Recommendations');
    report.recommendations.forEach(rec => {
        printInfo(rec);
    });

    // Additional security recommendations
    if (process.env.NODE_ENV === 'production') {
        printInfo('Consider implementing:');
        printInfo('• Web Application Firewall (WAF)');
        printInfo('• DDoS protection (Cloudflare, AWS Shield)');
        printInfo('• Monitoring and alerting (DataDog, New Relic)');
        printInfo('• Regular security audits and penetration testing');
        printInfo('• Backup and disaster recovery procedures');
    }

    // Summary
    printHeader('Security Validation Summary');
    
    if (hasErrors) {
        printError('❌ SECURITY VALIDATION FAILED');
        printError('Fix all errors before deploying to production');
        console.log('');
        process.exit(1);
    } else if (hasWarnings) {
        printWarning('⚠️  SECURITY VALIDATION PASSED WITH WARNINGS');
        printWarning('Consider addressing warnings for better security');
        console.log('');
        process.exit(0);
    } else {
        printSuccess('✅ SECURITY VALIDATION PASSED');
        printSuccess('Your application is ready for production deployment');
        console.log('');
        process.exit(0);
    }
}

function calculateEntropy(str) {
    const freq = {};
    str.split('').forEach(char => {
        freq[char] = (freq[char] || 0) + 1;
    });
    
    let entropy = 0;
    const len = str.length;
    
    Object.values(freq).forEach(count => {
        const p = count / len;
        entropy -= p * Math.log2(p);
    });
    
    return entropy;
}

// Generate secure secrets helper
function generateSecrets() {
    printHeader('Generate Secure Secrets');
    console.log('Copy these secure secrets to your .env file:');
    console.log('');
    console.log(colorize('JWT_SECRET=', 'cyan') + security.generateSecureSecret(64));
    console.log(colorize('SESSION_SECRET=', 'cyan') + security.generateSecureSecret(64));
    console.log('');
}

// Command line interface
const args = process.argv.slice(2);

if (args.includes('--generate-secrets')) {
    generateSecrets();
} else if (args.includes('--help')) {
    console.log('AgentPay Security Validation Tool');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/validate-security.js              # Run security validation');
    console.log('  node scripts/validate-security.js --generate-secrets  # Generate secure secrets');
    console.log('  node scripts/validate-security.js --help       # Show this help');
    console.log('');
} else {
    validateSecurity().catch(error => {
        printError(`Validation failed: ${error.message}`);
        process.exit(1);
    });
} 