#!/usr/bin/env node

/**
 * AgentPay Security Audit Script
 * =============================
 * 
 * Comprehensive security scan for hardcoded secrets, exposed credentials,
 * and security vulnerabilities in the AgentPay codebase.
 * 
 * Usage: node security-audit.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SecurityAuditor {
  constructor() {
    this.vulnerabilities = [];
    this.scannedFiles = 0;
    
    // Define sensitive patterns to detect
    this.sensitivePatterns = [
      {
        name: 'Stripe Secret Key',
        pattern: /sk_(test|live)_[a-zA-Z0-9]{24,}/g,
        severity: 'CRITICAL',
        description: 'Hardcoded Stripe secret key detected'
      },
      {
        name: 'Stripe Publishable Key',
        pattern: /pk_(test|live)_[a-zA-Z0-9]{24,}/g,
        severity: 'HIGH',
        description: 'Hardcoded Stripe publishable key detected'
      },
      {
        name: 'AWS Access Key',
        pattern: /AKIA[0-9A-Z]{16}/g,
        severity: 'CRITICAL',
        description: 'AWS access key detected'
      },
      {
        name: 'AWS Secret Key',
        pattern: /[A-Za-z0-9/+=]{40}/g,
        severity: 'HIGH',
        description: 'Potential AWS secret key detected'
      },
      {
        name: 'Lightning Macaroon',
        pattern: /0201[a-f0-9]{100,}/gi,
        severity: 'CRITICAL',
        description: 'Lightning Network macaroon detected'
      },
      {
        name: 'Credit Card Number',
        pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
        severity: 'CRITICAL',
        description: 'Credit card number detected'
      },
      {
        name: 'JWT Token (hardcoded)',
        pattern: /eyJ[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+/g,
        severity: 'HIGH',
        description: 'Hardcoded JWT token detected'
      },
      {
        name: 'Database URL with credentials',
        pattern: /(postgresql|mysql|mongodb):\/\/[^:\s]+:[^@\s]+@[^\s]+/g,
        severity: 'HIGH',
        description: 'Database URL with embedded credentials'
      },
      {
        name: 'Private Key',
        pattern: /-----BEGIN (RSA )?PRIVATE KEY-----/g,
        severity: 'CRITICAL',
        description: 'Private key detected'
      },
      {
        name: 'API Key Pattern',
        pattern: /['"](api[_-]?key|apikey)['"]\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/gi,
        severity: 'HIGH',
        description: 'Hardcoded API key detected'
      }
    ];
    
    // Files to exclude from scanning
    this.excludePatterns = [
      /node_modules/,
      /\.git/,
      /\.DS_Store/,
      /\.env\.example/,
      /security-audit\.js/,
      /\.log$/,
      /\.png$/,
      /\.jpg$/,
      /\.jpeg$/,
      /\.gif$/,
      /\.ico$/,
      /\.svg$/,
      /package-lock\.json$/,
      /yarn\.lock$/
    ];
    
    // Files to include (only text files)
    this.includeExtensions = [
      '.js', '.ts', '.json', '.env', '.md', '.txt', '.yml', '.yaml', 
      '.toml', '.ini', '.conf', '.config', '.sh', '.py', '.php'
    ];
  }
  
  shouldScanFile(filePath) {
    // Check exclude patterns
    for (const pattern of this.excludePatterns) {
      if (pattern.test(filePath)) {
        return false;
      }
    }
    
    // Check if it's a text file
    const ext = path.extname(filePath).toLowerCase();
    return this.includeExtensions.includes(ext) || !ext;
  }
  
  scanFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      this.scannedFiles++;
      
      // Check each sensitive pattern
      for (const patternDef of this.sensitivePatterns) {
        const matches = content.match(patternDef.pattern);
        
        if (matches) {
          // Find line numbers for each match
          matches.forEach(match => {
            const lineIndex = lines.findIndex(line => line.includes(match));
            
            // Special handling for certain patterns
            const isLegitimate = this.isLegitimateUsage(filePath, match, lines[lineIndex]);
            
            if (!isLegitimate) {
              this.vulnerabilities.push({
                file: filePath,
                line: lineIndex + 1,
                pattern: patternDef.name,
                severity: patternDef.severity,
                description: patternDef.description,
                match: this.redactSensitiveData(match),
                context: lines[lineIndex]?.trim()
              });
            }
          });
        }
      }
      
    } catch (error) {
      console.warn(`Warning: Could not scan ${filePath}: ${error.message}`);
    }
  }
  
  isLegitimateUsage(filePath, match, context) {
    // Allow examples in documentation
    if (filePath.includes('.md') || filePath.includes('README')) {
      if (context && (
        context.includes('example') ||
        context.includes('sk_test_***') ||
        context.includes('your_key_here') ||
        context.includes('placeholder')
      )) {
        return true;
      }
    }
    
    // Allow environment variable examples
    if (filePath.includes('env-example') || filePath.includes('.env.example')) {
      return true;
    }
    
    // Allow test patterns that are clearly examples
    if (match.includes('sk_test_***') || match.includes('pk_test_***')) {
      return true;
    }
    
    // Allow documented regex patterns
    if (context && context.includes('pattern') && context.includes('/')) {
      return true;
    }
    
    return false;
  }
  
  redactSensitiveData(data) {
    if (data.length <= 10) return data;
    return data.substring(0, 8) + '***' + data.substring(data.length - 4);
  }
  
  scanDirectory(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          this.scanDirectory(fullPath);
        } else if (entry.isFile() && this.shouldScanFile(fullPath)) {
          this.scanFile(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not scan directory ${dir}: ${error.message}`);
    }
  }
  
  generateReport() {
    console.log('\n🔒 **AGENTPAY SECURITY AUDIT REPORT**');
    console.log('=' * 50);
    console.log(`📁 Files scanned: ${this.scannedFiles}`);
    console.log(`🚨 Vulnerabilities found: ${this.vulnerabilities.length}\n`);
    
    if (this.vulnerabilities.length === 0) {
      console.log('✅ **NO SECURITY VULNERABILITIES DETECTED**');
      console.log('🎉 All sensitive data appears to be properly secured!\n');
      return true;
    }
    
    // Group by severity
    const critical = this.vulnerabilities.filter(v => v.severity === 'CRITICAL');
    const high = this.vulnerabilities.filter(v => v.severity === 'HIGH');
    const medium = this.vulnerabilities.filter(v => v.severity === 'MEDIUM');
    
    if (critical.length > 0) {
      console.log('🚨 **CRITICAL VULNERABILITIES**');
      console.log('-' * 40);
      critical.forEach(vuln => this.printVulnerability(vuln));
      console.log('');
    }
    
    if (high.length > 0) {
      console.log('⚠️ **HIGH SEVERITY VULNERABILITIES**');
      console.log('-' * 40);
      high.forEach(vuln => this.printVulnerability(vuln));
      console.log('');
    }
    
    if (medium.length > 0) {
      console.log('⚡ **MEDIUM SEVERITY VULNERABILITIES**');
      console.log('-' * 40);
      medium.forEach(vuln => this.printVulnerability(vuln));
      console.log('');
    }
    
    // Recommendations
    console.log('🔧 **IMMEDIATE ACTIONS REQUIRED**');
    console.log('-' * 40);
    
    if (critical.length > 0) {
      console.log('1. 🚨 Fix CRITICAL vulnerabilities immediately');
      console.log('   - Move hardcoded secrets to environment variables');
      console.log('   - Rotate any exposed credentials');
      console.log('   - Review commit history for leaked secrets');
    }
    
    if (high.length > 0) {
      console.log('2. ⚠️ Address HIGH severity issues before production');
      console.log('   - Implement proper secret management');
      console.log('   - Use .env files for configuration');
      console.log('   - Add .env to .gitignore');
    }
    
    console.log('3. 🔐 Security best practices:');
    console.log('   - Use environment variables for all secrets');
    console.log('   - Implement secret scanning in CI/CD');
    console.log('   - Regular security audits');
    console.log('   - Principle of least privilege');
    
    return false; // Vulnerabilities found
  }
  
  printVulnerability(vuln) {
    console.log(`   📄 ${vuln.file}:${vuln.line}`);
    console.log(`   🔍 ${vuln.pattern}: ${vuln.description}`);
    console.log(`   💀 Match: ${vuln.match}`);
    console.log(`   📝 Context: ${vuln.context}`);
    console.log('');
  }
  
  audit(directory = '.') {
    console.log('🔒 Starting AgentPay Security Audit...');
    console.log(`📁 Scanning directory: ${path.resolve(directory)}\n`);
    
    this.scanDirectory(directory);
    return this.generateReport();
  }
}

// Environment variable check
function checkEnvironmentSecurity() {
  console.log('🌍 **ENVIRONMENT VARIABLE SECURITY CHECK**');
  console.log('=' * 50);
  
  const requiredSecrets = [
    'STRIPE_SECRET_KEY',
    'JWT_SECRET',
    'DATABASE_URL'
  ];
  
  const optionalSecrets = [
    'LN_MACAROON',
    'LN_SOCKET',
    'OPENAI_API_KEY'
  ];
  
  let allGood = true;
  
  console.log('📋 Required environment variables:');
  for (const secret of requiredSecrets) {
    const value = process.env[secret];
    if (!value) {
      console.log(`   ❌ ${secret}: NOT SET`);
      allGood = false;
    } else if (value.includes('your_key_here') || value.includes('example')) {
      console.log(`   ⚠️ ${secret}: PLACEHOLDER VALUE`);
      allGood = false;
    } else {
      console.log(`   ✅ ${secret}: CONFIGURED`);
    }
  }
  
  console.log('\n📋 Optional environment variables:');
  for (const secret of optionalSecrets) {
    const value = process.env[secret];
    if (!value) {
      console.log(`   ⚪ ${secret}: Not set (optional)`);
    } else {
      console.log(`   ✅ ${secret}: CONFIGURED`);
    }
  }
  
  if (allGood) {
    console.log('\n✅ Environment security looks good!');
  } else {
    console.log('\n❌ Environment security issues detected!');
    console.log('Please configure missing environment variables.');
  }
  
  console.log('');
  return allGood;
}

// Main execution
if (require.main === module) {
  const auditor = new SecurityAuditor();
  
  // Check environment first
  const envSecure = checkEnvironmentSecurity();
  
  // Run file system audit
  const filesSecure = auditor.audit();
  
  // Overall result
  if (envSecure && filesSecure) {
    console.log('🎉 **SECURITY AUDIT PASSED**');
    console.log('✅ AgentPay codebase is secure and ready for production!');
    process.exit(0);
  } else {
    console.log('🚨 **SECURITY AUDIT FAILED**');
    console.log('❌ Critical security issues must be fixed before deployment!');
    process.exit(1);
  }
}

module.exports = SecurityAuditor; 