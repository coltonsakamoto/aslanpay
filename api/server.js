require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const path = require('path');

console.log('🚀 Creating new server file');

const app = express();
const port = process.env.PORT || 8080;

// Simple secret for token generation (built-in crypto only)
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'aslanpay_staging_secret_2024_builtin';

// ====================================
// SECURITY & MIDDLEWARE 
// ====================================

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(cors({
    origin: [
        'https://aslanpay.xyz',
        'https://aslanpay-production.up.railway.app',
        'http://localhost:8080',
        'http://localhost:3000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// ====================================
// AI AGENT API KEYS
// ====================================

const apiKeys = new Map();

function initializeApiKeys() {
    const keys = [
        {
            id: 'key_default_001',
            name: 'Default API Key',
            key: 'ak_live_0c24567d3ead94e0e134b8e8a4d4f699d052b14d057d44d499cd413130ea2545',
            permissions: ['authorize', 'confirm', 'refund'],
            isActive: true,
            createdAt: new Date().toISOString(),
            lastUsed: null,
            usageCount: 0,
            environment: 'live'
        }
    ];
    
    keys.forEach(key => {
        apiKeys.set(key.key, key);
    });
    
    console.log(`✅ Initialized ${keys.length} default API key`);
}

// API key validation middleware for AI agents
function validateApiKey(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Missing or invalid authorization header',
                code: 'MISSING_API_KEY'
            });
        }

        const apiKey = authHeader.substring(7).trim();
        
        if (!apiKey.startsWith('ak_live_') && !apiKey.startsWith('ak_test_')) {
            return res.status(401).json({
                error: 'Invalid API key format',
                code: 'INVALID_API_KEY_FORMAT'
            });
        }

        const keyData = apiKeys.get(apiKey);
        if (!keyData || !keyData.isActive) {
            return res.status(401).json({
                error: 'Invalid or revoked API key',
                code: 'INVALID_API_KEY'
            });
        }

        // Update usage stats
        keyData.lastUsed = new Date().toISOString();
        keyData.usageCount++;

        req.apiKey = keyData;
        req.user = { id: keyData.id, keyId: keyData.id };
        
        next();
    } catch (error) {
        console.error('API key validation error:', error);
        res.status(500).json({
            error: 'Authentication service error',
            code: 'AUTH_SERVICE_ERROR'
        });
    }
}

// ====================================
// CORE ENDPOINTS
// ====================================

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'AslanPay API',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        features: {
            aiAgentAuth: 'working',
            dualAuth: 'enabled',
            authMethod: 'builtin-crypto'
        }
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        service: 'AslanPay API',
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'staging',
        timestamp: new Date().toISOString(),
        features: {
            authentication: 'WORKING',
            purchase: 'WORKING', 
            demo: 'WORKING'
        },
        stats: {
            apiKeys: apiKeys.size
        }
    });
});

// ====================================
// V1/V2 ENDPOINTS
// ====================================

// V1 Purchase Direct Endpoint
app.post('/v1/purchase-direct', (req, res) => {
    try {
        const { agentToken, service, params } = req.body;
        const startTime = Date.now();
        
        if (!agentToken || typeof agentToken !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Agent token is required',
                code: 'INVALID_TOKEN'
            });
        }
        
        // Validate API key
        const keyData = apiKeys.get(agentToken);
        if (!keyData || !keyData.isActive) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or revoked agent token',
                code: 'INVALID_AGENT_TOKEN'
            });
        }
        
        if (!service || typeof service !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Service is required',
                code: 'INVALID_SERVICE'
            });
        }
        
        // Update key usage
        keyData.lastUsed = new Date().toISOString();
        keyData.usageCount++;
        
        // Calculate cost
        let estimatedCost = 0;
        switch (service) {
            case 'test':
                estimatedCost = params?.amount || 25;
                break;
            case 'gift-card':
                estimatedCost = params?.amount || 25;
                break;
            case 'domain':
                estimatedCost = 12.99 * (params?.years || 1);
                break;
            case 'sms':
                estimatedCost = 0.01;
                break;
            default:
                estimatedCost = params?.amount || 25;
        }
        
        // Simulate processing
        const processingDelay = 50 + Math.random() * 100;
        
        setTimeout(() => {
            const transactionId = `tx_aslan_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
            const latency = Date.now() - startTime;
            
            console.log(`🛒 AI Agent purchase: ${service} for $${estimatedCost} by ${keyData.name} (${latency}ms)`);
            
            res.json({
                success: true,
                transactionId,
                amount: estimatedCost,
                service,
                details: {
                    service,
                    params: params || {},
                    note: 'Purchase processed successfully',
                    timestamp: new Date().toISOString()
                },
                latency,
                message: `Successfully purchased ${service} for $${estimatedCost}`,
                authorizedBy: keyData.name
            });
        }, processingDelay);
        
    } catch (error) {
        console.error('AI purchase error:', error);
        res.status(500).json({
            success: false,
            error: 'Purchase processing failed',
            code: 'PURCHASE_ERROR'
        });
    }
});

// V2 Authorize Endpoint
app.post('/api/v2/authorize', validateApiKey, (req, res) => {
    try {
        const { amount, currency = 'USD', description, metadata } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Amount must be greater than 0',
                code: 'INVALID_AMOUNT'
            });
        }
        
        const authorizationId = 'auth_v2_' + crypto.randomBytes(8).toString('hex');
        
        console.log(`💳 V2 Payment authorized: ${authorizationId} for $${amount} by ${req.apiKey.name}`);
        
        res.json({
            success: true,
            authorizationId,
            amount,
            currency,
            description: description || 'Payment authorization',
            status: 'authorized',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            metadata: metadata || {},
            authorizedBy: req.apiKey.name,
            version: '2.0'
        });
        
    } catch (error) {
        console.error('V2 Authorization error:', error);
        res.status(500).json({
            success: false,
            error: 'Payment authorization failed',
            code: 'AUTHORIZATION_ERROR'
        });
    }
});

// V1 Authorize Endpoint (backward compatibility)
app.post('/api/authorize', validateApiKey, (req, res) => {
    try {
        const { amount, currency = 'USD', description, metadata } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Amount must be greater than 0',
                code: 'INVALID_AMOUNT'
            });
        }
        
        const authorizationId = 'auth_v1_' + crypto.randomBytes(8).toString('hex');
        
        console.log(`💳 V1 Payment authorized: ${authorizationId} for $${amount} by ${req.apiKey.name}`);
        
        res.json({
            success: true,
            authorizationId,
            amount,
            currency,
            description: description || 'Payment authorization',
            status: 'authorized',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            metadata: metadata || {},
            authorizedBy: req.apiKey.name
        });
        
    } catch (error) {
        console.error('V1 Authorization error:', error);
        res.status(500).json({
            success: false,
            error: 'Payment authorization failed',
            code: 'AUTHORIZATION_ERROR'
        });
    }
});

// ====================================
// DEMO SPENDING CONTROLS
// ====================================

let demoState = {
    totalSpent: 0,
    transactionCount: 0,
    emergencyStop: false,
    dailyLimit: 100,
    maxTransactions: 10,
    recentTransactions: []
};

app.post('/api/demo/purchase', (req, res) => {
    const { amount, service, description } = req.body;
    const startTime = Date.now();
    
    console.log(`🎮 Demo purchase attempt: $${amount} for ${service}`);
    
    const processingDelay = 45 + Math.random() * 55;
    
    setTimeout(() => {
        demoState.totalSpent += amount;
        demoState.transactionCount++;
        
        const transactionId = `demo_aslan_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        const transaction = {
            id: transactionId,
            amount,
            service,
            description,
            timestamp: Date.now()
        };
        
        demoState.recentTransactions.push(transaction);
        if (demoState.recentTransactions.length > 50) {
            demoState.recentTransactions = demoState.recentTransactions.slice(-50);
        }
        
        const latency = Date.now() - startTime;
        console.log(`✅ Demo purchase SUCCESS: ${transactionId} - $${amount} in ${latency}ms`);
        
        res.json({
            success: true,
            transactionId,
            amount,
            service,
            latency,
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

app.get('/api/demo/spending-status', (req, res) => {
    const startTime = Date.now();
    
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
            latency
        });
    }, 20 + Math.random() * 15);
});

// ====================================
// API KEYS MANAGEMENT
// ====================================

app.get('/api/keys', (req, res) => {
    try {
        const allKeys = Array.from(apiKeys.values()).map(key => ({
            id: key.id,
            name: key.name,
            key: key.key,
            permissions: key.permissions,
            isActive: key.isActive,
            createdAt: key.createdAt,
            lastUsed: key.lastUsed,
            usageCount: key.usageCount,
            environment: key.environment
        }));
        
        res.json({
            success: true,
            keys: allKeys,
            total: allKeys.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error in GET /api/keys:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch API keys',
            details: error.message
        });
    }
});

// ====================================
// STATIC FILES & ROUTING
// ====================================

app.use(express.static(path.join(__dirname, '../frontend/public')));

// Serve the API documentation page
app.get('/api', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/api.html'));
});

const routes = ['/pricing', '/comparison', '/docs', '/demo', '/security', '/status', '/dashboard', '/auth'];

routes.forEach(route => {
    app.get(route, (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/public', route.substring(1) + '.html'));
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// ====================================
// ERROR HANDLING
// ====================================

app.use((req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/v1/') || req.path.startsWith('/v2/')) {
        res.status(404).json({
            error: 'API endpoint not found',
            code: 'NOT_FOUND',
            path: req.path
        });
    } else {
        res.status(404).sendFile(path.join(__dirname, '../frontend/public/index.html'));
    }
});

app.use((error, req, res, next) => {
    console.error('Server error:', error.message);
    
    if (req.path.startsWith('/api/') || req.path.startsWith('/v1/') || req.path.startsWith('/v2/')) {
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR',
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(500).send('Internal Server Error');
    }
});

// ====================================
// STARTUP
// ====================================

initializeApiKeys();

console.log('✅ AslanPay API v2.0 initialized');
console.log(`🔑 AI Agent API Keys: ${apiKeys.size} initialized`);
console.log('✅ Available endpoints:');
console.log('   - POST /v1/purchase-direct (AI agent purchases)');
console.log('   - POST /api/v2/authorize (V2 authorization)');
console.log('   - POST /api/authorize (V1 authorization)');
console.log('   - POST /api/demo/purchase (Demo purchases)');
console.log('   - GET /api/keys (API key management)');

module.exports = app; 