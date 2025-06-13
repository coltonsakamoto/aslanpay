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
    transactions: new Map()    // All payment transactions
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
    async createApiKey(userId, tenantId, name) {
        const user = database.users.get(userId);
        if (!user || user.tenantId !== tenantId) {
            throw new Error('User not found in tenant');
        }

        const keyId = uuidv4();
        const prefix = 'ak_live_';
        const secret = crypto.randomBytes(32).toString('hex');
        const apiKey = `${prefix}${secret}`;
        
        const keyData = {
            id: keyId,
            userId,
            tenantId,  // CRITICAL: API keys are tenant-scoped
            name,
            key: apiKey,
            prefix,
            secret,
            lastUsed: null,
            usageCount: 0,
            createdAt: new Date(),
            isActive: true,
            permissions: ['authorize', 'confirm', 'refund'],
        };

        database.apiKeys.set(keyId, keyData);
        
        return {
            id: keyId,
            name,
            key: apiKey,
            tenantId,
            createdAt: keyData.createdAt,
            lastUsed: keyData.lastUsed,
            usageCount: keyData.usageCount,
            isActive: keyData.isActive,
            permissions: keyData.permissions
        };
    }

    async validateApiKey(apiKey) {
        for (const keyData of database.apiKeys.values()) {
            if (keyData.key === apiKey && keyData.isActive) {
                // Update usage statistics
                keyData.lastUsed = new Date();
                keyData.usageCount++;
                database.apiKeys.set(keyData.id, keyData);
                
                const user = database.users.get(keyData.userId);
                const tenant = database.tenants.get(keyData.tenantId);
                
                return {
                    keyId: keyData.id,
                    userId: keyData.userId,
                    tenantId: keyData.tenantId,
                    user: this.sanitizeUser(user),
                    tenant: tenant,
                    permissions: keyData.permissions
                };
            }
        }
        return null;
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
        const { amount, description, tenantId, userId, agentId, status = 'pending' } = transactionData;
        
        const transactionId = uuidv4();
        const transaction = {
            id: transactionId,
            tenantId,  // CRITICAL: Transactions are tenant-scoped
            userId,
            agentId,
            amount,
            description,
            status,
            createdAt: new Date(),
            metadata: transactionData.metadata || {}
        };

        database.transactions.set(transactionId, transaction);
        
        // Update tenant usage
        if (status === 'completed') {
            await this.updateTenantUsage(tenantId, amount);
        }
        
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
            },
            usage: {
                dailySpent: 0,
                monthlySpent: 0,
                apiCalls: 0,
                lastReset: new Date()
            },
            stripeAccountId: null,
            webhookUrls: []
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

        // Create default API key
        const apiKey = await this.createApiKey(user.id, tenantId, 'Default API Key');

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
}

module.exports = new Database(); 