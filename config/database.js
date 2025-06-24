// Robust Database Configuration for AslanPay Auth System
// Gracefully handles both local development and Railway staging/production

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

console.log('🔍 Database environment detection:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`   DATABASE_URL set: ${!!process.env.DATABASE_URL}`);

// Determine database type with robust fallbacks
const hasValidDatabaseUrl = process.env.DATABASE_URL && 
    (process.env.DATABASE_URL.startsWith('postgresql://') || 
     process.env.DATABASE_URL.startsWith('postgres://'));

const usePostgreSQL = hasValidDatabaseUrl;

console.log(`🔗 Database choice: ${usePostgreSQL ? 'PostgreSQL (Prisma)' : 'In-Memory (Local Dev)'}`);

// ========================================
// IN-MEMORY DATABASE FOR LOCAL DEVELOPMENT
// ========================================
class InMemoryDatabase {
    constructor() {
        this.users = new Map();
        this.sessions = new Map();
        this.apiKeys = new Map();
        this.passwordResets = new Map();
        this.emailVerifications = new Map();
        
        console.log('✅ In-memory database initialized for local development');
        
        // Add default test user
        this.createTestUser();
    }
    
    createTestUser() {
        const bcrypt = require('bcryptjs');
        const testUserId = uuidv4();
        const testUser = {
            id: testUserId,
            email: 'test@local.dev',
            name: 'Test User',
            password: bcrypt.hashSync('password123', 10),
            provider: 'email',
            emailVerified: true,
            subscriptionPlan: 'sandbox',
            subscriptionStatus: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        this.users.set(testUser.email, testUser);
        this.users.set(testUser.id, testUser);
        
        // Create default API key synchronously for test user
        const prefix = 'ak_live_';
        const secret = crypto.randomBytes(32).toString('hex');
        const apiKey = `${prefix}${secret}`;
        const keyId = uuidv4();
        
        const keyData = {
            id: keyId,
            userId: testUserId,
            name: 'Default API Key',
            key: apiKey,
            prefix,
            secret,
            permissions: 'authorize,confirm,refund',
            isActive: true,
            createdAt: new Date(),
            lastUsed: null,
            usageCount: 0
        };
        
        this.apiKeys.set(apiKey, keyData);
        this.apiKeys.set(keyId, keyData);
        
        console.log('👤 Test user created: test@local.dev / password123');
        console.log(`🔑 Test API key: ${apiKey.substring(0, 20)}...`);
    }
    
    // User Management
    async createUser(userData) {
        const bcrypt = require('bcryptjs');
        const { email, password, name, provider = 'email' } = userData;
        
        // Check if user exists
        if (this.users.has(email.toLowerCase())) {
            throw new Error('User already exists');
        }
        
        const hashedPassword = provider === 'email' ? await bcrypt.hash(password, 10) : null;
        const userId = uuidv4();
        
        const user = {
            id: userId,
            email: email.toLowerCase(),
            name,
            password: hashedPassword,
            provider,
            emailVerified: provider !== 'email',
            subscriptionPlan: 'sandbox',
            subscriptionStatus: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        this.users.set(user.email, user);
        this.users.set(user.id, user);
        
        // Create default API key
        await this.createApiKey(userId, 'Default Key');
        
        return this.sanitizeUser(user);
    }
    
    async getUserById(userId) {
        const user = this.users.get(userId);
        return user ? this.sanitizeUser(user) : null;
    }
    
    async getUserByEmail(email) {
        const user = this.users.get(email.toLowerCase());
        return user ? this.sanitizeUser(user) : null;
    }
    
    async verifyPassword(email, password) {
        const bcrypt = require('bcryptjs');
        const user = this.users.get(email.toLowerCase());
        
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
    
    // Session Management
    async createSession(userId) {
        const sessionId = uuidv4();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        
        const session = {
            id: sessionId,
            userId,
            expiresAt,
            lastActivity: new Date(),
            createdAt: new Date()
        };
        
        this.sessions.set(sessionId, session);
        return sessionId;
    }
    
    async getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session || session.expiresAt < new Date()) {
            if (session) this.sessions.delete(sessionId);
            return null;
        }
        return session;
    }
    
    async revokeSession(sessionId) {
        this.sessions.delete(sessionId);
        return true;
    }
    
    // API Key Management
    async createApiKey(userId, name) {
        const prefix = 'ak_live_';
        const secret = crypto.randomBytes(32).toString('hex');
        const apiKey = `${prefix}${secret}`;
        const keyId = uuidv4();
        
        const keyData = {
            id: keyId,
            userId,
            name,
            key: apiKey,
            prefix,
            secret,
            permissions: 'authorize,confirm,refund',
            isActive: true,
            createdAt: new Date(),
            lastUsed: null,
            usageCount: 0
        };
        
        this.apiKeys.set(apiKey, keyData);
        this.apiKeys.set(keyId, keyData);
        
        return {
            id: keyData.id,
            name: keyData.name,
            key: keyData.key,
            permissions: keyData.permissions.split(','),
            createdAt: keyData.createdAt,
            lastUsed: keyData.lastUsed,
            usageCount: keyData.usageCount,
            isActive: keyData.isActive
        };
    }
    
    async getApiKeysByUserId(userId) {
        const keys = [];
        for (const [key, data] of this.apiKeys) {
            if (data.userId === userId && data.isActive && typeof key === 'string' && key.startsWith('ak_')) {
                keys.push({
                    id: data.id,
                    name: data.name,
                    key: data.key,
                    permissions: data.permissions.split(','),
                    createdAt: data.createdAt,
                    lastUsed: data.lastUsed,
                    usageCount: data.usageCount,
                    isActive: data.isActive
                });
            }
        }
        return keys;
    }
    
    async validateApiKey(apiKey) {
        const keyData = this.apiKeys.get(apiKey);
        if (!keyData || !keyData.isActive) {
            return { valid: false, error: 'API key not found or inactive' };
        }
        
        const user = await this.getUserById(keyData.userId);
        if (!user) {
            return { valid: false, error: 'User not found' };
        }
        
        // Update usage
        keyData.lastUsed = new Date();
        keyData.usageCount++;
        
        return {
            valid: true,
            keyId: keyData.id,
            userId: keyData.userId,
            user: user,
            permissions: keyData.permissions.split(',')
        };
    }
    
    async revokeApiKey(userId, keyId) {
        const keyData = this.apiKeys.get(keyId);
        if (keyData && keyData.userId === userId) {
            keyData.isActive = false;
            keyData.revokedAt = new Date();
            return true;
        }
        return false;
    }
    
    async rotateApiKey(userId, keyId) {
        const oldKey = this.apiKeys.get(keyId);
        if (!oldKey || oldKey.userId !== userId) {
            throw new Error('API key not found');
        }
        
        // Revoke old key
        await this.revokeApiKey(userId, keyId);
        
        // Create new key
        return await this.createApiKey(userId, oldKey.name);
    }
    
    // Password Reset (simplified for local dev)
    async createPasswordReset(email) {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        
        this.passwordResets.set(token, {
            email: email.toLowerCase(),
            expiresAt,
            createdAt: new Date()
        });
        
        return token;
    }
    
    async resetPassword(token, newPassword) {
        const bcrypt = require('bcryptjs');
        const reset = this.passwordResets.get(token);
        if (!reset || reset.expiresAt < new Date()) {
            throw new Error('Invalid or expired reset token');
        }
        
        const user = this.users.get(reset.email);
        if (user) {
            user.password = await bcrypt.hash(newPassword, 10);
            user.updatedAt = new Date();
        }
        
        this.passwordResets.delete(token);
        return true;
    }
    
    // Email Verification (simplified for local dev)
    async createEmailVerification(userId, email) {
        const token = crypto.randomBytes(32).toString('hex');
        this.emailVerifications.set(token, { userId, email });
        return token;
    }
    
    async verifyEmail(token) {
        const verification = this.emailVerifications.get(token);
        if (verification) {
            const user = this.users.get(verification.userId);
            if (user) {
                user.emailVerified = true;
                user.updatedAt = new Date();
            }
            this.emailVerifications.delete(token);
            return true;
        }
        return false;
    }
    
    // Health check
    async healthCheck() {
        return {
            status: 'healthy',
            database: 'in-memory',
            users: this.users.size / 2, // Divided by 2 because we store by both email and id
            sessions: this.sessions.size,
            apiKeys: Array.from(this.apiKeys.values()).filter(k => k.isActive).length
        };
    }
}

// ========================================
// POSTGRESQL DATABASE FOR STAGING/PRODUCTION
// ========================================
class PostgreSQLDatabase {
    constructor() {
        this.prisma = null;
        this.initializePrisma();
    }
    
    async initializePrisma() {
        try {
            const { PrismaClient } = require('@prisma/client');
            this.prisma = new PrismaClient({
                log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
                datasources: {
                    db: {
                        url: process.env.DATABASE_URL
                    }
                }
            });
            
            await this.prisma.$connect();
            console.log('✅ PostgreSQL database connected via Prisma');
            
        } catch (error) {
            console.error('❌ PostgreSQL initialization failed:', error.message);
            throw error;
        }
    }
    
    // Delegate all methods to database-production.js
    async createUser(userData) {
        const productionDb = require('../database-production');
        return await productionDb.createUser(userData);
    }
    
    async getUserById(userId) {
        const productionDb = require('../database-production');
        return await productionDb.getUserById(userId);
    }
    
    async getUserByEmail(email) {
        const productionDb = require('../database-production');
        return await productionDb.getUserByEmail(email);
    }
    
    async verifyPassword(email, password) {
        const productionDb = require('../database-production');
        return await productionDb.verifyPassword(email, password);
    }
    
    sanitizeUser(user) {
        const productionDb = require('../database-production');
        return productionDb.sanitizeUser(user);
    }
    
    async createSession(userId) {
        const productionDb = require('../database-production');
        return await productionDb.createSession(userId);
    }
    
    async getSession(sessionId) {
        const productionDb = require('../database-production');
        return await productionDb.getSession(sessionId);
    }
    
    async revokeSession(sessionId) {
        const productionDb = require('../database-production');
        return await productionDb.revokeSession(sessionId);
    }
    
    async createApiKey(userId, name) {
        const productionDb = require('../database-production');
        return await productionDb.createApiKey(userId, name);
    }
    
    async getApiKeysByUserId(userId) {
        const productionDb = require('../database-production');
        return await productionDb.getApiKeysByUserId(userId);
    }
    
    async validateApiKey(apiKey) {
        const productionDb = require('../database-production');
        return await productionDb.validateApiKey(apiKey);
    }
    
    async revokeApiKey(userId, keyId) {
        const productionDb = require('../database-production');
        return await productionDb.revokeApiKey(userId, keyId);
    }
    
    async rotateApiKey(userId, keyId) {
        const productionDb = require('../database-production');
        return await productionDb.rotateApiKey(userId, keyId);
    }
    
    async createPasswordReset(email) {
        const productionDb = require('../database-production');
        return await productionDb.createPasswordReset(email);
    }
    
    async resetPassword(token, password) {
        const productionDb = require('../database-production');
        return await productionDb.resetPassword(token, password);
    }
    
    async createEmailVerification(userId, email) {
        const productionDb = require('../database-production');
        return await productionDb.createEmailVerification(userId, email);
    }
    
    async verifyEmail(token) {
        const productionDb = require('../database-production');
        return await productionDb.verifyEmail(token);
    }
    
    async healthCheck() {
        const productionDb = require('../database-production');
        return await productionDb.healthCheck();
    }
}

// ========================================
// EXPORT APPROPRIATE DATABASE
// ========================================
let database;

if (usePostgreSQL) {
    try {
        database = new PostgreSQLDatabase();
        console.log('🚀 PostgreSQL database selected for staging/production');
    } catch (error) {
        console.warn('⚠️ PostgreSQL failed, falling back to in-memory database');
        console.warn('⚠️ Error:', error.message);
        database = new InMemoryDatabase();
    }
} else {
    database = new InMemoryDatabase();
    console.log('🚀 In-memory database selected for local development');
}

module.exports = database; 