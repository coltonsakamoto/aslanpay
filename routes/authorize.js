const express = require('express');
const database = require('../config/database');
const InputValidation = require('../middleware/input-validation');
const crypto = require('crypto');

const router = express.Router();

// API Key Authentication Middleware for SaaS
const authenticateApiKey = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Missing or invalid Authorization header',
                code: 'MISSING_API_KEY',
                message: 'Include your API key as: Authorization: Bearer ak_live_your_key'
            });
        }

        const apiKey = authHeader.replace('Bearer ', '');
        
        if (!apiKey.startsWith('ak_live_') && !apiKey.startsWith('ak_test_')) {
            return res.status(401).json({
                error: 'Invalid API key format',
                code: 'INVALID_API_KEY_FORMAT',
                message: 'API keys must start with ak_live_ or ak_test_'
            });
        }

        // Validate API key and get tenant context
        const keyValidation = await database.validateApiKey(apiKey);
        
        if (!keyValidation) {
            return res.status(401).json({
                error: 'Invalid API key',
                code: 'INVALID_API_KEY',
                message: 'The provided API key is invalid or has been revoked'
            });
        }

        // Attach tenant and user context to request
        req.apiKey = keyValidation;
        req.tenant = keyValidation.tenant;
        req.user = keyValidation.user;
        
        console.log(`🔑 API request from tenant: ${req.tenant.name} (${req.tenant.id})`);
        
        next();
    } catch (error) {
        console.error('API key authentication error:', error);
        res.status(500).json({
            error: 'Authentication error',
            code: 'AUTH_ERROR'
        });
    }
};

// Check spending limits middleware
const checkSpendingLimits = async (req, res, next) => {
    try {
        const { amount } = req.body;
        const tenant = req.tenant;

        // Check transaction limit
        if (amount > tenant.settings.transactionLimit) {
            return res.status(402).json({
                error: 'Transaction amount exceeds limit',
                code: 'TRANSACTION_LIMIT_EXCEEDED',
                details: {
                    requestedAmount: amount,
                    transactionLimit: tenant.settings.transactionLimit,
                    maxAllowed: tenant.settings.transactionLimit
                }
            });
        }

        // Check daily limit
        const dailyTotal = tenant.usage.dailySpent + amount;
        if (dailyTotal > tenant.settings.dailyLimit) {
            return res.status(402).json({
                error: 'Daily spending limit exceeded',
                code: 'DAILY_LIMIT_EXCEEDED',
                details: {
                    requestedAmount: amount,
                    dailySpent: tenant.usage.dailySpent,
                    dailyLimit: tenant.settings.dailyLimit,
                    remainingDaily: tenant.settings.dailyLimit - tenant.usage.dailySpent
                }
            });
        }

        next();
    } catch (error) {
        console.error('Spending limits check error:', error);
        res.status(500).json({
            error: 'Failed to check spending limits',
            code: 'LIMIT_CHECK_ERROR'
        });
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
                minimum: 1,
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
        try {
            const { amount, description, agentId, metadata = {} } = req.body;
            const tenant = req.tenant;
            const user = req.user;

            console.log(`💳 Authorization request: $${amount/100} for "${description}" by ${tenant.name}`);

            // Create transaction record
            const transaction = await database.createTransaction({
                amount,
                description,
                tenantId: tenant.id,
                userId: user.id,
                agentId: agentId || 'unknown',
                status: 'authorized',
                metadata: {
                    ...metadata,
                    apiKeyId: req.apiKey.keyId,
                    userAgent: req.headers['user-agent'],
                    ip: req.ip
                }
            });

            // In a real implementation, this would call Stripe
            // For now, we'll simulate the authorization
            const authorizationId = `auth_${crypto.randomBytes(12).toString('hex')}`;

            // Update tenant usage
            await database.updateTenantUsage(tenant.id, amount);

            console.log(`✅ Payment authorized: ${authorizationId} for $${amount/100}`);

            // Return authorization response
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
                expires_at: Math.floor((Date.now() + 10 * 60 * 1000) / 1000), // 10 minutes
                metadata,
                livemode: process.env.NODE_ENV === 'production',
                transaction: {
                    id: transaction.id,
                    amount: transaction.amount,
                    status: transaction.status
                }
            });

        } catch (error) {
            console.error('Authorization error:', error);
            
            if (error.message.includes('limit')) {
                return res.status(402).json({
                    error: error.message,
                    code: 'SPENDING_LIMIT_ERROR'
                });
            }

            res.status(500).json({
                error: 'Failed to process authorization',
                code: 'AUTHORIZATION_ERROR',
                message: 'An error occurred while processing your payment authorization'
            });
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

            // In real implementation, would confirm with Stripe
            // For now, simulate successful confirmation
            const paymentId = `pay_${crypto.randomBytes(12).toString('hex')}`;

            // Create confirmed transaction record
            const transaction = await database.createTransaction({
                amount: finalAmount || req.body.amount,
                description: `Confirmed payment ${authorizationId}`,
                tenantId: tenant.id,
                userId: req.user.id,
                status: 'completed',
                metadata: {
                    authorizationId,
                    paymentId,
                    apiKeyId: req.apiKey.keyId
                }
            });

            console.log(`✅ Payment confirmed: ${paymentId}`);

            res.status(200).json({
                id: paymentId,
                object: 'payment',
                amount: finalAmount || req.body.amount,
                status: 'completed',
                authorizationId,
                tenantId: tenant.id,
                created: Math.floor(Date.now() / 1000),
                livemode: process.env.NODE_ENV === 'production',
                transaction: {
                    id: transaction.id,
                    amount: transaction.amount,
                    status: transaction.status
                }
            });

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

            // In real implementation, would process refund with Stripe
            const refundId = `ref_${crypto.randomBytes(12).toString('hex')}`;

            // Create refund transaction record
            const refundTransaction = await database.createTransaction({
                amount: -(amount || 0), // Negative amount for refund
                description: `Refund for ${transactionId}`,
                tenantId: tenant.id,
                userId: req.user.id,
                status: 'refunded',
                metadata: {
                    originalTransactionId: transactionId,
                    refundId,
                    reason: reason || 'requested',
                    apiKeyId: req.apiKey.keyId
                }
            });

            console.log(`✅ Refund processed: ${refundId}`);

            res.status(200).json({
                id: refundId,
                object: 'refund',
                amount: amount || 0,
                reason: reason || 'requested',
                status: 'succeeded',
                transactionId,
                tenantId: tenant.id,
                created: Math.floor(Date.now() / 1000),
                livemode: process.env.NODE_ENV === 'production',
                transaction: {
                    id: refundTransaction.id,
                    amount: refundTransaction.amount,
                    status: refundTransaction.status
                }
            });

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

module.exports = router; 