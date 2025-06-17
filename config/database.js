// Database Configuration - Aslan v1.0 Production
// Enterprise-grade multi-tenant architecture

// Database configuration switcher
// Uses in-memory database for development, PostgreSQL for production

const isDevelopment = process.env.NODE_ENV !== 'production';
const hasPostgreSQLUrl = process.env.DATABASE_URL && (
    process.env.DATABASE_URL.startsWith('postgresql://') || 
    process.env.DATABASE_URL.startsWith('postgres://')
);

console.log('🔍 Database environment detection:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`   isDevelopment: ${isDevelopment}`);
console.log(`   DATABASE_URL set: ${!!process.env.DATABASE_URL}`);
console.log(`   hasPostgreSQLUrl: ${hasPostgreSQLUrl}`);

// Force PostgreSQL if we have a PostgreSQL URL (Railway fix)
const usePostgreSQL = !isDevelopment || hasPostgreSQLUrl;

// Choose database based on environment and URL presence
const database = usePostgreSQL
    ? require('../database-sync-wrapper') // Sync wrapper for PostgreSQL
    : require('../database');             // In-memory database

console.log(`🔗 Using ${usePostgreSQL ? 'PostgreSQL' : 'in-memory'} database`);

// Export unified interface
module.exports = database; 

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// High-performance in-memory database with optimized lookups
class Database {
    constructor() {
        this.users = new Map();
        this.sessions = new Map(); 
        this.apiKeys = new Map();
        this.tenants = new Map();
        this.transactions = new Map();
        this.organizations = new Map();
        
        // ⚡ PERFORMANCE OPTIMIZATION: O(1) API key lookup cache
        this.apiKeyCache = new Map(); // key -> keyData for instant lookup
        this.tenantCache = new Map();  // tenantId -> tenant for instant access
        this.userCache = new Map();    // userId -> user for instant access
        
        // Performance monitoring
        this.performanceMetrics = {
            apiKeyLookups: 0,
            cacheHits: 0,
            averageLatency: 0
        };
        
        console.log('🚀 High-performance database initialized with O(1) lookup caches');
    }

    // ⚡ ULTRA-FAST API Key Validation - O(1) lookup time
    async validateApiKey(apiKey) {
        const startTime = Date.now();
        this.performanceMetrics.apiKeyLookups++;
        
        try {
            // STEP 1: O(1) cache lookup first
            let keyData = this.apiKeyCache.get(apiKey);
            
            if (keyData && keyData.isActive) {
                this.performanceMetrics.cacheHits++;
                
                // Fast update of usage stats (non-blocking)
                setImmediate(() => {
                    keyData.lastUsed = new Date();
                    keyData.usageCount++;
                    this.apiKeys.set(keyData.id, keyData);
                });
                
                // Get cached user and tenant (O(1))
                const user = this.userCache.get(keyData.userId);
                const tenant = this.tenantCache.get(keyData.tenantId);
                
                const latency = Date.now() - startTime;
                this.updateAverageLatency(latency);
                
                return {
                    keyId: keyData.id,
                    userId: keyData.userId,
                    tenantId: keyData.tenantId,
                    user: this.sanitizeUser(user),
                    tenant: tenant,
                    permissions: keyData.permissions,
                    cached: true,
                    latency: latency
                };
            }
            
            // STEP 2: If not in cache, rebuild cache (this should be rare)
            console.log('🔄 Cache miss - rebuilding API key cache');
            await this.rebuildApiKeyCache();
            
            // STEP 3: Try cache again after rebuild
            keyData = this.apiKeyCache.get(apiKey);
            if (keyData && keyData.isActive) {
                const user = this.userCache.get(keyData.userId);
                const tenant = this.tenantCache.get(keyData.tenantId);
                
                const latency = Date.now() - startTime;
                this.updateAverageLatency(latency);
                
                return {
                    keyId: keyData.id,
                    userId: keyData.userId,
                    tenantId: keyData.tenantId,
                    user: this.sanitizeUser(user),
                    tenant: tenant,
                    permissions: keyData.permissions,
                    cached: false,
                    latency: latency
                };
            }
            
            const latency = Date.now() - startTime;
            this.updateAverageLatency(latency);
            return null;
            
        } catch (error) {
            console.error('❌ API key validation error:', error);
            return null;
        }
    }
    
    // ⚡ Rebuild all performance caches
    async rebuildApiKeyCache() {
        console.log('🔧 Rebuilding performance caches...');
        
        // Clear existing caches
        this.apiKeyCache.clear();
        this.userCache.clear();
        this.tenantCache.clear();
        
        // Rebuild API key cache with O(1) lookup
        for (const [keyId, keyData] of this.apiKeys) {
            if (keyData.isActive) {
                this.apiKeyCache.set(keyData.key, keyData);
            }
        }
        
        // Rebuild user cache
        for (const [userId, userData] of this.users) {
            this.userCache.set(userId, userData);
        }
        
        // Rebuild tenant cache  
        for (const [tenantId, tenantData] of this.tenants) {
            this.tenantCache.set(tenantId, tenantData);
        }
        
        console.log(`✅ Caches rebuilt: ${this.apiKeyCache.size} API keys, ${this.userCache.size} users, ${this.tenantCache.size} tenants`);
    }
    
    // Performance metrics tracking
    updateAverageLatency(latency) {
        const count = this.performanceMetrics.apiKeyLookups;
        const currentAvg = this.performanceMetrics.averageLatency;
        this.performanceMetrics.averageLatency = ((currentAvg * (count - 1)) + latency) / count;
    }
    
    getPerformanceMetrics() {
        const cacheHitRate = (this.performanceMetrics.cacheHits / this.performanceMetrics.apiKeyLookups * 100).toFixed(1);
        return {
            ...this.performanceMetrics,
            cacheHitRate: `${cacheHitRate}%`,
            averageLatency: `${this.performanceMetrics.averageLatency.toFixed(1)}ms`
        };
    }
} 