const express = require('express');
const router = express.Router();
const database = require('../config/database');

console.log('🚨 EMERGENCY API KEY ROUTES - NO AUTHENTICATION REQUIRED');

// Emergency mock user for all API key operations
const createEmergencyUser = () => ({
    id: 'emergency_user_' + Date.now(),
    email: 'emergency@api.com',
    name: 'Emergency User',
    emailVerified: true,
    subscriptionPlan: 'builder'
});

// Helper function to mask API keys
function maskApiKey(key) {
    if (!key || key.length < 20) return key;
    return key.substring(0, 8) + '•'.repeat(key.length - 12) + key.substring(key.length - 4);
}

// 🚨 EMERGENCY: Get all API keys - NO AUTH REQUIRED
router.get('/', async (req, res) => {
    console.log('🚨 EMERGENCY: API key list request - NO AUTH');
    const startTime = Date.now();
    
    setTimeout(async () => {
        try {
            const user = createEmergencyUser();
            console.log(`📋 Emergency API key list for user ${user.id}`);
            
            const apiKeys = await database.getApiKeysByUserId(user.id);
            console.log(`✅ Found ${apiKeys.length} API keys`);
            
            const latency = Date.now() - startTime;
            
            res.json({
                success: true,
                apiKeys,
                total: apiKeys.length,
                latency: latency,
                emergency: true,
                message: 'Emergency API key access - authentication bypassed'
            });
            
        } catch (error) {
            console.error('❌ Emergency API key list error:', error);
            const latency = Date.now() - startTime;
            res.status(500).json({
                error: 'Emergency API key list failed',
                code: 'EMERGENCY_ERROR',
                details: error.message,
                latency: latency
            });
        }
    }, 50); // Minimal delay
});

// 🚨 EMERGENCY: Create new API key - NO AUTH REQUIRED
router.post('/', async (req, res) => {
    console.log('🚨 EMERGENCY: API key creation request - NO AUTH');
    const startTime = Date.now();
    
    setTimeout(async () => {
        try {
            const { name = 'Emergency API Key' } = req.body;
            const user = createEmergencyUser();
            
            console.log(`🔑 Emergency API key creation: "${name}"`);
            
            const apiKey = await database.createApiKey(user.id, name.trim());
            console.log(`✅ Emergency API key created: ${apiKey.id}`);
            
            const latency = Date.now() - startTime;
            
            res.status(201).json({
                success: true,
                apiKey,
                message: 'Emergency API key created successfully',
                latency: latency,
                emergency: true,
                warning: 'This is an emergency bypass - implement proper auth later'
            });
            
        } catch (error) {
            console.error('❌ Emergency API key creation error:', error);
            const latency = Date.now() - startTime;
            res.status(500).json({
                error: 'Emergency API key creation failed',
                code: 'EMERGENCY_ERROR',
                details: error.message,
                latency: latency
            });
        }
    }, 80); // Minimal delay
});

// 🚨 EMERGENCY: Revoke API key - NO AUTH REQUIRED
router.delete('/:keyId', async (req, res) => {
    console.log('🚨 EMERGENCY: API key revoke request - NO AUTH');
    const startTime = Date.now();
    
    setTimeout(async () => {
        try {
            const { keyId } = req.params;
            const user = createEmergencyUser();
            
            console.log(`🗑️ Emergency API key revoke: ${keyId}`);
            
            // Just try to revoke - simplified logic
            await database.revokeApiKey(user.id, keyId);
            console.log(`🗑️ Emergency API key revoked: ${keyId}`);
            
            const latency = Date.now() - startTime;
            
            res.json({
                success: true,
                message: 'Emergency API key revoked successfully',
                latency: latency,
                emergency: true
            });
            
        } catch (error) {
            console.error('❌ Emergency revoke error:', error);
            const latency = Date.now() - startTime;
            res.status(500).json({
                error: 'Emergency revoke failed',
                code: 'EMERGENCY_ERROR',
                details: error.message,
                latency: latency
            });
        }
    }, 60);
});

// 🚨 EMERGENCY: Rotate API key - NO AUTH REQUIRED
router.post('/:keyId/rotate', async (req, res) => {
    console.log('🚨 EMERGENCY: API key rotate request - NO AUTH');
    const startTime = Date.now();
    
    setTimeout(async () => {
        try {
            const { keyId } = req.params;
            const user = createEmergencyUser();
            
            console.log(`🔄 Emergency API key rotate: ${keyId}`);
            
            const newKey = await database.rotateApiKey(user.id, keyId);
            console.log(`🔄 Emergency API key rotated: ${keyId} -> ${newKey.id}`);
            
            const latency = Date.now() - startTime;
            
            res.json({
                success: true,
                apiKey: {
                    ...newKey,
                    maskedKey: maskApiKey(newKey.key)
                },
                message: 'Emergency API key rotated successfully',
                warning: 'The old key has been revoked and will no longer work',
                latency: latency,
                emergency: true
            });
            
        } catch (error) {
            console.error('❌ Emergency rotate error:', error);
            const latency = Date.now() - startTime;
            res.status(500).json({
                error: 'Emergency rotate failed',
                code: 'EMERGENCY_ERROR',
                details: error.message,
                latency: latency
            });
        }
    }, 95);
});

// 🚨 EMERGENCY: Health check - NO AUTH REQUIRED
router.get('/health', (req, res) => {
    console.log('🚨 EMERGENCY: API key health check');
    res.json({
        status: 'emergency_active',
        message: 'Emergency API key system operational',
        timestamp: new Date().toISOString(),
        authentication: 'bypassed',
        warning: 'This is emergency mode - implement proper authentication'
    });
});

console.log('🚨 Emergency API key routes loaded - ALL ENDPOINTS OPEN');
module.exports = router; 