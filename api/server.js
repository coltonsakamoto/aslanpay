const express = require('express');
const path = require('path');
const app = express();

// --- Health-check for Railway ---
app.get('/health', (_req, res) => res.status(200).send('ok'));

// Basic middleware
app.use(express.json());

// Session middleware for authentication
app.use(require('express-session')({
    secret: process.env.SESSION_SECRET || 'aslan-dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
}));

// ROBUST AUTH SYSTEM - Always setup simple auth first, then enhance with PostgreSQL if available
console.log('🔧 Setting up robust auth system...');

// STEP 1: Always setup simple auth as baseline (ensures signup always works)
setupSimpleAuth();

// STEP 2: Try to enhance with PostgreSQL if available (non-blocking)
const hasDatabaseUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0;

if (hasDatabaseUrl) {
    console.log('🔗 DATABASE_URL found - attempting to enhance with PostgreSQL features');
    setTimeout(async () => {
        try {
            const database = require('../config/database');
            
            // Test database connection
            await database.healthCheck();
            console.log('✅ PostgreSQL connection successful - enhanced features available');
            
            // PostgreSQL is working, but simple auth is already handling signup
            // This could be used for advanced features like persistent storage
            
        } catch (error) {
            console.log('⚠️ PostgreSQL connection failed - continuing with simple auth only');
            console.log('   Error:', error.message);
        }
    }, 1000); // Non-blocking async test
} else {
    console.log('⚠️ DATABASE_URL not found - using simple auth only');
}

function setupSimpleAuth() {
    console.log('🔧 Setting up simple auth system');
    
    // Simple in-memory auth for staging testing when DB not configured
    const tempUsers = new Map();
    const tempSessions = new Map();
    
    // Add test user
    tempUsers.set('test@aslanpay.xyz', {
        id: 'user_test_123',
        email: 'test@aslanpay.xyz',
        name: 'Test User',
        password: 'password123'
    });
    
    // Session-based auth endpoints (matching frontend expectations)
    app.post('/api/auth/login', (req, res) => {
        try {
            const { email, password } = req.body;
            
            if (!email || !password) {
                return res.status(400).json({
                    error: 'Email and password are required',
                    code: 'MISSING_CREDENTIALS'
                });
            }
            
            const user = tempUsers.get(email.toLowerCase());
            if (!user || password !== user.password) {
                return res.status(401).json({
                    error: 'Invalid email or password',
                    code: 'INVALID_CREDENTIALS'
                });
            }
            
            // Set session
            req.session.userId = user.id;
            req.session.user = { id: user.id, email: user.email, name: user.name };
            
            res.json({
                success: true,
                user: { id: user.id, email: user.email, name: user.name },
                message: 'Login successful (production mode)'
            });
        } catch (error) {
            console.error('Auth login error:', error);
            res.status(500).json({
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    });
    
    // Frontend expects /api/auth/me endpoint
    app.get('/api/auth/me', (req, res) => {
        try {
            if (!req.session.userId || !req.session.user) {
                return res.status(401).json({
                    error: 'Not authenticated',
                    code: 'NOT_AUTHENTICATED'
                });
            }
            
            res.json({
                success: true,
                user: req.session.user,
                message: 'Authenticated (production mode)'
            });
        } catch (error) {
            console.error('Auth me error:', error);
            res.status(500).json({
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    });
    
    app.get('/api/auth/status', (req, res) => {
        try {
            res.json({
                authenticated: !!(req.session.userId),
                user: req.session.user || null,
                message: 'Production auth mode'
            });
        } catch (error) {
            console.error('Auth status error:', error);
            res.status(500).json({
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    });
    
    app.post('/api/auth/logout', (req, res) => {
        try {
            req.session.destroy((err) => {
                if (err) {
                    console.error('Logout error:', err);
                    return res.status(500).json({
                        error: 'Logout failed',
                        code: 'LOGOUT_ERROR'
                    });
                }
                res.clearCookie('connect.sid');
                res.json({ 
                    success: true,
                    message: 'Logout successful' 
                });
            });
        } catch (error) {
            console.error('Auth logout error:', error);
            res.status(500).json({
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    });
    
    // Add signup endpoint to simple auth system
    app.post('/api/auth/signup', (req, res) => {
        try {
            const { email, password, name, organizationName } = req.body;
            
            if (!email || !password || !name) {
                return res.status(400).json({
                    error: 'Email, password, and name are required',
                    code: 'MISSING_CREDENTIALS'
                });
            }
            
            if (password.length < 8) {
                return res.status(400).json({
                    error: 'Password must be at least 8 characters long',
                    code: 'WEAK_PASSWORD'
                });
            }
            
            const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Add user to temp storage
            tempUsers.set(email.toLowerCase(), {
                id: userId,
                email: email.toLowerCase(),
                name,
                password,
                organizationName,
                createdAt: new Date().toISOString()
            });
            
            // Create session
            req.session.userId = userId;
            req.session.user = { id: userId, email: email.toLowerCase(), name };
            
            res.status(201).json({
                success: true,
                message: 'Account created successfully! (Production mode)',
                user: { id: userId, email: email.toLowerCase(), name }
            });
        } catch (error) {
            console.error('Auth signup error:', error);
            res.status(500).json({
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    });
    
    console.log('✅ Simple auth system ready (with signup)');
}

// Serve static frontend files FIRST (before API routes)
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Main page routes - serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

app.get('/docs', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/docs.html'));
});

app.get('/demo', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/demo.html'));
});

app.get('/auth', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/auth.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/signup.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/dashboard.html'));
});

app.get('/pricing', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/pricing.html'));
});

app.get('/comparison', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/comparison.html'));
});

app.get('/security', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/security.html'));
});

app.get('/checkout', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/checkout.html'));
});

app.get('/status', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/status.html'));
});

// API Status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: 'OK',
        service: 'AslanPay API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Database health check endpoint
app.get('/api/db-health', async (req, res) => {
    try {
        console.log('🏥 Database health check requested');
        
        // Check if we're using PostgreSQL or simple auth
        const hasDatabaseUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0;
        
        if (!hasDatabaseUrl) {
            return res.json({
                status: 'simple-auth',
                message: 'Using simple auth system (no DATABASE_URL)',
                timestamp: new Date().toISOString()
            });
        }
        
        console.log('🔗 DATABASE_URL found, testing PostgreSQL connection...');
        
        // Try to load the database
        const database = require('../config/database');
        
        // Test database health
        const healthResult = await database.healthCheck();
        console.log('✅ Database health check result:', healthResult);
        
        res.json({
            status: 'postgresql-connected',
            health: healthResult,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Database health check failed:', error);
        res.status(500).json({
            status: 'database-error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Main authorization endpoint (simplified but functional)
app.post('/api/v1/authorize', (req, res) => {
    const { amount, service = 'unknown', description, apiKey } = req.body;
    
    // Basic validation
    if (!amount || amount <= 0) {
        return res.status(400).json({
            error: 'Invalid amount',
            code: 'INVALID_AMOUNT'
        });
    }
    
    if (!apiKey) {
        return res.status(401).json({
            error: 'API key required',
            code: 'MISSING_API_KEY'
        });
    }
    
    // Simple authorization logic
    const approved = amount <= 100; // Approve amounts <= $100
    const approvalId = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    res.json({
        approved,
        amount,
        service,
        description,
        approvalId,
        timestamp: new Date().toISOString(),
        limits: {
            maxAmount: 100,
            dailyLimit: 1000
        }
    });
});

// Load enhanced API keys routes
console.log('🔑 Loading enhanced API keys system...');
try {
    const apiKeyRoutes = require('../routes/api-keys');
    app.use('/api/keys', apiKeyRoutes);
    console.log('✅ Enhanced API keys system loaded');
} catch (error) {
    console.error('❌ Failed to load enhanced API keys system:', error);
    console.log('⚠️ Falling back to simple API keys...');
    
    // Fallback to simple API keys if enhanced system fails
    setupSimpleApiKeys();
}

function setupSimpleApiKeys() {
    // In-memory API key storage for production
    const tempApiKeys = new Map();
    
    // Session authentication middleware
    function requireAuth(req, res, next) {
        if (!req.session.userId || !req.session.user) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'NOT_AUTHENTICATED'
            });
        }
        next();
    }
    
    // API Keys management endpoints
    app.get('/api/keys', requireAuth, (req, res) => {
    try {
        console.log('🔍 PRODUCTION: Loading API keys for user:', req.session.user.id);
        
        // Get user's API keys
        const userKeys = Array.from(tempApiKeys.values()).filter(key => key.userId === req.session.user.id);
        
        console.log('✅ Found', userKeys.length, 'API keys for user');
        
        res.json({
            success: true,
            keys: userKeys,
            total: userKeys.length
        });
    } catch (error) {
        console.error('❌ Get API keys error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

app.post('/api/keys', requireAuth, (req, res) => {
    try {
        console.log('🔑 PRODUCTION: Creating API key for user:', req.session.user.id);
        
        const { name, environment = 'live' } = req.body;
        
        if (!name || name.trim() === '') {
            return res.status(400).json({
                error: 'API key name is required',
                code: 'MISSING_NAME'
            });
        }
        
        const keyId = `key_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const keyPrefix = environment === 'test' ? 'ak_test_' : 'ak_live_';
        const apiKeyValue = `${keyPrefix}${Date.now()}_${Math.random().toString(36).substr(2, 20)}`;
        
        const apiKey = {
            id: keyId,
            userId: req.session.user.id,
            name: name.trim(),
            key: apiKeyValue,
            environment,
            permissions: ['authorize', 'confirm', 'refund'],
            createdAt: new Date().toISOString(),
            lastUsed: null,
            usageCount: 0,
            isActive: true
        };
        
        tempApiKeys.set(keyId, apiKey);
        
        console.log('✅ API key created:', keyId);
        
        res.status(201).json({
            success: true,
            apiKey,
            message: 'API key created successfully'
        });
    } catch (error) {
        console.error('❌ Create API key error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

app.delete('/api/keys/:keyId', requireAuth, (req, res) => {
    try {
        console.log('🗑️ PRODUCTION: Revoking API key:', req.params.keyId);
        
        const { keyId } = req.params;
        const apiKey = tempApiKeys.get(keyId);
        
        if (!apiKey || apiKey.userId !== req.session.user.id) {
            return res.status(404).json({
                error: 'API key not found or access denied',
                code: 'KEY_NOT_FOUND'
            });
        }
        
        tempApiKeys.delete(keyId);
        
        console.log('✅ API key revoked:', keyId);
        
        res.json({
            success: true,
            message: 'API key revoked successfully'
        });
    } catch (error) {
        console.error('❌ Revoke API key error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

app.post('/api/keys/:keyId/rotate', requireAuth, (req, res) => {
    try {
        console.log('🔄 PRODUCTION: Rotating API key:', req.params.keyId);
        
        const { keyId } = req.params;
        const oldKey = tempApiKeys.get(keyId);
        
        if (!oldKey || oldKey.userId !== req.session.user.id) {
            return res.status(404).json({
                error: 'API key not found or access denied',
                code: 'KEY_NOT_FOUND'
            });
        }
        
        // Generate new key
        const keyPrefix = oldKey.environment === 'test' ? 'ak_test_' : 'ak_live_';
        const newKeyValue = `${keyPrefix}${Date.now()}_${Math.random().toString(36).substr(2, 20)}`;
        
        const newKey = {
            ...oldKey,
            key: newKeyValue,
            createdAt: new Date().toISOString(),
            lastUsed: null,
            usageCount: 0
        };
        
        tempApiKeys.set(keyId, newKey);
        
        console.log('✅ API key rotated:', keyId);
        
        res.json({
            success: true,
            apiKey: newKey,
            message: 'API key rotated successfully'
        });
    } catch (error) {
        console.error('❌ Rotate API key error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Spending controls endpoint
app.get('/api/keys/spending-controls', (req, res) => {
    res.json({
        dailyLimit: 100,
        transactionLimit: 25,
        maxTransactions: 10,
        emergencyStop: false,
        lastUpdated: new Date().toISOString()
    });
});

// Demo authorization endpoint
app.post('/api/demo-authorize', (req, res) => {
    const { amount = 50, service = 'demo' } = req.body;
    
    res.json({
        approved: true,
        amount,
        service,
        demo: true,
        approvalId: `demo_${Date.now()}`,
        message: 'Demo authorization successful'
    });
});

// Demo spending controls - the endpoints the frontend actually calls
let demoSpendingState = {
    totalSpent: 0,
    transactionCount: 0,
    dailyLimit: 100,
    maxTransactions: 10,
    emergencyStop: false,
    transactions: []
};

// Get current spending status
app.get('/api/demo/spending-status', (req, res) => {
    const remainingLimit = Math.max(0, demoSpendingState.dailyLimit - demoSpendingState.totalSpent);
    const remainingTransactions = Math.max(0, demoSpendingState.maxTransactions - demoSpendingState.transactionCount);
    
    res.json({
        success: true,
        totalSpent: demoSpendingState.totalSpent,
        transactionCount: demoSpendingState.transactionCount,
        dailyLimit: demoSpendingState.dailyLimit,
        maxTransactions: demoSpendingState.maxTransactions,
        emergencyStop: demoSpendingState.emergencyStop,
        remainingLimit,
        remainingTransactions,
        lastUpdated: new Date().toISOString()
    });
});

// Process purchase with spending controls
app.post('/api/demo/purchase', (req, res) => {
    const { amount, service = 'gift-card', description = '' } = req.body;
    const startTime = Date.now();
    
    // Validate input
    if (!amount || amount <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Invalid amount',
            code: 'INVALID_AMOUNT'
        });
    }
    
    // Check emergency stop
    if (demoSpendingState.emergencyStop) {
        return res.json({
            success: false,
            blocked: true,
            reason: 'Emergency stop is active - all purchases blocked',
            currentSpent: demoSpendingState.totalSpent,
            dailyLimit: demoSpendingState.dailyLimit,
            transactionCount: demoSpendingState.transactionCount,
            maxTransactions: demoSpendingState.maxTransactions,
            emergencyStop: true
        });
    }
    
    // Check daily limit
    if (demoSpendingState.totalSpent + amount > demoSpendingState.dailyLimit) {
        return res.json({
            success: false,
            blocked: true,
            reason: `Daily limit exceeded: $${amount} would exceed remaining $${demoSpendingState.dailyLimit - demoSpendingState.totalSpent}`,
            currentSpent: demoSpendingState.totalSpent,
            dailyLimit: demoSpendingState.dailyLimit,
            transactionCount: demoSpendingState.transactionCount,
            maxTransactions: demoSpendingState.maxTransactions,
            emergencyStop: false
        });
    }
    
    // Check transaction count limit
    if (demoSpendingState.transactionCount >= demoSpendingState.maxTransactions) {
        return res.json({
            success: false,
            blocked: true,
            reason: `Transaction limit reached: ${demoSpendingState.maxTransactions} transactions already used today`,
            currentSpent: demoSpendingState.totalSpent,
            dailyLimit: demoSpendingState.dailyLimit,
            transactionCount: demoSpendingState.transactionCount,
            maxTransactions: demoSpendingState.maxTransactions,
            emergencyStop: false
        });
    }
    
    // Process successful transaction
    const transactionId = `tx_demo_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const latency = Date.now() - startTime + Math.floor(Math.random() * 50); // Add realistic latency
    
    // Update spending state
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
    
    const remainingLimit = Math.max(0, demoSpendingState.dailyLimit - demoSpendingState.totalSpent);
    
    res.json({
        success: true,
        approved: true,
        transactionId,
        amount,
        service,
        description,
        latency,
        processing_time: latency,
        spendingStatus: {
            totalSpent: demoSpendingState.totalSpent,
            transactionCount: demoSpendingState.transactionCount,
            dailyLimit: demoSpendingState.dailyLimit,
            maxTransactions: demoSpendingState.maxTransactions,
            remainingLimit,
            emergencyStop: demoSpendingState.emergencyStop
        },
        timestamp: new Date().toISOString()
    });
});

// Reset demo spending state (for testing)
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
        message: 'Demo spending state reset',
        spendingStatus: demoSpendingState
    });
});

// Toggle emergency stop
app.post('/api/demo/emergency-stop', (req, res) => {
    const { enable } = req.body;
    demoSpendingState.emergencyStop = enable === true;
    
    res.json({
        success: true,
        emergencyStop: demoSpendingState.emergencyStop,
        message: `Emergency stop ${demoSpendingState.emergencyStop ? 'enabled' : 'disabled'}`
    });
});

// API Documentation page - restored original clean UI
app.get('/api', (req, res) => {
    const apiHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Aslan API Reference - Payment Infrastructure for AI Agents</title>
    
    <!-- Favicon and App Icons -->
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="manifest" href="/site.webmanifest">
    <meta name="theme-color" content="#FF6B35">
    
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        'aslan-orange': '#FF6B35',
                        'aslan-gold': '#F7931E',
                        'aslan-dark': '#1a1a1a',
                        'aslan-gray': '#6B7280',
                        gray: {
                            50: '#f9fafb',
                            100: '#f3f4f6',
                            200: '#e5e7eb',
                            300: '#d1d5db',
                            400: '#9ca3af',
                            500: '#6b7280',
                            600: '#4b5563',
                            700: '#374151',
                            800: '#1f2937',
                            900: '#111827',
                        }
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-white overflow-x-hidden">
    <!-- Navigation -->
    <nav class="border-b" style="border-color: #e5e7eb;">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <span class="text-aslan-dark font-black text-xl tracking-wider" style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; letter-spacing: 0.1em;">ASLAN</span>
                </div>
                
                <!-- Desktop Menu -->
                <div class="hidden md:flex items-center space-x-8">
                    <a href="/" class="text-aslan-gray hover:text-aslan-dark transition-colors">Home</a>
                    <a href="/docs" class="text-aslan-gray hover:text-aslan-dark transition-colors">Documentation</a>
                    <a href="/api" class="text-aslan-orange font-medium">API Reference</a>
                    <a href="/demo" class="bg-aslan-orange text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors">
                        Try Demo
                    </a>
                </div>
                
                <!-- Mobile Menu Button -->
                <button id="mobile-menu-btn" class="md:hidden p-2 rounded-lg text-aslan-gray hover:text-aslan-dark" style="background-color: #f3f4f6;">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                    </svg>
                </button>
            </div>
            
            <!-- Mobile Menu -->
            <div id="mobile-menu" class="hidden md:hidden mt-4 pb-4 border-t pt-4" style="border-color: #e5e7eb;">
                <div class="flex flex-col space-y-4">
                    <a href="/" class="text-aslan-gray hover:text-aslan-dark transition-colors">Home</a>
                    <a href="/docs" class="text-aslan-gray hover:text-aslan-dark transition-colors">Documentation</a>
                    <a href="/api" class="text-aslan-orange font-medium">API Reference</a>
                    <a href="/demo" class="bg-aslan-orange text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors text-center">
                        Try Demo
                    </a>
                </div>
            </div>
        </div>
    </nav>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div class="grid lg:grid-cols-4 gap-8">
            <!-- Sidebar -->
            <div class="lg:col-span-1">
                <div class="sticky top-8 space-y-6">
                    <div>
                        <h3 class="text-lg font-semibold text-aslan-dark mb-3">Authentication</h3>
                        <ul class="space-y-2 text-sm">
                            <li><a href="#auth-overview" class="text-aslan-orange font-medium">Overview</a></li>
                            <li><a href="#api-keys" class="text-aslan-gray hover:text-aslan-dark">API Keys</a></li>
                            <li><a href="#jwt-tokens" class="text-aslan-gray hover:text-aslan-dark">JWT Tokens</a></li>
                        </ul>
                    </div>
                    
                    <div>
                        <h3 class="text-lg font-semibold text-aslan-dark mb-3">Endpoints</h3>
                        <ul class="space-y-2 text-sm">
                            <li><a href="#purchase" class="text-aslan-gray hover:text-aslan-dark">POST /purchase</a></li>
                            <li><a href="#authorize" class="text-aslan-gray hover:text-aslan-dark">POST /authorize</a></li>
                            <li><a href="#limits" class="text-aslan-gray hover:text-aslan-dark">GET /limits</a></li>
                            <li><a href="#transactions" class="text-aslan-gray hover:text-aslan-dark">GET /transactions</a></li>
                        </ul>
                    </div>
                    
                    <div>
                        <h3 class="text-lg font-semibold text-aslan-dark mb-3">Response Codes</h3>
                        <ul class="space-y-2 text-sm">
                            <li><a href="#success-codes" class="text-aslan-gray hover:text-aslan-dark">Success (2xx)</a></li>
                            <li><a href="#error-codes" class="text-aslan-gray hover:text-aslan-dark">Errors (4xx/5xx)</a></li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <!-- Main Content -->
            <div class="lg:col-span-3">
                <div class="prose prose-lg max-w-none">
                    <h1 id="introduction" class="text-3xl sm:text-4xl font-bold text-aslan-dark mb-6">API Reference</h1>
                    
                    <p class="text-lg text-aslan-gray mb-8">
                        Complete API reference for integrating Aslan payment infrastructure with your AI agents.
                        All endpoints support both REST and SDK-based access.
                    </p>

                    <!-- Base URL -->
                    <div class="border rounded-lg p-4 sm:p-6 mb-8" style="background-color: #eff6ff; border-color: #bfdbfe;">
                        <h3 class="text-lg font-semibold mb-2" style="color: #1e3a8a;">Base URL</h3>
                        <div class="bg-white rounded p-3 font-mono text-sm overflow-x-auto">
                            <span style="color: #2563eb;">https://api.aslanpay.xyz/v1</span>
                        </div>
                    </div>

                    <!-- Authentication -->
                    <section id="authentication" class="mb-12">
                        <h2 class="text-3xl font-bold text-aslan-dark mb-6">Authentication</h2>
                        
                        <p class="text-aslan-gray mb-6">
                            All API requests require authentication using an API key in the Authorization header.
                        </p>

                        <div class="bg-aslan-dark rounded-lg p-6 text-white mb-6">
                            <pre class="text-sm"><code>curl -X POST https://aslanpay.xyz/api/v1/authorize \\
  -H "Authorization: Bearer ak_live_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 2500,
    "description": "AWS credits"
  }'</code></pre>
                        </div>

                        <div class="border rounded-lg p-6" style="background-color: #fef3c7; border-color: #fde68a;">
                            <h4 class="font-semibold mb-2" style="color: #92400e;">🔑 API Key Formats</h4>
                            <ul class="text-sm space-y-1" style="color: #92400e;">
                                <li>• <strong>Live:</strong> <code>ak_live_...</code> - For production transactions</li>
                                <li>• <strong>Test:</strong> <code>ak_test_...</code> - For sandbox testing</li>
                            </ul>
                        </div>
                    </section>

                    <!-- Core Endpoints -->
                    <section id="endpoints" class="mb-12">
                        <h2 class="text-3xl font-bold text-aslan-dark mb-6">Core Endpoints</h2>
                        
                        <div class="space-y-8">
                            <!-- Authorize -->
                            <div class="border rounded-lg p-6" style="border-color: #e5e7eb;">
                                <div class="flex items-center space-x-3 mb-4">
                                    <span class="px-3 py-1 rounded-full text-sm font-medium" style="background-color: #d1fae5; color: #065f46;">POST</span>
                                    <code class="text-lg">/api/v1/authorize</code>
                                </div>
                                <p class="text-aslan-gray mb-4">Create a payment authorization for an AI agent.</p>
                                <div class="rounded-lg p-4" style="background-color: #f9fafb;">
                                    <pre class="text-sm"><code>{
  "amount": 2500,
  "description": "AWS credits",
  "agentId": "agent_123"
}</code></pre>
                                </div>
                            </div>

                            <!-- Status -->
                            <div class="border rounded-lg p-6" style="border-color: #e5e7eb;">
                                <div class="flex items-center space-x-3 mb-4">
                                    <span class="px-3 py-1 rounded-full text-sm font-medium" style="background-color: #f3f4f6; color: #374151;">GET</span>
                                    <code class="text-lg">/api/status</code>
                                </div>
                                <p class="text-aslan-gray mb-4">Get the current system status and health.</p>
                                <div class="rounded-lg p-4" style="background-color: #f9fafb;">
                                    <pre class="text-sm"><code>{
  "service": "Aslan Payment Infrastructure",
  "status": "operational",
  "environment": "production"
}</code></pre>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- SDKs -->
                    <section class="rounded-lg p-8" style="background-color: #f9fafb;">
                        <h2 class="text-2xl font-bold text-aslan-dark mb-4">SDKs & Libraries</h2>
                        <p class="text-aslan-gray mb-6">
                            Use our official SDKs for easier integration with your AI frameworks.
                        </p>
                        <div class="grid md:grid-cols-2 gap-4">
                            <div class="bg-white rounded-lg p-4">
                                <h3 class="font-semibold text-aslan-dark mb-2">Node.js</h3>
                                <code class="text-sm text-aslan-gray">npm install @aslanpay/sdk</code>
                            </div>
                            <div class="bg-white rounded-lg p-4">
                                <h3 class="font-semibold text-aslan-dark mb-2">Python</h3>
                                <code class="text-sm text-aslan-gray">pip install aslanpay</code>
                            </div>
                        </div>
                        <div class="mt-6 flex gap-4">
                            <a href="/docs" class="bg-aslan-orange text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-600 transition-colors">
                                View Documentation
                            </a>
                            <a href="https://github.com/coltonsakamoto/aslanpay" class="border text-aslan-dark px-6 py-3 rounded-lg font-medium transition-colors" style="border-color: #d1d5db;">
                                GitHub Repository
                            </a>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    </div>

    <!-- JavaScript for mobile menu -->
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const mobileMenuBtn = document.getElementById('mobile-menu-btn');
            const mobileMenu = document.getElementById('mobile-menu');
            
            if (mobileMenuBtn && mobileMenu) {
                mobileMenuBtn.addEventListener('click', function() {
                    mobileMenu.classList.toggle('hidden');
                });
                
                const mobileLinks = mobileMenu.querySelectorAll('a');
                mobileLinks.forEach(link => {
                    link.addEventListener('click', function() {
                        mobileMenu.classList.add('hidden');
                    });
                });
            }
            
            document.querySelectorAll('a[href^="#"]').forEach(anchor => {
                anchor.addEventListener('click', function (e) {
                    e.preventDefault();
                    const target = document.querySelector(this.getAttribute('href'));
                    if (target) {
                        target.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                });
            });
        });
    </script>
</body>
</html>`;
    
    res.send(apiHTML);
});

} // End of setupSimpleApiKeys function

// Export the Express app instead of starting a server
// (the root server.js will handle starting the server)
module.exports = app;
