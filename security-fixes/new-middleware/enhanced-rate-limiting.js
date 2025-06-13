const rateLimit = require('express-rate-limit');
// Make RedisStore optional
let RedisStore;
try {
    RedisStore = require('rate-limit-redis');
} catch (error) {
    console.log('⚠️  rate-limit-redis not found, using in-memory rate limiting');
}
const crypto = require('crypto');

/**
 * Enhanced Rate Limiting Configuration
 * 
 * Implements aggressive rate limiting on critical endpoints
 * with Redis backing for distributed systems
 */

class EnhancedRateLimiter {
    constructor(redisClient = null) {
        this.redisClient = redisClient;
        this.limiters = this.createLimiters();
    }
    
    createLimiters() {
        const createLimiter = (options) => {
            const config = {
                ...options,
                standardHeaders: true,
                legacyHeaders: false,
                handler: (req, res) => {
                    // Log rate limit violations
                    console.warn(`Rate limit exceeded: ${req.ip} on ${req.path}`);
                    
                    res.status(429).json({
                        error: 'Too many requests',
                        code: 'RATE_LIMIT_EXCEEDED',
                        retryAfter: res.getHeader('Retry-After')
                    });
                }
            };
            
            // Use Redis store if available
            if (this.redisClient && RedisStore) {
                config.store = new RedisStore({
                    client: this.redisClient,
                    prefix: `rl:${options.name}:`
                });
            }
            
            return rateLimit(config);
        };
        
        return {
            // CRITICAL: Authentication endpoints - VERY strict
            login: createLimiter({
                name: 'login',
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 5, // Only 5 login attempts per 15 minutes
                skipSuccessfulRequests: false, // Count all attempts
                keyGenerator: (req) => {
                    // Rate limit by IP + email combination
                    const email = req.body?.email || 'unknown';
                    const emailHash = crypto.createHash('sha256').update(email).digest('hex').substring(0, 8);
                    return `${req.ip}:${emailHash}`;
                }
            }),
            
            // Password reset - prevent abuse
            passwordReset: createLimiter({
                name: 'password-reset',
                windowMs: 60 * 60 * 1000, // 1 hour
                max: 3, // Only 3 reset attempts per hour
                skipSuccessfulRequests: false
            }),
            
            // API key creation - prevent key farming
            apiKeyCreation: createLimiter({
                name: 'api-key-create',
                windowMs: 24 * 60 * 60 * 1000, // 24 hours
                max: 10, // Max 10 API keys per day
                keyGenerator: (req) => req.userId || req.ip
            }),
            
            // Payment authorization - prevent fraud
            paymentAuth: createLimiter({
                name: 'payment-auth',
                windowMs: 60 * 1000, // 1 minute
                max: 10, // 10 payment authorizations per minute
                skip: (req) => {
                    // Skip rate limiting for verified merchants
                    return req.user?.verified === true;
                },
                keyGenerator: (req) => req.apiKey?.id || req.ip
            }),
            
            // General API rate limit
            api: createLimiter({
                name: 'api',
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 100, // 100 requests per 15 minutes
                keyGenerator: (req) => req.apiKey?.id || req.ip
            }),
            
            // Strict rate limit for public endpoints
            public: createLimiter({
                name: 'public',
                windowMs: 60 * 1000, // 1 minute
                max: 30, // 30 requests per minute
                keyGenerator: (req) => req.ip
            }),
            
            // User enumeration prevention
            userLookup: createLimiter({
                name: 'user-lookup',
                windowMs: 5 * 60 * 1000, // 5 minutes
                max: 10, // Only 10 user lookups per 5 minutes
                keyGenerator: (req) => req.ip
            }),
            
            // Webhook endpoint protection
            webhook: createLimiter({
                name: 'webhook',
                windowMs: 1000, // 1 second
                max: 5, // 5 webhooks per second max
                keyGenerator: (req) => {
                    // Rate limit by source IP + signature
                    const sig = req.headers['stripe-signature'] || 'no-sig';
                    const sigHash = crypto.createHash('sha256').update(sig).digest('hex').substring(0, 8);
                    return `${req.ip}:${sigHash}`;
                }
            })
        };
    }
    
    // Apply rate limiting based on endpoint
    getMiddleware(type) {
        if (!this.limiters[type]) {
            console.warn(`Unknown rate limiter type: ${type}, using default API limiter`);
            return this.limiters.api;
        }
        return this.limiters[type];
    }
    
    // Compound rate limiting for extra security
    compound(...types) {
        const middlewares = types.map(type => this.getMiddleware(type));
        return (req, res, next) => {
            // Apply all rate limiters in sequence
            let index = 0;
            const runNext = (err) => {
                if (err) return next(err);
                if (index >= middlewares.length) return next();
                const middleware = middlewares[index++];
                middleware(req, res, runNext);
            };
            runNext();
        };
    }
    
    // Dynamic rate limiting based on user behavior
    adaptive() {
        return async (req, res, next) => {
            // Check user's history for suspicious behavior
            if (req.userId) {
                const userKey = `adaptive:${req.userId}`;
                const suspicionScore = await this.getSuspicionScore(req.userId);
                
                if (suspicionScore > 0.7) {
                    // Apply stricter rate limiting for suspicious users
                    const strictLimiter = rateLimit({
                        windowMs: 60 * 1000,
                        max: Math.max(1, Math.floor(10 * (1 - suspicionScore))),
                        keyGenerator: () => userKey
                    });
                    
                    return strictLimiter(req, res, next);
                }
            }
            next();
        };
    }
    
    // Calculate suspicion score based on user behavior
    async getSuspicionScore(userId) {
        if (!this.redisClient) return 0;
        
        try {
            // Check various suspicious behavior indicators
            const indicators = await Promise.all([
                this.redisClient.get(`failed_logins:${userId}`),
                this.redisClient.get(`rate_violations:${userId}`),
                this.redisClient.get(`invalid_requests:${userId}`)
            ]);
            
            const [failedLogins, rateViolations, invalidRequests] = indicators.map(v => parseInt(v) || 0);
            
            // Calculate weighted score
            const score = Math.min(1, (
                (failedLogins * 0.3) +
                (rateViolations * 0.5) +
                (invalidRequests * 0.2)
            ) / 100);
            
            return score;
        } catch (error) {
            console.error('Error calculating suspicion score:', error);
            return 0;
        }
    }
    
    // Clear rate limit for a specific key (admin use only)
    async clearLimit(type, key) {
        if (!this.redisClient) {
            console.warn('Cannot clear rate limits without Redis');
            return false;
        }
        
        try {
            const prefix = `rl:${type}:`;
            await this.redisClient.del(`${prefix}${key}`);
            return true;
        } catch (error) {
            console.error('Error clearing rate limit:', error);
            return false;
        }
    }
}

// Export configured instance
module.exports = EnhancedRateLimiter; 