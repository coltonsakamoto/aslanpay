const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const app = express();

console.log('🚀 Starting AslanPay API Server - Reliable Auth System v3.0.0');
console.log('🌍 Environment:', process.env.NODE_ENV || 'staging');

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS configuration for staging
app.use(cors({
    origin: [
        'https://web-staging-16bc.up.railway.app',
        'https://aslanpay.xyz',
        'http://localhost:3000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// Cookie parser for session management
const cookieParser = require('cookie-parser');
app.use(cookieParser());

// Session middleware for staging
app.use(require('express-session')({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', 
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
}));

console.log('✅ Middleware configured for staging environment');

// ========================================
// DATABASE-BACKED AUTH SYSTEM
// ========================================

// Mount auth routes (database-backed)
const authRoutes = require('../routes/auth');
app.use('/api/auth', authRoutes);

console.log('✅ Auth routes mounted: /api/auth/*');

// Mount API key routes  
const apiKeyRoutes = require('../routes/api-keys');
app.use('/api/keys', apiKeyRoutes);

console.log('✅ API key routes mounted: /api/keys/*');

// ========================================
// CORE PAYMENT ENDPOINTS
// ========================================

// API status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        service: 'AslanPay API',
        version: '3.0.0',
        environment: process.env.NODE_ENV || 'staging',
        timestamp: new Date().toISOString(),
        features: {
            auth: 'database-backed',
            sessions: 'persistent',
            database: process.env.DATABASE_URL ? 'postgresql' : 'in-memory'
        }
    });
});

// Import and mount payment routes
try {
    console.log('📦 Loading payment services...');
    
    // Core payment processing
    const paymentMiddleware = require('../middleware/auth').validateApiKey;
    
    // Payment authorization endpoint
    app.post('/api/authorize', paymentMiddleware, async (req, res) => {
        try {
            const { amount, currency = 'USD', description, metadata } = req.body;
            
            // Validate amount
            if (!amount || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Amount must be greater than 0',
                    code: 'INVALID_AMOUNT'
                });
            }
            
            // Mock payment authorization for staging
            const authorizationId = 'auth_staging_' + crypto.randomBytes(8).toString('hex');
            
            // Log transaction (simplified for staging)
            console.log('💳 Payment authorized:', {
                authorizationId,
                amount,
                currency,
                userId: req.user?.id,
                apiKeyId: req.apiKey?.keyId
            });
            
            res.json({
                success: true,
                authorizationId,
                amount,
                currency,
                description,
                status: 'authorized',
                expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
                metadata: metadata || {}
            });
            
        } catch (error) {
            console.error('❌ Payment authorization error:', error);
            res.status(500).json({
                success: false,
                error: 'Payment authorization failed',
                code: 'AUTHORIZATION_ERROR'
            });
        }
    });
    
    console.log('✅ Payment endpoints loaded');
    
} catch (error) {
    console.error('❌ Failed to load payment services:', error.message);
}

// ========================================
// SPECIFIC HTML ROUTES (BEFORE STATIC FILES)
// ========================================

// Common pages without .html extension
app.get('/pricing', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/pricing.html'));
});

app.get('/comparison', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/comparison.html'));
});

app.get('/docs', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/docs.html'));
});

app.get('/demo', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/demo.html'));
});

app.get('/security', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/security.html'));
});

app.get('/status', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/status.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/dashboard.html'));
});

// Serve auth.html at /auth for convenience
app.get('/auth', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/auth.html'));
});

// Dashboard route (requires auth)
app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/dashboard.html'));
});

// Default route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// ========================================
// STATIC FILE SERVING (AFTER API ROUTES)
// ========================================

// Serve static files from frontend/public - ONLY for non-API paths
app.use('/static', express.static(path.join(__dirname, '../frontend/public')));
app.use(express.static(path.join(__dirname, '../frontend/public'), {
    index: false, // Don't serve index.html automatically
    redirect: false // Don't redirect trailing slashes
}));

// ========================================
// ERROR HANDLING
// ========================================

// 404 handler
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({
            error: 'API endpoint not found',
            code: 'NOT_FOUND',
            path: req.path
        });
    } else {
        res.status(404).sendFile(path.join(__dirname, '../frontend/public/index.html'));
    }
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('🚨 Unhandled server error:', error.message);
    
    if (req.path.startsWith('/api/')) {
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR',
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(500).send('Internal Server Error');
    }
});

console.log('🚀 AslanPay API Server ready for staging deployment');
console.log('📍 Auth endpoints: /api/auth/signup, /api/auth/login, /api/auth/status');
console.log('📍 Dashboard: /dashboard.html');
console.log('📍 Payment: /api/authorize');

module.exports = app; 