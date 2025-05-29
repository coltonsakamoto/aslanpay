const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class ProductionDatabase {
    constructor() {
        this.prisma = new PrismaClient({
            log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
        });
        
        // Graceful shutdown
        process.on('beforeExit', async () => {
            await this.prisma.$disconnect();
        });
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
                permissions: ['authorize', 'confirm', 'refund']
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
            permissions: keyData.permissions
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
        
        return keys;
    }

    async validateApiKey(apiKey) {
        const keyData = await this.prisma.apiKey.findFirst({
            where: {
                key: apiKey,
                isActive: true
            },
            include: {
                user: true
            }
        });
        
        if (!keyData) {
            return null;
        }

        // Update usage statistics
        await this.prisma.apiKey.update({
            where: { id: keyData.id },
            data: {
                lastUsed: new Date(),
                usageCount: { increment: 1 }
            }
        });
        
        return {
            keyId: keyData.id,
            userId: keyData.userId,
            user: this.sanitizeUser(keyData.user),
            permissions: keyData.permissions
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

    // Health check
    async healthCheck() {
        try {
            const startTime = Date.now();
            await this.prisma.$queryRaw`SELECT 1`;
            const responseTime = Date.now() - startTime;
            
            return { 
                status: 'connected', 
                responseTime: `${responseTime}ms`,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Database health check failed:', error);
            return { 
                status: 'disconnected', 
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = new ProductionDatabase(); 