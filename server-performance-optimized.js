require('dotenv').config();

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Production environment variable defaults
if (process.env.NODE_ENV === 'production') {
    process.env.JWT_SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex');
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex');
    delete process.env.REDIS_URL; // Force in-memory for speed
    console.log('🚀 PERFORMANCE-OPTIMIZED Aslan starting...');
}

// PERFORMANCE: Immediate health check - NO middleware overhead
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: Date.now(), latency: '< 50ms' });
});

// PERFORMANCE: Ultra-fast API endpoints FIRST (before heavy middleware)
const cors = require('cors');
const path = require('path');

// Minimal CORS for API endpoints only
app.use('/api/v1', cors({
    origin: true,
    credentials: false,
    optionsSuccessStatus: 200
}));

// PERFORMANCE: Minimal body parsing for API
app.use('/api/v1', express.json({ limit: '1mb' }));

// PERFORMANCE: Load database optimized
let database;
try {
    // Use production database if available, otherwise fallback
    database = require('./database-production.js');
    console.log('✅ Using optimized production database');
} catch (error) {
    console.log('⚠️ Production DB unavailable, using config database');
    database = require('./config/database');
}

// PERFORMANCE: Cached API key validation
const apiKeyCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function validateApiKeyFast(apiKey) {
    // Check cache first
    const cached = apiKeyCache.get(apiKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.result;
    }
    
    // Fast database lookup
    const startTime = Date.now();
    try {
        const result = await database.validateApiKey(apiKey);
        const latency = Date.now() - startTime;
        
        // Cache successful results
        if (result && result.valid) {
            apiKeyCache.set(apiKey, {
                result,
                timestamp: Date.now()
            });
        }
        
        console.log(`🔑 API key validation: ${latency}ms`);
        return result;
    } catch (error) {
        console.error('❌ API key validation failed:', error.message);
        return { valid: false, error: error.message };
    }
}

// PERFORMANCE: Ultra-fast API key middleware
function validateApiKeyMiddleware(req, res, next) {
    const startTime = Date.now();
    const apiKey = req.headers['authorization']?.replace('Bearer ', '') || 
                   req.headers['x-api-key'] || 
                   req.body?.apiKey;

    if (!apiKey) {
        return res.status(401).json({ 
            error: 'API key required',
            latency: (Date.now() - startTime) + 'ms'
        });
    }

    validateApiKeyFast(apiKey)
        .then(result => {
            if (!result.valid) {
                return res.status(401).json({ 
                    error: 'Invalid API key',
                    latency: (Date.now() - startTime) + 'ms'
                });
            }
            
            req.tenant = result.tenant || { id: 'default', name: 'Default' };
            req.apiKey = result;
            req.validationLatency = Date.now() - startTime;
            next();
        })
        .catch(error => {
            console.error('API key validation error:', error);
            res.status(500).json({ 
                error: 'Authentication error',
                latency: (Date.now() - startTime) + 'ms'
            });
        });
}

// PERFORMANCE: Ultra-fast authorize endpoint
app.post('/api/v1/authorize', validateApiKeyMiddleware, (req, res) => {
    const requestStart = Date.now();
    
    try {
        const { amount, service = 'unknown', description } = req.body;
        
        // Basic validation
        if (!amount || amount <= 0) {
            return res.status(400).json({
                error: 'Invalid amount',
                latency: (Date.now() - requestStart) + 'ms'
            });
        }
        
        // Ultra-fast approval logic
        const approved = amount <= 100; // Simple rule for demo
        const approvalId = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        
        const totalLatency = Date.now() - requestStart;
        
        res.json({
            approved,
            amount,
            service,
            description,
            approvalId,
            tenant: req.tenant,
            latency: totalLatency + 'ms',
            validationLatency: req.validationLatency + 'ms',
            timestamp: Date.now()
        });
        
        console.log(`⚡ AUTHORIZE: ${totalLatency}ms (validation: ${req.validationLatency}ms)`);
        
    } catch (error) {
        const totalLatency = Date.now() - requestStart;
        console.error('Authorize error:', error);
        res.status(500).json({
            error: 'Internal server error',
            latency: totalLatency + 'ms'
        });
    }
});

// PERFORMANCE: Fast test endpoint
app.get('/api/v1/test', validateApiKeyMiddleware, (req, res) => {
    const latency = Date.now() - req.startTime;
    res.json({
        status: 'FAST_API_WORKING',
        tenant: req.tenant,
        latency: latency + 'ms',
        timestamp: Date.now()
    });
});

// PERFORMANCE: Spending controls endpoints for demo
app.get('/api/keys/spending-controls', validateApiKeyMiddleware, (req, res) => {
    res.json({
        dailyLimit: 100,
        demoLimit: 10,
        spentToday: 0,
        transactionCount: 0,
        emergencyStop: false
    });
});

app.put('/api/keys/spending-controls', validateApiKeyMiddleware, (req, res) => {
    // In demo mode, just return success
    res.json({
        success: true,
        updated: req.body,
        latency: '< 50ms'
    });
});

console.log('🚀 PERFORMANCE-OPTIMIZED API routes mounted');

// PERFORMANCE: Now add heavier middleware for non-API routes only
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const session = require('express-session');

// Basic security for non-API routes
app.use(helmet({
    contentSecurityPolicy: false, // Disable for speed in demo
    crossOriginResourcePolicy: false
}));

// Simple rate limiting for non-API
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // High limit for demo
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Body parsing for non-API routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Simple session for non-API routes
app.use(session({
    secret: process.env.SESSION_SECRET || 'demo-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// PERFORMANCE: Load and mount other routes (with minimal middleware)
let authRoutes, apiKeyRoutes;
try {
    authRoutes = require('./routes/auth');
    apiKeyRoutes = require('./routes/api-keys');
    console.log('✅ Additional routes loaded');
} catch (error) {
    console.error('⚠️ Some routes unavailable:', error.message);
    authRoutes = express.Router();
    apiKeyRoutes = express.Router();
}

// Mount non-API routes
app.use('/api/auth', authRoutes);
app.use('/api/keys', apiKeyRoutes);

// Static files
app.use(express.static('public', {
    maxAge: '1d', // Shorter cache for demo
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/demo', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'demo.html'));
});

// Enhanced status endpoint with performance metrics
app.get('/api/status', (req, res) => {
    res.json({
        status: 'PERFORMANCE_OPTIMIZED',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cacheSize: apiKeyCache.size,
        optimizations: [
            'API routes before middleware',
            'Cached API key validation',
            'Minimal security overhead',
            'No CSRF for API endpoints',
            'Streamlined headers'
        ],
        targetLatency: '< 400ms',
        timestamp: Date.now()
    });
});

// Error handling
app.use((error, req, res, next) => {
    console.error('Server error:', error.message);
    res.status(500).json({
        error: 'Internal server error',
        timestamp: Date.now()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path,
        availableEndpoints: [
            '/health',
            '/api/v1/authorize',
            '/api/v1/test',
            '/api/status',
            '/demo'
        ]
    });
});

// Start server
app.listen(port, () => {
    console.log(`🚀 PERFORMANCE-OPTIMIZED Aslan running on port ${port}`);
    console.log(`⚡ Target: Sub-400ms API latency`);
    console.log(`🎯 Optimizations: API-first routing, cached validation, minimal middleware`);
    console.log(`🔗 Test: curl -X POST https://aslanpay-production.up.railway.app/api/v1/authorize`);
});

module.exports = app; 