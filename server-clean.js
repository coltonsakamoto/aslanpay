require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const path = require('path');

console.log('🚀 CleanPay API System v2.0 - Dual Authentication (AI + Users)');

const app = express();
const port = process.env.PORT || 3000;

// Simple secret for token generation (built-in crypto only)
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'cleanpay_staging_secret_2024_builtin';

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
        'https://web-staging-16bc.up.railway.app',
        'https://aslanpay.xyz',
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
// DUAL STORAGE SYSTEMS
// ====================================

// AI Agent API Keys (existing system)
const apiKeys = new Map();

// User Authentication System (new system - built-in crypto only)
const users = new Map(); // email -> user object
const sessions = new Map(); // sessionId -> user data

// File path for persistent user storage
const USERS_FILE = './users-persistent.json';

// ====================================
// USER AUTHENTICATION SYSTEM (SIMPLIFIED)
// ====================================

// Load users from persistent storage
function loadUsers() {
    try {
        if (require('fs').existsSync(USERS_FILE)) {
            const data = require('fs').readFileSync(USERS_FILE, 'utf8');
            const usersArray = JSON.parse(data);
            usersArray.forEach(user => {
                users.set(user.email, user);
            });
            console.log(`📂 Loaded ${usersArray.length} existing users from persistent storage`);
        }
    } catch (error) {
        console.log('📂 No existing users file found, starting fresh');
    }
}

// Save users to persistent storage
function saveUsers() {
    try {
        const usersArray = Array.from(users.values());
        require('fs').writeFileSync(USERS_FILE, JSON.stringify(usersArray, null, 2));
        console.log(`💾 Saved ${usersArray.length} users to persistent storage`);
    } catch (error) {
        console.error('❌ Error saving users:', error.message);
    }
}

// Initialize user storage
function initializeUsers() {
    loadUsers(); // Load existing users on startup
    console.log('✅ User authentication system initialized (built-in crypto + persistent storage)');
}

// Simple password hashing using built-in crypto
function hashPassword(password, salt) {
    if (!salt) {
        salt = crypto.randomBytes(16).toString('hex');
    }
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256').toString('hex');
    return { hash, salt };
}

// Verify password using built-in crypto
function verifyPassword(password, storedHash, storedSalt) {
    const { hash } = hashPassword(password, storedSalt);
    return hash === storedHash;
}

// Generate self-contained token using built-in crypto (no session dependency)
function generateToken(user) {
    const timestamp = Date.now().toString();
    const userData = JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        ts: timestamp
    });
    
    // Create signature
    const signature = crypto.createHmac('sha256', TOKEN_SECRET)
        .update(userData)
        .digest('hex');
    
    // Encode user data in base64
    const encodedData = Buffer.from(userData).toString('base64');
    
    return `${encodedData}.${signature}`;
}

// Verify self-contained token
function verifyToken(token) {
    try {
        const [encodedData, signature] = token.split('.');
        
        if (!encodedData || !signature) {
            return null;
        }
        
        // Decode user data
        const userData = Buffer.from(encodedData, 'base64').toString();
        const data = JSON.parse(userData);
        
        // Verify signature
        const expectedSignature = crypto.createHmac('sha256', TOKEN_SECRET)
            .update(userData)
            .digest('hex');
        
        if (signature !== expectedSignature) {
            return null;
        }
        
        // Check if token is expired (7 days)
        const tokenTime = parseInt(data.ts);
        const now = Date.now();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        
        if (now - tokenTime > sevenDays) {
            return null;
        }
        
        // Return user data
        return {
            id: data.id,
            email: data.email,
            name: data.name
        };
        
    } catch (error) {
        return null;
    }
}

// Create user
function createUser(userData) {
    const { email, password, name, organizationName } = userData;
    
    // Check if user exists
    if (users.has(email)) {
        throw new Error('User already exists');
    }
    
    // Hash password with built-in crypto
    const { hash, salt } = hashPassword(password);
    
    // Create user object
    const user = {
        id: 'user_' + crypto.randomBytes(8).toString('hex'),
        email,
        name,
        organizationName: organizationName || `${name}'s Organization`,
        passwordHash: hash,
        passwordSalt: salt,
        createdAt: new Date().toISOString(),
        emailVerified: true, // Auto-verify for staging
        isActive: true
    };
    
    // Store user
    users.set(email, user);
    
    // Save to persistent storage
    saveUsers();
    
    console.log(`👤 User created: ${email} (${user.id})`);
    return user;
}

// Authenticate user
function authenticateUser(email, password) {
    const user = users.get(email);
    if (!user || !user.isActive) {
        return null;
    }
    
    const isValid = verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!isValid) {
        return null;
    }
    
    return user;
}

// Create session
function createSession(user) {
    const sessionId = 'sess_' + crypto.randomBytes(16).toString('hex');
    const sessionData = {
        id: sessionId,
        userId: user.id,
        email: user.email,
        name: user.name,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
    };
    
    sessions.set(sessionId, sessionData);
    return sessionId;
}

// Get session
function getSession(sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
        session.lastUsed = new Date().toISOString();
    }
    return session;
}

// Simple JWT-like authentication middleware for web users
function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Missing or invalid authorization header',
            code: 'MISSING_TOKEN'
        });
    }
    
    const token = authHeader.substring(7).trim();
    const userData = verifyToken(token);
    
    if (!userData) {
        return res.status(401).json({
            error: 'Invalid or expired token',
            code: 'INVALID_TOKEN'
        });
    }
    
    // Attach user info to request (token is self-contained)
    req.user = userData;
    req.userId = userData.id;
    
    next();
}

// ====================================
// EXISTING API KEY SYSTEM (AI AGENTS)
// ====================================

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
        service: 'CleanPay API',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        features: {
            aiAgentAuth: 'working',
            userAuth: 'working',
            dualAuth: 'enabled',
            authMethod: 'builtin-crypto'
        }
    });
});

app.get('/api/status', (req, res) => {
    // TEMPORARY: Auto-restore user if missing and in production
    if (users.size === 0 && process.env.NODE_ENV === 'production') {
        try {
            const restoredUser = {
                "id": "e61e6584-c7e1-4242-a378-b85ed1094254",
                "email": "coltonsak@gmail.com", 
                "name": "Colton Sakamoto",
                "organizationName": "Colton Sakamoto's Organization",
                "passwordHash": "7ZZsYahRtZQsm3FCAcGkmOEGjr7yn5UVNaZs7sYP/omWgUG287tzG",
                "passwordSalt": "bcrypt_salt_placeholder",
                "createdAt": "2025-06-16T20:10:10.453Z",
                "emailVerified": true,
                "isActive": true
            };
            users.set(restoredUser.email, restoredUser);
            saveUsers();
            console.log('🔄 Auto-restored user data in production');
        } catch (error) {
            console.error('Failed to auto-restore users:', error);
        }
    }
    
    res.json({
        status: 'online',
        service: 'CleanPay API',
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'staging',
        timestamp: new Date().toISOString(),
        features: {
            authentication: 'WORKING',
            purchase: 'WORKING', 
            demo: 'WORKING',
            userAuth: 'WORKING'
        },
        stats: {
            apiKeys: apiKeys.size,
            users: users.size,
            activeSessions: sessions.size
        }
    });
});

// ====================================
// USER AUTHENTICATION ENDPOINTS
// ====================================

// User Signup
app.post('/api/auth/signup', (req, res) => {
    try {
        const { email, password, name, organizationName } = req.body;
        
        console.log('👤 Signup attempt:', email);
        
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
        
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format',
                code: 'INVALID_EMAIL'
            });
        }
        
        // Create user
        const user = createUser({
            email: email.toLowerCase(),
            password,
            name,
            organizationName
        });
        
        // Generate self-contained token (no session needed)
        const token = generateToken(user);
        
        console.log(`✅ Signup successful: ${email}`);
        
        res.status(201).json({
            success: true,
            message: 'Account created successfully!',
            token: token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                organizationName: user.organizationName
            }
        });
        
    } catch (error) {
        if (error.message === 'User already exists') {
            return res.status(409).json({
                success: false,
                error: 'An account with this email already exists',
                code: 'EMAIL_EXISTS'
            });
        }
        
        console.error('❌ Signup error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during signup',
            code: 'SIGNUP_ERROR'
        });
    }
});

// User Login
app.post('/api/auth/login', (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log('🔐 Login attempt:', email);
        
        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required',
                code: 'MISSING_CREDENTIALS'
            });
        }
        
        // Authenticate user
        const user = authenticateUser(email.toLowerCase(), password);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password',
                code: 'INVALID_CREDENTIALS'
            });
        }
        
        // Generate self-contained token (no session needed)
        const token = generateToken(user);
        
        console.log(`✅ Login successful: ${email}`);
        
        res.json({
            success: true,
            message: 'Login successful',
            token: token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                organizationName: user.organizationName,
                emailVerified: user.emailVerified
            }
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

// Auth Status Check
app.get('/api/auth/status', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.json({
                authenticated: false,
                user: null
            });
        }
        
        const token = authHeader.substring(7).trim();
        const userData = verifyToken(token);
        
        if (!userData) {
            return res.json({
                authenticated: false,
                user: null
            });
        }
        
        res.json({
            authenticated: true,
            user: {
                id: userData.id,
                email: userData.email,
                name: userData.name
            }
        });
        
    } catch (error) {
        console.error('❌ Auth status error:', error);
        res.json({
            authenticated: false,
            user: null
        });
    }
});

// ====================================
// API KEYS MANAGEMENT (WEB USERS)
// ====================================

// List API keys (available to both systems)
app.get('/api/keys', (req, res) => {
    try {
        const keyList = Array.from(apiKeys.values()).map(key => ({
            id: key.id,
            name: key.name,
            key: key.key,
            permissions: key.permissions,
            createdAt: key.createdAt,
            lastUsed: key.lastUsed,
            usageCount: key.usageCount,
            isActive: key.isActive,
            environment: key.environment || 'live'
        }));

        res.json({
            success: true,
            keys: keyList,
            total: keyList.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to retrieve API keys',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Create new API key
app.post('/api/keys', (req, res) => {
    try {
        const { name, environment = 'live' } = req.body;
        
        // Validation
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'API key name is required',
                code: 'MISSING_NAME'
            });
        }
        
        if (name.trim().length > 50) {
            return res.status(400).json({
                success: false,
                error: 'API key name must be 50 characters or less',
                code: 'NAME_TOO_LONG'
            });
        }
        
        // Generate new API key
        const keyId = 'key_' + crypto.randomBytes(8).toString('hex');
        const keyPrefix = environment === 'test' ? 'ak_test_' : 'ak_live_';
        const keyValue = keyPrefix + crypto.randomBytes(32).toString('hex');
        
        const newKey = {
            id: keyId,
            name: name.trim(),
            key: keyValue,
            permissions: ['authorize', 'confirm'],
            isActive: true,
            createdAt: new Date().toISOString(),
            lastUsed: null,
            usageCount: 0,
            environment: environment
        };
        
        // Store the key
        apiKeys.set(keyValue, newKey);
        
        console.log(`🔑 New API key created: ${name.trim()} (${keyId})`);
        
        res.status(201).json({
            success: true,
            message: 'API key created successfully',
            key: newKey,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Create API key error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create API key',
            code: 'CREATE_ERROR'
        });
    }
});

// Rotate API key (generate new key value, invalidate old)
app.post('/api/keys/:keyId/rotate', (req, res) => {
    try {
        const { keyId } = req.params;
        
        // Find existing key by ID
        let existingKey = null;
        let oldKeyValue = null;
        
        for (const [keyValue, keyData] of apiKeys.entries()) {
            if (keyData.id === keyId) {
                existingKey = keyData;
                oldKeyValue = keyValue;
                break;
            }
        }
        
        if (!existingKey) {
            return res.status(404).json({
                success: false,
                error: 'API key not found',
                code: 'KEY_NOT_FOUND'
            });
        }
        
        if (!existingKey.isActive) {
            return res.status(400).json({
                success: false,
                error: 'Cannot rotate inactive API key',
                code: 'KEY_INACTIVE'
            });
        }
        
        // Generate new key value
        const keyPrefix = existingKey.environment === 'test' ? 'ak_test_' : 'ak_live_';
        const newKeyValue = keyPrefix + crypto.randomBytes(32).toString('hex');
        
        // Update key data
        const rotatedKey = {
            ...existingKey,
            key: newKeyValue,
            lastUsed: null, // Reset usage stats
            usageCount: 0,
            rotatedAt: new Date().toISOString()
        };
        
        // Remove old key and add new one
        apiKeys.delete(oldKeyValue);
        apiKeys.set(newKeyValue, rotatedKey);
        
        console.log(`🔄 API key rotated: ${existingKey.name} (${keyId})`);
        
        res.json({
            success: true,
            message: 'API key rotated successfully',
            key: rotatedKey,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Rotate API key error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to rotate API key',
            code: 'ROTATE_ERROR'
        });
    }
});

// Revoke API key (deactivate)
app.delete('/api/keys/:keyId', (req, res) => {
    try {
        const { keyId } = req.params;
        
        // Find existing key by ID
        let existingKey = null;
        let keyValue = null;
        
        for (const [kv, keyData] of apiKeys.entries()) {
            if (keyData.id === keyId) {
                existingKey = keyData;
                keyValue = kv;
                break;
            }
        }
        
        if (!existingKey) {
            return res.status(404).json({
                success: false,
                error: 'API key not found',
                code: 'KEY_NOT_FOUND'
            });
        }
        
        if (!existingKey.isActive) {
            return res.status(400).json({
                success: false,
                error: 'API key is already inactive',
                code: 'KEY_ALREADY_INACTIVE'
            });
        }
        
        // Deactivate the key (don't delete, just mark inactive)
        existingKey.isActive = false;
        existingKey.revokedAt = new Date().toISOString();
        
        console.log(`🗑️ API key revoked: ${existingKey.name} (${keyId})`);
        
        res.json({
            success: true,
            message: 'API key revoked successfully',
            key: existingKey,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Revoke API key error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to revoke API key',
            code: 'REVOKE_ERROR'
        });
    }
});

// ====================================
// AI AGENT ENDPOINTS (EXISTING)
// ====================================

// Payment authorization (with API key auth)
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
        
        const authorizationId = 'auth_clean_' + crypto.randomBytes(8).toString('hex');
        
        console.log(`💳 Payment authorized: ${authorizationId} for $${amount} by ${req.apiKey.name}`);
        
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
        console.error('Authorization error:', error);
        res.status(500).json({
            success: false,
            error: 'Payment authorization failed',
            code: 'AUTHORIZATION_ERROR'
        });
    }
});

// V2 Authorization Endpoint 
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

// AI Agent Purchase Endpoint
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
            const transactionId = `tx_clean_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
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

// ====================================
// DEMO SPENDING CONTROLS (EXISTING)
// ====================================

let demoState = {
    totalSpent: 0,
    transactionCount: 0,
    emergencyStop: false,
    dailyLimit: 100,
    maxTransactions: 10,
    recentTransactions: []
};

function validateDemoSpending(amount, service, description) {
    const result = { approved: false, reason: '', spamDetected: false };
    
    if (demoState.emergencyStop) {
        result.reason = 'Emergency stop is active - all transactions blocked';
        return result;
    }
    
    const now = Date.now();
    const spamWindow = 30 * 1000;
    const identicalTransactions = demoState.recentTransactions.filter(tx => {
        return (now - tx.timestamp < spamWindow) &&
               tx.amount === amount &&
               tx.service === service &&
               tx.description === description;
    });
    
    if (identicalTransactions.length > 0) {
        result.reason = 'DUPLICATE BLOCKED: Identical transaction already processed within 30 seconds';
        result.spamDetected = true;
        return result;
    }
    
    const newTotal = demoState.totalSpent + amount;
    if (newTotal > demoState.dailyLimit) {
        result.reason = `Would exceed daily limit of $${demoState.dailyLimit} (attempting $${newTotal})`;
        return result;
    }
    
    if (demoState.transactionCount >= demoState.maxTransactions) {
        result.reason = `Maximum ${demoState.maxTransactions} transactions per day reached`;
        return result;
    }
    
    result.approved = true;
    return result;
}

app.post('/api/demo/purchase', (req, res) => {
    const { amount, service, description } = req.body;
    const startTime = Date.now();
    
    console.log(`🎮 Demo purchase attempt: $${amount} for ${service}`);
    
    const validation = validateDemoSpending(amount, service, description);
    
    if (!validation.approved) {
        const processingDelay = 25 + Math.random() * 35;
        
        setTimeout(() => {
            const latency = Date.now() - startTime;
            console.log(`🚨 Demo transaction BLOCKED: ${validation.reason}`);
            
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
                latency,
                message: '🚨 TRANSACTION BLOCKED BY SPENDING CONTROLS'
            });
        }, processingDelay);
        return;
    }
    
    const processingDelay = 45 + Math.random() * 55;
    
    setTimeout(() => {
        demoState.totalSpent += amount;
        demoState.transactionCount++;
        
        const transactionId = `demo_clean_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
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
            spamProtection: {
                recentTransactionsCount: recentTransactions.length,
                totalTrackedTransactions: demoState.recentTransactions.length,
                antiSpamActive: true
            },
            latency
        });
    }, 20 + Math.random() * 15);
});

app.put('/api/demo/spending-controls', (req, res) => {
    const { dailyLimit, maxTransactions, emergencyStop } = req.body;
    const startTime = Date.now();
    
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
            latency
        });
    }, 40 + Math.random() * 30);
});

// ====================================
// STATIC FILES & ROUTING
// ====================================

app.use(express.static(path.join(__dirname, 'frontend/public')));

const routes = ['/pricing', '/comparison', '/docs', '/demo', '/security', '/status', '/dashboard', '/auth'];

routes.forEach(route => {
    app.get(route, (req, res) => {
        res.sendFile(path.join(__dirname, 'frontend/public', route.substring(1) + '.html'));
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/public/index.html'));
});

// ====================================
// ERROR HANDLING
// ====================================

// Serve the API documentation page
app.get('/api', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/public/api.html'));
});

app.use((req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/v1/') || req.path.startsWith('/v2/')) {
        res.status(404).json({
            error: 'API endpoint not found',
            code: 'NOT_FOUND',
            path: req.path
        });
    } else {
        res.status(404).sendFile(path.join(__dirname, 'frontend/public/index.html'));
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

// TEMPORARY: User restore endpoint
app.post('/emergency-restore-users', (req, res) => {
    try {
        const restoredUsers = [
            {
                "id": "e61e6584-c7e1-4242-a378-b85ed1094254",
                "email": "coltonsak@gmail.com", 
                "name": "Colton Sakamoto",
                "organizationName": "Colton Sakamoto's Organization",
                "passwordHash": "7ZZsYahRtZQsm3FCAcGkmOEGjr7yn5UVNaZs7sYP/omWgUG287tzG",
                "passwordSalt": "bcrypt_salt_placeholder",
                "createdAt": "2025-06-16T20:10:10.453Z",
                "emailVerified": true,
                "isActive": true
            }
        ];
        
        // Clear existing users
        users.clear();
        
        // Add restored users
        restoredUsers.forEach(user => {
            users.set(user.email, user);
        });
        
        // Save to file
        saveUsers();
        
        res.json({
            success: true,
            message: 'Users restored',
            userCount: users.size
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ====================================
// STARTUP
// ====================================

initializeApiKeys();
initializeUsers();

app.listen(port, () => {
    console.log(`🚀 CleanPay API v2.0 running on port ${port}`);
    console.log(`🌍 Health: http://localhost:${port}/health`);
    console.log(`🌍 Status: http://localhost:${port}/api/status`);
    console.log(`🔑 AI Agent API Keys: ${apiKeys.size} initialized`);
    console.log(`👤 User Authentication: Ready (built-in crypto)`);
    console.log('✅ Dual authentication system ready:');
    console.log('   - AI Agents: API keys → /v1/purchase-direct');
    console.log('   - Web Users: tokens → /dashboard');
});

module.exports = app;
// Force Railway redeploy Tue Dec 25 09:23:13 PST 2024
// Force staging redeploy with dual auth Wed Jun 25 10:11:58 MDT 2025
// Force restart with 1 default API key Wed Jun 25 11:30:00 MDT 2025
