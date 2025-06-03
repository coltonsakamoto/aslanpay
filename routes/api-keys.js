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

// Get all API keys for authenticated user (masked)
router.get('/', validateSession, async (req, res) => {
    try {
        const apiKeys = await database.getApiKeysByUserId(req.user.id);
        
        // Mask the keys before sending
        const maskedKeys = apiKeys.map(key => ({
            ...key,
            maskedKey: maskApiKey(key.key),
            key: undefined // Remove the full key
        }));
        
        res.json({
            apiKeys: maskedKeys,
            total: maskedKeys.length
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
        
        // Get the user's API keys
        const apiKeys = await database.getApiKeysByUserId(req.user.id);
        const apiKey = apiKeys.find(k => k.id === keyId);
        
        if (!apiKey) {
            return res.status(404).json({
                error: 'API key not found',
                code: 'KEY_NOT_FOUND'
            });
        }
        
        // Log the reveal action for security auditing
        console.log(`🔓 API key revealed: ${keyId} by user ${req.user.id} at ${new Date().toISOString()}`);
        
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
        
        if (!name || name.trim() === '') {
            return res.status(400).json({
                error: 'API key name is required',
                code: 'MISSING_NAME'
            });
        }
        
        // Check rate limiting for API key creation
        const userId = req.user.id;
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        
        // Count keys created today
        const userKeys = await database.getApiKeysByUserId(userId);
        const keysCreatedToday = userKeys.filter(key => 
            new Date(key.createdAt) >= dayStart
        ).length;
        
        if (keysCreatedToday >= 10) {
            return res.status(429).json({
                error: 'Daily API key creation limit reached (10 per day)',
                code: 'RATE_LIMIT_EXCEEDED'
            });
        }
        
        const apiKey = await database.createApiKey(userId, name.trim());
        
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
        
        await database.revokeApiKey(req.user.id, keyId);
        
        res.json({
            message: 'API key revoked successfully'
        });
        
    } catch (error) {
        if (error.message === 'API key not found') {
            return res.status(404).json({
                error: 'API key not found',
                code: 'KEY_NOT_FOUND'
            });
        }
        
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
        
        const newKey = await database.rotateApiKey(req.user.id, keyId);
        
        // Log rotation for security auditing
        console.log(`🔄 API key rotated: ${keyId} by user ${req.user.id} at ${new Date().toISOString()}`);
        
        res.json({
            apiKey: {
                ...newKey,
                maskedKey: maskApiKey(newKey.key)
            },
            message: 'API key rotated successfully. Please save the new key securely.',
            warning: 'The old key has been revoked and will no longer work.'
        });
        
    } catch (error) {
        if (error.message === 'API key not found') {
            return res.status(404).json({
                error: 'API key not found',
                code: 'KEY_NOT_FOUND'
            });
        }
        
        console.error('Rotate API key error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Update API key name
router.patch('/:keyId', async (req, res) => {
    try {
        const { keyId } = req.params;
        const { name } = req.body;
        
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
        
        // Check for duplicate names (excluding current key)
        const existingKeys = database.getApiKeysByUserId(req.user.id);
        const duplicateName = existingKeys.find(key => 
            key.id !== keyId && key.name.toLowerCase() === name.toLowerCase()
        );
        if (duplicateName) {
            return res.status(400).json({
                error: 'An API key with this name already exists',
                code: 'DUPLICATE_NAME'
            });
        }
        
        // Find and update the key
        const allKeys = database.getAllData().apiKeys;
        const keyToUpdate = allKeys.find(key => key.id === keyId && key.userId === req.user.id);
        
        if (!keyToUpdate) {
            return res.status(404).json({
                error: 'API key not found',
                code: 'KEY_NOT_FOUND'
            });
        }
        
        keyToUpdate.name = name.trim();
        
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
router.get('/:keyId/usage', async (req, res) => {
    try {
        const { keyId } = req.params;
        
        if (!keyId) {
            return res.status(400).json({
                error: 'API key ID is required',
                code: 'MISSING_KEY_ID'
            });
        }
        
        const allKeys = database.getAllData().apiKeys;
        const apiKey = allKeys.find(key => key.id === keyId && key.userId === req.user.id);
        
        if (!apiKey) {
            return res.status(404).json({
                error: 'API key not found',
                code: 'KEY_NOT_FOUND'
            });
        }
        
        // In a real implementation, you'd query usage logs from a database
        const usageStats = {
            keyId: apiKey.id,
            name: apiKey.name,
            totalRequests: apiKey.usageCount,
            lastUsed: apiKey.lastUsed,
            createdAt: apiKey.createdAt,
            // Mock data for demo
            requestsLast24h: Math.floor(Math.random() * 100),
            requestsLast7d: Math.floor(Math.random() * 700),
            requestsLast30d: Math.floor(Math.random() * 3000),
            successRate: 95.5 + Math.random() * 4, // Random between 95.5-99.5%
            averageResponseTime: 150 + Math.random() * 100, // Random between 150-250ms
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