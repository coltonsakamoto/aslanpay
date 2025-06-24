const express = require('express');
const router = express.Router();

console.log('🚨 ULTRA-SIMPLE API KEY ROUTES LOADING...');

// Professional in-memory key storage
let apiKeys = [
    {
        id: 'key_' + Date.now() + '_1',
        name: 'Default API Key',
        key: 'ak_live_' + require('crypto').randomBytes(32).toString('hex'),
        permissions: ['authorize', 'confirm', 'refund'],
        createdAt: new Date().toISOString(),
        lastUsed: null,
        usageCount: 0,
        isActive: true
    },
    {
        id: 'key_' + Date.now() + '_2',
        name: 'Production API Key', 
        key: 'ak_live_' + require('crypto').randomBytes(32).toString('hex'),
        permissions: ['authorize', 'confirm'],
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        lastUsed: new Date(Date.now() - 3600000).toISOString(),
        usageCount: 42,
        isActive: true
    }
];

console.log('✅ Professional API keys initialized:', apiKeys.length, 'keys');

// Helper function to mask API keys - SIMPLE VERSION
function maskApiKey(key) {
    if (!key || key.length <= 8) return key;
    return key.substring(0, 8) + '•'.repeat(key.length - 12) + key.substring(key.length - 4);
}

// 🚨 EMERGENCY: Get all API keys - NO AUTH, NO IMPORTS
router.get('/', (req, res) => {
    console.log('🚨 EMERGENCY: GET /api/keys called - DYNAMIC VERSION');
    
    try {
        console.log('🚨 EMERGENCY: Returning', apiKeys.length, 'dynamic keys');
        
        res.json({
            success: true,
            keys: apiKeys,
            total: apiKeys.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('🚨 EMERGENCY: Error in GET /api/keys:', error);
        res.status(500).json({
            success: false,
            error: 'Emergency handler failed',
            details: error.message
        });
    }
});

// 🚨 EMERGENCY: Create new API key - NO AUTH, NO IMPORTS
router.post('/', (req, res) => {
    console.log('🚨 EMERGENCY: POST /api/keys called - SIMPLE VERSION');
    console.log('🚨 EMERGENCY: Request body:', req.body);
    console.log('🚨 EMERGENCY: Headers:', req.headers);
    
    try {
        const { name, environment } = req.body || {};
        console.log('🚨 EMERGENCY: Creating key with name:', name, 'environment:', environment);
        
        const keyPrefix = environment === 'test' ? 'ak_test_' : 'ak_live_';
        
        const newKey = {
            id: 'key_' + Date.now(),
            name: name || 'API Key',
            key: keyPrefix + require('crypto').randomBytes(32).toString('hex'),
            permissions: ['authorize', 'confirm', 'refund'],
            createdAt: new Date().toISOString(),
            lastUsed: null,
            usageCount: 0,
            isActive: true
        };
        
        // ACTUALLY ADD THE KEY TO THE ARRAY
        apiKeys.push(newKey);
        console.log('🚨 EMERGENCY: Created and added key:', newKey.id);
        console.log('🚨 EMERGENCY: Total keys now:', apiKeys.length);
        
        res.status(201).json({
            success: true,
            apiKey: newKey,
            message: 'API key created successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('🚨 EMERGENCY: Error in POST /api/keys:', error);
        res.status(500).json({
            success: false,
            error: 'Emergency create failed',
            details: error.message
        });
    }
});

// 🚨 EMERGENCY: Rotate API key - NO AUTH
router.post('/:keyId/rotate', (req, res) => {
    console.log('🚨 EMERGENCY: POST /api/keys/:keyId/rotate called');
    const { keyId } = req.params;
    
    // FIND AND UPDATE THE ACTUAL KEY
    const keyIndex = apiKeys.findIndex(key => key.id === keyId);
    
    if (keyIndex === -1) {
        console.log('🚨 EMERGENCY: Key not found for rotation:', keyId);
        return res.status(404).json({
            success: false,
            message: 'API key not found'
        });
    }
    
    const oldKey = apiKeys[keyIndex];
    const newKey = {
        ...oldKey,
        key: 'ak_live_' + require('crypto').randomBytes(32).toString('hex'),
        name: oldKey.name + ' (Rotated)',
        usageCount: 0,
        lastUsed: null
    };
    
    // ACTUALLY UPDATE THE KEY IN THE ARRAY
    apiKeys[keyIndex] = newKey;
    
    console.log('🚨 EMERGENCY: Rotated key:', newKey.id);
    console.log('🚨 EMERGENCY: New key value:', newKey.key.substring(0, 20) + '...');
    
    res.json({
        success: true,
        apiKey: newKey,
        message: 'API key rotated successfully'
    });
});

// 🚨 EMERGENCY: Delete API key - NO AUTH  
router.delete('/:keyId', (req, res) => {
    console.log('🚨 EMERGENCY: DELETE /api/keys/:keyId called');
    const { keyId } = req.params;
    
    const originalLength = apiKeys.length;
    // ACTUALLY REMOVE THE KEY FROM THE ARRAY
    apiKeys = apiKeys.filter(key => key.id !== keyId);
    
    const deleted = originalLength > apiKeys.length;
    console.log('🚨 EMERGENCY: Deleted key:', keyId, deleted ? 'SUCCESS' : 'NOT_FOUND');
    console.log('🚨 EMERGENCY: Total keys now:', apiKeys.length);
    
    res.json({
        success: true,
        message: deleted ? 'API key deleted successfully' : 'Key not found but operation completed',
        deleted: deleted,
        remaining: apiKeys.length
    });
});

// Simple test endpoint
router.get('/debug/test-data', (req, res) => {
    console.log('🔍 DEBUG: Test data endpoint hit - SIMPLE VERSION');
    
    const mockKeys = [
        {
            id: 'test_key_1',
            name: 'Test API Key 1',
            key: 'ak_live_123456789abcdef123456789abcdef123456789abcdef123456789abcdef12',
            permissions: ['authorize', 'confirm', 'refund'],
            createdAt: new Date(),
            lastUsed: null,
            usageCount: 0,
            isActive: true
        }
    ];
    
    res.json({
        success: true,
        keys: mockKeys,
        total: mockKeys.length,
        debug: true
    });
});

console.log('🚨 ULTRA-SIMPLE API key routes loaded - NO COMPLEX DEPENDENCIES');
module.exports = router; 