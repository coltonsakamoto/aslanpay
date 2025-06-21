const express = require('express');
const path = require('path');
const crypto = require('crypto');
const app = express();

console.log('🚀 Starting AslanPay API Server - Rebuilt Auth System v2.0.0');

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(require('express-session')({
    secret: process.env.SESSION_SECRET || 'aslan-staging-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Allow HTTP in staging
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true
    }
}));

// CORS for staging
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// ========================================
// REBUILT AUTH SYSTEM - PERSISTENT STORAGE
// ========================================

// In-memory user database (persistent during server session)
const users = new Map();
const sessions = new Map();
const apiKeys = new Map();

// Simple password hashing (for staging - would use bcrypt in production)
function hashPassword(password) {
    return crypto.createHash('sha256').update(password + 'aslan-salt').digest('hex');
}

// Add test users for staging
users.set('test@aslanpay.xyz', {
    id: 'user_test_001',
    email: 'test@aslanpay.xyz',
    name: 'Test User',
    password: hashPassword('password123'),
    organizationName: 'AslanPay Test',
    createdAt: new Date().toISOString(),
    isActive: true
});

users.set('staging@aslanpay.xyz', {
    id: 'user_staging_001', 
    email: 'staging@aslanpay.xyz',
    name: 'Staging User',
    password: hashPassword('staging123'),
    organizationName: 'Staging Test Org',
    createdAt: new Date().toISOString(),
    isActive: true
});

console.log('✅ Auth system initialized with test users');
console.log('📧 Test login: test@aslanpay.xyz / password123');
console.log('📧 Staging login: staging@aslanpay.xyz / staging123');

// Generate secure tokens
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function generateUserId() {
    return 'user_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

// ========================================
// AUTH ENDPOINTS
// ========================================

// SIGNUP ENDPOINT
app.post('/api/auth/signup', (req, res) => {
    console.log('📝 Signup attempt:', { email: req.body.email, name: req.body.name });
    
    try {
        const { email, password, name, organizationName } = req.body;
        
        // Validation
        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                error: 'Email, password, and name are required',
                code: 'MISSING_FIELDS'
            });
        }
        
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 8 characters long',
                code: 'WEAK_PASSWORD'
            });
        }
        
        // Check if user exists
        if (users.has(email.toLowerCase())) {
            return res.status(409).json({
                success: false,
                error: 'An account with this email already exists',
                code: 'EMAIL_EXISTS'
            });
        }
        
        // Create new user
        const userId = generateUserId();
        const userRecord = {
            id: userId,
            email: email.toLowerCase(),
            name: name.trim(),
            password: hashPassword(password),
            organizationName: organizationName?.trim() || `${name}'s Organization`,
            createdAt: new Date().toISOString(),
            isActive: true,
            apiKeyCount: 0,
            lastLogin: null
        };
        
        // Store user
        users.set(email.toLowerCase(), userRecord);
        
        // Create session token
        const sessionToken = generateToken();
        const sessionData = {
            userId: userId,
            email: email.toLowerCase(),
            name: name.trim(),
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        };
        
        sessions.set(sessionToken, sessionData);
        
        // Create default API key
        const defaultApiKey = 'ak_staging_' + crypto.randomBytes(16).toString('hex');
        apiKeys.set(defaultApiKey, {
            keyId: 'key_' + Date.now(),
            userId: userId,
            name: 'Default API Key',
            permissions: ['read', 'write'],
            createdAt: new Date().toISOString(),
            isActive: true
        });
        
        userRecord.apiKeyCount = 1;
        
        console.log('✅ User created successfully:', { userId, email: email.toLowerCase() });
        
        res.status(201).json({
            success: true,
            message: 'Account created successfully!',
            user: {
                id: userId,
                email: email.toLowerCase(),
                name: name.trim(),
                organizationName: userRecord.organizationName
            },
            token: sessionToken,
            expiresAt: sessionData.expiresAt.toISOString(),
            apiKey: defaultApiKey
        });
        
    } catch (error) {
        console.error('❌ Signup error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during signup',
            code: 'SIGNUP_ERROR'
        });
    }
});

// LOGIN ENDPOINT
app.post('/api/auth/login', (req, res) => {
    console.log('🔐 Login attempt:', { email: req.body.email });
    
    try {
        const { email, password } = req.body;
        
        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required',
                code: 'MISSING_CREDENTIALS'
            });
        }
        
        // Find user
        const user = users.get(email.toLowerCase());
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password',
                code: 'INVALID_CREDENTIALS'
            });
        }
        
        // Check password
        const hashedPassword = hashPassword(password);
        if (user.password !== hashedPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password',
                code: 'INVALID_CREDENTIALS'
            });
        }
        
        // Check if account is active
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                error: 'Account is deactivated',
                code: 'ACCOUNT_DEACTIVATED'
            });
        }
        
        // Create session token
        const sessionToken = generateToken();
        const sessionData = {
            userId: user.id,
            email: user.email,
            name: user.name,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        };
        
        sessions.set(sessionToken, sessionData);
        
        // Update last login
        user.lastLogin = new Date().toISOString();
        
        console.log('✅ Login successful:', { userId: user.id, email: user.email });
        
        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                organizationName: user.organizationName,
                lastLogin: user.lastLogin
            },
            token: sessionToken,
            expiresAt: sessionData.expiresAt.toISOString()
        });
        
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during login',
            code: 'LOGIN_ERROR'
        });
    }
});

// LOGOUT ENDPOINT
app.post('/api/auth/logout', (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;
        
        if (token && sessions.has(token)) {
            sessions.delete(token);
            console.log('✅ User logged out');
        }
        
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
        
    } catch (error) {
        console.error('❌ Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Logout error',
            code: 'LOGOUT_ERROR'
        });
    }
});

// AUTH STATUS ENDPOINT
app.get('/api/auth/status', (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
        
        if (!token) {
            return res.json({
                authenticated: false,
                user: null
            });
        }
        
        const session = sessions.get(token);
        if (!session || session.expiresAt < new Date()) {
            if (session) sessions.delete(token); // Clean up expired session
            return res.json({
                authenticated: false,
                user: null
            });
        }
        
        const user = users.get(session.email);
        if (!user || !user.isActive) {
            sessions.delete(token); // Clean up invalid session
            return res.json({
                authenticated: false,
                user: null
            });
        }
        
        res.json({
            authenticated: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                organizationName: user.organizationName
            },
            expiresAt: session.expiresAt.toISOString()
        });
        
    } catch (error) {
        console.error('❌ Auth status error:', error);
        res.status(500).json({
            authenticated: false,
            user: null,
            error: 'Status check error'
        });
    }
});

// ========================================
// MIDDLEWARE FOR PROTECTED ROUTES
// ========================================

function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Authentication token required',
            code: 'NO_TOKEN'
        });
    }
    
    const session = sessions.get(token);
    if (!session || session.expiresAt < new Date()) {
        if (session) sessions.delete(token);
        return res.status(401).json({
            success: false,
            error: 'Invalid or expired token',
            code: 'INVALID_TOKEN'
        });
    }
    
    const user = users.get(session.email);
    if (!user || !user.isActive) {
        sessions.delete(token);
        return res.status(401).json({
            success: false,
            error: 'User account not found or deactivated',
            code: 'USER_NOT_FOUND'
        });
    }
    
    req.user = user;
    req.session = session;
    next();
}

// ========================================
// API KEY ENDPOINTS
// ========================================

// List API Keys
app.get('/api/keys', requireAuth, (req, res) => {
    try {
        const userKeys = Array.from(apiKeys.entries())
            .filter(([key, data]) => data.userId === req.user.id)
            .map(([key, data]) => ({
                keyId: data.keyId,
                name: data.name,
                permissions: data.permissions,
                createdAt: data.createdAt,
                isActive: data.isActive,
                maskedKey: key.substring(0, 12) + '...' + key.substring(key.length - 4)
            }));
        
        res.json({
            success: true,
            keys: userKeys
        });
        
    } catch (error) {
        console.error('❌ API keys list error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve API keys'
        });
    }
});

// Create API Key
app.post('/api/keys', requireAuth, (req, res) => {
    try {
        const { name, permissions = ['read'] } = req.body;
        
        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'API key name is required'
            });
        }
        
        const newApiKey = 'ak_staging_' + crypto.randomBytes(16).toString('hex');
        const keyData = {
            keyId: 'key_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
            userId: req.user.id,
            name: name.trim(),
            permissions: permissions,
            createdAt: new Date().toISOString(),
            isActive: true
        };
        
        apiKeys.set(newApiKey, keyData);
        req.user.apiKeyCount = (req.user.apiKeyCount || 0) + 1;
        
        console.log('✅ API key created:', { keyId: keyData.keyId, userId: req.user.id });
        
        res.status(201).json({
            success: true,
            message: 'API key created successfully',
            keyId: keyData.keyId,
            apiKey: newApiKey,
            name: keyData.name,
            permissions: keyData.permissions,
            createdAt: keyData.createdAt
        });
        
    } catch (error) {
        console.error('❌ API key creation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create API key'
        });
    }
});

// ========================================
// CORE API ENDPOINTS
// ========================================

// API Status
app.get('/api/status', (req, res) => {
    res.json({
        status: 'OK',
        service: 'AslanPay API - Rebuilt Auth System',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        environment: 'staging',
        features: {
            authentication: true,
            apiKeys: true,
            userManagement: true,
            persistentStorage: true
        },
        stats: {
            totalUsers: users.size,
            activeSessions: sessions.size,
            apiKeys: apiKeys.size
        }
    });
});

// Main authorization endpoint
app.post('/api/v1/authorize', (req, res) => {
    const { amount, service = 'unknown', description, apiKey } = req.body;
    
    // Basic validation
    if (!amount || amount <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Invalid amount',
            code: 'INVALID_AMOUNT'
        });
    }
    
    if (!apiKey) {
        return res.status(401).json({
            success: false,
            error: 'API key required',
            code: 'MISSING_API_KEY'
        });
    }
    
    // Validate API key
    const keyData = apiKeys.get(apiKey);
    if (!keyData || !keyData.isActive) {
        return res.status(401).json({
            success: false,
            error: 'Invalid API key',
            code: 'INVALID_API_KEY'
        });
    }
    
    // Simple authorization logic
    const approved = amount <= 100; // Approve amounts <= $100
    const approvalId = `auth_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    console.log('💳 Authorization request:', { amount, service, approved, userId: keyData.userId });
    
    res.json({
        success: true,
        approved,
        amount,
        service,
        description,
        approvalId,
        timestamp: new Date().toISOString(),
        limits: {
            maxAmount: 100,
            dailyLimit: 1000
        },
        userId: keyData.userId
    });
});

// ========================================
// DEMO ENDPOINTS
// ========================================

// Demo spending state (per session)
let demoSpendingState = {
    totalSpent: 0,
    transactionCount: 0,
    dailyLimit: 100,
    maxTransactions: 10,
    emergencyStop: false,
    transactions: []
};

// Demo purchase endpoint
app.post('/api/demo/purchase', (req, res) => {
    const { amount, service = 'gift-card', description = '' } = req.body;
    const startTime = Date.now();
    
    if (!amount || amount <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Invalid amount'
        });
    }
    
    if (demoSpendingState.emergencyStop) {
        return res.json({
            success: false,
            blocked: true,
            reason: 'Emergency stop active'
        });
    }
    
    if (demoSpendingState.totalSpent + amount > demoSpendingState.dailyLimit) {
        return res.json({
            success: false,
            blocked: true,
            reason: 'Daily limit exceeded'
        });
    }
    
    // Process transaction
    const transactionId = `tx_demo_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const latency = Date.now() - startTime;
    
    demoSpendingState.totalSpent += amount;
    demoSpendingState.transactionCount += 1;
    demoSpendingState.transactions.push({
        id: transactionId,
        amount,
        service,
        description,
        timestamp: new Date().toISOString(),
        latency
    });
    
    res.json({
        success: true,
        approved: true,
        transactionId,
        amount,
        service,
        latency,
        spendingStatus: {
            totalSpent: demoSpendingState.totalSpent,
            transactionCount: demoSpendingState.transactionCount,
            remainingLimit: demoSpendingState.dailyLimit - demoSpendingState.totalSpent
        }
    });
});

// Demo reset
app.post('/api/demo/reset', (req, res) => {
    demoSpendingState = {
        totalSpent: 0,
        transactionCount: 0,
        dailyLimit: 100,
        maxTransactions: 10,
        emergencyStop: false,
        transactions: []
    };
    
    res.json({
        success: true,
        message: 'Demo state reset'
    });
});

// ========================================
// STATIC FILES AND ROUTES
// ========================================

// Serve static files
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Page routes
const pages = ['', 'docs', 'demo', 'auth', 'signup', 'dashboard', 'pricing', 'comparison', 'security', 'checkout', 'status'];

pages.forEach(page => {
    const route = page === '' ? '/' : `/${page}`;
    const file = page === '' ? 'index.html' : `${page}.html`;
    
    app.get(route, (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/public', file));
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
    });
});

// Error handler
app.use((error, req, res, next) => {
    console.error('🚨 Server error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

console.log('✅ AslanPay API Server ready with rebuilt auth system');
console.log('🔐 Auth endpoints: /api/auth/signup, /api/auth/login, /api/auth/logout, /api/auth/status');
console.log('🔑 API key endpoints: /api/keys (GET/POST)');
console.log('💳 Authorization: /api/v1/authorize');
console.log('🎮 Demo: /api/demo/purchase, /api/demo/reset');

// Export the Express app
module.exports = app; 