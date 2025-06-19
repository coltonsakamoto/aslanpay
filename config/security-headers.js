const helmet = require('helmet');

/**
 * Security Headers Configuration
 * Implements comprehensive security headers including CSP
 */
class SecurityHeaders {
    /**
     * Get Content Security Policy directives
     */
    static getCSPDirectives() {
        const isDevelopment = process.env.NODE_ENV !== 'production';
        
        return {
            defaultSrc: ["'self'"],
            
            // Scripts: Only from same origin and specific CDNs
            scriptSrc: [
                "'self'",
                "'unsafe-inline'", // Remove in production if possible
                "'unsafe-eval'", // Remove in production
                "https://cdn.jsdelivr.net",
                "https://cdnjs.cloudflare.com",
                "https://cdn.tailwindcss.com", // ✅ CRITICAL FIX: Allow Tailwind CSS
                "https://js.stripe.com",
                // Add nonce support for inline scripts
                (req, res) => `'nonce-${res.locals.nonce}'`
            ],
            
            // Styles: Same origin and specific CDNs
            styleSrc: [
                "'self'",
                "'unsafe-inline'", // For inline styles (try to remove)
                "https://cdn.jsdelivr.net",
                "https://cdnjs.cloudflare.com",
                "https://cdn.tailwindcss.com", // ✅ CRITICAL FIX: Allow Tailwind CSS styles
                "https://fonts.googleapis.com"
            ],
            
            // Images: Same origin and data URIs
            imgSrc: [
                "'self'",
                "data:",
                "https:",
                "blob:"
            ],
            
            // Fonts
            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com",
                "https://cdn.jsdelivr.net"
            ],
            
            // Connect (AJAX, WebSocket, EventSource)
            connectSrc: [
                "'self'",
                "https://api.stripe.com",
                "wss://localhost:*", // WebSocket in dev
                ...(isDevelopment ? ["ws://localhost:*"] : [])
            ],
            
            // Media
            mediaSrc: ["'none'"],
            
            // Objects (plugins)
            objectSrc: ["'none'"],
            
            // Frames
            frameSrc: [
                "'self'",
                "https://js.stripe.com", // Stripe payment frames
                "https://hooks.stripe.com"
            ],
            
            // Frame ancestors (who can frame this site)
            frameAncestors: ["'none'"], // Prevent clickjacking
            
            // Form actions
            formAction: ["'self'"],
            
            // Base URI
            baseUri: ["'self'"],
            
            // Manifest
            manifestSrc: ["'self'"],
            
            // Workers
            workerSrc: ["'self'", "blob:"],
            
            // Upgrade insecure requests in production
            ...(isDevelopment ? {} : { upgradeInsecureRequests: [] })
        };
    }

    /**
     * Generate nonce for inline scripts
     */
    static generateNonce() {
        return require('crypto').randomBytes(16).toString('base64');
    }

    /**
     * Nonce middleware - adds nonce to res.locals
     */
    static nonceMiddleware() {
        return (req, res, next) => {
            res.locals.nonce = this.generateNonce();
            next();
        };
    }

    /**
     * Get complete Helmet configuration
     */
    static getHelmetConfig() {
        const isDevelopment = process.env.NODE_ENV !== 'production';
        
        return {
            // Content Security Policy
            contentSecurityPolicy: {
                directives: this.getCSPDirectives(),
                reportOnly: isDevelopment // Report only in dev, enforce in production
            },
            
            // DNS Prefetch Control
            dnsPrefetchControl: {
                allow: false
            },
            
            // Expect-CT
            expectCt: {
                enforce: true,
                maxAge: 86400 // 1 day
            },
            
            // Frameguard (X-Frame-Options)
            frameguard: {
                action: 'deny' // Prevent clickjacking
            },
            
            // Hide Powered By
            hidePoweredBy: true,
            
            // HSTS (HTTP Strict Transport Security)
            hsts: {
                maxAge: 31536000, // 1 year
                includeSubDomains: true,
                preload: true
            },
            
            // IE No Open
            ieNoOpen: true,
            
            // No Sniff (X-Content-Type-Options)
            noSniff: true,
            
            // Origin Agent Cluster
            originAgentCluster: true,
            
            // Permitted Cross Domain Policies
            permittedCrossDomainPolicies: {
                permittedPolicies: 'none'
            },
            
            // Referrer Policy
            referrerPolicy: {
                policy: 'strict-origin-when-cross-origin'
            },
            
            // XSS Filter (X-XSS-Protection) - Modern best practice is to disable
            xssFilter: false,
            
            // Cross Origin Embedder Policy
            crossOriginEmbedderPolicy: !isDevelopment,
            
            // Cross Origin Opener Policy
            crossOriginOpenerPolicy: {
                policy: 'same-origin'
            },
            
            // Cross Origin Resource Policy
            crossOriginResourcePolicy: {
                policy: 'cross-origin'
            }
        };
    }

    /**
     * Custom security headers middleware
     */
    static customHeaders() {
        return (req, res, next) => {
            // Feature Policy / Permissions Policy
            res.setHeader('Permissions-Policy', 
                'accelerometer=(), ' +
                'camera=(), ' +
                'geolocation=(), ' +
                'gyroscope=(), ' +
                'magnetometer=(), ' +
                'microphone=(), ' +
                'payment=*, ' + // Allow payment APIs
                'usb=()'
            );
            
            // Additional security headers
            res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
            res.setHeader('X-Download-Options', 'noopen');
            res.setHeader('X-Content-Security-Policy', 'default-src \'self\'');
            res.setHeader('X-WebKit-CSP', 'default-src \'self\'');
            
            // Modern XSS protection (disable the problematic XSS auditor)
            res.setHeader('X-XSS-Protection', '0');
            
            // Cache control for sensitive pages
            if (req.path.includes('/api/') || req.path.includes('/auth/')) {
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
            }
            
            next();
        };
    }

    /**
     * Report URI for CSP violations
     */
    static cspReportHandler() {
        return (req, res) => {
            if (req.body) {
                console.log('CSP Violation Report:', JSON.stringify(req.body, null, 2));
                
                // Log to security audit
                const SecurityAudit = require('../middleware/security-audit');
                SecurityAudit.log(
                    SecurityAudit.EVENT_TYPES.SUSPICIOUS_ACTIVITY,
                    SecurityAudit.LOG_LEVELS.WARNING,
                    {
                        type: 'CSP_VIOLATION',
                        report: req.body,
                        ...req.auditContext
                    }
                );
            }
            
            res.status(204).end();
        };
    }

    /**
     * Initialize all security headers
     */
    static initialize(app) {
        // Add nonce middleware first
        app.use(this.nonceMiddleware());
        
        // Apply Helmet with configuration
        app.use(helmet(this.getHelmetConfig()));
        
        // Apply custom headers
        app.use(this.customHeaders());
        
        // CSP report endpoint
        app.post('/csp-report', this.cspReportHandler());
        
        console.log('✅ Security headers initialized');
    }
}

module.exports = SecurityHeaders; 