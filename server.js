require('dotenv').config();

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('./config/passport');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes = require('./routes/auth');
const apiKeyRoutes = require('./routes/api-keys');
const authorizeRoutes = require('./routes/authorize');

// Import database and security configuration
const database = require('./config/database');
const security = require('./config/security');

const app = express();
const port = process.env.PORT || 3000;

// Validate environment variables on startup
const envValidation = security.validateEnvironment();
if (envValidation.errors.length > 0) {
    console.error('🚨 Environment validation errors:');
    envValidation.errors.forEach(error => console.error(`   ❌ ${error}`));
    
    if (security.isProduction) {
        console.error('🛑 Cannot start in production with environment errors');
        process.exit(1);
    }
}

if (envValidation.warnings.length > 0) {
    console.warn('⚠️  Environment validation warnings:');
    envValidation.warnings.forEach(warning => console.warn(`   ⚠️  ${warning}`));
}

// Security middleware - applied first
app.use((req, res, next) => {
    req.startTime = Date.now();
    next();
});

// HTTPS enforcement (production only)
app.use(security.enforceHTTPS());

// Security headers with Helmet
app.use(helmet(security.getHelmetConfig()));

// Custom security headers
app.use(security.securityHeaders());

// Rate limiting
const limiter = rateLimit(security.getRateLimitConfig());
app.use('/api/', limiter);

// CORS configuration
app.use(cors(security.getCorsConfig()));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parsing
app.use(cookieParser());

// Session middleware with security configuration
app.use(session(security.getSessionConfig()));

// Origin validation for sensitive endpoints
app.use('/api/auth', security.validateOrigin());
app.use('/api/keys', security.validateOrigin());

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Static files (with security headers)
app.use(express.static('public', {
    maxAge: '1y',
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/keys', apiKeyRoutes);
app.use('/api/v1/authorize', authorizeRoutes);

// Security report endpoint
app.get('/api/security', (req, res) => {
    const report = security.getSecurityReport();
    res.json(report);
});

// Enhanced health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        // Check database connectivity
        const dbHealth = await database.healthCheck();
        
        // Get security status
        const securityReport = security.getSecurityReport();
        
        res.json({ 
            status: 'OK', 
            timestamp: new Date().toISOString(),
            database: dbHealth,
            security: {
                environment: securityReport.environment,
                features: securityReport.features,
                hasErrors: securityReport.validation.errors.length > 0,
                hasWarnings: securityReport.validation.warnings.length > 0
            },
            authentication: 'enabled',
            apiKeys: 'enabled',
            authorization: 'enabled',
            version: '1.0.0'
        });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            error: error.message,
            environment: process.env.NODE_ENV || 'development'
        });
    }
});

// Simple health check for Railway
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', service: 'aslan' });
});

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Create subscription endpoint
app.post('/api/create-subscription', async (req, res) => {
    try {
        const { paymentMethodId, priceId, email, name, company } = req.body;

        // Create customer
        const customer = await stripe.customers.create({
            email,
            name,
            metadata: {
                company: company || '',
            },
            payment_method: paymentMethodId,
            invoice_settings: {
                default_payment_method: paymentMethodId,
            },
        });

        // Create subscription
        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: priceId }],
            payment_behavior: 'default_incomplete',
            expand: ['latest_invoice.payment_intent'],
            trial_period_days: 14, // 14-day free trial
        });

        res.json({
            subscriptionId: subscription.id,
            clientSecret: subscription.latest_invoice.payment_intent.client_secret,
        });

    } catch (error) {
        console.error('Error creating subscription:', error);
        res.status(400).json({
            error: error.message,
        });
    }
});

// Create Stripe products and prices (run this once to set up your products)
app.post('/api/setup-products', async (req, res) => {
    try {
        // Create Builder plan
        const builderProduct = await stripe.products.create({
            name: 'Builder Plan',
            description: 'For individual developers and small projects',
        });

        const builderPrice = await stripe.prices.create({
            unit_amount: 9900, // $99.00
            currency: 'usd',
            recurring: { interval: 'month' },
            product: builderProduct.id,
        });

        // Create Team plan
        const teamProduct = await stripe.products.create({
            name: 'Team Plan',
            description: 'For growing teams and multiple agents',
        });

        const teamPrice = await stripe.prices.create({
            unit_amount: 49900, // $499.00
            currency: 'usd',
            recurring: { interval: 'month' },
            product: teamProduct.id,
        });

        res.json({
            builder: {
                productId: builderProduct.id,
                priceId: builderPrice.id,
            },
            team: {
                productId: teamProduct.id,
                priceId: teamPrice.id,
            },
        });

    } catch (error) {
        console.error('Error setting up products:', error);
        res.status(400).json({
            error: error.message,
        });
    }
});

// Webhook endpoint for Stripe events
app.post('/api/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.log(`Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'subscription.created':
            const subscription = event.data.object;
            console.log('Subscription created:', subscription.id);
            // Here you would typically:
            // - Update your database
            // - Send welcome email
            // - Provision account access
            break;

        case 'subscription.updated':
            console.log('Subscription updated:', event.data.object.id);
            break;

        case 'subscription.deleted':
            console.log('Subscription cancelled:', event.data.object.id);
            break;

        case 'invoice.payment_succeeded':
            console.log('Payment succeeded:', event.data.object.id);
            break;

        case 'invoice.payment_failed':
            console.log('Payment failed:', event.data.object.id);
            break;

        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
});

// Simple test endpoint (no middleware)
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Server is responding',
        timestamp: new Date().toISOString(),
        cookies: req.cookies,
        headers: req.headers
    });
});

// Direct session test endpoint
app.get('/api/test-session', (req, res) => {
    console.log('📍 Direct session test endpoint hit');
    try {
        const token = req.cookies?.session;
        console.log('📍 Session cookie:', token ? 'Found' : 'Not found');
        
        if (!token) {
            return res.status(401).json({ error: 'No session cookie' });
        }
        
        // Try to decode JWT
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';
        
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            console.log('📍 JWT decoded:', decoded);
            res.json({ 
                success: true, 
                decoded,
                message: 'JWT is valid'
            });
        } catch (err) {
            console.log('📍 JWT error:', err.message);
            res.status(401).json({ error: 'Invalid JWT', details: err.message });
        }
    } catch (error) {
        console.error('📍 Test session error:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// Minimal /me endpoint that bypasses router middleware
app.get('/api/auth/me-direct', (req, res) => {
    console.log('📍 Direct /me endpoint hit');
    try {
        const token = req.cookies?.session;
        if (!token) {
            return res.status(401).json({ error: 'No session token provided', code: 'NO_SESSION' });
        }
        
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const session = database.getSession(decoded.sessionId);
        
        if (!session) {
            return res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' });
        }
        
        const user = database.getUserById(session.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
        }
        
        console.log('📍 Direct /me success for user:', user.email);
        res.json({ user });
        
    } catch (error) {
        console.error('📍 Direct /me error:', error);
        res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
});

// Direct API keys endpoints (bypass router)
app.get('/api/keys-direct', (req, res) => {
    console.log('📍 Direct API keys endpoint hit');
    try {
        const token = req.cookies?.session;
        if (!token) {
            return res.status(401).json({ error: 'No session token provided', code: 'NO_SESSION' });
        }
        
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const session = database.getSession(decoded.sessionId);
        const user = database.getUserById(session.userId);
        
        if (!user) {
            return res.status(401).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
        }
        
        const apiKeys = database.getApiKeysByUserId(user.id);
        console.log('📍 Direct API keys success, found', apiKeys.length, 'keys');
        
        res.json({
            apiKeys,
            total: apiKeys.length
        });
        
    } catch (error) {
        console.error('📍 Direct API keys error:', error);
        res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
});

// Create API key directly
app.post('/api/keys-direct', (req, res) => {
    console.log('📍 Direct create API key endpoint hit');
    try {
        const token = req.cookies?.session;
        if (!token) {
            return res.status(401).json({ error: 'No session token provided', code: 'NO_SESSION' });
        }
        
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const session = database.getSession(decoded.sessionId);
        const user = database.getUserById(session.userId);
        
        if (!user) {
            return res.status(401).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
        }
        
        const { name } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'API key name is required', code: 'MISSING_NAME' });
        }
        
        const apiKey = database.createApiKey(user.id, name.trim());
        console.log('📍 Direct create API key success');
        
        res.status(201).json({
            apiKey,
            message: 'API key created successfully!'
        });
        
    } catch (error) {
        console.error('📍 Direct create API key error:', error);
        res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
});

// Development endpoint to view database (remove in production)
if (process.env.NODE_ENV !== 'production') {
    app.get('/api/dev/database', async (req, res) => {
        try {
            const data = await database.getAllData();
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        code: 'NOT_FOUND'
    });
});

app.listen(port, () => {
    console.log(`🦁 Aslan server running at http://localhost:${port}`);
    console.log('📋 Available endpoints:');
    console.log('   • Authentication: /api/auth/*');
    console.log('   • API Keys: /api/keys/*');
    console.log('   • Authorization: /api/v1/authorize/*');
    console.log('   • Stripe: /api/create-subscription, /api/setup-products');
    console.log('   • Health: /api/health');
    console.log('   • Security: /api/security');
    if (process.env.NODE_ENV !== 'production') {
        console.log('   • Dev Database: /api/dev/database');
    }
    console.log('');
    
    // Display security status
    const securityReport = security.getSecurityReport();
    console.log('🔒 Security Status:');
    console.log(`   • Environment: ${securityReport.environment}`);
    console.log(`   • HTTPS Enforcement: ${securityReport.features.httpsEnforcement}`);
    console.log(`   • Security Headers: ${securityReport.features.securityHeaders}`);
    console.log(`   • CORS Protection: ${securityReport.features.corsProtection}`);
    console.log(`   • Rate Limiting: ${securityReport.features.rateLimiting}`);
    
    if (securityReport.validation.errors.length > 0) {
        console.log('❌ Security Errors:', securityReport.validation.errors.length);
    }
    if (securityReport.validation.warnings.length > 0) {
        console.log('⚠️  Security Warnings:', securityReport.validation.warnings.length);
    }
    
    console.log('');
    console.log('🦁 Like the great lion of Narnia, Aslan guides AI agents to accomplish their missions');
    console.log('⚠️  Make sure to set your environment variables:');
    console.log('   • JWT_SECRET (strong random value)');
    console.log('   • SESSION_SECRET (strong random value)');
    console.log('   • STRIPE_SECRET_KEY');
    console.log('   • CORS_ORIGINS (production domains)');
}); 