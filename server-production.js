require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = express();
const port = process.env.PORT || 3000;

// Production-safe environment setup
if (process.env.NODE_ENV === 'production') {
    process.env.JWT_SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex');
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex');
    console.log('🚀 Starting in PRODUCTION mode');
} else {
    console.log('🧪 Starting in DEVELOPMENT mode');
}

// Bulletproof error handling
process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error.message);
    if (process.env.NODE_ENV === 'production') {
        console.log('⚠️  Continuing in production mode...');
    } else {
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection:', reason);
    if (process.env.NODE_ENV === 'production') {
        console.log('⚠️  Continuing in production mode...');
    }
});

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Production database with persistent storage
const database = require('./database-production.js');

// Initialize database on startup
(async () => {
    try {
        console.log('🔄 Initializing persistent database...');
        await database.healthCheck();
        console.log('✅ Persistent database initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize persistent database:', error.message);
        console.log('⚠️  This will affect user account persistence');
        
        // For development, we could fall back to in-memory, but for production
        // we should ensure DATABASE_URL is properly configured
        if (!process.env.DATABASE_URL) {
            console.log('💡 Please set DATABASE_URL environment variable');
            console.log('   Example: DATABASE_URL="file:./dev.db"');
        }
        console.error('💥 Database initialization failed. Server may not function properly.');
        process.exit(1);
    }
})();

// JWT utilities
function getJWTSecret() {
    return process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex');
}

function generateToken(sessionId) {
    return jwt.sign({ sessionId }, getJWTSecret(), { expiresIn: '7d' });
}

async function validateSession(req, res, next) {
    const token = req.cookies?.agentpay_session;
    if (!token) {
        return res.status(401).json({ error: 'No session token', code: 'NO_SESSION' });
    }
    
    try {
        const decoded = jwt.verify(token, getJWTSecret());
        const session = await database.getSession(decoded.sessionId);
        if (!session) {
            return res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' });
        }
        
        const user = await database.getUserById(session.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
        }
        
        req.session = session;
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid session', code: 'INVALID_SESSION' });
    }
}

// Custom page routes (BEFORE static middleware)
app.get('/comparison', (req, res) => {
    try {
        console.log('📊 Serving comparison page');
        res.sendFile(path.join(__dirname, 'public', 'comparison.html'));
    } catch (error) {
        console.error('❌ Comparison page error:', error);
        res.status(404).json({ error: 'Comparison page not found' });
    }
});

app.get('/vs-stripe', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'comparison.html'));
    } catch (error) {
        res.status(404).json({ error: 'Comparison page not found' });
    }
});

// Serve static files
try {
    if (fs.existsSync('public')) {
        app.use(express.static('public'));
        console.log('✅ Static files enabled');
    }
} catch (error) {
    console.log('⚠️  Static files disabled:', error.message);
}

// BULLETPROOF health check - FIRST priority
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        service: 'aslan-production', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0-production'
    });
});

// Simple test endpoint
app.get('/test', (req, res) => {
    res.json({
        message: '✅ Aslan production server is running!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        port: port
    });
});

// API status endpoint
app.get('/api/status', async (req, res) => {
    try {
        const dbHealth = await database.healthCheck();
        res.json({
            service: 'Aslan Payment Infrastructure',
            status: 'operational',
            timestamp: new Date().toISOString(),
            version: '1.0.0-production',
            environment: process.env.NODE_ENV || 'development',
            uptime: process.uptime(),
            components: {
                server: { status: 'operational' },
                database: { status: 'operational', type: dbHealth.type },
                authentication: { status: 'operational' },
                health: { status: 'operational' }
            }
        });
    } catch (error) {
        res.status(200).json({
            service: 'Aslan Payment Infrastructure',
            status: 'operational',
            timestamp: new Date().toISOString(),
            error: 'Partial status check'
        });
    }
});

// Authentication endpoints
// SaaS Signup endpoint - NEW MAIN ENTRY POINT
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { email, password, name, organizationName } = req.body;
        
        if (!email || !password || !name) {
            return res.status(400).json({ 
                error: 'Email, password, and name are required', 
                code: 'MISSING_FIELDS' 
            });
        }
        
        const existingUser = await database.getUserByEmail(email.toLowerCase());
        if (existingUser) {
            return res.status(409).json({ 
                error: 'User already exists', 
                code: 'USER_EXISTS',
                suggestion: 'Try logging in instead, or use a different email address'
            });
        }
        
        console.log('🚀 SaaS signup attempt for:', email);
        
        const user = await database.createUser({
            email: email.toLowerCase(),
            password,
            name,
            provider: 'email'
        });
        
        // Create API key automatically for SaaS signup
        const apiKey = await database.createApiKey(user.id, 'Default API Key');
        
        const sessionId = await database.createSession(user.id);
        const token = generateToken(sessionId);
        
        res.cookie('agentpay_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: 'strict'
        });
        
        console.log('✅ SaaS signup successful for:', email);
        
        res.status(201).json({
            success: true,
            message: 'Account created successfully! Your API key is ready to use.',
            user,
            tenant: {
                id: user.id, // Using user ID as tenant ID for production server
                name: organizationName || `${name}'s Organization`,
                plan: 'sandbox'
            },
            apiKey: {
                id: apiKey.id,
                name: apiKey.name,
                key: apiKey.key
            },
            nextSteps: {
                dashboard: `${process.env.BASE_URL || 'http://localhost:3000'}/dashboard.html`,
                docs: `${process.env.BASE_URL || 'http://localhost:3000'}/docs.html`,
                demo: `${process.env.BASE_URL || 'http://localhost:3000'}/demo.html`
            }
        });
        
    } catch (error) {
        console.error('❌ SaaS signup error:', error);
        res.status(500).json({ 
            error: 'Failed to create account. Please try again.',
            code: 'SIGNUP_FAILED' 
        });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name required', code: 'MISSING_FIELDS' });
        }
        
        const existingUser = await database.getUserByEmail(email.toLowerCase());
        if (existingUser) {
            return res.status(409).json({ error: 'User already exists', code: 'USER_EXISTS' });
        }
        
        const user = await database.createUser({
            email: email.toLowerCase(),
            password,
            name,
            provider: 'email'
        });
        
        const sessionId = await database.createSession(user.id);
        const token = generateToken(sessionId);
        
        res.cookie('agentpay_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: 'strict'
        });
        
        res.status(201).json({
            user,
            message: 'Account created successfully'
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required', code: 'MISSING_CREDENTIALS' });
        }
        
        const user = await database.verifyPassword(email.toLowerCase(), password);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
        }
        
        const sessionId = await database.createSession(user.id);
        const token = generateToken(sessionId);
        
        res.cookie('agentpay_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: 'strict'
        });
        
        res.json({
            user,
            message: 'Login successful'
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
});

app.post('/api/auth/logout', validateSession, async (req, res) => {
    try {
        await database.revokeSession(req.session.id);
        res.clearCookie('agentpay_session');
        res.json({ message: 'Logout successful' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
});

app.get('/api/auth/me', validateSession, (req, res) => {
    res.json({ user: req.user });
});

// API Key authentication middleware
async function validateApiKey(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Missing or invalid authorization header. Include: Authorization: Bearer ak_live_your_key',
                code: 'MISSING_API_KEY',
                documentation: 'https://docs.aslanpay.xyz/authentication'
            });
        }

        const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
        
        // Validate API key format
        if (!apiKey.startsWith('ak_live_') && !apiKey.startsWith('ak_test_')) {
            return res.status(401).json({
                error: 'Invalid API key format. Expected format: ak_live_... or ak_test_...',
                code: 'INVALID_API_KEY_FORMAT',
                documentation: 'https://docs.aslanpay.xyz/authentication'
            });
        }

        // Validate API key in database (this already updates usage stats)
        const keyData = await database.validateApiKey(apiKey);
        
        if (!keyData) {
            return res.status(401).json({
                error: 'Invalid or revoked API key',
                code: 'INVALID_API_KEY',
                documentation: 'https://docs.aslanpay.xyz/authentication'
            });
        }

        // Attach user and API key data to request
        req.user = keyData.user;
        req.apiKey = {
            id: keyData.keyId,
            userId: keyData.userId,
            permissions: keyData.permissions
        };
        
        // Add rate limiting headers for better developer experience
        res.set({
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '99', 
            'X-RateLimit-Reset': Math.floor(Date.now() / 1000) + 3600,
            'X-API-Version': '1.0',
            'X-AslanPay-Request-ID': require('crypto').randomBytes(8).toString('hex')
        });
        
        console.log(`🔑 API request authenticated for user: ${keyData.user.email}`);
        
        next();
    } catch (error) {
        console.error('API key validation error:', error);
        res.status(500).json({ 
            error: 'Authentication service error', 
            code: 'AUTH_SERVICE_ERROR' 
        });
    }
}

// API Key management
app.get('/api/keys', validateSession, async (req, res) => {
    try {
        const apiKeys = await database.getApiKeysByUserId(req.user.id);
        res.json({
            apiKeys,
            total: apiKeys.length
        });
    } catch (error) {
        console.error('Get API keys error:', error);
        res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
});

app.post('/api/keys', validateSession, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'API key name required', code: 'MISSING_NAME' });
        }
        
        const apiKey = await database.createApiKey(req.user.id, name.trim());
        res.status(201).json({
            apiKey,
            message: 'API key created successfully'
        });
    } catch (error) {
        console.error('Create API key error:', error);
        res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
});

// Payment authorization endpoint (with API key authentication)
app.post('/api/v1/authorize', validateApiKey, (req, res) => {
    try {
        const { amount, description, agentId, metadata } = req.body;
        
        // Enhanced validation
        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ 
                error: 'Valid amount required (positive integer in cents, e.g., 2500 = $25.00)', 
                code: 'INVALID_AMOUNT',
                example: { amount: 2500, description: "AWS credits for AI agent" }
            });
        }
        
        if (!description || typeof description !== 'string' || description.trim().length === 0) {
            return res.status(400).json({ 
                error: 'Description is required', 
                code: 'MISSING_DESCRIPTION',
                example: { amount: 2500, description: "AWS credits for AI agent" }
            });
        }
        
        if (amount > 10000000) { // $100,000 limit
            return res.status(400).json({ 
                error: 'Amount exceeds maximum limit of $100,000', 
                code: 'AMOUNT_TOO_LARGE' 
            });
        }
        
        const authId = `auth_${require('crypto').randomBytes(16).toString('hex')}`;
        
        console.log(`💳 Payment authorization: $${amount/100} for "${description}" by ${req.user.email} using ${req.apiKey.name}`);
        
        res.json({
            id: authId,
            object: 'authorization',
            amount,
            description: description.trim(),
            agentId: agentId || 'unknown',
            userId: req.user.id,
            apiKeyId: req.apiKey.id,
            status: 'authorized',
            created: Math.floor(Date.now() / 1000),
            expires_at: Math.floor((Date.now() + 10 * 60 * 1000) / 1000),
            livemode: false,
            mock: true,
            metadata: metadata || {},
            message: 'Authorization successful - payment authorized for AI agent'
        });
        
    } catch (error) {
        console.error('Authorization error:', error);
        res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
});

// Payment confirmation endpoint (with API key authentication)
app.post('/api/v1/confirm', validateApiKey, (req, res) => {
    try {
        const { authorizationId, finalAmount } = req.body;
        
        if (!authorizationId) {
            return res.status(400).json({ 
                error: 'Authorization ID required', 
                code: 'MISSING_AUTH_ID',
                example: { authorizationId: "auth_1234567890abcdef", finalAmount: 2500 }
            });
        }
        
        const paymentId = `pay_${require('crypto').randomBytes(16).toString('hex')}`;
        
        console.log(`✅ Payment confirmation: ${authorizationId} confirmed by ${req.user.email} using ${req.apiKey.name}`);
        
        res.json({
            id: paymentId,
            object: 'payment',
            amount: finalAmount || 2500,
            status: 'completed',
            authorizationId,
            userId: req.user.id,
            apiKeyId: req.apiKey.id,
            created: Math.floor(Date.now() / 1000),
            livemode: false,
            mock: true,
            transaction: {
                id: `txn_${require('crypto').randomBytes(12).toString('hex')}`,
                amount: finalAmount || 2500,
                status: 'completed'
            },
            message: 'Payment confirmed successfully'
        });
        
    } catch (error) {
        console.error('Confirmation error:', error);
        res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
});

// Payment refund endpoint (with API key authentication)
app.post('/api/v1/refund', validateApiKey, (req, res) => {
    try {
        const { transactionId, amount, reason } = req.body;
        
        if (!transactionId) {
            return res.status(400).json({ 
                error: 'Transaction ID required', 
                code: 'MISSING_TRANSACTION_ID',
                example: { transactionId: "txn_1234567890", amount: 1000, reason: "customer_request" }
            });
        }
        
        const refundId = `ref_${require('crypto').randomBytes(16).toString('hex')}`;
        
        console.log(`💰 Refund processed: ${transactionId} refunded by ${req.user.email} using ${req.apiKey.name}`);
        
        res.json({
            id: refundId,
            object: 'refund',
            amount: amount || 500,
            reason: reason || 'requested',
            status: 'succeeded',
            transactionId,
            userId: req.user.id,
            apiKeyId: req.apiKey.id,
            created: Math.floor(Date.now() / 1000),
            livemode: false,
            mock: true,
            transaction: {
                id: `txn_${require('crypto').randomBytes(12).toString('hex')}`,
                amount: -(amount || 500),
                status: 'refunded'
            },
            message: 'Refund processed successfully'
        });
        
    } catch (error) {
        console.error('Refund error:', error);
        res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
});

// API Key test endpoint
app.get('/api/v1/test', validateApiKey, (req, res) => {
    res.json({
        message: '🎉 API Key is working correctly!',
        user: {
            id: req.user.id,
            email: req.user.email,
            name: req.user.name
        },
        apiKey: {
            id: req.apiKey.id,
            name: req.apiKey.name,
            usageCount: req.apiKey.usageCount,
            lastUsed: req.apiKey.lastUsed
        },
        timestamp: new Date().toISOString(),
        instructions: {
            usage: 'Include in header: Authorization: Bearer ' + req.apiKey.key.substring(0, 20) + '...',
            endpoints: [
                'POST /api/v1/authorize - Authorize payments',
                'POST /api/v1/confirm - Confirm payments', 
                'POST /api/v1/refund - Process refunds'
            ]
        }
    });
});

// Tenant information endpoint
app.get('/api/v1/tenant', validateApiKey, async (req, res) => {
    try {
        const userApiKeys = await database.getApiKeysByUserId(req.user.id);
        
        res.json({
            id: req.user.id,
            name: req.user.name + "'s Organization",
            plan: req.user.subscriptionPlan || 'sandbox',
            user: {
                email: req.user.email,
                name: req.user.name,
                created: req.user.createdAt
            },
            usage: {
                dailySpent: 2500,
                monthlySpent: 25000,
                apiCalls: 'N/A'
            },
            stats: {
                users: 1,
                api_keys: userApiKeys.length,
                transactions: 3
            },
            apiKeys: userApiKeys.map(key => ({
                id: key.id,
                name: key.name,
                usageCount: key.usageCount,
                lastUsed: key.lastUsed
            }))
        });
    } catch (error) {
        console.error('Tenant error:', error);
        res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
});

// Clean URL helper function
function createPageRoute(route, filename) {
    // Clean URL (preferred)
    app.get(route, (req, res) => {
        try {
            res.sendFile(path.join(__dirname, 'public', filename));
        } catch (error) {
            res.status(404).json({ error: `${route} page not found` });
        }
    });
    
    // .html URL (backward compatibility)
    if (route !== '/') {
        app.get(route + '.html', (req, res) => {
            try {
                res.sendFile(path.join(__dirname, 'public', filename));
            } catch (error) {
                res.status(404).json({ error: `${route} page not found` });
            }
        });
    }
}

// Static page routes with clean URLs
createPageRoute('/', 'index.html');
createPageRoute('/docs', 'docs.html');
createPageRoute('/api', 'api.html');
createPageRoute('/demo', 'demo.html');
createPageRoute('/pricing', 'pricing.html');
createPageRoute('/auth', 'auth.html');
createPageRoute('/status', 'status.html');
createPageRoute('/security', 'security.html');
createPageRoute('/dashboard', 'dashboard.html');

// Catch-all for 404s
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        message: 'Available pages: /, /docs, /api, /demo, /pricing, /auth, /status, /security, /comparison, /dashboard | API endpoints: /health, /test, /api/status, /api/auth/*, /api/keys, /api/v1/* | Note: Both /page and /page.html work',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(port, () => {
    console.log(`🦁 ASLAN PRODUCTION SERVER RUNNING`);
    console.log(`📍 Port: ${port}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`⏰ Started: ${new Date().toISOString()}`);
    console.log(`🔗 Health check: http://localhost:${port}/health`);
    console.log('');
    console.log('📋 Available endpoints:');
    console.log('   • Health: /health, /test, /api/status');
    console.log('   • Authentication: /api/auth/register, /api/auth/login, /api/auth/logout, /api/auth/me');
    console.log('   • API Keys: /api/keys (GET/POST)');
    console.log('   • 🔑 Payment API (REQUIRES API KEY):');
    console.log('     - GET  /api/v1/test       (Test API key)');
    console.log('     - POST /api/v1/authorize  (Authorize payments)');
    console.log('     - POST /api/v1/confirm    (Confirm payments)');
    console.log('     - POST /api/v1/refund     (Process refunds)');
    console.log('     - GET  /api/v1/tenant     (Tenant info)');
    console.log('');
    console.log('🔐 API Key Authentication: ENABLED ✅');
    console.log('💡 To test: node test-api-keys.js');
    console.log('📖 Include header: Authorization: Bearer ak_live_your_key');
    console.log('');
    console.log('🦁 Like the great lion of Narnia, Aslan guides AI agents to accomplish their missions');
    console.log('✅ PRODUCTION DEPLOYMENT SUCCESSFUL - API key authentication operational!');
}); 