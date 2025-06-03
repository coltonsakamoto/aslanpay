#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔒 Applying Security Fixes to server.js...\n');

// Read current server.js
const serverPath = path.join(__dirname, '..', 'server.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');

// Backup original
const backupPath = path.join(__dirname, 'server.js.backup');
fs.writeFileSync(backupPath, serverContent);
console.log('✅ Created backup at security-fixes/server.js.backup');

// 1. Add security module imports after other requires
const securityImports = `
// Security modules
const SecureSessionManager = require('./security-fixes/new-middleware/secure-sessions');
const EnhancedRateLimiter = require('./security-fixes/new-middleware/enhanced-rate-limiting');

// Initialize Redis client (optional but recommended)
let redisClient = null;
if (process.env.REDIS_URL) {
    const redis = require('redis');
    redisClient = redis.createClient({
        url: process.env.REDIS_URL,
        socket: {
            reconnectStrategy: (retries) => Math.min(retries * 50, 500)
        }
    });
    
    redisClient.on('error', (err) => console.error('Redis Client Error', err));
    redisClient.connect().then(() => {
        console.log('✅ Redis connected for sessions and rate limiting');
    }).catch(err => {
        console.error('❌ Redis connection failed:', err);
        console.log('⚠️  Falling back to in-memory storage');
        redisClient = null;
    });
}

// Initialize security modules
const sessionManager = new SecureSessionManager(redisClient);
const rateLimiter = new EnhancedRateLimiter(redisClient);
`;

// Insert after the last require but before app initialization
const lastRequireIndex = serverContent.lastIndexOf("const RequestSigning = require('./middleware/request-signing');");
if (lastRequireIndex !== -1) {
    const insertPoint = serverContent.indexOf('\n', lastRequireIndex) + 1;
    serverContent = serverContent.slice(0, insertPoint) + securityImports + serverContent.slice(insertPoint);
    console.log('✅ Added security module imports');
}

// 2. Replace old session middleware
const oldSessionRegex = /app\.use\(session\(security\.getSessionConfig\(\)\)\);/;
if (oldSessionRegex.test(serverContent)) {
    serverContent = serverContent.replace(
        oldSessionRegex,
        '// Old session middleware replaced\n// app.use(session(security.getSessionConfig()));\n\n// New secure session middleware\napp.use(sessionManager.middleware());'
    );
    console.log('✅ Replaced session middleware');
}

// 3. Replace rate limiting
const oldRateLimitRegex = /const limiter = rateLimit[\s\S]*?app\.use\('\/api\/', limiter\);/;
if (oldRateLimitRegex.test(serverContent)) {
    const newRateLimiting = `// Old rate limiter replaced
// const limiter = rateLimit(security.getRateLimitConfig());
// app.use('/api/', limiter);

// New endpoint-specific rate limiting
app.use('/api/auth/login', rateLimiter.getMiddleware('login'));
app.use('/api/auth/register', rateLimiter.compound('login', 'public'));
app.use('/api/auth/forgot-password', rateLimiter.getMiddleware('passwordReset'));
app.use('/api/auth/reset-password', rateLimiter.getMiddleware('passwordReset'));
app.use('/api/keys', rateLimiter.getMiddleware('apiKeyCreation'));
app.use('/api/v1/authorize', rateLimiter.getMiddleware('paymentAuth'));
app.use('/api/webhook', rateLimiter.getMiddleware('webhook'));
app.use('/api/', rateLimiter.getMiddleware('api'));

// Add adaptive rate limiting
app.use(rateLimiter.adaptive());`;
    
    serverContent = serverContent.replace(oldRateLimitRegex, newRateLimiting);
    console.log('✅ Replaced rate limiting configuration');
}

// 4. Update JWT session handling to use new session system
// Update the test-session endpoint
const testSessionRegex = /const token = req\.cookies\?\.session;/g;
serverContent = serverContent.replace(testSessionRegex, 'const token = req.cookies?.agentpay_session;');

// Update direct endpoints
const directEndpointRegex = /const token = req\.cookies\?\.session;/g;
serverContent = serverContent.replace(directEndpointRegex, 'const token = req.cookies?.agentpay_session;');

console.log('✅ Updated session cookie references');

// 5. Write updated server.js
fs.writeFileSync(serverPath, serverContent);
console.log('✅ Updated server.js with security fixes');

// 6. Create .env template
const envTemplate = `# Security Configuration - Add these to your .env file

# Generated secure tokens (CHANGE THESE!)
DEV_DEBUG_TOKEN=${require('crypto').randomBytes(32).toString('hex')}
SESSION_SECRET=${require('crypto').randomBytes(32).toString('hex')}
JWT_SECRET=${require('crypto').randomBytes(32).toString('hex')}

# Redis Configuration (optional but recommended for production)
REDIS_URL=redis://localhost:6379

# Session Configuration
SESSION_TTL=604800
SESSION_COOKIE_NAME=agentpay_session
SESSION_REGENERATE_ON_LOGIN=true

# Rate Limiting
RATE_LIMIT_REDIS_PREFIX=agentpay_rl:

# CORS Origins (update for production)
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
`;

const envPath = path.join(__dirname, '..', '.env.security-template');
fs.writeFileSync(envPath, envTemplate);
console.log('\n✅ Created .env.security-template with required variables');

console.log('\n📋 Next steps:');
console.log('1. Stop your current server (kill process 3888)');
console.log('2. Copy values from .env.security-template to your .env file');
console.log('3. Start Redis: docker run -d -p 6379:6379 redis:alpine');
console.log('4. Restart your server: npm start');
console.log('5. Run security tests: node security-fixes/test-security-fixes.js');

console.log('\n⚠️  IMPORTANT: The generated tokens in .env.security-template are secure but should be regenerated for production!'); 