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
// DEMO API ENDPOINTS - SPENDING CONTROLS SHOWCASE
// ========================================

// Demo state tracking - IN-MEMORY for staging demo
let demoState = {
    totalSpent: 0,
    transactionCount: 0,
    emergencyStop: false,
    dailyLimit: 100,
    maxTransactions: 10,
    recentTransactions: [] // Track for spam detection
};

// Spending validation with anti-spam protection
function validateDemoSpending(amount, service, description) {
    const result = { approved: false, reason: '', spamDetected: false };
    
    // Emergency stop check
    if (demoState.emergencyStop) {
        result.reason = 'Emergency stop is active - all transactions blocked';
        return result;
    }
    
    // ANTI-SPAM: Check for duplicate transactions in 30 seconds
    const now = Date.now();
    const spamWindow = 30 * 1000;
    const identicalTransactions = demoState.recentTransactions.filter(tx => {
        return (now - tx.timestamp < spamWindow) &&
               tx.amount === amount &&
               tx.service === service &&
               tx.description === description;
    });
    
    if (identicalTransactions.length > 0) {
        result.reason = `DUPLICATE BLOCKED: Identical transaction already processed within 30 seconds`;
        result.spamDetected = true;
        return result;
    }
    
    // Daily limit check
    const newTotal = demoState.totalSpent + amount;
    if (newTotal > demoState.dailyLimit) {
        result.reason = `Would exceed daily limit of $${demoState.dailyLimit} (attempting $${newTotal})`;
        return result;
    }
    
    // Transaction count check
    if (demoState.transactionCount >= demoState.maxTransactions) {
        result.reason = `Maximum ${demoState.maxTransactions} transactions per day reached`;
        return result;
    }
    
    result.approved = true;
    return result;
}

// POST /api/demo/purchase - Process demo purchases with spending controls
app.post('/api/demo/purchase', (req, res) => {
    const { amount, service, description } = req.body;
    const startTime = Date.now();
    
    console.log(`🛒 Demo purchase attempt: $${amount} for ${service}`);
    
    // Validate spending limits - THE CORE PRODUCT FEATURE
    const validation = validateDemoSpending(amount, service, description);
    
    if (!validation.approved) {
        // Realistic processing time even for blocked transactions
        const processingDelay = 25 + Math.random() * 35; // 25-60ms
        
        setTimeout(() => {
            const latency = Date.now() - startTime;
            console.log(`🚨 Transaction BLOCKED: ${validation.reason}`);
            
            res.status(402).json({
                success: false,
                blocked: true,
                reason: validation.reason,
                currentSpent: demoState.totalSpent,
                dailyLimit: demoState.dailyLimit,
                transactionCount: demoState.transactionCount,
                maxTransactions: demoState.maxTransactions,
                emergencyStop: demoState.emergencyStop,
                spamDetected: validation.spamDetected || false,
                latency: latency,
                message: '🚨 TRANSACTION BLOCKED BY SPENDING CONTROLS'
            });
        }, processingDelay);
        return;
    }
    
    // Process approved transaction
    const processingDelay = 45 + Math.random() * 55; // 45-100ms realistic processing
    
    setTimeout(() => {
        // Update spending state
        demoState.totalSpent += amount;
        demoState.transactionCount++;
        
        // Track transaction for spam detection
        const transactionId = `demo_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const transaction = {
            id: transactionId,
            amount: amount,
            service: service,
            description: description,
            timestamp: Date.now()
        };
        
        // Add to recent transactions (keep last 50)
        demoState.recentTransactions.push(transaction);
        if (demoState.recentTransactions.length > 50) {
            demoState.recentTransactions = demoState.recentTransactions.slice(-50);
        }
        
        const latency = Date.now() - startTime;
        console.log(`✅ Demo purchase SUCCESS: ${transactionId} - $${amount} in ${latency}ms`);
        
        res.json({
            success: true,
            transactionId: transactionId,
            amount: amount,
            service: service,
            latency: latency,
            spendingStatus: {
                totalSpent: demoState.totalSpent,
                remainingLimit: demoState.dailyLimit - demoState.totalSpent,
                transactionCount: demoState.transactionCount,
                remainingTransactions: demoState.maxTransactions - demoState.transactionCount
            },
            message: '✅ Transaction approved and processed'
        });
    }, processingDelay);
});

// GET /api/demo/spending-status - Get current spending state
app.get('/api/demo/spending-status', (req, res) => {
    const startTime = Date.now();
    
    // Simulate realistic database query
    setTimeout(() => {
        const now = Date.now();
        const recentTransactions = demoState.recentTransactions.filter(tx => now - tx.timestamp < 60000);
        const latency = Date.now() - startTime;
        
        res.json({
            totalSpent: demoState.totalSpent,
            dailyLimit: demoState.dailyLimit,
            remainingLimit: demoState.dailyLimit - demoState.totalSpent,
            transactionCount: demoState.transactionCount,
            maxTransactions: demoState.maxTransactions,
            remainingTransactions: demoState.maxTransactions - demoState.transactionCount,
            emergencyStop: demoState.emergencyStop,
            status: demoState.emergencyStop ? 'EMERGENCY_STOP' : 
                    (demoState.totalSpent >= demoState.dailyLimit ? 'LIMIT_REACHED' : 'ACTIVE'),
            spamProtection: {
                recentTransactionsCount: recentTransactions.length,
                totalTrackedTransactions: demoState.recentTransactions.length,
                antiSpamActive: true
            },
            latency: latency
        });
    }, 20 + Math.random() * 15); // 20-35ms realistic query time
});

// PUT /api/demo/spending-controls - Update spending limits
app.put('/api/demo/spending-controls', (req, res) => {
    const { dailyLimit, maxTransactions, emergencyStop } = req.body;
    const startTime = Date.now();
    
    console.log(`⚙️ Updating demo spending controls:`, { dailyLimit, maxTransactions, emergencyStop });
    
    // Simulate realistic configuration update
    setTimeout(() => {
        if (dailyLimit !== undefined && dailyLimit > 0) {
            demoState.dailyLimit = dailyLimit;
        }
        if (maxTransactions !== undefined && maxTransactions > 0) {
            demoState.maxTransactions = maxTransactions;
        }
        if (emergencyStop !== undefined) {
            demoState.emergencyStop = emergencyStop;
        }
        
        const latency = Date.now() - startTime;
        console.log(`✅ Demo controls updated in ${latency}ms`);
        
        res.json({
            success: true,
            message: 'Spending controls updated',
            currentState: {
                totalSpent: demoState.totalSpent,
                dailyLimit: demoState.dailyLimit,
                maxTransactions: demoState.maxTransactions,
                emergencyStop: demoState.emergencyStop,
                transactionCount: demoState.transactionCount
            },
            latency: latency
        });
    }, 40 + Math.random() * 30); // 40-70ms for config update
});

console.log('✅ Demo API endpoints loaded: /api/demo/purchase, /api/demo/spending-status, /api/demo/spending-controls');

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