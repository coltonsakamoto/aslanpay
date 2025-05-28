const jwt = require('jsonwebtoken');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const database = require('../config/database');

// JWT secret (use environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';

// Rate limiters
const rateLimiters = {
    // API Key rate limiting: 1000 requests per hour per API key
    apiKey: new RateLimiterMemory({
        keyGenerator: (req) => req.apiKey?.keyId || req.ip,
        points: 1000, // Number of requests
        duration: 3600, // Per 3600 seconds (1 hour)
        blockDuration: 3600, // Block for 1 hour if limit exceeded
    }),
    
    // Login rate limiting: 5 attempts per 15 minutes per IP
    login: new RateLimiterMemory({
        keyGenerator: (req) => req.ip,
        points: 5,
        duration: 900, // 15 minutes
        blockDuration: 900,
    }),
    
    // Password reset: 3 attempts per hour per IP
    passwordReset: new RateLimiterMemory({
        keyGenerator: (req) => req.ip,
        points: 3,
        duration: 3600,
        blockDuration: 3600,
    })
};

// Middleware to validate API keys
const validateApiKey = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Missing or invalid authorization header',
                code: 'MISSING_API_KEY'
            });
        }

        const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
        
        // Validate API key format
        if (!apiKey.startsWith('ak_live_') && !apiKey.startsWith('ak_test_')) {
            return res.status(401).json({
                error: 'Invalid API key format',
                code: 'INVALID_API_KEY'
            });
        }

        // Check rate limit for this API key
        try {
            await rateLimiters.apiKey.consume(req);
        } catch (rateLimiterRes) {
            if (rateLimiterRes && rateLimiterRes.msBeforeNext) {
                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    code: 'RATE_LIMIT_EXCEEDED',
                    retryAfter: Math.round(rateLimiterRes.msBeforeNext / 1000)
                });
            } else {
                // Fallback if rate limiter has issues
                console.warn('Rate limiter error:', rateLimiterRes);
                // Continue without rate limiting as fallback
            }
        }

        // Validate API key in database
        const keyData = await database.validateApiKey(apiKey);
        
        if (!keyData) {
            return res.status(401).json({
                error: 'Invalid or revoked API key',
                code: 'INVALID_API_KEY'
            });
        }

        // Check if user's subscription allows API access
        if (keyData.user.subscription.status !== 'active') {
            return res.status(403).json({
                error: 'Account subscription is not active',
                code: 'SUBSCRIPTION_INACTIVE'
            });
        }

        // Attach key and user data to request
        req.apiKey = keyData;
        req.user = keyData.user;
        
        next();
    } catch (error) {
        console.error('API key validation error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

// Middleware to validate JWT tokens (for web dashboard)
const validateSession = async (req, res, next) => {
    console.log('🔍 Session validation started for:', req.path);
    try {
        const token = req.cookies?.session || req.headers.authorization?.substring(7);
        console.log('🔍 Token found:', token ? 'YES' : 'NO');
        
        if (!token) {
            console.log('❌ No session token provided');
            return res.status(401).json({
                error: 'No session token provided',
                code: 'NO_SESSION'
            });
        }

        // Verify JWT token
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
            console.log('🔍 JWT decoded:', decoded);
        } catch (err) {
            console.log('❌ JWT verification failed:', err.message);
            return res.status(401).json({
                error: 'Invalid session token',
                code: 'INVALID_SESSION'
            });
        }

        // Check session in database
        console.log('🔍 Checking session in database:', decoded.sessionId);
        const session = database.getSession(decoded.sessionId);
        console.log('🔍 Session found:', session ? 'YES' : 'NO');
        if (!session) {
            console.log('❌ Session not found or expired');
            return res.status(401).json({
                error: 'Session expired or invalid',
                code: 'SESSION_EXPIRED'
            });
        }

        // Get user data
        console.log('🔍 Getting user data for:', session.userId);
        const user = database.getUserById(session.userId);
        console.log('🔍 User found:', user ? 'YES' : 'NO');
        if (!user) {
            console.log('❌ User not found');
            return res.status(401).json({
                error: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        // Create a session object compatible with express-session
        req.session = {
            id: session.id,
            userId: session.userId,
            touch: () => {}, // Dummy touch method for express-session compatibility
            save: (callback) => callback && callback(),
            destroy: (callback) => callback && callback(),
            ...session
        };
        req.user = user;
        
        console.log('✅ Session validation successful for user:', user.email);
        next();
    } catch (error) {
        console.error('❌ Session validation error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

// Simplified middleware to validate JWT tokens (for debugging)
const validateSessionSimple = async (req, res, next) => {
    console.log('🔍 Simple session validation started for:', req.path);
    
    try {
        const token = req.cookies?.session;
        console.log('🔍 Cookie token:', token ? 'Found' : 'Not found');
        
        if (!token) {
            console.log('❌ No session cookie');
            return res.status(401).json({
                error: 'No session token provided',
                code: 'NO_SESSION'
            });
        }

        // Just verify JWT without database checks for now
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
            console.log('✅ JWT verified successfully, sessionId:', decoded.sessionId);
        } catch (err) {
            console.log('❌ JWT verification failed:', err.message);
            return res.status(401).json({
                error: 'Invalid session token',
                code: 'INVALID_SESSION'
            });
        }

        // Get the session to find the real user ID
        const session = database.getSession(decoded.sessionId);
        if (!session) {
            console.log('❌ Session not found');
            return res.status(401).json({
                error: 'Session expired or invalid',
                code: 'SESSION_EXPIRED'
            });
        }

        // Get the real user
        const user = database.getUserById(session.userId);
        if (!user) {
            console.log('❌ User not found');
            return res.status(401).json({
                error: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        // Create a session object compatible with express-session
        req.session = {
            id: session.id,
            userId: session.userId,
            touch: () => {}, // Dummy touch method for express-session compatibility
            save: (callback) => callback && callback(),
            destroy: (callback) => callback && callback(),
            ...session
        };
        req.user = user;
        
        console.log('✅ Simple session validation successful for user:', user.email);
        next();
        
    } catch (error) {
        console.error('❌ Simple session validation error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};

// Rate limiting middleware for login attempts
const rateLimitLogin = async (req, res, next) => {
    try {
        await rateLimiters.login.consume(req);
        next();
    } catch (rateLimiterRes) {
        res.status(429).json({
            error: 'Too many login attempts',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.round(rateLimiterRes.msBeforeNext / 1000)
        });
    }
};

// Rate limiting middleware for password reset
const rateLimitPasswordReset = async (req, res, next) => {
    try {
        await rateLimiters.passwordReset.consume(req);
        next();
    } catch (rateLimiterRes) {
        res.status(429).json({
            error: 'Too many password reset attempts',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.round(rateLimiterRes.msBeforeNext / 1000)
        });
    }
};

// Middleware to check permissions
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.apiKey || !req.apiKey.permissions.includes(permission)) {
            return res.status(403).json({
                error: `Permission '${permission}' required`,
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }
        next();
    };
};

// Helper function to generate JWT tokens
const generateToken = (sessionId) => {
    return jwt.sign({ sessionId }, JWT_SECRET, { expiresIn: '7d' });
};

module.exports = {
    validateApiKey,
    validateSession,
    validateSessionSimple,
    rateLimitLogin,
    rateLimitPasswordReset,
    requirePermission,
    generateToken,
    JWT_SECRET
}; 