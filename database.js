const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// In-memory database (replace with PostgreSQL/MongoDB in production)
const database = {
    users: new Map(),
    apiKeys: new Map(),
    sessions: new Map(),
    passwordResets: new Map(),
    emailVerifications: new Map()
};

class Database {
    // User Management
    async createUser(userData) {
        const { email, password, name, provider = 'email', googleId, githubId } = userData;
        
        // Check if user already exists
        const existingUser = this.getUserByEmail(email);
        if (existingUser) {
            throw new Error('User already exists');
        }

        const userId = uuidv4();
        const hashedPassword = provider === 'email' ? await bcrypt.hash(password, 12) : null;
        
        const user = {
            id: userId,
            email,
            name,
            password: hashedPassword,
            provider,
            googleId: googleId || null,
            githubId: githubId || null,
            emailVerified: provider !== 'email', // OAuth users are pre-verified
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
        
        // Create default API key
        await this.createApiKey(userId, 'Default Key');
        
        return this.sanitizeUser(user);
    }

    async updateUser(userId, updates) {
        const user = database.users.get(userId);
        if (!user) {
            throw new Error('User not found');
        }

        Object.assign(user, updates, { updatedAt: new Date() });
        database.users.set(userId, user);
        
        return this.sanitizeUser(user);
    }

    getUserById(userId) {
        const user = database.users.get(userId);
        return user ? this.sanitizeUser(user) : null;
    }

    getUserByEmail(email) {
        for (const user of database.users.values()) {
            if (user.email === email) {
                return this.sanitizeUser(user);
            }
        }
        return null;
    }

    async verifyPassword(email, password) {
        for (const user of database.users.values()) {
            if (user.email === email && user.password) {
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

    // API Key Management
    async createApiKey(userId, name) {
        // Check if user exists in raw database
        const user = database.users.get(userId);
        if (!user) {
            console.log('🔍 User not found in database for userId:', userId);
            console.log('🔍 Available userIds:', Array.from(database.users.keys()));
            throw new Error('User not found');
        }

        const keyId = uuidv4();
        const prefix = 'ak_live_';
        const secret = crypto.randomBytes(32).toString('hex');
        const apiKey = `${prefix}${secret}`;
        
        const keyData = {
            id: keyId,
            userId,
            name,
            key: apiKey,
            prefix,
            secret,
            lastUsed: null,
            usageCount: 0,
            createdAt: new Date(),
            isActive: true,
            permissions: ['authorize', 'confirm', 'refund'], // Default permissions
        };

        database.apiKeys.set(keyId, keyData);
        
        return {
            id: keyId,
            name,
            key: apiKey,
            createdAt: keyData.createdAt,
            lastUsed: keyData.lastUsed,
            usageCount: keyData.usageCount,
            isActive: keyData.isActive,
            permissions: keyData.permissions
        };
    }

    async revokeApiKey(userId, keyId) {
        const keyData = database.apiKeys.get(keyId);
        if (!keyData || keyData.userId !== userId) {
            throw new Error('API key not found');
        }

        keyData.isActive = false;
        keyData.revokedAt = new Date();
        database.apiKeys.set(keyId, keyData);
        
        return true;
    }

    async rotateApiKey(userId, keyId) {
        const oldKey = database.apiKeys.get(keyId);
        if (!oldKey || oldKey.userId !== userId) {
            throw new Error('API key not found');
        }

        // Revoke old key
        await this.revokeApiKey(userId, keyId);
        
        // Create new key with same name
        return await this.createApiKey(userId, oldKey.name);
    }

    getApiKeysByUserId(userId) {
        const keys = [];
        for (const keyData of database.apiKeys.values()) {
            if (keyData.userId === userId && keyData.isActive) {
                keys.push({
                    id: keyData.id,
                    name: keyData.name,
                    key: keyData.key, // Return full key for authenticated users
                    createdAt: keyData.createdAt,
                    lastUsed: keyData.lastUsed,
                    usageCount: keyData.usageCount,
                    permissions: keyData.permissions
                });
            }
        }
        return keys;
    }

    async validateApiKey(apiKey) {
        for (const keyData of database.apiKeys.values()) {
            if (keyData.key === apiKey && keyData.isActive) {
                // Update usage statistics
                keyData.lastUsed = new Date();
                keyData.usageCount++;
                database.apiKeys.set(keyData.id, keyData);
                
                const user = database.users.get(keyData.userId);
                return {
                    keyId: keyData.id,
                    userId: keyData.userId,
                    user: this.sanitizeUser(user),
                    permissions: keyData.permissions
                };
            }
        }
        return null;
    }

    // Email Verification
    createEmailVerification(userId, email) {
        const token = crypto.randomBytes(32).toString('hex');
        const verification = {
            userId,
            email,
            token,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
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

    // Password Reset
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
            expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
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

    // Session Management (for web dashboard)
    createSession(userId) {
        const sessionId = uuidv4();
        const session = {
            id: sessionId,
            userId,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
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

        // Update last activity
        session.lastActivity = new Date();
        database.sessions.set(sessionId, session);
        
        return session;
    }

    revokeSession(sessionId) {
        return database.sessions.delete(sessionId);
    }

    // Development helper - get all data
    getAllData() {
        return {
            users: Array.from(database.users.values()).map(u => this.sanitizeUser(u)),
            apiKeys: Array.from(database.apiKeys.values()),
            sessions: Array.from(database.sessions.values()),
            passwordResets: Array.from(database.passwordResets.values()),
            emailVerifications: Array.from(database.emailVerifications.values())
        };
    }
}

module.exports = new Database(); 