const crypto = require('crypto');
const SecurityAudit = require('./security-audit');

/**
 * Request Signing Middleware
 * Implements HMAC-based request signing for API authentication
 */
class RequestSigning {
    static SIGNATURE_HEADER = 'x-signature';
    static TIMESTAMP_HEADER = 'x-timestamp';
    static NONCE_HEADER = 'x-nonce';
    static API_KEY_HEADER = 'x-api-key';
    
    // Signature validity window (5 minutes)
    static SIGNATURE_WINDOW = 5 * 60 * 1000;
    
    // Store used nonces to prevent replay attacks
    static usedNonces = new Map();
    static NONCE_CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes

    /**
     * Generate signature for a request
     */
    static generateSignature(method, path, timestamp, nonce, body, secretKey) {
        // Create signing string
        const signingString = [
            method.toUpperCase(),
            path,
            timestamp,
            nonce,
            body ? JSON.stringify(body) : ''
        ].join('\n');
        
        // Generate HMAC
        const hmac = crypto.createHmac('sha256', secretKey);
        hmac.update(signingString);
        return hmac.digest('hex');
    }

    /**
     * Verify request signature
     */
    static verifySignature(req, secretKey) {
        const signature = req.headers[this.SIGNATURE_HEADER];
        const timestamp = req.headers[this.TIMESTAMP_HEADER];
        const nonce = req.headers[this.NONCE_HEADER];
        
        if (!signature || !timestamp || !nonce) {
            return {
                valid: false,
                error: 'Missing signature headers'
            };
        }
        
        // Check timestamp validity
        const requestTime = parseInt(timestamp, 10);
        const now = Date.now();
        
        if (isNaN(requestTime)) {
            return {
                valid: false,
                error: 'Invalid timestamp format'
            };
        }
        
        if (Math.abs(now - requestTime) > this.SIGNATURE_WINDOW) {
            return {
                valid: false,
                error: 'Request timestamp outside valid window'
            };
        }
        
        // Check nonce hasn't been used
        const nonceKey = `${nonce}-${timestamp}`;
        if (this.usedNonces.has(nonceKey)) {
            return {
                valid: false,
                error: 'Nonce already used (replay attack prevention)'
            };
        }
        
        // Calculate expected signature
        const expectedSignature = this.generateSignature(
            req.method,
            req.originalUrl || req.url,
            timestamp,
            nonce,
            req.body,
            secretKey
        );
        
        // Constant-time comparison
        const valid = crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        );
        
        if (valid) {
            // Mark nonce as used
            this.usedNonces.set(nonceKey, Date.now());
        }
        
        return { valid, expectedSignature };
    }

    /**
     * Middleware to verify signed requests
     */
    static requireSignature() {
        return async (req, res, next) => {
            try {
                // Skip signature check for public endpoints
                if (this.isPublicEndpoint(req.path)) {
                    return next();
                }
                
                const apiKey = req.headers[this.API_KEY_HEADER];
                if (!apiKey) {
                    await SecurityAudit.log(
                        SecurityAudit.EVENT_TYPES.API_KEY_INVALID,
                        SecurityAudit.LOG_LEVELS.WARNING,
                        {
                            ...req.auditContext,
                            reason: 'Missing API key header'
                        }
                    );
                    
                    return res.status(401).json({
                        error: 'API key required',
                        code: 'MISSING_API_KEY'
                    });
                }
                
                // Get secret key for API key (from database)
                const apiKeyData = await this.getApiKeyData(apiKey);
                if (!apiKeyData) {
                    await SecurityAudit.log(
                        SecurityAudit.EVENT_TYPES.API_KEY_INVALID,
                        SecurityAudit.LOG_LEVELS.WARNING,
                        {
                            ...req.auditContext,
                            apiKey: apiKey.substring(0, 8) + '...'
                        }
                    );
                    
                    return res.status(401).json({
                        error: 'Invalid API key',
                        code: 'INVALID_API_KEY'
                    });
                }
                
                // Verify signature
                const result = this.verifySignature(req, apiKeyData.secretKey);
                
                if (!result.valid) {
                    await SecurityAudit.log(
                        SecurityAudit.EVENT_TYPES.AUTHORIZATION_FAILED,
                        SecurityAudit.LOG_LEVELS.WARNING,
                        {
                            ...req.auditContext,
                            reason: result.error,
                            apiKeyId: apiKeyData.id
                        }
                    );
                    
                    return res.status(401).json({
                        error: 'Invalid request signature',
                        code: 'INVALID_SIGNATURE',
                        details: result.error
                    });
                }
                
                // Attach API key data to request
                req.apiKey = apiKeyData;
                req.signatureVerified = true;
                
                next();
                
            } catch (error) {
                console.error('Signature verification error:', error);
                
                await SecurityAudit.log(
                    SecurityAudit.EVENT_TYPES.SYSTEM_ERROR,
                    SecurityAudit.LOG_LEVELS.CRITICAL,
                    {
                        ...req.auditContext,
                        error: error.message,
                        stack: error.stack
                    }
                );
                
                res.status(500).json({
                    error: 'Internal server error',
                    code: 'SIGNATURE_VERIFICATION_ERROR'
                });
            }
        };
    }

    /**
     * Helper to generate signed request headers (for client SDK)
     */
    static generateRequestHeaders(method, path, body, apiKey, secretKey) {
        const timestamp = Date.now().toString();
        const nonce = crypto.randomBytes(16).toString('hex');
        
        const signature = this.generateSignature(
            method,
            path,
            timestamp,
            nonce,
            body,
            secretKey
        );
        
        return {
            [this.API_KEY_HEADER]: apiKey,
            [this.SIGNATURE_HEADER]: signature,
            [this.TIMESTAMP_HEADER]: timestamp,
            [this.NONCE_HEADER]: nonce,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Check if endpoint is public (doesn't require signature)
     */
    static isPublicEndpoint(path) {
        const publicPaths = [
            '/auth/login',
            '/auth/register',
            '/auth/forgot-password',
            '/auth/reset-password',
            '/auth/verify-email',
            '/health',
            '/api/csrf-token'
        ];
        
        return publicPaths.some(publicPath => path.startsWith(publicPath));
    }

    /**
     * Get API key data from database (mock implementation)
     */
    static async getApiKeyData(apiKey) {
        // In production, this would query your database
        // For now, using the database module
        const database = require('../config/database');
        
        try {
            const keyData = database.getApiKeyByKey(apiKey);
            if (!keyData) return null;
            
            return {
                id: keyData.id,
                userId: keyData.userId,
                secretKey: keyData.secretKey || apiKey, // In production, store separate secret
                permissions: keyData.permissions || [],
                rateLimit: keyData.rateLimit
            };
        } catch (error) {
            console.error('Error fetching API key:', error);
            return null;
        }
    }

    /**
     * Clean up old nonces periodically
     */
    static startNonceCleanup() {
        setInterval(() => {
            const now = Date.now();
            const cutoff = now - this.SIGNATURE_WINDOW * 2; // Keep nonces for 2x the signature window
            
            let cleaned = 0;
            for (const [nonce, timestamp] of this.usedNonces.entries()) {
                if (timestamp < cutoff) {
                    this.usedNonces.delete(nonce);
                    cleaned++;
                }
            }
            
            if (cleaned > 0) {
                console.log(`🧹 Cleaned up ${cleaned} expired nonces`);
            }
        }, this.NONCE_CLEANUP_INTERVAL);
    }
}

// Start nonce cleanup
RequestSigning.startNonceCleanup();

module.exports = RequestSigning; 