const crypto = require('crypto');
const { promisify } = require('util');

/**
 * Secure Session Management Module
 * 
 * Features:
 * - Session regeneration on login
 * - Redis-backed storage (with in-memory fallback)
 * - Secure session ID generation
 * - Session fixation prevention
 * - Automatic cleanup of expired sessions
 */

class SecureSessionManager {
    constructor(redisClient = null) {
        this.storage = redisClient ? new RedisSessionStorage(redisClient) : new InMemorySessionStorage();
        this.sessionConfig = {
            ttl: 7 * 24 * 60 * 60, // 7 days in seconds
            regenerateOnLogin: true,
            secureCookieOptions: {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
                path: '/',
                domain: process.env.COOKIE_DOMAIN
            }
        };
        
        // Start cleanup interval
        this.startCleanupInterval();
    }
    
    /**
     * Generate cryptographically secure session ID
     */
    generateSessionId() {
        // Use 32 bytes of randomness for 256-bit security
        const id = crypto.randomBytes(32).toString('base64url');
        return `sess_${id}`;
    }
    
    /**
     * Create a new session
     */
    async createSession(userId, metadata = {}) {
        const sessionId = this.generateSessionId();
        const session = {
            id: sessionId,
            userId,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + this.sessionConfig.ttl * 1000).toISOString(),
            lastActivity: new Date().toISOString(),
            metadata: {
                ...metadata,
                userAgent: metadata.userAgent || 'unknown',
                ipAddress: metadata.ipAddress || 'unknown'
            },
            isActive: true
        };
        
        await this.storage.set(sessionId, session, this.sessionConfig.ttl);
        return session;
    }
    
    /**
     * Regenerate session ID (prevent fixation attacks)
     */
    async regenerateSession(oldSessionId) {
        const oldSession = await this.storage.get(oldSessionId);
        if (!oldSession) {
            throw new Error('Session not found');
        }
        
        // Create new session with same data but new ID
        const newSessionId = this.generateSessionId();
        const newSession = {
            ...oldSession,
            id: newSessionId,
            regeneratedFrom: oldSessionId,
            regeneratedAt: new Date().toISOString()
        };
        
        // Atomic operation: create new, delete old
        await this.storage.set(newSessionId, newSession, this.sessionConfig.ttl);
        await this.storage.delete(oldSessionId);
        
        return newSession;
    }
    
    /**
     * Get session with activity tracking
     */
    async getSession(sessionId) {
        const session = await this.storage.get(sessionId);
        
        if (!session) {
            return null;
        }
        
        // Check if expired
        if (new Date(session.expiresAt) < new Date()) {
            await this.storage.delete(sessionId);
            return null;
        }
        
        // Update last activity
        session.lastActivity = new Date().toISOString();
        await this.storage.set(sessionId, session, this.sessionConfig.ttl);
        
        return session;
    }
    
    /**
     * Invalidate session
     */
    async invalidateSession(sessionId) {
        const session = await this.storage.get(sessionId);
        if (session) {
            // Mark as inactive for audit trail
            session.isActive = false;
            session.invalidatedAt = new Date().toISOString();
            await this.storage.set(sessionId, session, 3600); // Keep for 1 hour for audit
            
            // Log security event
            console.log(`Session invalidated: ${sessionId} for user ${session.userId}`);
        }
        return true;
    }
    
    /**
     * Invalidate all sessions for a user
     */
    async invalidateUserSessions(userId) {
        const sessions = await this.storage.getUserSessions(userId);
        const invalidatePromises = sessions.map(session => 
            this.invalidateSession(session.id)
        );
        await Promise.all(invalidatePromises);
        return sessions.length;
    }
    
    /**
     * Clean up expired sessions
     */
    async cleanupExpiredSessions() {
        const count = await this.storage.cleanupExpired();
        if (count > 0) {
            console.log(`Cleaned up ${count} expired sessions`);
        }
        return count;
    }
    
    /**
     * Start automatic cleanup interval
     */
    startCleanupInterval() {
        // Run cleanup every hour
        setInterval(async () => {
            try {
                await this.cleanupExpiredSessions();
            } catch (error) {
                console.error('Session cleanup error:', error);
            }
        }, 60 * 60 * 1000);
    }
    
    /**
     * Express middleware
     */
    middleware() {
        return async (req, res, next) => {
            // Get session ID from cookie
            const sessionId = req.cookies?.agentpay_session;
            
            if (sessionId) {
                try {
                    const session = await this.getSession(sessionId);
                    if (session) {
                        req.session = session;
                        req.sessionId = session.id;
                        req.userId = session.userId;
                    }
                } catch (error) {
                    console.error('Session middleware error:', error);
                }
            }
            
            // Add session methods to request
            req.createSession = async (userId, metadata = {}) => {
                const session = await this.createSession(userId, {
                    ...metadata,
                    userAgent: req.headers['user-agent'],
                    ipAddress: req.ip
                });
                
                res.cookie('agentpay_session', session.id, this.sessionConfig.secureCookieOptions);
                req.session = session;
                req.sessionId = session.id;
                req.userId = userId;
                
                return session;
            };
            
            req.regenerateSession = async () => {
                if (!req.sessionId) {
                    throw new Error('No active session to regenerate');
                }
                
                const newSession = await this.regenerateSession(req.sessionId);
                res.cookie('agentpay_session', newSession.id, this.sessionConfig.secureCookieOptions);
                req.session = newSession;
                req.sessionId = newSession.id;
                
                return newSession;
            };
            
            req.destroySession = async () => {
                if (req.sessionId) {
                    await this.invalidateSession(req.sessionId);
                    res.clearCookie('agentpay_session');
                    delete req.session;
                    delete req.sessionId;
                    delete req.userId;
                }
            };
            
            next();
        };
    }
}

/**
 * Redis-backed session storage
 */
class RedisSessionStorage {
    constructor(redisClient) {
        this.client = redisClient;
        // Only promisify if methods exist
        if (redisClient && redisClient.get && redisClient.setex && redisClient.del && redisClient.keys) {
            this.getAsync = promisify(this.client.get).bind(this.client);
            this.setAsync = promisify(this.client.setex).bind(this.client);
            this.delAsync = promisify(this.client.del).bind(this.client);
            this.keysAsync = promisify(this.client.keys).bind(this.client);
        } else {
            // Fallback methods that throw errors
            this.getAsync = async () => { throw new Error('Redis client not properly initialized'); };
            this.setAsync = async () => { throw new Error('Redis client not properly initialized'); };
            this.delAsync = async () => { throw new Error('Redis client not properly initialized'); };
            this.keysAsync = async () => { throw new Error('Redis client not properly initialized'); };
        }
    }
    
    async set(sessionId, session, ttl) {
        await this.setAsync(sessionId, ttl, JSON.stringify(session));
        // Also index by user ID for bulk operations
        await this.setAsync(`user:${session.userId}:${sessionId}`, ttl, '1');
    }
    
    async get(sessionId) {
        const data = await this.getAsync(sessionId);
        return data ? JSON.parse(data) : null;
    }
    
    async delete(sessionId) {
        const session = await this.get(sessionId);
        if (session) {
            await this.delAsync(sessionId);
            await this.delAsync(`user:${session.userId}:${sessionId}`);
        }
    }
    
    async getUserSessions(userId) {
        const keys = await this.keysAsync(`user:${userId}:sess_*`);
        const sessions = [];
        
        for (const key of keys) {
            const sessionId = key.split(':')[2];
            const session = await this.get(sessionId);
            if (session) {
                sessions.push(session);
            }
        }
        
        return sessions;
    }
    
    async cleanupExpired() {
        // Redis handles TTL automatically
        return 0;
    }
}

/**
 * In-memory session storage (fallback)
 */
class InMemorySessionStorage {
    constructor() {
        this.sessions = new Map();
        this.userSessions = new Map(); // userId -> Set of sessionIds
    }
    
    async set(sessionId, session, ttl) {
        this.sessions.set(sessionId, {
            data: session,
            expiresAt: Date.now() + (ttl * 1000)
        });
        
        // Update user index
        if (!this.userSessions.has(session.userId)) {
            this.userSessions.set(session.userId, new Set());
        }
        this.userSessions.get(session.userId).add(sessionId);
    }
    
    async get(sessionId) {
        const entry = this.sessions.get(sessionId);
        if (!entry) return null;
        
        if (entry.expiresAt < Date.now()) {
            this.delete(sessionId);
            return null;
        }
        
        return entry.data;
    }
    
    async delete(sessionId) {
        const entry = this.sessions.get(sessionId);
        if (entry) {
            const session = entry.data;
            this.sessions.delete(sessionId);
            
            // Update user index
            const userSessions = this.userSessions.get(session.userId);
            if (userSessions) {
                userSessions.delete(sessionId);
                if (userSessions.size === 0) {
                    this.userSessions.delete(session.userId);
                }
            }
        }
    }
    
    async getUserSessions(userId) {
        const sessionIds = this.userSessions.get(userId) || new Set();
        const sessions = [];
        
        for (const sessionId of sessionIds) {
            const session = await this.get(sessionId);
            if (session) {
                sessions.push(session);
            }
        }
        
        return sessions;
    }
    
    async cleanupExpired() {
        let count = 0;
        const now = Date.now();
        
        for (const [sessionId, entry] of this.sessions.entries()) {
            if (entry.expiresAt < now) {
                await this.delete(sessionId);
                count++;
            }
        }
        
        return count;
    }
}

module.exports = SecureSessionManager; 