const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { validateApiKey, requirePermission } = require('../middleware/auth');
const RequestSigning = require('../middleware/request-signing');
const InputValidation = require('../middleware/input-validation');
const SecurityAudit = require('../middleware/security-audit');
const Joi = require('joi');

// Mock authorization database (in production, this would be a real database)
const authorizations = new Map();

// Generate cryptographically secure authorization ID
function generateSecureAuthId() {
    // Use crypto.randomBytes for unpredictable IDs
    const timestamp = Date.now().toString(36);
    const randomBytes = crypto.randomBytes(16).toString('base64url');
    return `auth_${timestamp}_${randomBytes}`;
}

// Create a new authorization with request signing
router.post('/', 
    RequestSigning.requireSignature(), // Add request signing
    InputValidation.validateBody(InputValidation.paymentSchemas.authorize),
    requirePermission('create_authorization'), 
    async (req, res) => {
    try {
        const { amount, description, merchant, metadata } = req.body;
        
        // Generate secure authorization ID
        const authId = generateSecureAuthId();
        
        // Create authorization record
        const authorization = {
            id: authId,
            amount,
            description,
            merchant: merchant || 'Default Merchant',
            metadata: metadata || {},
            status: 'pending',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
            apiKeyId: req.apiKey.id,
            userId: req.apiKey.userId
        };
        
        // Store authorization
        authorizations.set(authId, authorization);
        
        // Update ownership index for IDOR prevention
        authorizationIndex.set(authId, {
            userId: req.apiKey.userId,
            createdAt: authorization.createdAt
        });
        
        // Log successful authorization
        await SecurityAudit.log(
            SecurityAudit.EVENT_TYPES.AUTHORIZATION_SUCCESS,
            SecurityAudit.LOG_LEVELS.INFO,
            {
                authId,
                amount,
                apiKeyId: req.apiKey.id,
                userId: req.apiKey.userId,
                ...req.auditContext
            }
        );
        
        res.status(201).json({
            authorization: {
                id: authorization.id,
                amount: authorization.amount,
                description: authorization.description,
                status: authorization.status,
                expiresAt: authorization.expiresAt
            }
        });
        
    } catch (error) {
        console.error('Authorization creation error:', error);
        
        await SecurityAudit.log(
            SecurityAudit.EVENT_TYPES.SYSTEM_ERROR,
            SecurityAudit.LOG_LEVELS.CRITICAL,
            {
                error: error.message,
                endpoint: 'POST /authorize',
                ...req.auditContext
            }
        );
        
        res.status(500).json({
            error: 'Failed to create authorization',
            code: 'AUTHORIZATION_ERROR'
        });
    }
});

// Get authorization status with request signing
router.get('/:authId', 
    RequestSigning.requireSignature(), // Add request signing
    InputValidation.validateParams(Joi.object({
        authId: Joi.string().pattern(/^auth_[a-zA-Z0-9_-]+$/).required()
    })),
    async (req, res) => {
    try {
        const { authId } = req.params;
        
        // SECURITY: Check ownership BEFORE fetching data
        // This prevents information disclosure through IDOR
        const authIndex = await getAuthorizationIndex();
        const authOwnership = authIndex.get(authId);
        
        if (!authOwnership || authOwnership.userId !== req.user.id) {
            // Return generic error to prevent enumeration
            return res.status(404).json({
                error: 'Authorization not found',
                code: 'AUTH_NOT_FOUND'
            });
        }
        
        // Now safe to fetch the full authorization
        const authorization = authorizations.get(authId);
        
        if (!authorization) {
            // This shouldn't happen if index is correct
            console.error(`Authorization index mismatch for ${authId}`);
            return res.status(404).json({
                error: 'Authorization not found',
                code: 'AUTH_NOT_FOUND'
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

// Confirm authorization with request signing
router.post('/:authId/confirm', 
    RequestSigning.requireSignature(), // Add request signing
    InputValidation.validateBody(InputValidation.paymentSchemas.confirm),
    requirePermission('confirm_authorization'), 
    async (req, res) => {
    try {
        const { authId } = req.params;
        const { paymentMethodId, receiptEmail } = req.body;
        
        // SECURITY: Check ownership BEFORE fetching data
        const authIndex = await getAuthorizationIndex();
        const authOwnership = authIndex.get(authId);
        
        if (!authOwnership || authOwnership.userId !== req.user.id) {
            await SecurityAudit.log(
                SecurityAudit.EVENT_TYPES.AUTHORIZATION_FAILED,
                SecurityAudit.LOG_LEVELS.WARNING,
                {
                    reason: 'Unauthorized access attempt',
                    authId,
                    attemptedBy: req.user.id,
                    ...req.auditContext
                }
            );
            
            return res.status(404).json({
                error: 'Authorization not found',
                code: 'AUTH_NOT_FOUND'
            });
        }
        
        // Now safe to fetch and process
        const authorization = authorizations.get(authId);
        
        if (!authorization) {
            return res.status(404).json({
                error: 'Authorization not found',
                code: 'AUTH_NOT_FOUND'
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
        
        // Generate secure transaction ID
        const transactionId = `txn_${Date.now().toString(36)}_${crypto.randomBytes(12).toString('base64url')}`;
        
        // Log successful confirmation
        await SecurityAudit.log(
            SecurityAudit.EVENT_TYPES.PAYMENT_SUCCESS,
            SecurityAudit.LOG_LEVELS.INFO,
            {
                authId,
                transactionId,
                amount: authorization.amount,
                ...req.auditContext
            }
        );
        
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

// Cancel authorization with request signing
router.post('/:authId/cancel', 
    RequestSigning.requireSignature(), // Add request signing
    requirePermission('cancel_authorization'), 
    async (req, res) => {
    // ... existing code with added audit logging ...
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

// Authorization ownership index for fast lookups
const authorizationIndex = new Map();

async function getAuthorizationIndex() {
    return authorizationIndex;
}

module.exports = router; 