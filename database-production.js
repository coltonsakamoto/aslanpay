const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class ProductionDatabase {
    constructor() {
        this.prisma = new PrismaClient({
            log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
            // ⚡ PERFORMANCE: Optimize connection pool for production
            datasources: {
                db: {
                    url: process.env.DATABASE_URL
                }
            }
        });
        
        // ⚡ ULTRA-FAST: In-memory cache for API key validation
        this.apiKeyCache = new Map();
        this.cacheTimeout = 60000; // 1 minute TTL
        this.performanceMetrics = {
            cacheHits: 0,
            cacheMisses: 0,
            totalQueries: 0,
            averageLatency: 0
        };
        
        // Clear cache every minute to ensure data freshness
        setInterval(() => {
            const oldSize = this.apiKeyCache.size;
            this.apiKeyCache.clear();
            if (oldSize > 0) {
                console.log(`🔄 API key cache cleared (${oldSize} entries)`);
            }
        }, this.cacheTimeout);
        
        // Auto-migrate on startup for Railway
        this.initializeDatabase();
        
        // Graceful shutdown
        process.on('beforeExit', async () => {
            await this.prisma.$disconnect();
        });
    }

    // Initialize database with migrations
    async initializeDatabase() {
        try {
            console.log('🔄 Checking database connection...');
            await this.prisma.$connect();
            console.log('✅ Database connected successfully');
            
            // Run migrations if needed
            if (process.env.NODE_ENV === 'production') {
                console.log('🔄 Running database migrations...');
                const { execSync } = require('child_process');
                try {
                    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
                    console.log('✅ Database migrations completed');
                } catch (error) {
                    console.warn('⚠️  Migration failed, but continuing:', error.message);
                }
            }
        } catch (error) {
            console.error('❌ Database initialization failed:', error.message);
        }
    }

    // User Management
    async createUser(userData) {
        const { email, password, name, provider = 'email', googleId, githubId } = userData;
        
        // Check if user already exists
        const existingUser = await this.prisma.user.findUnique({
            where: { email }
        });
        
        if (existingUser) {
            throw new Error('User already exists');
        }

        const hashedPassword = provider === 'email' ? await bcrypt.hash(password, 12) : null;
        
        const user = await this.prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
                provider,
                googleId: googleId || null,
                githubId: githubId || null,
                emailVerified: provider !== 'email', // OAuth users are pre-verified
                subscriptionPlan: 'sandbox',
                subscriptionStatus: 'active'
            }
        });
        
        // Create default API key
        await this.createApiKey(user.id, 'Default Key');
        
        return this.sanitizeUser(user);
    }

    async updateUser(userId, updates) {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: updates
        });
        
        return this.sanitizeUser(user);
    }

    async getUserById(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                apiKeys: {
                    where: { isActive: true },
                    select: {
                        id: true,
                        name: true,
                        key: true,
                        createdAt: true,
                        lastUsed: true,
                        usageCount: true,
                        permissions: true
                    }
                }
            }
        });
        
        return user ? this.sanitizeUser(user) : null;
    }

    async getUserByEmail(email) {
        const user = await this.prisma.user.findUnique({
            where: { email }
        });
        
        return user ? this.sanitizeUser(user) : null;
    }

    async verifyPassword(email, password) {
        const user = await this.prisma.user.findUnique({
            where: { email }
        });
        
        if (user && user.password) {
            const isValid = await bcrypt.compare(password, user.password);
            if (isValid) {
                return this.sanitizeUser(user);
            }
        }
        
        return null;
    }

    sanitizeUser(user) {
        if (!user) return null;
        const { password, ...sanitized } = user;
        return sanitized;
    }

    // API Key Management
    async createApiKey(userId, name) {
        // Check if user exists
        const user = await this.prisma.user.findUnique({
            where: { id: userId }
        });
        
        if (!user) {
            throw new Error('User not found');
        }

        const prefix = 'ak_live_';
        const secret = crypto.randomBytes(32).toString('hex');
        const apiKey = `${prefix}${secret}`;
        
        const keyData = await this.prisma.apiKey.create({
            data: {
                userId,
                name,
                key: apiKey,
                prefix,
                secret,
                permissions: 'authorize,confirm,refund'
            }
        });
        
        return {
            id: keyData.id,
            name: keyData.name,
            key: keyData.key,
            createdAt: keyData.createdAt,
            lastUsed: keyData.lastUsed,
            usageCount: keyData.usageCount,
            isActive: keyData.isActive,
            permissions: keyData.permissions ? keyData.permissions.split(',') : []
        };
    }

    async revokeApiKey(userId, keyId) {
        const keyData = await this.prisma.apiKey.findFirst({
            where: {
                id: keyId,
                userId: userId
            }
        });
        
        if (!keyData) {
            throw new Error('API key not found');
        }

        await this.prisma.apiKey.update({
            where: { id: keyId },
            data: {
                isActive: false,
                revokedAt: new Date()
            }
        });
        
        return true;
    }

    async rotateApiKey(userId, keyId) {
        const oldKey = await this.prisma.apiKey.findFirst({
            where: {
                id: keyId,
                userId: userId
            }
        });
        
        if (!oldKey) {
            throw new Error('API key not found');
        }

        // Revoke old key
        await this.revokeApiKey(userId, keyId);
        
        // Create new key with same name
        return await this.createApiKey(userId, oldKey.name);
    }

    async getApiKeysByUserId(userId) {
        const keys = await this.prisma.apiKey.findMany({
            where: {
                userId,
                isActive: true
            },
            select: {
                id: true,
                name: true,
                key: true,
                createdAt: true,
                lastUsed: true,
                usageCount: true,
                permissions: true
            }
        });
        
        return keys.map(key => ({
            ...key,
            permissions: key.permissions ? key.permissions.split(',') : []
        }));
    }

    async validateApiKey(apiKey) {
        const startTime = Date.now();
        this.performanceMetrics.totalQueries++;
        
        try {
            // ⚡ STEP 1: Check cache first (instant lookup)
            const cacheKey = `key:${apiKey}`;
            const cached = this.apiKeyCache.get(cacheKey);
            
            if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
                this.performanceMetrics.cacheHits++;
                const latency = Date.now() - startTime;
                
                return {
                    ...cached.data,
                    __performance: {
                        latency: `${latency}ms`,
                        cached: true,
                        cacheAge: `${Date.now() - cached.timestamp}ms`
                    }
                };
            }
            
            // ⚡ STEP 2: Cache miss - query database with minimal data
            this.performanceMetrics.cacheMisses++;
            const keyData = await this.prisma.apiKey.findUnique({
                where: { key: apiKey },
                select: {
                    id: true,
                    userId: true,
                    isActive: true,
                    permissions: true,
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            emailVerified: true,
                            subscriptionPlan: true,
                            subscriptionStatus: true,
                            createdAt: true
                        }
                    }
                }
            });
            
            // ⚡ INSTANT RETURN for invalid keys
            if (!keyData || !keyData.isActive) {
                return { valid: false, error: 'API key not found or inactive' };
            }

            // ⚡ CREATE TENANT OBJECT from user subscription data (this is what authorize route expects!)
            const user = keyData.user;
            const isVerified = user.emailVerified;
            const planLimits = {
                sandbox: { transaction: 10000, daily: 50000 }, // $100 transaction, $500 daily
                builder: { transaction: 100000, daily: 500000 }, // $1000 transaction, $5000 daily
                team: { transaction: 1000000, daily: 5000000 } // $10000 transaction, $50000 daily
            };
            
            const plan = user.subscriptionPlan || 'sandbox';
            const limits = planLimits[plan] || planLimits.sandbox;
            
            const mockTenant = {
                id: user.id, // Use user ID as tenant ID
                name: user.name || user.email,
                plan: plan,
                createdAt: user.createdAt,
                settings: {
                    transactionLimit: isVerified ? limits.transaction : 5000, // $50 unverified
                    dailyLimit: isVerified ? limits.daily : 20000, // $200 unverified  
                    riskLevel: isVerified ? 'trusted' : 'new',
                    velocityCap: isVerified ? 100 : 10
                },
                usage: {
                    dailySpent: 0, // TODO: Calculate from today's transactions
                    dailyAuthCount: 0 // TODO: Calculate from today's authorizations
                }
            };

            const result = {
                valid: true,
                keyId: keyData.id,
                userId: keyData.userId,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    emailVerified: user.emailVerified
                },
                tenant: mockTenant,
                permissions: keyData.permissions ? keyData.permissions.split(',') : []
            };
            
            // ⚡ STEP 3: Cache the result for future requests
            this.apiKeyCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
            
            const latency = Date.now() - startTime;
            this.updateAverageLatency(latency);
            
            return {
                ...result,
                __performance: {
                    latency: `${latency}ms`,
                    cached: false,
                    ultraOptimized: true
                }
            };
            
        } catch (error) {
            // ⚡ MINIMAL ERROR HANDLING - no logging in production
            return { valid: false, error: 'Database validation failed' };
        }
    }
    
    // ⚡ Performance tracking
    updateAverageLatency(latency) {
        const current = this.performanceMetrics.averageLatency;
        const count = this.performanceMetrics.totalQueries;
        this.performanceMetrics.averageLatency = ((current * (count - 1)) + latency) / count;
    }
    
    getPerformanceMetrics() {
        const hitRate = ((this.performanceMetrics.cacheHits / this.performanceMetrics.totalQueries) * 100).toFixed(1);
        return {
            ...this.performanceMetrics,
            cacheHitRate: `${hitRate}%`,
            averageLatency: `${this.performanceMetrics.averageLatency.toFixed(1)}ms`,
            cacheSize: this.apiKeyCache.size
        };
    }

    // Email Verification
    async createEmailVerification(userId, email) {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        await this.prisma.emailVerification.create({
            data: {
                userId,
                email,
                token,
                expiresAt
            }
        });
        
        return token;
    }

    async verifyEmail(token) {
        const verification = await this.prisma.emailVerification.findUnique({
            where: { token },
            include: { user: true }
        });
        
        if (!verification || verification.expiresAt < new Date()) {
            return false;
        }

        // Update user email verification status
        await this.prisma.user.update({
            where: { id: verification.userId },
            data: { emailVerified: true }
        });

        // Clean up verification record
        await this.prisma.emailVerification.delete({
            where: { token }
        });
        
        return true;
    }

    // Password Reset
    async createPasswordReset(email) {
        const user = await this.prisma.user.findUnique({
            where: { email }
        });
        
        if (!user) {
            throw new Error('User not found');
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        
        await this.prisma.passwordReset.create({
            data: {
                userId: user.id,
                email,
                token,
                expiresAt
            }
        });
        
        return token;
    }

    async resetPassword(token, newPassword) {
        const reset = await this.prisma.passwordReset.findUnique({
            where: { token }
        });
        
        if (!reset || reset.expiresAt < new Date()) {
            throw new Error('Invalid or expired reset token');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        
        await this.prisma.user.update({
            where: { id: reset.userId },
            data: { password: hashedPassword }
        });

        // Clean up reset record
        await this.prisma.passwordReset.delete({
            where: { token }
        });
        
        return true;
    }

    // Session Management
    async createSession(userId) {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        
        const session = await this.prisma.session.create({
            data: {
                userId,
                expiresAt
            }
        });
        
        return session.id;
    }

    async getSession(sessionId) {
        const session = await this.prisma.session.findUnique({
            where: { id: sessionId }
        });
        
        if (!session || session.expiresAt < new Date()) {
            if (session) {
                await this.prisma.session.delete({
                    where: { id: sessionId }
                });
            }
            return null;
        }

        // Update last activity
        await this.prisma.session.update({
            where: { id: sessionId },
            data: { lastActivity: new Date() }
        });
        
        return session;
    }

    async revokeSession(sessionId) {
        try {
            await this.prisma.session.delete({
                where: { id: sessionId }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    // Audit Logging
    async logAudit({ userId, apiKeyId, action, resource, metadata, ipAddress, userAgent }) {
        await this.prisma.auditLog.create({
            data: {
                userId,
                apiKeyId,
                action,
                resource,
                metadata,
                ipAddress,
                userAgent
            }
        });
    }

    // Transaction Logging
    async createTransaction({ userId, apiKeyId, agentId, type, amount, currency = 'USD', description, stripePaymentId, metadata }) {
        return await this.prisma.transaction.create({
            data: {
                userId,
                apiKeyId,
                agentId,
                type,
                amount,
                currency,
                description,
                status: 'pending',
                stripePaymentId,
                metadata
            }
        });
    }

    async updateTransaction(transactionId, updates) {
        return await this.prisma.transaction.update({
            where: { id: transactionId },
            data: updates
        });
    }

    // Development helper - get all data (remove in production)
    async getAllData() {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('getAllData is not available in production');
        }
        
        const [users, apiKeys, sessions, passwordResets, emailVerifications] = await Promise.all([
            this.prisma.user.findMany(),
            this.prisma.apiKey.findMany(),
            this.prisma.session.findMany(),
            this.prisma.passwordReset.findMany(),
            this.prisma.emailVerification.findMany()
        ]);
        
        return {
            users: users.map(u => this.sanitizeUser(u)),
            apiKeys,
            sessions,
            passwordResets,
            emailVerifications
        };
    }

    // Subscription Management
    async updateUserSubscription(userId, subscriptionData) {
        const { plan, status, stripeCustomerId, subscriptionId } = subscriptionData;
        
        const updateData = {
            subscriptionPlan: plan,
            subscriptionStatus: status,
            updatedAt: new Date()
        };
        
        if (stripeCustomerId) {
            updateData.stripeCustomerId = stripeCustomerId;
        }
        
        if (subscriptionId) {
            updateData.stripeSubscriptionId = subscriptionId;
        }
        
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: updateData
        });
        
        // Log subscription change
        await this.logAudit({
            userId,
            action: 'subscription_updated',
            resource: 'subscription',
            metadata: JSON.stringify({ plan, status, subscriptionId })
        });
        
        console.log(`✅ Updated subscription for user ${userId}: ${plan} (${status})`);
        
        return this.sanitizeUser(user);
    }

    async getUserSubscription(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                subscriptionPlan: true,
                subscriptionStatus: true,
                stripeCustomerId: true,
                stripeSubscriptionId: true,
                createdAt: true,
                updatedAt: true
            }
        });
        
        return user;
    }

    async cancelSubscription(userId) {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: {
                subscriptionStatus: 'canceled',
                updatedAt: new Date()
            }
        });
        
        await this.logAudit({
            userId,
            action: 'subscription_canceled',
            resource: 'subscription',
            metadata: JSON.stringify({ plan: user.subscriptionPlan })
        });
        
        return this.sanitizeUser(user);
    }

    // Billing and Usage Tracking
    async trackUsage(userId, apiKeyId, type, count = 1) {
        const today = new Date().toISOString().split('T')[0];
        
        // Update or create usage record for today
        await this.prisma.usage.upsert({
            where: {
                userId_date: {
                    userId,
                    date: today
                }
            },
            update: {
                authorizations: type === 'authorization' ? { increment: count } : undefined,
                apiCalls: { increment: count },
                updatedAt: new Date()
            },
            create: {
                userId,
                date: today,
                authorizations: type === 'authorization' ? count : 0,
                apiCalls: count
            }
        });
    }

    async getUserUsage(userId, startDate = null, endDate = null) {
        const where = { userId };
        
        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = startDate;
            if (endDate) where.date.lte = endDate;
        }
        
        const usage = await this.prisma.usage.findMany({
            where,
            orderBy: { date: 'desc' }
        });
        
        return usage;
    }

    async getMonthlyUsage(userId, year, month) {
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        
        const usage = await this.getUserUsage(userId, startDate, endDate);
        
        const totals = usage.reduce((acc, day) => ({
            authorizations: acc.authorizations + day.authorizations,
            apiCalls: acc.apiCalls + day.apiCalls
        }), { authorizations: 0, apiCalls: 0 });
        
        return {
            userId,
            period: `${year}-${month.toString().padStart(2, '0')}`,
            dailyUsage: usage,
            totals
        };
    }

    // Health check
    async healthCheck() {
        try {
            const startTime = Date.now();
            
            // Test basic connection first
            console.log('🔍 Testing database connection...');
            await this.prisma.$connect();
            
            // Test actual query
            console.log('🔍 Testing database query...');
            await this.prisma.$queryRaw`SELECT 1 as test`;
            
            const responseTime = Date.now() - startTime;
            
            console.log(`✅ Database health check passed in ${responseTime}ms`);
            return { 
                status: 'connected', 
                responseTime: `${responseTime}ms`,
                timestamp: new Date().toISOString(),
                type: 'postgresql',
                environment: process.env.NODE_ENV || 'unknown'
            };
        } catch (error) {
            console.error('❌ Database health check failed:', error.message);
            console.error('Error code:', error.code);
            console.error('DATABASE_URL set:', process.env.DATABASE_URL ? 'Yes' : 'No');
            
            return { 
                status: 'disconnected', 
                error: error.message,
                code: error.code,
                timestamp: new Date().toISOString(),
                type: 'postgresql',
                environment: process.env.NODE_ENV || 'unknown',
                databaseUrlSet: !!process.env.DATABASE_URL
            };
        }
    }
}

module.exports = new ProductionDatabase(); 