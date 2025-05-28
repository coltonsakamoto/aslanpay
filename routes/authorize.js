const express = require('express');
const router = express.Router();
const { validateApiKey, requirePermission } = require('../middleware/auth');

// Mock authorization database (in production, this would be a real database)
const authorizations = new Map();

// Authorize a payment
router.post('/', validateApiKey, requirePermission('authorize'), async (req, res) => {
    try {
        const { amount, description, merchant, metadata = {} } = req.body;
        
        // Validation
        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({
                error: 'Valid amount is required',
                code: 'INVALID_AMOUNT'
            });
        }
        
        if (amount > 10000000) { // $100,000 limit
            return res.status(400).json({
                error: 'Amount exceeds maximum limit ($100,000)',
                code: 'AMOUNT_TOO_HIGH'
            });
        }
        
        if (!description || description.trim() === '') {
            return res.status(400).json({
                error: 'Description is required',
                code: 'MISSING_DESCRIPTION'
            });
        }
        
        // Check user's subscription limits
        const user = req.user;
        const plan = user.subscription.plan;
        
        // Simple plan-based limits (in production, this would be more sophisticated)
        const planLimits = {
            sandbox: { maxAmount: 10000, dailyLimit: 50000 }, // $100 per transaction, $500 daily
            builder: { maxAmount: 100000, dailyLimit: 1000000 }, // $1,000 per transaction, $10,000 daily
            team: { maxAmount: 500000, dailyLimit: 5000000 }, // $5,000 per transaction, $50,000 daily
            enterprise: { maxAmount: 10000000, dailyLimit: 100000000 } // $100,000 per transaction, $1M daily
        };
        
        const limits = planLimits[plan] || planLimits.sandbox;
        
        if (amount > limits.maxAmount) {
            return res.status(403).json({
                error: `Amount exceeds plan limit ($${limits.maxAmount / 100})`,
                code: 'PLAN_LIMIT_EXCEEDED'
            });
        }
        
        // Generate authorization
        const authId = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const authorization = {
            id: authId,
            userId: user.id,
            apiKeyId: req.apiKey.keyId,
            amount,
            description,
            merchant: merchant || 'Unknown Merchant',
            metadata,
            status: 'authorized',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes expiry
            confirmed: false
        };
        
        authorizations.set(authId, authorization);
        
        // Simulate authorization time (<400ms)
        const authTime = 50 + Math.random() * 200; // Random between 50-250ms
        
        res.json({
            authorization: {
                id: authId,
                amount,
                description,
                merchant: authorization.merchant,
                status: 'authorized',
                expiresAt: authorization.expiresAt,
                authorizationTime: `${Math.round(authTime)}ms`
            },
            message: 'Payment authorized successfully'
        });
        
    } catch (error) {
        console.error('Authorization error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Confirm a payment authorization
router.post('/:authId/confirm', validateApiKey, requirePermission('confirm'), async (req, res) => {
    try {
        const { authId } = req.params;
        const { paymentMethodId, receiptEmail } = req.body;
        
        const authorization = authorizations.get(authId);
        
        if (!authorization) {
            return res.status(404).json({
                error: 'Authorization not found',
                code: 'AUTH_NOT_FOUND'
            });
        }
        
        if (authorization.userId !== req.user.id) {
            return res.status(403).json({
                error: 'Unauthorized access to authorization',
                code: 'UNAUTHORIZED_AUTH'
            });
        }
        
        if (authorization.expiresAt < new Date()) {
            return res.status(400).json({
                error: 'Authorization has expired',
                code: 'AUTH_EXPIRED'
            });
        }
        
        if (authorization.confirmed) {
            return res.status(400).json({
                error: 'Authorization already confirmed',
                code: 'ALREADY_CONFIRMED'
            });
        }
        
        // Mark as confirmed
        authorization.confirmed = true;
        authorization.confirmedAt = new Date();
        authorization.paymentMethodId = paymentMethodId;
        authorization.receiptEmail = receiptEmail;
        authorizations.set(authId, authorization);
        
        // Simulate payment processing
        const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        res.json({
            transaction: {
                id: transactionId,
                authorizationId: authId,
                amount: authorization.amount,
                description: authorization.description,
                merchant: authorization.merchant,
                status: 'completed',
                confirmedAt: authorization.confirmedAt
            },
            message: 'Payment confirmed and processed successfully'
        });
        
    } catch (error) {
        console.error('Confirmation error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Get authorization status
router.get('/:authId', validateApiKey, async (req, res) => {
    try {
        const { authId } = req.params;
        
        const authorization = authorizations.get(authId);
        
        if (!authorization) {
            return res.status(404).json({
                error: 'Authorization not found',
                code: 'AUTH_NOT_FOUND'
            });
        }
        
        if (authorization.userId !== req.user.id) {
            return res.status(403).json({
                error: 'Unauthorized access to authorization',
                code: 'UNAUTHORIZED_AUTH'
            });
        }
        
        res.json({
            authorization: {
                id: authorization.id,
                amount: authorization.amount,
                description: authorization.description,
                merchant: authorization.merchant,
                status: authorization.status,
                confirmed: authorization.confirmed,
                createdAt: authorization.createdAt,
                expiresAt: authorization.expiresAt,
                confirmedAt: authorization.confirmedAt
            }
        });
        
    } catch (error) {
        console.error('Get authorization error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// List authorizations for the user
router.get('/', validateApiKey, async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        
        // Get user's authorizations
        const userAuthorizations = Array.from(authorizations.values())
            .filter(auth => auth.userId === req.user.id)
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(Number(offset), Number(offset) + Number(limit))
            .map(auth => ({
                id: auth.id,
                amount: auth.amount,
                description: auth.description,
                merchant: auth.merchant,
                status: auth.status,
                confirmed: auth.confirmed,
                createdAt: auth.createdAt,
                expiresAt: auth.expiresAt
            }));
        
        res.json({
            authorizations: userAuthorizations,
            pagination: {
                limit: Number(limit),
                offset: Number(offset),
                total: Array.from(authorizations.values()).filter(auth => auth.userId === req.user.id).length
            }
        });
        
    } catch (error) {
        console.error('List authorizations error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Refund an authorization (if it has the refund permission)
router.post('/:authId/refund', validateApiKey, requirePermission('refund'), async (req, res) => {
    try {
        const { authId } = req.params;
        const { reason, amount: refundAmount } = req.body;
        
        const authorization = authorizations.get(authId);
        
        if (!authorization) {
            return res.status(404).json({
                error: 'Authorization not found',
                code: 'AUTH_NOT_FOUND'
            });
        }
        
        if (authorization.userId !== req.user.id) {
            return res.status(403).json({
                error: 'Unauthorized access to authorization',
                code: 'UNAUTHORIZED_AUTH'
            });
        }
        
        if (!authorization.confirmed) {
            return res.status(400).json({
                error: 'Cannot refund unconfirmed authorization',
                code: 'NOT_CONFIRMED'
            });
        }
        
        const refundId = `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const finalRefundAmount = refundAmount || authorization.amount;
        
        // Mark authorization as refunded
        authorization.refunded = true;
        authorization.refundedAt = new Date();
        authorization.refundAmount = finalRefundAmount;
        authorization.refundReason = reason;
        authorizations.set(authId, authorization);
        
        res.json({
            refund: {
                id: refundId,
                authorizationId: authId,
                amount: finalRefundAmount,
                reason: reason || 'No reason provided',
                status: 'completed',
                refundedAt: authorization.refundedAt
            },
            message: 'Refund processed successfully'
        });
        
    } catch (error) {
        console.error('Refund error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

module.exports = router; 