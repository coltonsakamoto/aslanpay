const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Multi-tenant database with organization isolation
const database = {
    tenants: new Map(),        // Organizations/workspaces
    users: new Map(),          // Users belong to tenants
    apiKeys: new Map(),        // API keys scoped to tenants
    sessions: new Map(),
    passwordResets: new Map(),
    emailVerifications: new Map(),
    transactions: new Map(),   // All payment transactions
    
    // ⚡ PERFORMANCE OPTIMIZATION: O(1) lookup caches
    apiKeyCache: new Map(),    // key -> keyData for instant lookup (ELIMINATES O(n) SCAN!)
    userCache: new Map(),      // userId -> user for instant access
    tenantCache: new Map(),    // tenantId -> tenant for instant access
    
    // Performance monitoring 
    performanceMetrics: {
        apiKeyLookups: 0,
        cacheHits: 0,
        totalLatency: 0,
        avgLatency: 0
    }
};

class Database {
    // Tenant Management (Organizations)
    async createTenant(tenantData) {
        const { name, domain, plan = 'sandbox', ownerId } = tenantData;
        
        const tenantId = uuidv4();
        const tenant = {
            id: tenantId,
            name,
            domain,
            plan,
            ownerId,
            createdAt: new Date(),
            settings: {
                dailyLimit: plan === 'sandbox' ? 10000 : 1000000,  // $100 vs $10k
                transactionLimit: plan === 'sandbox' ? 5000 : 100000, // $50 vs $1k
                apiCallLimit: plan === 'sandbox' ? 1000 : 100000,
            },
            usage: {
                dailySpent: 0,
                monthlySpent: 0,
                apiCalls: 0,
                lastReset: new Date()
            },
            stripeAccountId: null,  // For Stripe Connect (future)
            webhookUrls: []
        };

        database.tenants.set(tenantId, tenant);
        
        // Create default API key for tenant
        await this.createApiKey(ownerId, tenantId, 'Default Key');
        
        return tenant;
    }

    getTenant(tenantId) {
        return database.tenants.get(tenantId);
    }

    async updateTenantUsage(tenantId, amount) {
        const tenant = database.tenants.get(tenantId);
        if (!tenant) throw new Error('Tenant not found');

        const today = new Date().toDateString();
        const lastReset = tenant.usage.lastReset.toDateString();
        
        // Reset daily usage if new day
        if (today !== lastReset) {
            tenant.usage.dailySpent = 0;
            tenant.usage.lastReset = new Date();
        }
        
        tenant.usage.dailySpent += amount;
        tenant.usage.monthlySpent += amount;
        
        database.tenants.set(tenantId, tenant);
        return tenant;
    }

    // User Management (Multi-tenant)
    async createUser(userData) {
        const { email, password, name, provider = 'email', googleId, githubId, tenantId } = userData;
        
        // Check if user already exists in this tenant
        const existingUser = this.getUserByEmail(email, tenantId);
        if (existingUser) {
            throw new Error('User already exists in this organization');
        }

        const userId = uuidv4();
        const hashedPassword = provider === 'email' ? await bcrypt.hash(password, 12) : null;
        
        const user = {
            id: userId,
            tenantId,  // CRITICAL: Every user belongs to a tenant
            email,
            name,
            password: hashedPassword,
            provider,
            googleId: googleId || null,
            githubId: githubId || null,
            emailVerified: provider !== 'email',
            role: 'member', // owner, admin, member, viewer
            createdAt: new Date(),
            updatedAt: new Date(),
            subscription: {
                plan: 'sandbox',
                status: 'active',
                stripeCustomerId: null,
                trialEnd: null
            }
        };

        database.users.set(userId, user);
        
        // If this is the first user and no tenant exists, create one
        if (!tenantId && !this.getTenant(tenantId)) {
            const tenant = await this.createTenant({
                name: `${name}'s Organization`,
                domain: email.split('@')[1],
                ownerId: userId
            });
            user.tenantId = tenant.id;
            user.role = 'owner';
            database.users.set(userId, user);
        }
        
        return this.sanitizeUser(user);
    }

    getUserByEmail(email, tenantId = null) {
        for (const user of database.users.values()) {
            if (user.email === email && (!tenantId || user.tenantId === tenantId)) {
                return this.sanitizeUser(user);
            }
        }
        return null;
    }

    getUserById(userId) {
        const user = database.users.get(userId);
        return user ? this.sanitizeUser(user) : null;
    }

    // Get users in a tenant
    getUsersByTenant(tenantId) {
        const users = [];
        for (const user of database.users.values()) {
            if (user.tenantId === tenantId) {
                users.push(this.sanitizeUser(user));
            }
        }
        return users;
    }

    async verifyPassword(email, password, tenantId = null) {
        for (const user of database.users.values()) {
            if (user.email === email && user.password && (!tenantId || user.tenantId === tenantId)) {
                const isValid = await bcrypt.compare(password, user.password);
                if (isValid) {
                    return this.sanitizeUser(user);
                }
            }
        }
        return null;
    }

    sanitizeUser(user) {
        if (!user) return null;
        const { password, ...sanitized } = user;
        return sanitized;
    }

    // API Key Management (Tenant-scoped)
    async createApiKey(userId, tenantId, name, keyType = 'sandbox') {
        const user = database.users.get(userId);
        const tenant = database.tenants.get(tenantId);
        
        if (!user || user.tenantId !== tenantId) {
            throw new Error('User not found in tenant');
        }

        // FRAUD PROTECTION: Check if live key is allowed
        if (keyType === 'live') {
            if (!tenant.verification.emailVerified) {
                throw new Error('Email verification required for live API keys');
            }
            
            // For high-risk accounts, require manual review
            if (tenant.settings.manualReviewRequired) {
                throw new Error('Account requires manual review before live key issuance');
            }
            
            // Check if business verification needed (for high limits)
            if (tenant.settings.dailyLimit > 100000 && !tenant.verification.businessVerified) { // >$1000/day
                throw new Error('Business verification required for high-limit live keys');
            }
        }

        const keyId = uuidv4();
        const prefix = keyType === 'live' ? 'ak_live_' : 'ak_test_';
        const secret = crypto.randomBytes(32).toString('hex');
        const apiKey = `${prefix}${secret}`;
        
        const keyData = {
            id: keyId,
            userId,
            tenantId,
            name,
            key: apiKey,
            prefix,
            secret,
            keyType, // 'sandbox' or 'live'
            lastUsed: null,
            usageCount: 0,
            createdAt: new Date(),
            isActive: true,
            permissions: keyType === 'live' ? 
                ['authorize', 'confirm', 'refund', 'webhooks'] : 
                ['authorize'], // Sandbox has limited permissions
            // FRAUD PROTECTION
            dailyUsageCount: 0,
            suspiciousActivityFlags: [],
            riskScore: 0
        };

        database.apiKeys.set(keyId, keyData);
        
        // ⚡ PERFORMANCE: Add to cache immediately for O(1) lookup
        database.apiKeyCache.set(apiKey, keyData);
        
        return {
            id: keyId,
            name,
            key: apiKey,
            keyType,
            tenantId,
            createdAt: keyData.createdAt,
            lastUsed: keyData.lastUsed,
            usageCount: keyData.usageCount,
            isActive: keyData.isActive,
            permissions: keyData.permissions
        };
    }

    // ⚡ Performance cache management methods
    rebuildPerformanceCache() {
        console.log('🔧 Rebuilding high-performance caches...');
        
        // Clear existing caches
        database.apiKeyCache.clear();
        database.userCache.clear();
        database.tenantCache.clear();
        
        // Rebuild API key cache with O(1) lookup
        for (const [keyId, keyData] of database.apiKeys) {
            if (keyData.isActive) {
                database.apiKeyCache.set(keyData.key, keyData);
            }
        }
        
        // Rebuild user cache
        for (const [userId, userData] of database.users) {
            database.userCache.set(userId, userData);
        }
        
        // Rebuild tenant cache  
        for (const [tenantId, tenantData] of database.tenants) {
            database.tenantCache.set(tenantId, tenantData);
        }
        
        console.log(`✅ Performance caches rebuilt: ${database.apiKeyCache.size} API keys, ${database.userCache.size} users, ${database.tenantCache.size} tenants`);
    }
    
    updatePerformanceMetrics(latency) {
        const metrics = database.performanceMetrics;
        metrics.totalLatency += latency;
        metrics.avgLatency = metrics.totalLatency / metrics.apiKeyLookups;
        
        // Log performance improvements every 100 requests
        if (metrics.apiKeyLookups % 100 === 0) {
            const cacheHitRate = (metrics.cacheHits / metrics.apiKeyLookups * 100).toFixed(1);
            console.log(`📊 Performance: ${metrics.avgLatency.toFixed(1)}ms avg latency, ${cacheHitRate}% cache hit rate`);
        }
    }
    
    getPerformanceStats() {
        const metrics = database.performanceMetrics;
        const cacheHitRate = metrics.apiKeyLookups > 0 ? (metrics.cacheHits / metrics.apiKeyLookups * 100) : 0;
        
        return {
            apiKeyLookups: metrics.apiKeyLookups,
            cacheHits: metrics.cacheHits,
            cacheHitRate: `${cacheHitRate.toFixed(1)}%`,
            averageLatency: `${metrics.avgLatency.toFixed(1)}ms`,
            cacheSize: {
                apiKeys: database.apiKeyCache.size,
                users: database.userCache.size,
                tenants: database.tenantCache.size
            }
        };
    }

    // ⚡ ULTRA-FAST API Key Validation - O(1) lookup time (WAS O(n) DISASTER!)
    async validateApiKey(apiKey) {
        const startTime = Date.now();
        database.performanceMetrics.apiKeyLookups++;
        
        try {
            // STEP 1: O(1) cache lookup first (INSTANT!)
            let keyData = database.apiKeyCache.get(apiKey);
            
            if (keyData && keyData.isActive) {
                database.performanceMetrics.cacheHits++;
                
                // Fast update of usage stats (non-blocking for performance)
                setImmediate(() => {
                    keyData.lastUsed = new Date();
                    keyData.usageCount++;
                    database.apiKeys.set(keyData.id, keyData);
                });
                
                // Get cached user and tenant (O(1) - also instant!)
                const user = database.userCache.get(keyData.userId) || database.users.get(keyData.userId);
                const tenant = database.tenantCache.get(keyData.tenantId) || database.tenants.get(keyData.tenantId);
                
                // Cache user and tenant for next time if not already cached
                if (user && !database.userCache.has(keyData.userId)) {
                    database.userCache.set(keyData.userId, user);
                }
                if (tenant && !database.tenantCache.has(keyData.tenantId)) {
                    database.tenantCache.set(keyData.tenantId, tenant);
                }
                
                const latency = Date.now() - startTime;
                this.updatePerformanceMetrics(latency);
                
                return {
                    keyId: keyData.id,
                    userId: keyData.userId,
                    tenantId: keyData.tenantId,
                    user: this.sanitizeUser(user),
                    tenant: tenant,
                    permissions: keyData.permissions,
                    // Performance debug info (remove in production)
                    __performance: {
                        latency: `${latency}ms`,
                        cached: true,
                        cacheHitRate: `${(database.performanceMetrics.cacheHits / database.performanceMetrics.apiKeyLookups * 100).toFixed(1)}%`
                    }
                };
            }
            
            // STEP 2: Cache miss - rebuild cache (should be rare)
            console.log('🔄 Cache miss - rebuilding API key performance cache');
            this.rebuildPerformanceCache();
            
            // STEP 3: Try cache again after rebuild
            keyData = database.apiKeyCache.get(apiKey);
            if (keyData && keyData.isActive) {
                const user = database.userCache.get(keyData.userId) || database.users.get(keyData.userId);
                const tenant = database.tenantCache.get(keyData.tenantId) || database.tenants.get(keyData.tenantId);
                
                const latency = Date.now() - startTime;
                this.updatePerformanceMetrics(latency);
                
                return {
                    keyId: keyData.id,
                    userId: keyData.userId,
                    tenantId: keyData.tenantId,
                    user: this.sanitizeUser(user),
                    tenant: tenant,
                    permissions: keyData.permissions,
                    __performance: {
                        latency: `${latency}ms`,
                        cached: false,
                        rebuilt: true
                    }
                };
            }
            
            const latency = Date.now() - startTime;
            this.updatePerformanceMetrics(latency);
            return null;
            
        } catch (error) {
            console.error('❌ High-performance API key validation error:', error);
            return null;
        }
    }

    getApiKeysByTenant(tenantId) {
        const keys = [];
        for (const keyData of database.apiKeys.values()) {
            if (keyData.tenantId === tenantId && keyData.isActive) {
                keys.push({
                    id: keyData.id,
                    name: keyData.name,
                    key: keyData.key,
                    createdAt: keyData.createdAt,
                    lastUsed: keyData.lastUsed,
                    usageCount: keyData.usageCount,
                    permissions: keyData.permissions
                });
            }
        }
        return keys;
    }

    // Transaction Management
    async createTransaction(transactionData) {
        const { amount, description, tenantId, userId, agentId, status = 'pending', apiKeyId } = transactionData;
        
        const tenant = database.tenants.get(tenantId);
        if (!tenant) throw new Error('Tenant not found');

        // FRAUD PROTECTION: Velocity checks
        const today = new Date().toDateString();
        const lastReset = tenant.usage.lastReset.toDateString();
        
        // Reset daily counters if new day
        if (today !== lastReset) {
            tenant.usage.dailySpent = 0;
            tenant.usage.dailyAuthCount = 0;
            tenant.usage.lastReset = new Date();
        }

        // Check velocity cap for new accounts
        if (tenant.settings.riskLevel === 'new' && tenant.usage.dailyAuthCount >= tenant.settings.velocityCap) {
            throw new Error('Daily authorization limit exceeded for new accounts. Please verify your email to increase limits.');
        }

        // FRAUD DETECTION: Flag suspicious patterns
        const suspiciousFlags = [];
        
        // High frequency from single IP (would need request IP)
        if (tenant.usage.dailyAuthCount > 50) {
            suspiciousFlags.push('high_frequency');
        }
        
        // Round amounts (possible testing)
        if (amount % 1000 === 0 && amount >= 10000) {
            suspiciousFlags.push('round_amounts');
        }
        
        // Very high amounts for new accounts
        if (tenant.settings.riskLevel === 'new' && amount > 50000) { // >$500
            suspiciousFlags.push('high_amount_new_account');
        }

        const transactionId = uuidv4();
        const transaction = {
            id: transactionId,
            tenantId,
            userId,
            agentId,
            amount,
            description,
            status,
            createdAt: new Date(),
            metadata: {
                ...transactionData.metadata,
                apiKeyId,
                suspiciousFlags,
                riskScore: suspiciousFlags.length
            }
        };

        database.transactions.set(transactionId, transaction);
        
        // Update usage counters
        if (status === 'completed' || status === 'authorized') {
            tenant.usage.dailySpent += amount;
            tenant.usage.dailyAuthCount += 1;
            
            // Store suspicious activity
            if (suspiciousFlags.length > 0) {
                tenant.usage.suspiciousActivity.push({
                    transactionId,
                    flags: suspiciousFlags,
                    timestamp: new Date(),
                    amount
                });
            }
        }
        
        await this.updateTenantUsage(tenantId, amount);
        
        return transaction;
    }

    getTransactionsByTenant(tenantId, filters = {}) {
        const transactions = [];
        for (const transaction of database.transactions.values()) {
            if (transaction.tenantId === tenantId) {
                // Apply filters
                if (filters.userId && transaction.userId !== filters.userId) continue;
                if (filters.status && transaction.status !== filters.status) continue;
                if (filters.from && transaction.createdAt < new Date(filters.from)) continue;
                if (filters.to && transaction.createdAt > new Date(filters.to)) continue;
                
                transactions.push(transaction);
            }
        }
        return transactions.sort((a, b) => b.createdAt - a.createdAt);
    }

    // Public Signup for SaaS
    async createTenantWithOwner(signupData) {
        const { email, password, name, organizationName } = signupData;
        
        // Check if user already exists globally
        const existingUser = this.getUserByEmail(email);
        if (existingUser) {
            throw new Error('User already exists');
        }

        // Create tenant first
        const tenantId = uuidv4();
        const tenant = {
            id: tenantId,
            name: organizationName || `${name}'s Organization`,
            domain: email.split('@')[1],
            plan: 'sandbox',
            ownerId: null, // Will be set after user creation
            createdAt: new Date(),
            settings: {
                dailyLimit: 10000,     // $100 sandbox limit
                transactionLimit: 5000, // $50 per transaction
                apiCallLimit: 1000,
                // FRAUD PROTECTION SETTINGS
                velocityCap: 100,      // Max 100 auth/day for new accounts
                requireEmailVerification: true, // Must verify email for live keys
                riskLevel: 'new',      // new, verified, trusted
                manualReviewRequired: false
            },
            usage: {
                dailySpent: 0,
                monthlySpent: 0,
                apiCalls: 0,
                lastReset: new Date(),
                // FRAUD TRACKING
                dailyAuthCount: 0,
                suspiciousActivity: [],
                lastRiskAssessment: new Date()
            },
            stripeAccountId: null,
            webhookUrls: [],
            // VERIFICATION STATUS
            verification: {
                emailVerified: false,
                identityVerified: false,
                businessVerified: false,
                verifiedAt: null,
                verificationMethod: null
            }
        };

        database.tenants.set(tenantId, tenant);

        // Create owner user
        const user = await this.createUser({
            email,
            password,
            name,
            tenantId,
            provider: 'email'
        });

        // Update tenant with owner
        tenant.ownerId = user.id;
        database.tenants.set(tenantId, tenant);

        // Create SANDBOX API key only (no live keys until verified)
        const apiKey = await this.createApiKey(user.id, tenantId, 'Sandbox API Key', 'sandbox');

        return {
            user,
            tenant,
            apiKey
        };
    }

    // Email Verification (existing code)
    createEmailVerification(userId, email) {
        const token = crypto.randomBytes(32).toString('hex');
        const verification = {
            userId,
            email,
            token,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        };
        
        database.emailVerifications.set(token, verification);
        return token;
    }

    verifyEmail(token) {
        const verification = database.emailVerifications.get(token);
        if (!verification || verification.expiresAt < new Date()) {
            return false;
        }

        const user = database.users.get(verification.userId);
        if (user) {
            user.emailVerified = true;
            user.updatedAt = new Date();
            database.users.set(verification.userId, user);
        }

        database.emailVerifications.delete(token);
        return true;
    }

    // Password Reset (existing code)
    createPasswordReset(email) {
        const user = this.getUserByEmail(email);
        if (!user) {
            throw new Error('User not found');
        }

        const token = crypto.randomBytes(32).toString('hex');
        const reset = {
            userId: user.id,
            email,
            token,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000)
        };
        
        database.passwordResets.set(token, reset);
        return token;
    }

    async resetPassword(token, newPassword) {
        const reset = database.passwordResets.get(token);
        if (!reset || reset.expiresAt < new Date()) {
            throw new Error('Invalid or expired reset token');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        const user = database.users.get(reset.userId);
        
        if (user) {
            user.password = hashedPassword;
            user.updatedAt = new Date();
            database.users.set(reset.userId, user);
        }

        database.passwordResets.delete(token);
        return true;
    }

    // Session Management (existing code with tenant context)
    createSession(userId) {
        const sessionId = uuidv4();
        const user = database.users.get(userId);
        
        const session = {
            id: sessionId,
            userId,
            tenantId: user?.tenantId,  // Include tenant context
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            lastActivity: new Date()
        };
        
        database.sessions.set(sessionId, session);
        return sessionId;
    }

    getSession(sessionId) {
        const session = database.sessions.get(sessionId);
        if (!session || session.expiresAt < new Date()) {
            if (session) {
                database.sessions.delete(sessionId);
            }
            return null;
        }

        session.lastActivity = new Date();
        database.sessions.set(sessionId, session);
        
        return session;
    }

    revokeSession(sessionId) {
        return database.sessions.delete(sessionId);
    }

    // Health check
    async healthCheck() {
        try {
            const startTime = Date.now();
            const tenantCount = database.tenants.size;
            const userCount = database.users.size;
            const transactionCount = database.transactions.size;
            const responseTime = Date.now() - startTime;
            
            return { 
                status: 'connected', 
                responseTime: `${responseTime}ms`,
                timestamp: new Date().toISOString(),
                type: 'in-memory-multi-tenant',
                stats: {
                    tenants: tenantCount,
                    users: userCount,
                    transactions: transactionCount
                }
            };
        } catch (error) {
            console.error('Database health check failed:', error);
            return { 
                status: 'disconnected', 
                error: error.message,
                timestamp: new Date().toISOString(),
                type: 'in-memory-multi-tenant'
            };
        }
    }

    // Development helper - get all data
    getAllData() {
        return {
            tenants: Array.from(database.tenants.values()),
            users: Array.from(database.users.values()).map(u => this.sanitizeUser(u)),
            apiKeys: Array.from(database.apiKeys.values()),
            sessions: Array.from(database.sessions.values()),
            transactions: Array.from(database.transactions.values()),
            passwordResets: Array.from(database.passwordResets.values()),
            emailVerifications: Array.from(database.emailVerifications.values())
        };
    }

    // Email verification for fraud protection
    async verifyEmailForTenant(token) {
        const verification = database.emailVerifications.get(token);
        if (!verification || verification.expiresAt < new Date()) {
            return false;
        }

        const user = database.users.get(verification.userId);
        if (user) {
            user.emailVerified = true;
            user.updatedAt = new Date();
            database.users.set(verification.userId, user);
            
            // Update tenant verification status
            const tenant = database.tenants.get(user.tenantId);
            if (tenant) {
                tenant.verification.emailVerified = true;
                tenant.verification.verifiedAt = new Date();
                tenant.verification.verificationMethod = 'email';
                tenant.settings.riskLevel = 'verified'; // Upgrade from 'new'
                tenant.settings.velocityCap = 500; // Increase limit for verified accounts
                database.tenants.set(user.tenantId, tenant);
            }
        }

        database.emailVerifications.delete(token);
        return true;
    }

    // Risk assessment for accounts
    async assessAccountRisk(tenantId) {
        const tenant = database.tenants.get(tenantId);
        if (!tenant) throw new Error('Tenant not found');

        let riskScore = 0;
        const riskFactors = [];

        // Account age risk
        const accountAge = Date.now() - tenant.createdAt.getTime();
        const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);
        
        if (daysSinceCreation < 1) {
            riskScore += 3;
            riskFactors.push('very_new_account');
        } else if (daysSinceCreation < 7) {
            riskScore += 1;
            riskFactors.push('new_account');
        }

        // Email verification risk
        if (!tenant.verification.emailVerified) {
            riskScore += 2;
            riskFactors.push('unverified_email');
        }

        // Suspicious activity risk
        const recentSuspiciousActivity = tenant.usage.suspiciousActivity.filter(
            activity => Date.now() - activity.timestamp.getTime() < 24 * 60 * 60 * 1000
        );
        
        if (recentSuspiciousActivity.length > 5) {
            riskScore += 4;
            riskFactors.push('high_suspicious_activity');
        } else if (recentSuspiciousActivity.length > 2) {
            riskScore += 2;
            riskFactors.push('moderate_suspicious_activity');
        }

        // Update tenant risk assessment
        tenant.usage.lastRiskAssessment = new Date();
        
        // Auto-trigger manual review for high risk
        if (riskScore >= 5) {
            tenant.settings.manualReviewRequired = true;
            tenant.settings.riskLevel = 'high_risk';
        } else if (riskScore >= 3) {
            tenant.settings.riskLevel = 'medium_risk';
        }

        database.tenants.set(tenantId, tenant);

        return {
            riskScore,
            riskFactors,
            riskLevel: tenant.settings.riskLevel,
            manualReviewRequired: tenant.settings.manualReviewRequired
        };
    }
}

module.exports = new Database(); 