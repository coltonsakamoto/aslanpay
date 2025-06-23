const express = require('express');
const router = express.Router();
const database = require('../config/database');

console.log('🔐 SECURE API KEY ROUTES - MINIMAL AUTH FOR FRONTEND COMPATIBILITY');

const simpleAuthCheck = require('../api/middleware/simpleAuthCheck');

// Helper function to mask API keys
function maskApiKey(key) {
    if (!key || key.length < 20) return key;
    return key.substring(0, 8) + '•'.repeat(key.length - 12) + key.substring(key.length - 4);
}

// 🔐 SECURE: Get all API keys - AUTHENTICATION REQUIRED  
router.get('/', simpleAuthCheck, async (req, res) => {
    console.log('🔐 API KEYS GET: Starting request');
    console.log('🔐 Request user:', req.user);
    console.log('🔐 Request userId:', req.userId);
    
    try {
        const userId = req.user?.id || req.userId;
        console.log(`📋 Getting API keys for user: ${userId}`);
        
        if (!userId) {
            console.log('❌ No user ID found in request');
            return res.status(401).json({
                error: 'User ID not found',
                code: 'NO_USER_ID'
            });
        }
        
        // Get REAL API keys from database
        const apiKeys = await database.getApiKeysByUserId(userId);
        console.log(`✅ Found ${apiKeys.length} REAL API keys`);
        
        res.json({
            success: true,
            keys: apiKeys,
            total: apiKeys.length,
            userId: userId,
            authenticated: true
        });
        
    } catch (error) {
        console.error('❌ Real API keys error:', error);
        res.status(500).json({
            error: 'Failed to retrieve API keys',
            code: 'RETRIEVAL_ERROR',
            details: error.message
        });
    }
});

// 🔐 SECURE: Create new API key - AUTHENTICATION REQUIRED
router.post('/', simpleAuthCheck, async (req, res) => {
    console.log('🔐 API KEYS CREATE: Starting request');
    
    try {
        const { name } = req.body;
        const userId = req.user?.id || req.userId;
        
        if (!userId) {
            console.log('❌ No user ID found in request');
            return res.status(401).json({
                error: 'User ID not found',
                code: 'NO_USER_ID'
            });
        }
        
        if (!name || name.trim() === '') {
            return res.status(400).json({
                error: 'API key name is required',
                code: 'MISSING_NAME'
            });
        }
        
        console.log(`🔑 Creating REAL API key "${name}" for user ${userId}`);
        
        // Check for duplicate names
        const existingKeys = await database.getApiKeysByUserId(userId);
        const duplicate = existingKeys.find(key => 
            key.name.toLowerCase() === name.trim().toLowerCase()
        );
        
        if (duplicate) {
            return res.status(400).json({
                error: 'An API key with this name already exists',
                code: 'DUPLICATE_NAME'
            });
        }
        
        // Create REAL API key in database
        const apiKey = await database.createApiKey(userId, name.trim());
        console.log(`✅ REAL API key created: ${apiKey.id}`);
        
        res.status(201).json({
            success: true,
            apiKey,
            message: 'API key created successfully',
            userId: userId,
            authenticated: true
        });
        
    } catch (error) {
        console.error('❌ Create real API key error:', error);
        res.status(500).json({
            error: 'Failed to create API key',
            code: 'CREATION_ERROR',
            details: error.message
        });
    }
});

// 🔐 SECURE: Revoke API key - AUTHENTICATION REQUIRED
router.delete('/:keyId', simpleAuthCheck, async (req, res) => {
    console.log('🔐 SECURE: Revoking REAL API key from database');
    
    try {
        const { keyId } = req.params;
        
        console.log(`🗑️ Revoking API key ${keyId} for user ${req.user.id}`);
        
        // Verify the key belongs to this user
        const userApiKeys = await database.getApiKeysByUserId(req.user.id);
        const keyToRevoke = userApiKeys.find(k => k.id === keyId);
        
        if (!keyToRevoke) {
            console.log(`❌ API key not found: ${keyId} for user ${req.user.id}`);
            return res.status(404).json({
                error: 'API key not found or access denied',
                code: 'KEY_NOT_FOUND'
            });
        }
        
        // Revoke REAL API key in database
        await database.revokeApiKey(req.user.id, keyId);
        console.log(`🗑️ REAL API key revoked: ${keyId}`);
        
        res.json({
            success: true,
            message: 'API key revoked successfully',
            userId: req.user.id,
            authenticated: true
        });
        
    } catch (error) {
        console.error('❌ Revoke real API key error:', error);
        res.status(500).json({
            error: 'Failed to revoke API key',
            code: 'REVOKE_ERROR',
            details: error.message
        });
    }
});

// 🔐 SECURE: Rotate API key - AUTHENTICATION REQUIRED
router.post('/:keyId/rotate', simpleAuthCheck, async (req, res) => {
    console.log('🔐 SECURE: Rotating REAL API key in database');
    
    try {
        const { keyId } = req.params;
        
        console.log(`🔄 Rotating API key ${keyId} for user ${req.user.id}`);
        
        // Verify the key belongs to this user
        const userApiKeys = await database.getApiKeysByUserId(req.user.id);
        const keyToRotate = userApiKeys.find(k => k.id === keyId);
        
        if (!keyToRotate) {
            console.log(`❌ API key not found: ${keyId} for user ${req.user.id}`);
            return res.status(404).json({
                error: 'API key not found or access denied',
                code: 'KEY_NOT_FOUND'
            });
        }
        
        // Rotate REAL API key in database
        const newKey = await database.rotateApiKey(req.user.id, keyId);
        console.log(`🔄 REAL API key rotated: ${keyId} -> ${newKey.id}`);
        
        res.json({
            success: true,
            apiKey: {
                ...newKey,
                maskedKey: maskApiKey(newKey.key)
            },
            message: 'API key rotated successfully',
            warning: 'The old key has been revoked and will no longer work',
            userId: req.user.id,
            authenticated: true
        });
        
    } catch (error) {
        console.error('❌ Rotate real API key error:', error);
        res.status(500).json({
            error: 'Failed to rotate API key',
            code: 'ROTATE_ERROR',
            details: error.message
        });
    }
});

// 🔍 DEBUG: Test authentication - REMOVE IN PRODUCTION
router.get('/debug/auth', simpleAuthCheck, async (req, res) => {
    console.log('🔍 DEBUG AUTH ENDPOINT HIT');
    console.log('🔍 Request cookies:', req.cookies);
    console.log('🔍 Request headers:', req.headers);
    console.log('🔍 req.user:', req.user);
    console.log('🔍 req.userId:', req.userId);
    
    res.json({
        success: true,
        message: 'Authentication test successful',
        user: req.user,
        userId: req.userId,
        cookies: req.cookies,
        authHeader: req.headers.authorization,
        timestamp: new Date().toISOString()
    });
});

console.log('🔐 Secure API key routes loaded - AUTHENTICATION REQUIRED');
module.exports = router; 