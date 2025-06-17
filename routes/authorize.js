const express = require('express');
const database = require('../config/database');
const InputValidation = require('../middleware/input-validation');
const crypto = require('crypto');

// Initialize Stripe with Aslan's account
let stripe;
try {
    if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('placeholder')) {
        stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        console.log('✅ Stripe initialized for real payments');
    } else {
        console.log('⚠️  No Stripe key found - using mock payments');
        stripe = null;
    }
} catch (error) {
    console.error('❌ Stripe initialization failed:', error);
    stripe = null;
}

const router = express.Router();

// Enhanced error response helper
function createErrorResponse(code, message, details = {}, docsSnippet = null) {
    const error = {
        error: message,
        code,
        timestamp: new Date().toISOString(),
        details,
        documentation: `${process.env.BASE_URL || 'http://localhost:3000'}/docs.html#error-${code.toLowerCase()}`
    };
    
    if (docsSnippet) {
        error.help = docsSnippet;
    }
    
    return error;
}

// Common error responses with helpful snippets
const ERROR_RESPONSES = {
    MISSING_API_KEY: {
        message: 'Missing or invalid Authorization header',
        help: {
            example: 'Authorization: Bearer ak_live_your_api_key_here',
            note: 'Get your API key from the dashboard at /dashboard.html'
        }
    },
    INVALID_API_KEY_FORMAT: {
        message: 'API key must start with ak_live_ or ak_test_',
        help: {
            correct: 'ak_live_1234567890abcdef...',
            incorrect: 'your_api_key_here',
            note: 'Copy the full key from your welcome email or dashboard'
        }
    },
    INVALID_API_KEY: {
        message: 'The provided API key is invalid or has been revoked',
        help: {
            troubleshooting: [
                'Check that you copied the full API key',
                'Verify the key hasn\'t been revoked in your dashboard',
                'Make sure you\'re using the right environment (live vs test)'
            ]
        }
    },
    SPENDING_LIMIT_EXCEEDED: {
        message: 'Transaction exceeds your account spending limits',
        help: {
            solutions: [
                'Verify your email to increase limits',
                'Upgrade to Production plan for unlimited spending',
                'Contact support if you need higher limits'
            ]
        }
    },
    VALIDATION_ERROR: {
        message: 'Request validation failed',
        help: {
            example: {
                amount: 2500,
                description: 'Payment description',
                agentId: 'optional-agent-id'
            },
            note: 'Amount must be in cents (2500 = $25.00)'
        }
    },
    RATE_LIMIT_EXCEEDED: {
        message: 'Too many requests',
        help: {
            solutions: [
                'Implement exponential backoff in your retry logic',
                'Reduce request frequency',
                'Contact support for higher rate limits'
            ]
        }
    }
};

// API Key Authentication Middleware for SaaS
const authenticateApiKey = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json(createErrorResponse(
                'MISSING_API_KEY',
                ERROR_RESPONSES.MISSING_API_KEY.message,
                {},
                ERROR_RESPONSES.MISSING_API_KEY.help
            ));
        }

        const apiKey = authHeader.replace('Bearer ', '');
        
        if (!apiKey.startsWith('ak_live_') && !apiKey.startsWith('ak_test_')) {
            return res.status(401).json(createErrorResponse(
                'INVALID_API_KEY_FORMAT',
                ERROR_RESPONSES.INVALID_API_KEY_FORMAT.message,
                { providedKey: apiKey.substring(0, 10) + '...' },
                ERROR_RESPONSES.INVALID_API_KEY_FORMAT.help
            ));
        }

        // Validate API key and get tenant context
        const keyValidation = await database.validateApiKey(apiKey);
        
        if (!keyValidation) {
            return res.status(401).json(createErrorResponse(
                'INVALID_API_KEY',
                ERROR_RESPONSES.INVALID_API_KEY.message,
                { keyPrefix: apiKey.substring(0, 15) + '...' },
                ERROR_RESPONSES.INVALID_API_KEY.help
            ));
        }

        // Attach tenant and user context to request
        req.apiKey = keyValidation;
        req.tenant = keyValidation.tenant;
        req.user = keyValidation.user;
        
        // ⚡ PERFORMANCE: Reduced logging (only log every 20th request)
        if (Math.random() < 0.05) {
            console.log(`🔑 API request from tenant: ${req.tenant.name} (${req.tenant.id})`);
        }
        
        next();
    } catch (error) {
        console.error('API key authentication error:', error);
        res.status(500).json(createErrorResponse(
            'AUTHENTICATION_ERROR',
            'Authentication service temporarily unavailable',
            {},
            {
                message: 'Please try again in a few moments',
                status: 'Check https://status.aslanpay.com for service status'
            }
        ));
    }
};

// Enhanced spending limits middleware
const checkSpendingLimits = async (req, res, next) => {
    try {
        const { amount } = req.body;
        const tenant = req.tenant;

        // Validate amount format
        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json(createErrorResponse(
                'INVALID_AMOUNT',
                'Amount must be a positive integer in cents',
                { 
                    provided: amount,
                    expectedType: 'number (cents)'
                },
                {
                    examples: {
                        '$25.00': 2500,
                        '$100.50': 10050,
                        '$1.99': 199
                    }
                }
            ));
        }

        // Check transaction limit
        if (amount > tenant.settings.transactionLimit) {
            return res.status(402).json(createErrorResponse(
                'TRANSACTION_LIMIT_EXCEEDED',
                `Transaction amount exceeds limit of $${tenant.settings.transactionLimit / 100}`,
                {
                    requestedAmount: `$${amount / 100}`,
                    transactionLimit: `$${tenant.settings.transactionLimit / 100}`,
                    plan: tenant.plan
                },
                {
                    solutions: tenant.plan === 'sandbox' ? [
                        'Verify your email to unlock higher limits',
                        'Upgrade to Production plan for $1,000 per transaction',
                        'Contact support for custom limits'
                    ] : [
                        'Contact support to increase transaction limits',
                        'Consider splitting large payments into smaller amounts'
                    ]
                }
            ));
        }

        // Check daily limit
        const dailyTotal = tenant.usage.dailySpent + amount;
        if (dailyTotal > tenant.settings.dailyLimit) {
            return res.status(402).json(createErrorResponse(
                'DAILY_LIMIT_EXCEEDED',
                `Daily spending limit exceeded`,
                {
                    requestedAmount: `$${amount / 100}`,
                    dailySpent: `$${tenant.usage.dailySpent / 100}`,
                    dailyLimit: `$${tenant.settings.dailyLimit / 100}`,
                    remainingDaily: `$${Math.max(0, tenant.settings.dailyLimit - tenant.usage.dailySpent) / 100}`,
                    resetTime: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString()
                },
                ERROR_RESPONSES.SPENDING_LIMIT_EXCEEDED.help
            ));
        }

        // Check velocity limits for new accounts
        if (tenant.settings.riskLevel === 'new' && tenant.usage.dailyAuthCount >= tenant.settings.velocityCap) {
            return res.status(429).json(createErrorResponse(
                'VELOCITY_LIMIT_EXCEEDED',
                'Daily authorization limit exceeded for new accounts',
                {
                    dailyAuthCount: tenant.usage.dailyAuthCount,
                    velocityCap: tenant.settings.velocityCap,
                    accountAge: Math.floor((Date.now() - tenant.createdAt.getTime()) / (1000 * 60 * 60 * 24)) + ' days'
                },
                {
                    solutions: [
                        'Verify your email address to increase limits',
                        'Wait 24 hours for limits to reset',
                        'Contact support if you need higher limits immediately'
                    ],
                    verifyEmailUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/dashboard.html`
                }
            ));
        }

        next();
    } catch (error) {
        console.error('Spending limits check error:', error);
        res.status(500).json(createErrorResponse(
            'LIMIT_CHECK_ERROR',
            'Unable to verify spending limits',
            {},
            {
                message: 'Please try again in a few moments',
                contact: 'If this persists, contact support with your request ID'
            }
        ));
    }
};

// POST /api/v1/authorize - Main payment authorization endpoint
router.post('/', 
    authenticateApiKey,
    InputValidation.validateBody({
        type: 'object',
        properties: {
            amount: { 
                type: 'integer',
                minimum: 50,      // Minimum $0.50
                maximum: 10000000  // $100,000 max
            },
            description: { 
                type: 'string',
                minLength: 1,
                maxLength: 500
            },
            agentId: { 
                type: 'string',
                maxLength: 100
            },
            metadata: {
                type: 'object'
            }
        },
        required: ['amount', 'description']
    }),
    checkSpendingLimits,
    async (req, res) => {
        const requestStartTime = Date.now();
        console.log(`🚀 [${requestStartTime}] Starting authorization request`);
        
        try {
            const { amount, description, agentId, metadata = {} } = req.body;
            const tenant = req.tenant;
            const user = req.user;

            // ⚡ PERFORMANCE: Reduced logging for sub-400ms latency
            if (Math.random() < 0.1) {
                console.log(`💳 Authorization request: $${amount/100} for "${description}" by ${tenant.name}`);
            }

            // Enhanced input validation with helpful errors
            if (description.trim().length === 0) {
                return res.status(400).json(createErrorResponse(
                    'EMPTY_DESCRIPTION',
                    'Description cannot be empty',
                    {},
                    {
                        examples: [
                            'AI Assistant Service',
                            'ChatGPT API Usage',
                            'Custom Model Inference'
                        ]
                    }
                ));
            }

            // Create transaction record with fraud detection
            const transactionStartTime = Date.now();
            const transaction = await database.createTransaction({
                amount,
                description,
                tenantId: tenant.id,
                userId: user.id,
                agentId: agentId || 'unknown',
                status: 'authorized',
                apiKeyId: req.apiKey.keyId,
                metadata: {
                    ...metadata,
                    userAgent: req.headers['user-agent'],
                    ip: req.ip,
                    requestId: req.headers['x-request-id'] || 'unknown'
                }
            });
            console.log(`📊 Transaction created in ${Date.now() - transactionStartTime}ms`);

            // REAL STRIPE INTEGRATION - Process actual payments!
            if (stripe) {
                try {
                    const stripeStartTime = Date.now();
                    
                    // ⚡ ULTRA-FAST Stripe call with minimal metadata
                    const overageFeePerTransaction = 2; // $0.02 in cents
                    const aslanFee = overageFeePerTransaction;

                    // ⚡ OPTIMIZED: Minimal Stripe PaymentIntent creation
                    const paymentIntent = await stripe.paymentIntents.create({
                        amount: amount + aslanFee,
                        currency: 'usd',
                        description: `${description} (via Aslan)`,
                        automatic_payment_methods: { enabled: true },
                        metadata: {
                            tenantId: tenant.id,
                            userId: user.id,
                            originalAmount: amount,
                            aslanFee: aslanFee,
                            internalTransactionId: transaction.id
                        }
                    });
                    
                    console.log(`📊 Stripe PaymentIntent created in ${Date.now() - stripeStartTime}ms`);

                    // ⚡ FAST response without blocking operations
                    const totalLatency = Date.now() - requestStartTime;
                    console.log(`🏁 [${requestStartTime}] TOTAL REQUEST LATENCY: ${totalLatency}ms`);
                    
                    res.status(200).json({
                        id: paymentIntent.id,
                        object: 'authorization',
                        amount,
                        totalAmount: amount + aslanFee,
                        aslanFee,
                        description,
                        status: paymentIntent.status,
                        clientSecret: paymentIntent.client_secret,
                        agentId: agentId || null,
                        tenantId: tenant.id,
                        userId: user.id,
                        created: paymentIntent.created,
                        expires_at: Math.floor((Date.now() + 10 * 60 * 1000) / 1000),
                        livemode: paymentIntent.livemode,
                        stripePaymentIntentId: paymentIntent.id,
                        transaction: {
                            id: transaction.id,
                            amount: transaction.amount,
                            status: transaction.status
                        }
                    });

                } catch (stripeError) {
                    console.error('❌ Stripe payment failed:', stripeError);
                    
                    // Return helpful Stripe error
                    return res.status(400).json(createErrorResponse(
                        'STRIPE_ERROR',
                        stripeError.message || 'Payment processing failed',
                        {
                            stripeCode: stripeError.code,
                            stripeType: stripeError.type
                        },
                        {
                            message: 'There was an issue processing your payment',
                            troubleshooting: [
                                'Verify your payment details are correct',
                                'Check that your card has sufficient funds',
                                'Try again with a different payment method'
                            ]
                        }
                    ));
                }

            } else {
                // Fallback to mock for development
                const authorizationId = `auth_mock_${crypto.randomBytes(12).toString('hex')}`;
                
                console.log(`⚠️  MOCK payment authorized: ${authorizationId} for $${amount/100} (Stripe not configured)`);

                res.status(200).json({
                    id: authorizationId,
                    object: 'authorization',
                    amount,
                    description,
                    status: 'authorized',
                    agentId: agentId || null,
                    tenantId: tenant.id,
                    userId: user.id,
                    created: Math.floor(Date.now() / 1000),
                    expires_at: Math.floor((Date.now() + 10 * 60 * 1000) / 1000),
                    metadata,
                    livemode: false,
                    mock: true,
                    transaction: {
                        id: transaction.id,
                        amount: transaction.amount,
                        status: transaction.status
                    }
                });
            }

        } catch (error) {
            console.error('Authorization error:', error);
            
            // Handle specific error types with helpful messages
            if (error.message.includes('Daily authorization limit exceeded')) {
                return res.status(429).json(createErrorResponse(
                    'VELOCITY_LIMIT_EXCEEDED',
                    error.message,
                    {},
                    {
                        solutions: [
                            'Verify your email address to increase limits',
                            'Wait 24 hours for limits to reset',
                            'Contact support for immediate assistance'
                        ]
                    }
                ));
            }
            
            if (error.message.includes('limit')) {
                return res.status(402).json(createErrorResponse(
                    'SPENDING_LIMIT_ERROR',
                    error.message,
                    {},
                    ERROR_RESPONSES.SPENDING_LIMIT_EXCEEDED.help
                ));
            }

            // Generic server error
            res.status(500).json(createErrorResponse(
                'AUTHORIZATION_ERROR',
                'Failed to process authorization',
                {},
                {
                    message: 'An unexpected error occurred while processing your payment authorization',
                    troubleshooting: [
                        'Verify your request format matches the API documentation',
                        'Check that all required fields are provided',
                        'Ensure your API key has sufficient permissions'
                    ],
                    contact: 'If this error persists, contact support with your request details'
                }
            ));
        }
    }
);

// POST /api/v1/confirm - Confirm and capture an authorization
router.post('/confirm',
    authenticateApiKey,
    InputValidation.validateBody({
        type: 'object',
        properties: {
            authorizationId: { type: 'string' },
            finalAmount: { type: 'integer', minimum: 1 }
        },
        required: ['authorizationId']
    }),
    async (req, res) => {
        try {
            const { authorizationId, finalAmount } = req.body;
            const tenant = req.tenant;

            console.log(`🔒 Confirming authorization: ${authorizationId} for tenant ${tenant.name}`);

            // REAL STRIPE CONFIRMATION - Actually capture the payment!
            if (stripe && authorizationId.startsWith('pi_')) {
                try {
                    // Confirm the PaymentIntent with Stripe
                    const paymentIntent = await stripe.paymentIntents.confirm(authorizationId);
                    
                    console.log(`✅ REAL payment confirmed: ${paymentIntent.id} status: ${paymentIntent.status}`);

                    // Create confirmed transaction record
                    const transaction = await database.createTransaction({
                        amount: finalAmount || paymentIntent.amount,
                        description: `Confirmed payment ${authorizationId}`,
                        tenantId: tenant.id,
                        userId: req.user.id,
                        status: paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
                        metadata: {
                            authorizationId,
                            stripePaymentIntentId: paymentIntent.id,
                            stripeStatus: paymentIntent.status,
                            apiKeyId: req.apiKey.keyId
                        }
                    });

                    // Update tenant billing usage for completed payments
                    if (paymentIntent.status === 'succeeded') {
                        await database.updateTenantUsage(tenant.id, paymentIntent.amount);
                    }

                    res.status(200).json({
                        id: paymentIntent.id,
                        object: 'payment',
                        amount: paymentIntent.amount,
                        status: paymentIntent.status,
                        authorizationId,
                        tenantId: tenant.id,
                        created: paymentIntent.created,
                        livemode: paymentIntent.livemode,
                        stripePaymentIntentId: paymentIntent.id,
                        charges: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : null,
                        transaction: {
                            id: transaction.id,
                            amount: transaction.amount,
                            status: transaction.status
                        }
                    });

                } catch (stripeError) {
                    console.error('❌ Stripe confirmation failed:', stripeError);
                    
                    return res.status(400).json(createErrorResponse(
                        'STRIPE_CONFIRMATION_ERROR',
                        stripeError.message || 'Payment confirmation failed',
                        {
                            stripeCode: stripeError.code,
                            authorizationId
                        },
                        {
                            message: 'Unable to confirm the payment',
                            troubleshooting: [
                                'Verify the authorization ID is correct',
                                'Check that the payment hasn\'t already been confirmed',
                                'Ensure the authorization hasn\'t expired'
                            ]
                        }
                    ));
                }

            } else {
                // Fallback for mock payments or non-Stripe IDs
                const paymentId = `pay_mock_${crypto.randomBytes(12).toString('hex')}`;

                const transaction = await database.createTransaction({
                    amount: finalAmount || req.body.amount,
                    description: `Confirmed payment ${authorizationId}`,
                    tenantId: tenant.id,
                    userId: req.user.id,
                    status: 'completed',
                    metadata: {
                        authorizationId,
                        paymentId,
                        apiKeyId: req.apiKey.keyId,
                        mock: true
                    }
                });

                console.log(`⚠️  MOCK payment confirmed: ${paymentId} (Stripe not configured or mock payment)`);

                res.status(200).json({
                    id: paymentId,
                    object: 'payment',
                    amount: finalAmount || req.body.amount,
                    status: 'completed',
                    authorizationId,
                    tenantId: tenant.id,
                    created: Math.floor(Date.now() / 1000),
                    livemode: false,
                    mock: true,
                    transaction: {
                        id: transaction.id,
                        amount: transaction.amount,
                        status: transaction.status
                    }
                });
            }

        } catch (error) {
            console.error('Confirmation error:', error);
            res.status(500).json({
                error: 'Failed to confirm payment',
                code: 'CONFIRMATION_ERROR'
            });
        }
    }
);

// POST /api/v1/refund - Refund a completed transaction
router.post('/refund',
    authenticateApiKey,
    InputValidation.validateBody({
        type: 'object',
        properties: {
            transactionId: { type: 'string' },
            amount: { type: 'integer', minimum: 1 },
            reason: { type: 'string' }
        },
        required: ['transactionId']
    }),
    async (req, res) => {
        try {
            const { transactionId, amount, reason } = req.body;
            const tenant = req.tenant;

            console.log(`💸 Refund request: ${transactionId} for tenant ${tenant.name}`);

            // Find the original transaction to get Stripe PaymentIntent ID
            const originalTransaction = database.getTransactionsByTenant(tenant.id)
                .find(t => t.id === transactionId);

            if (!originalTransaction) {
                return res.status(404).json(createErrorResponse(
                    'TRANSACTION_NOT_FOUND',
                    'Transaction not found or not accessible',
                    { transactionId },
                    {
                        troubleshooting: [
                            'Verify the transaction ID is correct',
                            'Ensure the transaction belongs to your tenant',
                            'Check that the transaction was successfully completed'
                        ]
                    }
                ));
            }

            // REAL STRIPE REFUND - Process actual refunds!
            if (stripe && originalTransaction.metadata?.stripePaymentIntentId) {
                try {
                    const stripePaymentIntentId = originalTransaction.metadata.stripePaymentIntentId;
                    
                    // Get the PaymentIntent to find the charge
                    const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);
                    
                    if (!paymentIntent.charges?.data?.[0]?.id) {
                        throw new Error('No charge found for this payment');
                    }

                    // Create refund in Stripe
                    const refund = await stripe.refunds.create({
                        charge: paymentIntent.charges.data[0].id,
                        amount: amount || paymentIntent.amount,
                        reason: reason || 'requested_by_customer',
                        metadata: {
                            tenantId: tenant.id,
                            originalTransactionId: transactionId,
                            refundRequestedBy: req.user.id
                        }
                    });

                    console.log(`✅ REAL refund processed: ${refund.id} for $${refund.amount/100}`);

                    // Create refund transaction record
                    const refundTransaction = await database.createTransaction({
                        amount: -(refund.amount),
                        description: `Refund for ${transactionId}`,
                        tenantId: tenant.id,
                        userId: req.user.id,
                        status: refund.status,
                        metadata: {
                            originalTransactionId: transactionId,
                            stripeRefundId: refund.id,
                            stripeChargeId: refund.charge,
                            stripeStatus: refund.status,
                            reason: refund.reason,
                            apiKeyId: req.apiKey.keyId
                        }
                    });

                    res.status(200).json({
                        id: refund.id,
                        object: 'refund',
                        amount: refund.amount,
                        reason: refund.reason,
                        status: refund.status,
                        transactionId,
                        tenantId: tenant.id,
                        created: refund.created,
                        livemode: refund.livemode,
                        stripeRefundId: refund.id,
                        stripeChargeId: refund.charge,
                        transaction: {
                            id: refundTransaction.id,
                            amount: refundTransaction.amount,
                            status: refundTransaction.status
                        }
                    });

                } catch (stripeError) {
                    console.error('❌ Stripe refund failed:', stripeError);
                    
                    return res.status(400).json(createErrorResponse(
                        'STRIPE_REFUND_ERROR',
                        stripeError.message || 'Refund processing failed',
                        {
                            stripeCode: stripeError.code,
                            transactionId
                        },
                        {
                            message: 'Unable to process the refund',
                            troubleshooting: [
                                'Verify the transaction was successfully completed',
                                'Check that the refund amount doesn\'t exceed the original payment',
                                'Ensure the transaction hasn\'t already been fully refunded'
                            ]
                        }
                    ));
                }

            } else {
                // Fallback for mock transactions or when Stripe isn't configured
                const refundId = `ref_mock_${crypto.randomBytes(12).toString('hex')}`;

                const refundTransaction = await database.createTransaction({
                    amount: -(amount || originalTransaction.amount),
                    description: `Refund for ${transactionId}`,
                    tenantId: tenant.id,
                    userId: req.user.id,
                    status: 'refunded',
                    metadata: {
                        originalTransactionId: transactionId,
                        refundId,
                        reason: reason || 'requested',
                        apiKeyId: req.apiKey.keyId,
                        mock: true
                    }
                });

                console.log(`⚠️  MOCK refund processed: ${refundId} (Stripe not configured or mock transaction)`);

                res.status(200).json({
                    id: refundId,
                    object: 'refund',
                    amount: amount || originalTransaction.amount,
                    reason: reason || 'requested',
                    status: 'succeeded',
                    transactionId,
                    tenantId: tenant.id,
                    created: Math.floor(Date.now() / 1000),
                    livemode: false,
                    mock: true,
                    transaction: {
                        id: refundTransaction.id,
                        amount: refundTransaction.amount,
                        status: refundTransaction.status
                    }
                });
            }

        } catch (error) {
            console.error('Refund error:', error);
            res.status(500).json({
                error: 'Failed to process refund',
                code: 'REFUND_ERROR'
            });
        }
    }
);

// GET /api/v1/transactions - List transactions for tenant
router.get('/transactions',
    authenticateApiKey,
    async (req, res) => {
        try {
            const tenant = req.tenant;
            const { 
                limit = 50, 
                offset = 0, 
                status, 
                agentId,
                from,
                to 
            } = req.query;

            const filters = {};
            if (status) filters.status = status;
            if (agentId) filters.agentId = agentId;
            if (from) filters.from = from;
            if (to) filters.to = to;

            const transactions = database.getTransactionsByTenant(tenant.id, filters);
            
            // Apply pagination
            const paginatedTransactions = transactions
                .slice(offset, offset + parseInt(limit))
                .map(t => ({
                    id: t.id,
                    amount: t.amount,
                    description: t.description,
                    status: t.status,
                    agentId: t.agentId,
                    created: Math.floor(t.createdAt.getTime() / 1000),
                    metadata: t.metadata
                }));

            res.status(200).json({
                object: 'list',
                data: paginatedTransactions,
                has_more: offset + parseInt(limit) < transactions.length,
                total_count: transactions.length,
                tenant: {
                    id: tenant.id,
                    name: tenant.name,
                    usage: tenant.usage
                }
            });

        } catch (error) {
            console.error('List transactions error:', error);
            res.status(500).json({
                error: 'Failed to retrieve transactions',
                code: 'TRANSACTION_LIST_ERROR'
            });
        }
    }
);

// GET /api/v1/limits - Get current spending limits and usage
router.get('/limits',
    authenticateApiKey,
    async (req, res) => {
        try {
            const tenant = req.tenant;

            res.status(200).json({
                tenant: {
                    id: tenant.id,
                    name: tenant.name,
                    plan: tenant.plan
                },
                limits: {
                    daily: tenant.settings.dailyLimit,
                    per_transaction: tenant.settings.transactionLimit,
                    api_calls: tenant.settings.apiCallLimit
                },
                usage: {
                    daily_spent: tenant.usage.dailySpent,
                    monthly_spent: tenant.usage.monthlySpent,
                    api_calls: tenant.usage.apiCalls,
                    last_reset: tenant.usage.lastReset
                },
                remaining: {
                    daily: Math.max(0, tenant.settings.dailyLimit - tenant.usage.dailySpent),
                    daily_percentage: Math.round((tenant.usage.dailySpent / tenant.settings.dailyLimit) * 100)
                }
            });

        } catch (error) {
            console.error('Get limits error:', error);
            res.status(500).json({
                error: 'Failed to retrieve limits',
                code: 'LIMITS_ERROR'
            });
        }
    }
);

// GET /api/v1/tenant - Get tenant information
router.get('/tenant',
    authenticateApiKey,
    async (req, res) => {
        try {
            const tenant = req.tenant;
            const users = database.getUsersByTenant(tenant.id);
            const apiKeys = database.getApiKeysByTenant(tenant.id);

            res.status(200).json({
                id: tenant.id,
                name: tenant.name,
                domain: tenant.domain,
                plan: tenant.plan,
                created: Math.floor(tenant.createdAt.getTime() / 1000),
                owner: {
                    id: tenant.ownerId,
                    name: users.find(u => u.id === tenant.ownerId)?.name
                },
                settings: tenant.settings,
                usage: tenant.usage,
                stats: {
                    users: users.length,
                    api_keys: apiKeys.length,
                    transactions: database.getTransactionsByTenant(tenant.id).length
                }
            });

        } catch (error) {
            console.error('Get tenant error:', error);
            res.status(500).json({
                error: 'Failed to retrieve tenant information',
                code: 'TENANT_ERROR'
            });
        }
    }
);

// Development/Testing endpoints
if (process.env.NODE_ENV !== 'production') {
    // POST /api/v1/test/reset-limits - Reset daily limits for testing
    router.post('/test/reset-limits',
        authenticateApiKey,
        async (req, res) => {
            try {
                const tenant = req.tenant;
                
                // Reset usage
                tenant.usage.dailySpent = 0;
                tenant.usage.lastReset = new Date();
                
                console.log(`🧪 Reset limits for tenant: ${tenant.name}`);
                
                res.status(200).json({
                    message: 'Limits reset successfully',
                    tenant: {
                        id: tenant.id,
                        name: tenant.name,
                        usage: tenant.usage
                    }
                });

            } catch (error) {
                console.error('Reset limits error:', error);
                res.status(500).json({
                    error: 'Failed to reset limits',
                    code: 'RESET_ERROR'
                });
            }
        }
    );

    // GET /api/v1/performance - Check performance metrics
    router.get('/performance', async (req, res) => {
        try {
            const stats = database.getPerformanceStats ? database.getPerformanceStats() : {
                message: 'Performance monitoring not available in this environment',
                optimization: 'O(1) lookups active'
            };
            
            res.status(200).json({
                status: 'High-performance mode active',
                message: 'API key lookups optimized from O(n) to O(1)',
                targetLatency: '<400ms per request',
                optimizations: [
                    'HashMap API key cache',
                    'Reduced logging overhead',
                    'Non-blocking usage updates',
                    'Database query optimization'
                ],
                stats
            });
            
        } catch (error) {
            console.error('Performance check error:', error);
            res.status(500).json({
                error: 'Failed to get performance metrics',
                code: 'PERFORMANCE_ERROR'
            });
        }
    });

    // POST /api/v1/test/simulate-payment - Simulate payment without Stripe
    router.post('/test/simulate-payment',
        authenticateApiKey,
        InputValidation.validateBody({
            type: 'object',
            properties: {
                amount: { type: 'integer', minimum: 1 },
                description: { type: 'string' },
                shouldFail: { type: 'boolean' }
            },
            required: ['amount', 'description']
        }),
        async (req, res) => {
            try {
                const { amount, description, shouldFail } = req.body;
                const tenant = req.tenant;

                if (shouldFail) {
                    return res.status(402).json({
                        error: 'Simulated payment failure',
                        code: 'PAYMENT_FAILED',
                        message: 'This is a test failure'
                    });
                }

                // Simulate successful payment
                const paymentId = `sim_${crypto.randomBytes(8).toString('hex')}`;
                
                const transaction = await database.createTransaction({
                    amount,
                    description: `[TEST] ${description}`,
                    tenantId: tenant.id,
                    userId: req.user.id,
                    status: 'completed',
                    metadata: {
                        simulation: true,
                        paymentId
                    }
                });

                await database.updateTenantUsage(tenant.id, amount);

                res.status(200).json({
                    id: paymentId,
                    object: 'payment',
                    amount,
                    description,
                    status: 'completed',
                    simulation: true,
                    created: Math.floor(Date.now() / 1000),
                    transaction: {
                        id: transaction.id,
                        status: transaction.status
                    }
                });

            } catch (error) {
                console.error('Simulate payment error:', error);
                res.status(500).json({
                    error: 'Failed to simulate payment',
                    code: 'SIMULATION_ERROR'
                });
            }
        }
    );
}

// Enhanced error handling for all routes
router.use((error, req, res, next) => {
    console.error('API Error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
        return res.status(400).json(createErrorResponse(
            'VALIDATION_ERROR',
            'Request validation failed',
            {
                field: error.field,
                providedValue: error.value,
                expectedType: error.expectedType
            },
            ERROR_RESPONSES.VALIDATION_ERROR.help
        ));
    }
    
    // Handle rate limiting errors
    if (error.status === 429) {
        return res.status(429).json(createErrorResponse(
            'RATE_LIMIT_EXCEEDED',
            ERROR_RESPONSES.RATE_LIMIT_EXCEEDED.message,
            {
                retryAfter: error.retryAfter || '60 seconds',
                limit: error.limit,
                remaining: error.remaining
            },
            ERROR_RESPONSES.RATE_LIMIT_EXCEEDED.help
        ));
    }
    
    // Generic server error
    res.status(500).json(createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        'An unexpected error occurred',
        {},
        {
            message: 'Our team has been notified and is investigating',
            contact: 'If urgent, contact support with your request ID'
        }
    ));
});

module.exports = router; 