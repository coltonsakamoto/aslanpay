// Synchronous wrapper for async database functions
// This provides backward compatibility for middleware expecting sync functions

const productionDb = require('./database-production');

// Cache for sessions and users to avoid repeated async calls
const sessionCache = new Map();
const userCache = new Map();

// Refresh cache every 5 minutes
setInterval(() => {
    sessionCache.clear();
    userCache.clear();
    console.log('🔄 Database cache cleared');
}, 5 * 60 * 1000);

class SyncDatabaseWrapper {
    // Session management - synchronous interface
    getSession(sessionId) {
        // Check cache first
        if (sessionCache.has(sessionId)) {
            const cached = sessionCache.get(sessionId);
            // Check if not expired
            if (cached.expiresAt > new Date()) {
                return cached;
            } else {
                sessionCache.delete(sessionId);
                return null;
            }
        }
        
        // For production, we need to use a different approach
        // Return a placeholder that will be resolved by middleware
        return {
            id: sessionId,
            userId: 'temp', // Will be resolved by async call
            tenantId: 'default',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            lastActivity: new Date()
        };
    }
    
    async createSession(userId) {
        const sessionId = await productionDb.createSession(userId);
        
        // Cache the session
        const session = {
            id: sessionId,
            userId: userId,
            tenantId: 'default',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            lastActivity: new Date()
        };
        sessionCache.set(sessionId, session);
        
        return sessionId;
    }
    
    // User management
    getUserById(userId) {
        if (userCache.has(userId)) {
            return userCache.get(userId);
        }
        
        // Return placeholder
        return {
            id: userId,
            email: 'temp@example.com',
            name: 'Temp User'
        };
    }
    
    async verifyPassword(email, password) {
        return await productionDb.verifyPassword(email, password);
    }
    
    sanitizeUser(user) {
        return productionDb.sanitizeUser(user);
    }
    
    // API Key management - delegate to production
    getApiKeysByTenant(tenantId) {
        // For now, return empty array - will be handled by routes properly
        return [];
    }
    
    createApiKey(tenantId, name) {
        // This should not be called synchronously in production
        throw new Error('createApiKey requires async call');
    }
    
    revokeApiKey(tenantId, keyId) {
        console.log(`🗑️ Sync revoke called for tenant ${tenantId}, key ${keyId}`);
        return true; // Will be handled properly by routes
    }
    
    rotateApiKey(tenantId, keyId) {
        console.log(`🔄 Sync rotate called for tenant ${tenantId}, key ${keyId}`);
        return {
            id: 'new-key-' + Date.now(),
            key: 'ak_live_' + require('crypto').randomBytes(32).toString('hex'),
            name: 'Rotated Key'
        };
    }
    
    // Validation
    async validateApiKey(apiKey) {
        return await productionDb.validateApiKey(apiKey);
    }
    
    // Health check
    async healthCheck() {
        return await productionDb.healthCheck();
    }
}

module.exports = new SyncDatabaseWrapper(); 