const crypto = require('crypto');

// Store CSRF tokens in memory (use Redis in production)
const csrfTokens = new Map();

// CSRF token configuration
const CSRF_TOKEN_LENGTH = 32;
const CSRF_TOKEN_EXPIRY = 3600000; // 1 hour

class CSRFProtection {
    /**
     * Generate a new CSRF token for a session
     */
    static generateToken(sessionId) {
        const token = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
        const expiry = Date.now() + CSRF_TOKEN_EXPIRY;
        
        // Store token with session binding
        csrfTokens.set(token, {
            sessionId,
            expiry,
            used: false
        });
        
        // Clean up expired tokens periodically
        this.cleanupExpiredTokens();
        
        return token;
    }
    
    /**
     * Validate a CSRF token
     */
    static validateToken(token, sessionId) {
        const tokenData = csrfTokens.get(token);
        
        if (!tokenData) {
            return { valid: false, reason: 'Token not found' };
        }
        
        if (tokenData.sessionId !== sessionId) {
            return { valid: false, reason: 'Token session mismatch' };
        }
        
        if (tokenData.expiry < Date.now()) {
            csrfTokens.delete(token);
            return { valid: false, reason: 'Token expired' };
        }
        
        if (tokenData.used) {
            return { valid: false, reason: 'Token already used' };
        }
        
        // Mark token as used (single-use tokens)
        tokenData.used = true;
        
        return { valid: true };
    }
    
    /**
     * Clean up expired tokens
     */
    static cleanupExpiredTokens() {
        const now = Date.now();
        for (const [token, data] of csrfTokens.entries()) {
            if (data.expiry < now) {
                csrfTokens.delete(token);
            }
        }
    }
    
    /**
     * Middleware to inject CSRF token into response
     */
    static injectToken() {
        return (req, res, next) => {
            // Skip for API endpoints that use API key auth
            if (req.path.startsWith('/api/v1/')) {
                return next();
            }
            
            // Generate token for authenticated sessions
            if (req.session?.id) {
                const token = this.generateToken(req.session.id);
                
                // Set token in response locals for templates
                res.locals.csrfToken = token;
                
                // Also set as a secure, httpOnly cookie
                res.cookie('_csrf', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: CSRF_TOKEN_EXPIRY
                });
            }
            
            next();
        };
    }
    
    /**
     * Middleware to validate CSRF token on state-changing requests
     */
    static validateRequest() {
        return (req, res, next) => {
            // Skip CSRF check for safe methods
            if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
                return next();
            }
            
            // Skip CSRF check for public endpoints
            const publicPaths = [
                '/api/auth/login',
                '/api/auth/register',
                '/api/auth/forgot-password',
                '/api/auth/reset-password',
                '/api/auth/verify-email',
                '/api/webhook',
                '/api/csrf-token',
                '/csp-report',
                '/api/v1/'  // Skip all API v1 endpoints that use request signing
            ];
            
            if (publicPaths.some(path => req.path === path || req.path.startsWith(path))) {
                return next();
            }
            
            // Skip for API endpoints with proper authentication headers
            if (req.headers['x-api-key'] || req.headers.authorization?.startsWith('Bearer ')) {
                return next();
            }
            
            // Get token from header or body
            const token = req.headers['x-csrf-token'] || req.body._csrf;
            
            if (!token) {
                return res.status(403).json({
                    error: 'CSRF token missing',
                    code: 'CSRF_TOKEN_MISSING'
                });
            }
            
            // Validate token
            const sessionId = req.session?.id || 'anonymous';
            const result = this.validateToken(token, sessionId);
            
            if (!result.valid) {
                // Log security event
                console.warn('⚠️  CSRF validation failed:', result.reason);
                
                return res.status(403).json({
                    error: 'Invalid CSRF token',
                    code: 'CSRF_TOKEN_INVALID',
                    reason: result.reason
                });
            }
            
            // Token is valid, continue
            next();
        };
    }
    
    /**
     * Get CSRF token for current session (for AJAX requests)
     */
    static getTokenEndpoint() {
        return (req, res) => {
            if (!req.session?.id) {
                return res.status(401).json({
                    error: 'Authentication required',
                    code: 'NOT_AUTHENTICATED'
                });
            }
            
            const token = this.generateToken(req.session.id);
            
            res.json({
                csrfToken: token,
                expiresIn: CSRF_TOKEN_EXPIRY / 1000 // seconds
            });
        };
    }
    
    /**
     * Check if path is exempt from CSRF
     */
    isExemptPath(path) {
        const exemptPaths = [
            '/api/auth/login',
            '/api/auth/register',
            '/api/auth/forgot-password',
            '/api/auth/reset-password',
            '/api/auth/verify-email',
            '/api/auth/oauth/callback',
            '/api/v1/authorize',
            '/api/v1/confirm',
            '/api/v1/refund',
            '/api/health',
            '/api/status',
            '/api/csrf-token',
            '/api/keys' // Temporarily exempt for testing
        ];
        
        return exemptPaths.some(exempt => path.startsWith(exempt));
    }
}

// Run cleanup every 5 minutes
setInterval(() => {
    CSRFProtection.cleanupExpiredTokens();
}, 5 * 60 * 1000);

module.exports = CSRFProtection; 