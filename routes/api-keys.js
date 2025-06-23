const express = require('express');
const router = express.Router();

console.log('🚨 EMERGENCY API KEY ROUTES - BYPASSING AUTH FOR TESTING');

// Helper function to mask API keys
function maskApiKey(key) {
    if (!key || key.length < 20) return key;
    return key.substring(0, 8) + '•'.repeat(key.length - 12) + key.substring(key.length - 4);
}

// 🚨 EMERGENCY: Get all API keys - NO AUTH
router.get('/', async (req, res) => {
    console.log('🚨 EMERGENCY: GET /api/keys called');
    
    // Return hardcoded API keys to test frontend
    const hardcodedKeys = [
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
    
    console.log('🚨 EMERGENCY: Returning hardcoded keys:', hardcodedKeys);
    
    res.json({
        success: true,
        keys: hardcodedKeys,
        total: hardcodedKeys.length,
        emergency: true,
        timestamp: new Date().toISOString()
    });
});

// 🚨 EMERGENCY: Create new API key - NO AUTH
router.post('/', async (req, res) => {
    console.log('🚨 EMERGENCY: POST /api/keys called');
    console.log('🚨 EMERGENCY: Request body:', req.body);
    
    const { name } = req.body;
    
    const newKey = {
        id: 'emergency_' + Date.now(),
        name: name || 'Emergency Key',
        key: 'ak_live_emergency' + Date.now() + 'abcdef123456789',
        permissions: ['authorize', 'confirm', 'refund'],
        createdAt: new Date().toISOString(),
        lastUsed: null,
        usageCount: 0,
        isActive: true
    };
    
    console.log('🚨 EMERGENCY: Created key:', newKey);
    
    res.status(201).json({
        success: true,
        apiKey: newKey,
        message: 'Emergency API key created',
        emergency: true
    });
});

// Removed complex auth endpoints for emergency testing

// Removed debug auth endpoint for emergency testing

// 🔍 DEBUG: Test API key data format - REMOVE IN PRODUCTION
router.get('/debug/test-data', async (req, res) => {
    console.log('🔍 DEBUG: Test data endpoint hit');
    
    // Create mock API key data in the exact format we expect
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
        },
        {
            id: 'test_key_2', 
            name: 'Test API Key 2',
            key: 'ak_live_987654321fedcba987654321fedcba987654321fedcba987654321fedcba98',
            permissions: ['authorize', 'confirm'],
            createdAt: new Date(Date.now() - 86400000), // 1 day ago
            lastUsed: new Date(Date.now() - 3600000), // 1 hour ago
            usageCount: 5,
            isActive: true
        }
    ];
    
    res.json({
        success: true,
        keys: mockKeys,
        total: mockKeys.length,
        debug: true,
        timestamp: new Date().toISOString()
    });
});

console.log('🚨 EMERGENCY API key routes loaded - NO AUTHENTICATION');
module.exports = router; 