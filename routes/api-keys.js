const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { validateSession } = require('../middleware/auth');
const SecureRandom = require('../utils/secure-random');

// Helper function to mask API keys
function maskApiKey(key) {
    if (!key || key.length < 20) return key;
    // Show first 8 chars and last 4 chars
    return key.substring(0, 8) + '•'.repeat(key.length - 12) + key.substring(key.length - 4);
}

// Get all API keys for authenticated user's tenant (masked)
router.get('/', validateSession, async (req, res) => {
    try {
        const session = database.getSession(req.session.id);
        if (!session || !session.tenantId) {
            return res.status(400).json({
                error: 'No tenant context found',
                code: 'NO_TENANT_CONTEXT'
            });
        }

        const apiKeys = database.getApiKeysByTenant(session.tenantId);
        
        // Mask the keys before sending
        const maskedKeys = apiKeys.map(key => ({
            ...key,
            maskedKey: maskApiKey(key.key),
            key: undefined // Remove the full key
        }));
        
        const tenant = database.getTenant(session.tenantId);
        
        res.json({
            apiKeys: maskedKeys,
            total: maskedKeys.length,
            tenant: {
                id: tenant.id,
                name: tenant.name,
                plan: tenant.plan
            }
        });
        
    } catch (error) {
        console.error('Get API keys error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Reveal a specific API key (requires additional verification)
router.post('/:keyId/reveal', validateSession, async (req, res) => {
    try {
        const { keyId } = req.params;
        const session = database.getSession(req.session.id);
        
        if (!session || !session.tenantId) {
            return res.status(400).json({
                error: 'No tenant context found',
                code: 'NO_TENANT_CONTEXT'
            });
        }
        
        // Get the tenant's API keys
        const apiKeys = database.getApiKeysByTenant(session.tenantId);
        const apiKey = apiKeys.find(k => k.id === keyId);
        
        if (!apiKey) {
            return res.status(404).json({
                error: 'API key not found',
                code: 'KEY_NOT_FOUND'
            });
        }
        
        // Log the reveal action for security auditing
        console.log(`🔓 API key revealed: ${keyId} by user ${req.user.id} in tenant ${session.tenantId} at ${new Date().toISOString()}`);
        
        // Return the full key (frontend should handle display carefully)
        res.json({
            key: apiKey.key,
            warning: 'This key will only be shown once. Please copy it now.'
        });
        
    } catch (error) {
        console.error('Reveal API key error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Create new API key
router.post('/', validateSession, async (req, res) => {
    try {
        const { name } = req.body;
        const session = database.getSession(req.session.id);
        
        if (!session || !session.tenantId) {
            return res.status(400).json({
                error: 'No tenant context found',
                code: 'NO_TENANT_CONTEXT'
            });
        }
        
        if (!name || name.trim() === '') {
            return res.status(400).json({
                error: 'API key name is required',
                code: 'MISSING_NAME'
            });
        }
        
        // Check rate limiting for API key creation per tenant
        const tenantId = session.tenantId;
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        
        // Count keys created today for this tenant
        const tenantKeys = database.getApiKeysByTenant(tenantId);
        const keysCreatedToday = tenantKeys.filter(key => 
            new Date(key.createdAt) >= dayStart
        ).length;
        
        if (keysCreatedToday >= 10) {
            return res.status(429).json({
                error: 'Daily API key creation limit reached (10 per day per organization)',
                code: 'RATE_LIMIT_EXCEEDED'
            });
        }

        // Check if name already exists in tenant
        const existingKey = tenantKeys.find(key => 
            key.name.toLowerCase() === name.trim().toLowerCase()
        );
        
        if (existingKey) {
            return res.status(400).json({
                error: 'An API key with this name already exists in your organization',
                code: 'DUPLICATE_NAME'
            });
        }
        
        const apiKey = await database.createApiKey(req.user.id, tenantId, name.trim());
        
        console.log(`🔑 API key created: ${apiKey.id} for tenant ${tenantId} by user ${req.user.id}`);
        
        // Return the full key only on creation
        res.status(201).json({
            apiKey: {
                ...apiKey,
                maskedKey: maskApiKey(apiKey.key)
            },
            message: 'API key created successfully. Please save this key securely - it will not be shown again.',
            warning: 'This is the only time you will see the full API key.'
        });
        
    } catch (error) {
        console.error('Create API key error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Revoke API key
router.delete('/:keyId', validateSession, async (req, res) => {
    try {
        const { keyId } = req.params;
        const session = database.getSession(req.session.id);
        
        if (!session || !session.tenantId) {
            return res.status(400).json({
                error: 'No tenant context found',
                code: 'NO_TENANT_CONTEXT'
            });
        }

        // Verify the key belongs to this tenant
        const tenantKeys = database.getApiKeysByTenant(session.tenantId);
        const keyToRevoke = tenantKeys.find(k => k.id === keyId);
        
        if (!keyToRevoke) {
            return res.status(404).json({
                error: 'API key not found in your organization',
                code: 'KEY_NOT_FOUND'
            });
        }

        // Mark key as inactive (we'll use the existing revokeApiKey method)
        const allKeys = database.getAllData().apiKeys;
        const keyData = allKeys.find(k => k.id === keyId);
        
        if (keyData) {
            keyData.isActive = false;
            keyData.revokedAt = new Date();
            keyData.revokedBy = req.user.id;
        }
        
        console.log(`🗑️ API key revoked: ${keyId} in tenant ${session.tenantId} by user ${req.user.id}`);
        
        res.json({
            message: 'API key revoked successfully'
        });
        
    } catch (error) {
        console.error('Revoke API key error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Rotate API key
router.post('/:keyId/rotate', validateSession, async (req, res) => {
    try {
        const { keyId } = req.params;
        const session = database.getSession(req.session.id);
        
        if (!session || !session.tenantId) {
            return res.status(400).json({
                error: 'No tenant context found',
                code: 'NO_TENANT_CONTEXT'
            });
        }

        // Verify the key belongs to this tenant
        const tenantKeys = database.getApiKeysByTenant(session.tenantId);
        const keyToRotate = tenantKeys.find(k => k.id === keyId);
        
        if (!keyToRotate) {
            return res.status(404).json({
                error: 'API key not found in your organization',
                code: 'KEY_NOT_FOUND'
            });
        }

        // Create new key with same name
        const newKey = await database.createApiKey(req.user.id, session.tenantId, keyToRotate.name);
        
        // Revoke old key
        const allKeys = database.getAllData().apiKeys;
        const oldKeyData = allKeys.find(k => k.id === keyId);
        if (oldKeyData) {
            oldKeyData.isActive = false;
            oldKeyData.revokedAt = new Date();
            oldKeyData.revokedBy = req.user.id;
        }
        
        console.log(`🔄 API key rotated: ${keyId} -> ${newKey.id} in tenant ${session.tenantId} by user ${req.user.id}`);
        
        res.json({
            apiKey: {
                ...newKey,
                maskedKey: maskApiKey(newKey.key)
            },
            message: 'API key rotated successfully. Please save the new key securely.',
            warning: 'The old key has been revoked and will no longer work.'
        });
        
    } catch (error) {
        console.error('Rotate API key error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Update API key name
router.patch('/:keyId', validateSession, async (req, res) => {
    try {
        const { keyId } = req.params;
        const { name } = req.body;
        const session = database.getSession(req.session.id);
        
        if (!session || !session.tenantId) {
            return res.status(400).json({
                error: 'No tenant context found',
                code: 'NO_TENANT_CONTEXT'
            });
        }
        
        if (!keyId) {
            return res.status(400).json({
                error: 'API key ID is required',
                code: 'MISSING_KEY_ID'
            });
        }
        
        if (!name || name.trim() === '') {
            return res.status(400).json({
                error: 'API key name is required',
                code: 'MISSING_NAME'
            });
        }
        
        if (name.length > 50) {
            return res.status(400).json({
                error: 'API key name must be 50 characters or less',
                code: 'NAME_TOO_LONG'
            });
        }
        
        // Verify the key belongs to this tenant
        const tenantKeys = database.getApiKeysByTenant(session.tenantId);
        const keyToUpdate = tenantKeys.find(k => k.id === keyId);
        
        if (!keyToUpdate) {
            return res.status(404).json({
                error: 'API key not found in your organization',
                code: 'KEY_NOT_FOUND'
            });
        }
        
        // Check for duplicate names within tenant (excluding current key)
        const duplicateName = tenantKeys.find(key => 
            key.id !== keyId && key.name.toLowerCase() === name.toLowerCase()
        );
        if (duplicateName) {
            return res.status(400).json({
                error: 'An API key with this name already exists in your organization',
                code: 'DUPLICATE_NAME'
            });
        }
        
        // Update the key in the raw data
        const allKeys = database.getAllData().apiKeys;
        const keyData = allKeys.find(key => key.id === keyId);
        
        if (keyData) {
            keyData.name = name.trim();
            console.log(`📝 API key renamed: ${keyId} to "${name}" in tenant ${session.tenantId}`);
        }
        
        res.json({
            message: 'API key name updated successfully'
        });
        
    } catch (error) {
        console.error('Update API key error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Get API key usage statistics
router.get('/:keyId/usage', validateSession, async (req, res) => {
    try {
        const { keyId } = req.params;
        const session = database.getSession(req.session.id);
        
        if (!session || !session.tenantId) {
            return res.status(400).json({
                error: 'No tenant context found',
                code: 'NO_TENANT_CONTEXT'
            });
        }
        
        if (!keyId) {
            return res.status(400).json({
                error: 'API key ID is required',
                code: 'MISSING_KEY_ID'
            });
        }
        
        // Verify the key belongs to this tenant
        const tenantKeys = database.getApiKeysByTenant(session.tenantId);
        const apiKey = tenantKeys.find(k => k.id === keyId);
        
        if (!apiKey) {
            return res.status(404).json({
                error: 'API key not found in your organization',
                code: 'KEY_NOT_FOUND'
            });
        }
        
        // Get actual transactions for this API key
        const transactions = database.getTransactionsByTenant(session.tenantId);
        const keyTransactions = transactions.filter(t => t.metadata?.apiKeyId === keyId);
        
        // Calculate usage statistics
        const now = new Date();
        const day24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const day7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const day30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const usageStats = {
            keyId: apiKey.id,
            name: apiKey.name,
            totalRequests: apiKey.usageCount || 0,
            lastUsed: apiKey.lastUsed,
            createdAt: apiKey.createdAt,
            totalTransactions: keyTransactions.length,
            totalAmount: keyTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
            requestsLast24h: keyTransactions.filter(t => t.createdAt >= day24hAgo).length,
            requestsLast7d: keyTransactions.filter(t => t.createdAt >= day7Ago).length,
            requestsLast30d: keyTransactions.filter(t => t.createdAt >= day30Ago).length,
            successfulTransactions: keyTransactions.filter(t => t.status === 'completed').length,
            failedTransactions: keyTransactions.filter(t => t.status === 'failed').length,
            successRate: keyTransactions.length > 0 ? 
                (keyTransactions.filter(t => t.status === 'completed').length / keyTransactions.length * 100) : 0
        };
        
        res.json(usageStats);
        
    } catch (error) {
        console.error('Get API key usage error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

module.exports = router; 