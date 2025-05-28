const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { validateSession, validateSessionSimple } = require('../middleware/auth');
const { requireAuth } = require('../middleware/auth');

// All routes require authentication (using simple validation for debugging)
router.use(validateSessionSimple);

// Get all API keys for the authenticated user
router.get('/', async (req, res) => {
    try {
        const apiKeys = database.getApiKeysByUserId(req.user.id);
        
        res.json({
            apiKeys,
            total: apiKeys.length
        });
        
    } catch (error) {
        console.error('Get API keys error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Create a new API key
router.post('/', async (req, res) => {
    try {
        const { name } = req.body;
        
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
        
        // Check if user already has too many keys (limit to 10 for now)
        const existingKeys = database.getApiKeysByUserId(req.user.id);
        if (existingKeys.length >= 10) {
            return res.status(400).json({
                error: 'Maximum number of API keys reached (10)',
                code: 'TOO_MANY_KEYS'
            });
        }
        
        // Check for duplicate names
        const duplicateName = existingKeys.find(key => key.name.toLowerCase() === name.toLowerCase());
        if (duplicateName) {
            return res.status(400).json({
                error: 'An API key with this name already exists',
                code: 'DUPLICATE_NAME'
            });
        }
        
        const apiKey = await database.createApiKey(req.user.id, name.trim());
        
        res.status(201).json({
            apiKey,
            message: 'API key created successfully. Make sure to copy it now - you won\'t be able to see it again!'
        });
        
    } catch (error) {
        console.error('Create API key error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Revoke an API key
router.delete('/:keyId', async (req, res) => {
    try {
        const { keyId } = req.params;
        
        if (!keyId) {
            return res.status(400).json({
                error: 'API key ID is required',
                code: 'MISSING_KEY_ID'
            });
        }
        
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

// Rotate an API key (revoke old one and create new one)
router.post('/:keyId/rotate', async (req, res) => {
    try {
        const { keyId } = req.params;
        
        if (!keyId) {
            return res.status(400).json({
                error: 'API key ID is required',
                code: 'MISSING_KEY_ID'
            });
        }
        
        const newApiKey = await database.rotateApiKey(req.user.id, keyId);
        
        res.json({
            apiKey: newApiKey,
            message: 'API key rotated successfully. The old key has been revoked and a new one created.'
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