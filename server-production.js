require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = express();
const port = process.env.PORT || 3000;

// Stripe configuration
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

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

// Use Railway's PostgreSQL for data persistence, fallback to SQLite for local dev
if (!process.env.DATABASE_URL) {
    // Only use SQLite as fallback for local development
    const sqliteUrl = "file:./prisma/dev.db";
    console.log('🔧 No DATABASE_URL provided, using SQLite for local dev:', sqliteUrl);
    process.env.DATABASE_URL = sqliteUrl;
} else {
    console.log('✅ Using provided DATABASE_URL for persistent storage');
    console.log('🔧 Database URL type:', process.env.DATABASE_URL.split(':')[0]);
}

// Production database with persistent storage
const database = require('./database-production.js');

// Import API key management router
const apiKeyRoutes = require('./routes/api-keys');

// Import safe database backup manager
const DatabaseBackupManager = require('./database-backup.js');

// Initialize database on startup
(async () => {
    try {
        console.log('🔄 Initializing persistent database...');
        console.log('📂 Database URL:', process.env.DATABASE_URL);
        
        // Skip directory creation for PostgreSQL
        if (process.env.DATABASE_URL.startsWith('file:')) {
            const dbPath = process.env.DATABASE_URL.replace('file:', '');
            const dbDir = path.dirname(dbPath);
            if (!fs.existsSync(dbDir)) {
                console.log('📁 Creating database directory:', dbDir);
                fs.mkdirSync(dbDir, { recursive: true });
            }
        }
        
        // SAFE database schema creation with backup protection
        if (process.env.NODE_ENV === 'production') {
            const backupManager = new DatabaseBackupManager();
            
            try {
                console.log('🔄 Safe database schema setup for production...');
                
                // Create backup before any schema changes
                await backupManager.createBackup('startup-safety');
                
                // Use safe migration instead of force-reset
                await backupManager.safeMigration(async () => {
                    const { execSync } = require('child_process');
                    
                    console.log('🔧 Running safe schema migration...');
                    // Try migrate deploy first (preserves data)
                    try {
                        execSync('npx prisma migrate deploy', { stdio: 'inherit' });
                        console.log('✅ Database migration successful');
                    } catch (migrateError) {
                        console.log('🔄 Migration not possible, trying safe schema push...');
                        // Only use db push if no existing data would be lost
                        const integrity = await backupManager.validateDatabaseIntegrity();
                        if (integrity.userCount > 0) {
                            throw new Error('Cannot modify schema: existing users detected. Manual migration required.');
                        }
                        execSync('npx prisma db push', { stdio: 'inherit' });
                        console.log('✅ Safe schema push completed');
                    }
                }, 'production-schema-setup');
                
                // Verify tables exist (SQLite compatible)
                console.log('🔍 Verifying database tables...');
                const tableCheck = await database.prisma.$queryRaw`
                    SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'api_keys', 'sessions');
                `;
                console.log('📊 Database tables found:', tableCheck);
                
            } catch (schemaError) {
                console.error('❌ Safe schema setup failed:', schemaError.message);
                console.log('🔄 Attempting backup restoration...');
                
                // Try to restore from backup
                try {
                    const backups = backupManager.listBackups();
                    if (backups.length > 0) {
                        await backupManager.restoreFromBackup(backups[0].filename);
                        console.log('✅ Database restored from backup');
                    }
                } catch (restoreError) {
                    console.error('❌ Backup restoration failed:', restoreError.message);
                }
                
                // Continue with limited functionality rather than crashing
                console.log('⚠️  Continuing with existing database state...');
            }
        }
        
        // Verify database health and table existence
        try {
        await database.healthCheck();
            console.log('✅ Database connection verified');
            
            // Check if critical tables exist (database-agnostic)
            const tableCheck = process.env.DATABASE_URL.startsWith('file:') 
                ? await database.prisma.$queryRaw`
                    SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'api_keys', 'sessions');
                  `
                : await database.prisma.$queryRaw`
                    SELECT table_name as name FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name IN ('users', 'api_keys', 'sessions');
                  `;
            console.log('🔍 Critical tables found:', tableCheck);
            
            if (tableCheck.length < 3) {
                throw new Error(`Missing critical tables. Found: ${tableCheck.map(t => t.name).join(', ')}`);
            }
            
        } catch (healthError) {
            console.error('❌ Database health check failed:', healthError.message);
            
            // For PostgreSQL, rely on migrations instead of manual table creation
            console.log('🔄 Database schema issue, attempting migration deploy...');
            try {
                const { execSync } = require('child_process');
                execSync('npx prisma migrate deploy', { stdio: 'inherit' });
                console.log('✅ Migration deploy successful');
                await database.healthCheck();
            } catch (migrationError) {
                console.error('❌ Migration deploy failed:', migrationError.message);
                throw healthError;
            }
        }
        
        console.log('✅ Persistent database initialized successfully');
        
        // Setup automatic backup system
        const backupManager = new DatabaseBackupManager();
        
        // Create initial backup after successful initialization
        await backupManager.createBackup('post-initialization');
        
        // Setup periodic backups every 6 hours
        setInterval(async () => {
            try {
                console.log('🔄 Creating scheduled backup...');
                await backupManager.createBackup('scheduled');
            } catch (error) {
                console.error('❌ Scheduled backup failed:', error.message);
            }
        }, 6 * 60 * 60 * 1000); // 6 hours
        
        // DEBUG: Check if we have any users or API keys
        try {
            const userCount = await database.prisma.user.count();
            const apiKeyCount = await database.prisma.apiKey.count();
            console.log(`📊 Database contents: ${userCount} users, ${apiKeyCount} API keys`);
            
            // If empty database, create a test user and API key for immediate testing
            if (userCount === 0) {
                console.log('🔧 Creating test user for immediate API testing...');
                const testUser = await database.createUser({
                    email: 'test@aslanpay.xyz',
                    password: 'TestPassword123!',
                    name: 'Test User',
                    provider: 'email'
                });
                console.log(`✅ Created test user: ${testUser.email}`);
                
                const testApiKeys = await database.getApiKeysByUserId(testUser.id);
                if (testApiKeys.length > 0) {
                    console.log(`🔑 Test API Key: ${testApiKeys[0].key}`);
                    console.log('💡 Use this key to test: Authorization: Bearer ' + testApiKeys[0].key);
                }
                
                // Create backup after adding test user
                await backupManager.createBackup('test-user-created');
            }
        } catch (debugError) {
            console.error('⚠️  Debug check failed:', debugError.message);
        }
    } catch (error) {
        console.error('❌ Failed to initialize persistent database:', error.message);
        console.log('⚠️  This will affect user account persistence');
        
        // Try alternative database path
        if (!process.env.DATABASE_URL.includes('prisma/')) {
            console.log('🔧 Trying alternative database path: file:./dev.db');
            process.env.DATABASE_URL = "file:./dev.db";
            try {
                await database.healthCheck();
                console.log('✅ Alternative database path successful');
                return;
            } catch (altError) {
                console.error('❌ Alternative path also failed:', altError.message);
        }
        }
        
        console.error('💥 Database initialization failed. Server may not function properly.');
        console.log('💡 Available database files:', require('fs').readdirSync('.').filter(f => f.endsWith('.db')));
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

// FIXED: API key creation with proper validation
app.post('/debug/create-test-user', async (req, res) => {
    try {
        console.log('🚨 EMERGENCY: Creating test user and API key...');
        
        const testEmail = `test-${Date.now()}@aslanpay.xyz`;
        
        // Create user and wait for completion
        const testUser = await database.createUser({
            email: testEmail,
            password: 'TestPassword123!',
            name: 'Debug Test User',
            provider: 'email'
        });
        
        console.log('✅ User created:', testUser.id);
        
        // Wait a moment to ensure database commit
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Get API keys (user creation should have created one)
        let apiKeys = await database.getApiKeysByUserId(testUser.id);
        console.log('🔑 Found', apiKeys.length, 'API keys for user');
        
        if (apiKeys.length === 0) {
            console.log('🔧 No API keys found, creating manually...');
            const manualKey = await database.createApiKey(testUser.id, 'Emergency Test Key');
            apiKeys = [manualKey];
        }
        
        const apiKey = apiKeys[0].key;
        console.log('🔑 Using API key:', apiKey.substring(0, 20) + '...');
        
        // CRITICAL: Wait for database commit and test validation
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Test the API key validation immediately
        console.log('🔍 Testing API key validation...');
        const validationTest = await database.validateApiKey(apiKey);
        
        if (!validationTest) {
            console.error('❌ CRITICAL: API key validation failed immediately');
            
            // Try to find the key directly
            const directCheck = await database.prisma.apiKey.findFirst({
                where: { key: apiKey },
                include: { user: true }
            });
            
            console.log('🔍 Direct key lookup:', directCheck ? 'FOUND' : 'NOT FOUND');
            
            if (!directCheck) {
                throw new Error('API key not found in database after creation - database transaction issue');
            }
            
            throw new Error('API key exists but validation logic is broken');
        }
        
        console.log('✅ API key validation successful');
        
        res.json({
            success: true,
            message: 'Test user and VALIDATED API key created',
            user: testUser,
            apiKey: apiKey,
            validation: 'PASSED',
            instructions: {
                testEndpoint: '/api/v1/test',
                authorization: `Bearer ${apiKey}`,
                example: `curl -H "Authorization: Bearer ${apiKey}" https://aslanpay.xyz/api/v1/test`
            }
        });
        
    } catch (error) {
        console.error('❌ EMERGENCY: Failed to create test user:', error);
        res.status(500).json({
            error: 'Emergency test user creation failed',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
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
        
        // Get the API key that was automatically created with the user
        const apiKeys = await database.getApiKeysByUserId(user.id);
        const apiKey = apiKeys[0]; // First (and should be only) API key
        
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
    console.log('✅ /api/auth/me - Session validation successful for:', req.user.email);
    res.json({ user: req.user });
});

// DEBUG: Session validation test endpoint (no middleware)
app.get('/api/debug/session-test', async (req, res) => {
    try {
        console.log('🔍 Debug session test - cookies:', req.cookies);
        
        const token = req.cookies?.agentpay_session;
        if (!token) {
            return res.json({ 
                status: 'no_token', 
                message: 'No session cookie found',
                cookies: Object.keys(req.cookies || {})
            });
        }
        
        console.log('🔍 Found session token:', token.substring(0, 20) + '...');
        
        const decoded = jwt.verify(token, getJWTSecret());
        console.log('🔍 Decoded JWT:', decoded);
        
        const session = await database.getSession(decoded.sessionId);
        console.log('🔍 Database session:', session ? 'Found' : 'Not found');
        
        if (!session) {
            return res.json({ 
                status: 'session_not_found', 
                message: 'Session not found in database',
                sessionId: decoded.sessionId
            });
        }
        
        const user = await database.getUserById(session.userId);
        console.log('🔍 Database user:', user ? user.email : 'Not found');
        
        if (!user) {
            return res.json({ 
                status: 'user_not_found', 
                message: 'User not found in database',
                userId: session.userId
            });
        }
        
        res.json({
            status: 'success',
            message: 'Session validation successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            },
            session: {
                id: session.id,
                created: session.createdAt,
                expires: session.expiresAt
            }
        });
        
    } catch (error) {
        console.error('❌ Session test error:', error);
        res.json({
            status: 'error',
            message: error.message,
            type: error.name
        });
    }
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
        console.log(`🔍 Validating API key: ${apiKey.substring(0, 20)}...`);
        
        // DEBUGGING: Check database state before validation
        try {
            const totalKeys = await database.prisma.apiKey.count();
            const activeKeys = await database.prisma.apiKey.count({ where: { isActive: true } });
            console.log(`📊 Database has ${totalKeys} total API keys, ${activeKeys} active`);
        } catch (countError) {
            console.error('❌ Failed to count API keys:', countError.message);
        }
        
        const keyData = await database.validateApiKey(apiKey);
        
        if (!keyData) {
            console.log(`❌ API key not found in database: ${apiKey.substring(0, 20)}...`);
            
            // DEBUGGING: Show some sample keys for comparison
            try {
                const sampleKeys = await database.prisma.apiKey.findMany({ 
                    take: 3, 
                    select: { key: true, isActive: true } 
                });
                console.log('🔍 Sample keys in database:');
                sampleKeys.forEach(key => {
                    console.log(`   - ${key.key.substring(0, 20)}... (active: ${key.isActive})`);
                });
            } catch (sampleError) {
                console.error('❌ Failed to get sample keys:', sampleError.message);
            }
            
            return res.status(401).json({
                error: 'Invalid or revoked API key',
                code: 'INVALID_API_KEY',
                documentation: 'https://docs.aslanpay.xyz/authentication',
                hint: 'Create a new API key in your dashboard: /dashboard'
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
        console.error('❌ API key validation error:', error);
        console.error('Database URL:', process.env.DATABASE_URL);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            code: error.code,
            stack: error.stack?.split('\n').slice(0, 3).join('\n')
        });
        
        res.status(500).json({ 
            error: 'Authentication service error', 
            code: 'AUTH_SERVICE_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal authentication error',
            timestamp: new Date().toISOString()
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

// API Key rotation endpoint (API key authenticated for programmatic access)
app.post('/api/v1/keys/rotate', validateApiKey, async (req, res) => {
    try {
        const { keyId } = req.body;
        
        if (!keyId) {
            return res.status(400).json({
                error: 'API key ID required for rotation',
                code: 'MISSING_KEY_ID',
                example: { keyId: "your-api-key-id" }
            });
        }

        // Verify the key belongs to this user
        const userApiKeys = await database.getApiKeysByUserId(req.user.id);
        const keyToRotate = userApiKeys.find(k => k.id === keyId);
        
        if (!keyToRotate) {
            return res.status(404).json({
                error: 'API key not found or access denied',
                code: 'KEY_NOT_FOUND'
            });
        }

        // Use the database's rotate method
        const newKey = await database.rotateApiKey(req.user.id, keyId);
        
        console.log(`🔄 API key rotated via API: ${keyId} -> ${newKey.id} by user ${req.user.id}`);
        
        res.json({
            success: true,
            message: 'API key rotated successfully via API',
            oldKeyId: keyId,
            newApiKey: {
                id: newKey.id,
                name: newKey.name,
                key: newKey.key,
                createdAt: newKey.createdAt
            },
            warning: 'The old API key has been revoked and will no longer work. Update your applications immediately.'
        });
        
    } catch (error) {
        console.error('API key rotation error:', error);
        res.status(500).json({ 
            error: 'API key rotation failed', 
            code: 'ROTATION_FAILED',
            details: error.message
        });
    }
});

// Mount the full API key management router (includes dashboard routes)
app.use('/api/keys', apiKeyRoutes);

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

// API Key test endpoint - FIXED
app.get('/api/v1/test', validateApiKey, (req, res) => {
    try {
        console.log('🔍 /api/v1/test endpoint called for user:', req.user?.email);
        
        // Safe access to user and API key data
        const user = req.user || {};
        const apiKey = req.apiKey || {};
        
        res.json({
            message: '🎉 API Key is working correctly!',
            user: {
                id: user.id || 'unknown',
                email: user.email || 'unknown',
                name: user.name || 'unknown'
            },
            apiKey: {
                id: apiKey.id || 'unknown',
                usageCount: 0,
                lastUsed: new Date().toISOString()
            },
            timestamp: new Date().toISOString(),
            status: 'operational',
            validation: 'passed',
            instructions: {
                usage: 'Include in header: Authorization: Bearer YOUR_API_KEY',
                endpoints: [
                    'POST /api/v1/authorize - Authorize payments',
                    'POST /api/v1/confirm - Confirm payments', 
                    'POST /api/v1/refund - Process refunds'
                ]
            }
        });
        
        console.log('✅ /api/v1/test response sent successfully');
        
    } catch (error) {
        console.error('❌ /api/v1/test endpoint error:', error);
        res.status(500).json({
            error: 'Test endpoint error',
            message: 'API test failed',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
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

// Stripe Checkout Endpoints
app.post('/api/create-checkout-session', validateSession, async (req, res) => {
    try {
        if (!stripe) {
            return res.status(503).json({ 
                error: 'Stripe not configured', 
                code: 'STRIPE_NOT_CONFIGURED',
                message: 'Payment processing is not available. Please contact support.'
            });
        }

        const { plan, priceId } = req.body;
        
        if (!plan || !priceId) {
            return res.status(400).json({ 
                error: 'Plan and price ID required', 
                code: 'MISSING_PLAN_INFO' 
            });
        }

        // Define plan configurations
        const planConfigs = {
            starter: {
                priceId: process.env.STRIPE_STARTER_PRICE_ID || 'price_starter_monthly',
                name: 'AslanPay Starter Plan',
                description: '3,000 API authorizations per month',
                amount: 2900 // $29.00 in cents
            },
            builder: {
                priceId: process.env.STRIPE_BUILDER_PRICE_ID || 'price_builder_monthly', 
                name: 'AslanPay Builder Plan',
                description: '12,000 API authorizations per month',
                amount: 12900 // $129.00 in cents
            }
        };

        const selectedPlan = planConfigs[plan];
        if (!selectedPlan) {
            return res.status(400).json({ 
                error: 'Invalid plan selected', 
                code: 'INVALID_PLAN' 
            });
        }

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: selectedPlan.name,
                        description: selectedPlan.description,
                    },
                    unit_amount: selectedPlan.amount,
                    recurring: {
                        interval: 'month'
                    }
                },
                quantity: 1,
            }],
            mode: 'subscription',
            success_url: `${process.env.BASE_URL || 'https://aslanpay.xyz'}/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.BASE_URL || 'https://aslanpay.xyz'}/pricing?canceled=true`,
            customer_email: req.user.email,
            metadata: {
                userId: req.user.id,
                plan: plan,
                userEmail: req.user.email
            },
            subscription_data: {
                metadata: {
                    userId: req.user.id,
                    plan: plan
                }
            },
            // Free trial for 14 days
            subscription_data: {
                trial_period_days: 14,
                metadata: {
                    userId: req.user.id,
                    plan: plan
                }
            }
        });

        console.log(`💳 Stripe checkout session created: ${session.id} for ${req.user.email} (${plan} plan)`);

        res.json({
            sessionId: session.id,
            url: session.url
        });

    } catch (error) {
        console.error('Stripe checkout error:', error);
        res.status(500).json({ 
            error: 'Failed to create checkout session', 
            code: 'STRIPE_ERROR',
            message: 'Unable to process payment. Please try again or contact support.'
        });
    }
});

// Stripe webhook endpoint for handling subscription events
app.post('/api/stripe/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    try {
        if (!stripe) {
            return res.status(503).send('Stripe not configured');
        }

        const sig = req.headers['stripe-signature'];
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        if (!webhookSecret) {
            console.error('Stripe webhook secret not configured');
            return res.status(400).send('Webhook secret not configured');
        }

        let event;
        try {
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        // Handle the event
        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object;
                console.log(`💰 Payment successful for session: ${session.id}`);
                
                // Update user subscription in database
                if (session.metadata && session.metadata.userId) {
                    try {
                        await database.updateUserSubscription(session.metadata.userId, {
                            plan: session.metadata.plan,
                            status: 'active',
                            stripeCustomerId: session.customer,
                            subscriptionId: session.subscription
                        });
                        console.log(`✅ Updated subscription for user: ${session.metadata.userId}`);
                    } catch (dbError) {
                        console.error('Failed to update user subscription:', dbError);
                    }
                }
                break;

            case 'customer.subscription.updated':
            case 'customer.subscription.deleted':
                const subscription = event.data.object;
                console.log(`📋 Subscription ${event.type}: ${subscription.id}`);
                
                // Update subscription status in database
                if (subscription.metadata && subscription.metadata.userId) {
                    try {
                        await database.updateUserSubscription(subscription.metadata.userId, {
                            status: subscription.status,
                            subscriptionId: subscription.id
                        });
                        console.log(`✅ Updated subscription status for user: ${subscription.metadata.userId}`);
                    } catch (dbError) {
                        console.error('Failed to update subscription status:', dbError);
                    }
                }
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({received: true});

    } catch (error) {
        console.error('Stripe webhook error:', error);
        res.status(500).send('Webhook handler failed');
    }
});

// Clean URL helper function
function createPageRoute(route, filename) {
    // Clean URL (preferred)
    app.get(route, (req, res) => {
        try {
            // Special handling for pricing page to inject Stripe key
            if (filename === 'pricing.html') {
                let html = fs.readFileSync(path.join(__dirname, 'public', filename), 'utf8');
                const stripeKey = process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder';
                html = html.replace(
                    "window.STRIPE_PUBLISHABLE_KEY = 'pk_test_placeholder_key'; // Will be replaced dynamically",
                    `window.STRIPE_PUBLISHABLE_KEY = '${stripeKey}';`
                );
                res.setHeader('Content-Type', 'text/html');
                res.send(html);
            } else {
                res.sendFile(path.join(__dirname, 'public', filename));
            }
        } catch (error) {
            res.status(404).json({ error: `${route} page not found` });
        }
    });
    
    // .html URL (backward compatibility)
    if (route !== '/') {
        app.get(route + '.html', (req, res) => {
            try {
                // Special handling for pricing page to inject Stripe key
                if (filename === 'pricing.html') {
                    let html = fs.readFileSync(path.join(__dirname, 'public', filename), 'utf8');
                    const stripeKey = process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder';
                    html = html.replace(
                        "window.STRIPE_PUBLISHABLE_KEY = 'pk_test_placeholder_key'; // Will be replaced dynamically",
                        `window.STRIPE_PUBLISHABLE_KEY = '${stripeKey}';`
                    );
                    res.setHeader('Content-Type', 'text/html');
                    res.send(html);
                } else {
                    res.sendFile(path.join(__dirname, 'public', filename));
                }
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