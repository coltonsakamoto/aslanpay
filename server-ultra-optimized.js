require('dotenv').config();

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// ⚡ ULTRA-PERFORMANCE: Force production mode
process.env.NODE_ENV = 'production';

// ⚡ ULTRA-PERFORMANCE: Disable all logging
console.log = () => {};
console.warn = () => {};
console.error = () => {};

// ⚡ ULTRA-PERFORMANCE: Minimal middleware stack
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ⚡ ULTRA-PERFORMANCE: Instant health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: Date.now() });
});

// ⚡ ULTRA-PERFORMANCE: Lazy database loading
let database;
function getDatabase() {
    if (!database) {
        try {
            database = require('./database-production.js');
        } catch (error) {
            database = require('./config/database');
        }
    }
    return database;
}

// ⚡ ULTRA-PERFORMANCE: In-memory API key cache
const apiKeyCache = new Map();
const CACHE_TTL = 300000; // 5 minutes

async function validateApiKeyUltraFast(apiKey) {
    // Check cache first (instant)
    const cached = apiKeyCache.get(apiKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.result;
    }
    
    // Database lookup
    try {
        const db = getDatabase();
        const result = await db.validateApiKey(apiKey);
        
        // Cache valid results
        if (result && result.valid) {
            apiKeyCache.set(apiKey, {
                result,
                timestamp: Date.now()
            });
        }
        
        return result || { valid: false, error: 'Invalid API key' };
    } catch (error) {
        return { valid: false, error: 'Database error' };
    }
}

// ⚡ ULTRA-PERFORMANCE: Minimal API key middleware
function validateApiKey(req, res, next) {
    const apiKey = req.headers['authorization']?.replace('Bearer ', '') || 
                   req.headers['x-api-key'] || 
                   req.body?.apiKey;

    if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
    }

    validateApiKeyUltraFast(apiKey)
        .then(result => {
            if (!result || !result.valid) {
                return res.status(401).json({ error: 'Invalid API key' });
            }
            
            req.tenant = result.tenant || { id: 'default', name: 'Default' };
            req.apiKey = result;
            req.user = result.user || { id: 'default' };
            next();
        })
        .catch(error => {
            res.status(500).json({ error: 'Authentication error' });
        });
}

// ⚡ ULTRA-PERFORMANCE: Minimal input validation
function validateAmount(req, res, next) {
    const { amount } = req.body;
    if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
    }
    next();
}

// ⚡ ULTRA-PERFORMANCE: Streamlined authorize endpoint
app.post('/api/v1/authorize', validateApiKey, validateAmount, async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { amount, description, agentId, metadata = {} } = req.body;
        
        // Create transaction record
        const db = getDatabase();
        const transaction = await db.createTransaction({
            userId: req.user.id,
            apiKeyId: req.apiKey.keyId,
            agentId: agentId || 'unknown',
            type: 'authorize',
            amount,
            currency: 'USD',
            description: description || 'Payment',
            metadata
        });

        // Mock authorization (ultra-fast)
        const authorizationId = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const response = {
            id: authorizationId,
            object: 'authorization',
            amount,
            description: description || 'Payment',
            status: 'authorized',
            agentId: agentId || null,
            tenantId: req.tenant.id,
            userId: req.user.id,
            created: Math.floor(Date.now() / 1000),
            expires_at: Math.floor((Date.now() + 10 * 60 * 1000) / 1000),
            metadata,
            livemode: false,
            transaction: {
                id: transaction.id,
                amount: transaction.amount,
                status: transaction.status
            },
            latency: Date.now() - startTime
        };
        
        res.json(response);
        
    } catch (error) {
        res.status(500).json({ 
            error: 'Authorization failed',
            latency: Date.now() - startTime
        });
    }
});

// ⚡ ULTRA-PERFORMANCE: Status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: 'ULTRA_OPTIMIZED',
        uptime: process.uptime(),
        cacheSize: apiKeyCache.size,
        targetLatency: '< 400ms',
        optimizations: [
            'Production mode enforced',
            'Logging disabled',
            'Minimal middleware',
            'In-memory caching',
            'Lazy database loading',
            'Streamlined validation'
        ],
        timestamp: Date.now()
    });
});

// ⚡ ULTRA-PERFORMANCE: Minimal error handling
app.use((error, req, res, next) => {
    res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// ⚡ ULTRA-PERFORMANCE: Start server
app.listen(port, () => {
    console.log(`🚀 ULTRA-OPTIMIZED Aslan running on port ${port}`);
    console.log(`⚡ Target: Sub-400ms API latency`);
    console.log(`🎯 Optimizations: Production mode, no logging, minimal stack`);
});

module.exports = app; 