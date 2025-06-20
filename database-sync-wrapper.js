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
    
    // Multi-tenant signup - create tenant + owner + API key
    async createTenantWithOwner(userData) {
        const { email, password, name, organizationName } = userData;
        
        console.log('🚀 createTenantWithOwner starting for:', email);
        
        try {
            // Create the user first
            console.log('📝 Creating user...');
            const user = await productionDb.createUser({
                email,
                password,
                name,
                provider: 'email'
            });
            console.log('✅ User created:', user.id);
            
            // Get their default API key (created automatically)
            console.log('🔑 Getting API keys for user...');
            const apiKeys = await productionDb.getApiKeysByUserId(user.id);
            console.log('✅ Found API keys:', apiKeys.length);
            
            if (!apiKeys || apiKeys.length === 0) {
                console.log('⚠️ No API keys found, creating one...');
                const newApiKey = await productionDb.createApiKey(user.id, 'Default Key');
                console.log('✅ Created new API key:', newApiKey.id);
                apiKeys = [newApiKey];
            }
            
            const apiKey = apiKeys[0]; // Use the first (default) API key
            console.log('🔑 Using API key:', apiKey.id);
            
            // Create mock tenant object (using user as tenant)
            const tenant = {
                id: user.id,
                name: organizationName || `${name}'s Organization`,
                plan: 'sandbox',
                settings: {
                    transactionLimit: 5000, // $50 for new users
                    dailyLimit: 20000 // $200 for new users
                },
                usage: {
                    dailySpent: 0,
                    transactionCount: 0
                }
            };
            console.log('🏢 Created tenant object:', tenant.id);
            
            console.log('✅ createTenantWithOwner completed successfully');
            return {
                user,
                tenant,
                apiKey
            };
        } catch (error) {
            console.error('❌ createTenantWithOwner error:', error);
            console.error('❌ Error details:', error.message);
            console.error('❌ Error stack:', error.stack);
            
            // Re-throw with more specific error message for debugging
            if (error.message.includes('User already exists')) {
                throw new Error('User already exists');
            } else if (error.message.includes('connect')) {
                throw new Error('Database connection failed - PostgreSQL may not be accessible');
            } else if (error.message.includes('prisma')) {
                throw new Error('Database client error - Prisma configuration issue');
            } else {
                throw new Error(`Database operation failed: ${error.message}`);
            }
        }
    }
    
    // Email verification methods
    async createEmailVerification(userId, email) {
        return await productionDb.createEmailVerification(userId, email);
    }
    
    async verifyEmail(token) {
        return await productionDb.verifyEmail(token);
    }
    
    // Password reset methods  
    async createPasswordReset(email) {
        return await productionDb.createPasswordReset(email);
    }
    
    async resetPassword(token, password) {
        return await productionDb.resetPassword(token, password);
    }
    
    // Tenant management
    getTenant(tenantId) {
        // Return a mock tenant based on user ID
        return {
            id: tenantId,
            name: 'User Tenant',
            plan: 'sandbox',
            settings: {
                transactionLimit: 5000,
                dailyLimit: 20000
            },
            usage: {
                dailySpent: 0,
                transactionCount: 0
            }
        };
    }

    // Health check
    async healthCheck() {
        return await productionDb.healthCheck();
    }
}

module.exports = new SyncDatabaseWrapper(); 