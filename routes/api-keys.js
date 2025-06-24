const express = require('express');
const router = express.Router();

console.log('🚨 ULTRA-SIMPLE API KEY ROUTES LOADING...');

// 🚨 EMERGENCY: In-memory key storage that actually changes
let emergencyKeys = [
    {
        id: 'emergency_key_1',
        name: 'Emergency Test Key 1',
        key: 'ak_live_emergency123456789abcdef123456789abcdef123456789abcdef',
        permissions: ['authorize', 'confirm', 'refund'],
        createdAt: new Date().toISOString(),
        lastUsed: null,
        usageCount: 0,
        isActive: true
    },
    {
        id: 'emergency_key_2',
        name: 'Emergency Test Key 2', 
        key: 'ak_live_emergency987654321fedcba987654321fedcba987654321fedcba',
        permissions: ['authorize', 'confirm'],
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        lastUsed: new Date(Date.now() - 3600000).toISOString(),
        usageCount: 42,
        isActive: true
    }
];

console.log('🚨 EMERGENCY: Initialized with', emergencyKeys.length, 'keys');

// Helper function to mask API keys - SIMPLE VERSION
function maskApiKey(key) {
    if (!key || key.length <= 8) return key;
    return key.substring(0, 8) + '•'.repeat(key.length - 12) + key.substring(key.length - 4);
}

// 🚨 EMERGENCY: Get all API keys - NO AUTH, NO IMPORTS
router.get('/', (req, res) => {
    console.log('🚨 EMERGENCY: GET /api/keys called - DYNAMIC VERSION');
    
    try {
        console.log('🚨 EMERGENCY: Returning', emergencyKeys.length, 'dynamic keys');
        
        res.json({
            success: true,
            keys: emergencyKeys,
            total: emergencyKeys.length,
            emergency: true,
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
            id: 'emergency_' + Date.now(),
            name: name || 'Emergency Key',
            key: keyPrefix + 'emergency' + Date.now() + Math.random().toString(36).substring(2),
            permissions: ['authorize', 'confirm', 'refund'],
            createdAt: new Date().toISOString(),
            lastUsed: null,
            usageCount: 0,
            isActive: true
        };
        
        // ACTUALLY ADD THE KEY TO THE ARRAY
        emergencyKeys.push(newKey);
        console.log('🚨 EMERGENCY: Created and added key:', newKey.id);
        console.log('🚨 EMERGENCY: Total keys now:', emergencyKeys.length);
        
        res.status(201).json({
            success: true,
            apiKey: newKey,
            message: 'Emergency API key created successfully',
            emergency: true,
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
    const keyIndex = emergencyKeys.findIndex(key => key.id === keyId);
    
    if (keyIndex === -1) {
        console.log('🚨 EMERGENCY: Key not found for rotation:', keyId);
        return res.status(404).json({
            success: false,
            message: 'API key not found'
        });
    }
    
    const oldKey = emergencyKeys[keyIndex];
    const newKey = {
        ...oldKey,
        key: 'ak_live_rotated' + Date.now() + Math.random().toString(36).substring(2),
        name: oldKey.name + ' (Rotated)',
        usageCount: 0,
        lastUsed: null
    };
    
    // ACTUALLY UPDATE THE KEY IN THE ARRAY
    emergencyKeys[keyIndex] = newKey;
    
    console.log('🚨 EMERGENCY: Rotated key:', newKey.id);
    console.log('🚨 EMERGENCY: New key value:', newKey.key.substring(0, 20) + '...');
    
    res.json({
        success: true,
        apiKey: newKey,
        message: 'Emergency API key rotated successfully'
    });
});

// 🚨 EMERGENCY: Delete API key - NO AUTH  
router.delete('/:keyId', (req, res) => {
    console.log('🚨 EMERGENCY: DELETE /api/keys/:keyId called');
    const { keyId } = req.params;
    
    const originalLength = emergencyKeys.length;
    // ACTUALLY REMOVE THE KEY FROM THE ARRAY
    emergencyKeys = emergencyKeys.filter(key => key.id !== keyId);
    
    const deleted = originalLength > emergencyKeys.length;
    console.log('🚨 EMERGENCY: Deleted key:', keyId, deleted ? 'SUCCESS' : 'NOT_FOUND');
    console.log('🚨 EMERGENCY: Total keys now:', emergencyKeys.length);
    
    res.json({
        success: true,
        message: deleted ? 'Emergency API key deleted successfully' : 'Key not found but operation completed',
        deleted: deleted,
        remaining: emergencyKeys.length
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