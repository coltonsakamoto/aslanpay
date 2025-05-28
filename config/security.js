const crypto = require('crypto');

/**
 * Security Configuration Module
 * Handles environment security, HTTPS enforcement, and security validations
 */

class SecurityConfig {
    constructor() {
        this.isProduction = process.env.NODE_ENV === 'production';
        this.requiredSecrets = ['JWT_SECRET', 'SESSION_SECRET'];
        this.requiredProdVars = ['DATABASE_URL', 'STRIPE_SECRET_KEY', 'CORS_ORIGINS'];
    }

    /**
     * Validate all required environment variables
     */
    validateEnvironment() {
        const errors = [];
        const warnings = [];

        // Check required secrets
        for (const secret of this.requiredSecrets) {
            const value = process.env[secret];
            
            if (!value) {
                errors.push(`Missing required environment variable: ${secret}`);
                continue;
            }

            // Check if using default/weak values
            if (this.isWeakSecret(secret, value)) {
                if (this.isProduction) {
                    errors.push(`${secret} is using a default/weak value in production`);
                } else {
                    warnings.push(`${secret} is using a default/weak value`);
                }
            }

            // Check secret strength
            if (secret === 'JWT_SECRET' && value.length < 32) {
                errors.push(`${secret} must be at least 32 characters long`);
            }
        }

        // Check production-specific variables
        if (this.isProduction) {
            for (const varName of this.requiredProdVars) {
                if (!process.env[varName]) {
                    errors.push(`Missing required production variable: ${varName}`);
                }
            }

            // Validate DATABASE_URL format for production
            const dbUrl = process.env.DATABASE_URL;
            if (dbUrl && !dbUrl.startsWith('postgresql://')) {
                warnings.push('DATABASE_URL should use PostgreSQL in production');
            }

            // Validate Stripe keys are live keys
            const stripeKey = process.env.STRIPE_SECRET_KEY;
            if (stripeKey && !stripeKey.startsWith('sk_live_')) {
                warnings.push('STRIPE_SECRET_KEY should be a live key in production');
            }
        }

        return { errors, warnings };
    }

    /**
     * Check if a secret is using default/weak values
     */
    isWeakSecret(name, value) {
        const weakPatterns = [
            'your-jwt-secret',
            'your_jwt_secret',
            'jwt-secret',
            'change-in-production',
            'change_in_production',
            'secret',
            'password',
            '123456',
            'admin'
        ];

        const lowerValue = value.toLowerCase();
        return weakPatterns.some(pattern => lowerValue.includes(pattern));
    }

    /**
     * Generate secure random secrets
     */
    generateSecureSecret(length = 64) {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Helmet.js security configuration
     */
    getHelmetConfig() {
        return {
            // Content Security Policy
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: [
                        "'self'",
                        "'unsafe-inline'", // Required for some dashboard functionality
                        "https://js.stripe.com",
                        "https://cdn.jsdelivr.net"
                    ],
                    styleSrc: [
                        "'self'",
                        "'unsafe-inline'",
                        "https://fonts.googleapis.com",
                        "https://cdn.jsdelivr.net"
                    ],
                    fontSrc: [
                        "'self'",
                        "https://fonts.gstatic.com"
                    ],
                    imgSrc: [
                        "'self'",
                        "data:",
                        "https:"
                    ],
                    connectSrc: [
                        "'self'",
                        "https://api.stripe.com",
                        "https://checkout.stripe.com"
                    ],
                    frameSrc: [
                        "https://js.stripe.com",
                        "https://hooks.stripe.com"
                    ],
                    formAction: ["'self'"],
                    baseUri: ["'self'"],
                    objectSrc: ["'none'"]
                }
            },
            
            // HTTP Strict Transport Security
            hsts: {
                maxAge: 31536000, // 1 year
                includeSubDomains: true,
                preload: true
            },
            
            // X-Frame-Options
            frameguard: {
                action: 'deny'
            },
            
            // X-Content-Type-Options
            noSniff: true,
            
            // X-XSS-Protection
            xssFilter: true,
            
            // Referrer Policy
            referrerPolicy: {
                policy: 'strict-origin-when-cross-origin'
            },
            
            // Hide X-Powered-By header
            hidePoweredBy: true,
            
            // DNS Prefetch Control
            dnsPrefetchControl: {
                allow: false
            },
            
            // Permissions Policy
            permissionsPolicy: {
                features: {
                    camera: [],
                    microphone: [],
                    geolocation: [],
                    payment: ['self', 'https://checkout.stripe.com']
                }
            }
        };
    }

    /**
     * CORS configuration for production
     */
    getCorsConfig() {
        const corsOrigins = process.env.CORS_ORIGINS 
            ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
            : this.isProduction 
                ? [] // No origins allowed by default in production
                : true; // Allow all in development

        return {
            origin: corsOrigins,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: [
                'Content-Type',
                'Authorization',
                'X-Requested-With',
                'Accept',
                'Origin'
            ],
            exposedHeaders: ['X-Total-Count'],
            maxAge: 86400, // 24 hours
            preflightContinue: false,
            optionsSuccessStatus: 204
        };
    }

    /**
     * Secure cookie configuration
     */
    getCookieConfig() {
        return {
            httpOnly: true,
            secure: this.isProduction, // HTTPS only in production
            sameSite: this.isProduction ? 'strict' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            domain: this.isProduction ? process.env.COOKIE_DOMAIN : undefined
        };
    }

    /**
     * Session configuration
     */
    getSessionConfig() {
        return {
            secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
            name: 'agentpay.sid', // Don't use default 'connect.sid'
            resave: false,
            saveUninitialized: false,
            cookie: this.getCookieConfig(),
            rolling: true, // Reset expiry on activity
            
            // Additional security options
            proxy: this.isProduction, // Trust proxy in production
            genid: () => crypto.randomUUID(), // Use secure session ID generation
        };
    }

    /**
     * Rate limiting configuration
     */
    getRateLimitConfig() {
        return {
            windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
            max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // requests per window
            message: {
                error: 'Too many requests',
                code: 'RATE_LIMIT_EXCEEDED'
            },
            standardHeaders: true,
            legacyHeaders: false,
            skipSuccessfulRequests: false,
            skipFailedRequests: false,
            keyGenerator: (req) => {
                // Use API key if available, otherwise IP
                return req.apiKey?.keyId || req.ip;
            }
        };
    }

    /**
     * HTTPS enforcement middleware
     */
    enforceHTTPS() {
        return (req, res, next) => {
            if (this.isProduction && !req.secure && req.get('x-forwarded-proto') !== 'https') {
                return res.redirect(301, `https://${req.get('host')}${req.url}`);
            }
            next();
        };
    }

    /**
     * Security headers middleware
     */
    securityHeaders() {
        return (req, res, next) => {
            // Additional custom security headers
            res.setHeader('X-API-Version', '1.0');
            res.setHeader('X-Response-Time', Date.now() - req.startTime);
            
            // Remove server information
            res.removeHeader('X-Powered-By');
            res.removeHeader('Server');
            
            next();
        };
    }

    /**
     * Validate request origin
     */
    validateOrigin() {
        return (req, res, next) => {
            if (!this.isProduction) {
                return next(); // Skip validation in development
            }

            const origin = req.get('origin') || req.get('referer');
            const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [];
            
            if (origin && !allowedOrigins.some(allowed => origin.startsWith(allowed.trim()))) {
                console.warn(`Blocked request from unauthorized origin: ${origin}`);
                return res.status(403).json({
                    error: 'Forbidden origin',
                    code: 'UNAUTHORIZED_ORIGIN'
                });
            }

            next();
        };
    }

    /**
     * Get comprehensive security report
     */
    getSecurityReport() {
        const validation = this.validateEnvironment();
        
        return {
            environment: this.isProduction ? 'production' : 'development',
            timestamp: new Date().toISOString(),
            validation,
            features: {
                httpsEnforcement: this.isProduction,
                securityHeaders: true,
                corsProtection: true,
                rateLimiting: true,
                cookieSecurity: this.isProduction,
                sessionSecurity: true
            },
            recommendations: this.getSecurityRecommendations(validation)
        };
    }

    /**
     * Get security recommendations based on current configuration
     */
    getSecurityRecommendations(validation) {
        const recommendations = [];

        if (validation.errors.length > 0) {
            recommendations.push('Fix all environment variable errors before deploying to production');
        }

        if (validation.warnings.length > 0) {
            recommendations.push('Address security warnings for better protection');
        }

        if (this.isProduction) {
            if (!process.env.CORS_ORIGINS) {
                recommendations.push('Set CORS_ORIGINS to restrict allowed domains');
            }
            
            if (!process.env.STRIPE_WEBHOOK_SECRET) {
                recommendations.push('Configure Stripe webhook secret for production');
            }
        }

        if (!this.isProduction) {
            recommendations.push('Use strong secrets and enable HTTPS for production');
        }

        return recommendations;
    }
}

module.exports = new SecurityConfig(); 