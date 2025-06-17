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

// CRITICAL: Body parsing FIRST for all endpoints to work
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// CRITICAL: Basic CORS for all endpoints
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// PERFORMANCE: Ultra-fast API endpoints FIRST (before heavy middleware)
const cors = require('cors');
const path = require('path');

// NOTE: Middleware moved to top of file

// ⚡ PERFORMANCE: Lazy load database - don't block startup
let database;
function getDatabase() {
    if (!database) {
        try {
            database = require('./database-production.js');
            console.log('✅ Using optimized production database');
        } catch (error) {
            console.log('⚠️ Production DB unavailable, using config database');
            database = require('./config/database');
        }
    }
    return database;
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
        const db = getDatabase();
        const result = await db.validateApiKey(apiKey);
        const latency = Date.now() - startTime;
        
        // FIX: Ensure we always return a proper object
        if (!result) {
            console.log(`🔑 API key validation: ${latency}ms - null result`);
            return { valid: false, error: 'API key not found' };
        }
        
        // Cache successful results
        if (result && result.valid) {
            apiKeyCache.set(apiKey, {
                result,
                timestamp: Date.now()
            });
        }
        
        // ⚡ PERFORMANCE: Reduced logging (only log slow queries)
        if (latency > 100) {
            console.log(`🔑 API key validation: ${latency}ms`);
        }
        return result;
    } catch (error) {
        // ⚡ PERFORMANCE: Minimal error logging
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
            // BULLETPROOF: Complete null safety
            if (!result) {
                console.error('❌ Null result from validateApiKeyFast');
                return res.status(401).json({ 
                    error: 'API key validation failed',
                    latency: (Date.now() - startTime) + 'ms'
                });
            }
            
            if (!result.valid) {
                console.log('🔑 Invalid API key result');
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

console.log('🚀 PERFORMANCE-OPTIMIZED API routes mounted');

// NOTE: Middleware already loaded at top

// ⚡ PERFORMANCE: Lazy load routes - only load when needed
const routeCache = new Map();

function lazyLoadRoute(routePath) {
    if (routeCache.has(routePath)) {
        return routeCache.get(routePath);
    }
    
    try {
        const route = require(routePath);
        routeCache.set(routePath, route);
        return route;
    } catch (error) {
        console.error(`Failed to load ${routePath}:`, error.message);
        const fallbackRouter = require('express').Router();
        fallbackRouter.all('*', (req, res) => {
            res.status(503).json({ error: 'Service temporarily unavailable' });
        });
        routeCache.set(routePath, fallbackRouter);
        return fallbackRouter;
    }
}

// ⚡ PERFORMANCE: Minimal session middleware only for auth routes
const session = require('express-session');

// Mount essential routes with lazy loading
app.use('/api/v1', (req, res, next) => {
    const authorizeRoutes = lazyLoadRoute('./routes/authorize');
    authorizeRoutes(req, res, next);
});

app.use('/api/auth', session({
    secret: process.env.SESSION_SECRET || 'demo-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}), (req, res, next) => {
    const authRoutes = lazyLoadRoute('./routes/auth');
    authRoutes(req, res, next);
});

app.use('/api/keys', (req, res, next) => {
    const apiKeyRoutes = lazyLoadRoute('./routes/api-keys');
    apiKeyRoutes(req, res, next);
});

console.log('✅ PERFORMANCE-OPTIMIZED routes configured');

// ⚡ PERFORMANCE: Optimized static files with aggressive caching
app.use(express.static('public', {
    maxAge: '1h',
    etag: false,
    lastModified: false,
    index: false // Disable directory indexing for speed
}));

// ⚡ PERFORMANCE: Minimal route handlers for better latency
const staticRoutes = ['/', '/demo', '/auth', '/pricing', '/dashboard', '/api', '/docs'];
const staticFiles = {
    '/': 'index.html',
    '/demo': 'demo.html', 
    '/auth': 'auth.html',
    '/pricing': 'pricing.html',
    '/dashboard': 'dashboard.html',
    '/api': 'api.html',
    '/docs': 'docs.html'
};

staticRoutes.forEach(route => {
    app.get(route, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', staticFiles[route]));
    });
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

// NOTE: Ultra-fast endpoints moved to top of file before middleware

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