const { RateLimiterMemory } = require('rate-limiter-flexible');

// Store lockout information (use Redis in production)
const accountLockouts = new Map();

// Configuration
const LOCKOUT_CONFIG = {
    maxAttempts: 5,              // Max login attempts before lockout
    lockoutDuration: 15 * 60,    // 15 minutes in seconds
    resetWindow: 15 * 60,        // Reset attempt counter after 15 minutes
};

class AccountLockout {
    /**
     * Record a failed login attempt
     */
    static recordFailedAttempt(email) {
        const key = email.toLowerCase();
        const now = Date.now();
        
        let lockoutData = accountLockouts.get(key);
        
        if (!lockoutData) {
            lockoutData = {
                attempts: [],
                lockedUntil: null
            };
            accountLockouts.set(key, lockoutData);
        }
        
        // Remove old attempts outside the reset window
        lockoutData.attempts = lockoutData.attempts.filter(
            attemptTime => now - attemptTime < LOCKOUT_CONFIG.resetWindow * 1000
        );
        
        // Add new attempt
        lockoutData.attempts.push(now);
        
        // Check if we should lock the account
        if (lockoutData.attempts.length >= LOCKOUT_CONFIG.maxAttempts) {
            lockoutData.lockedUntil = now + (LOCKOUT_CONFIG.lockoutDuration * 1000);
            console.log(`🔒 Account locked: ${email} until ${new Date(lockoutData.lockedUntil).toISOString()}`);
        }
        
        return {
            attempts: lockoutData.attempts.length,
            isLocked: lockoutData.lockedUntil && lockoutData.lockedUntil > now,
            lockedUntil: lockoutData.lockedUntil
        };
    }
    
    /**
     * Clear failed attempts on successful login
     */
    static clearFailedAttempts(email) {
        const key = email.toLowerCase();
        accountLockouts.delete(key);
        console.log(`✅ Failed attempts cleared for: ${email}`);
    }
    
    /**
     * Check if account is locked
     */
    static isLocked(email) {
        const key = email.toLowerCase();
        const lockoutData = accountLockouts.get(key);
        
        if (!lockoutData) {
            return { isLocked: false };
        }
        
        const now = Date.now();
        
        // Check if lockout has expired
        if (lockoutData.lockedUntil && lockoutData.lockedUntil <= now) {
            // Lockout expired, clear it
            lockoutData.lockedUntil = null;
            lockoutData.attempts = [];
        }
        
        const isLocked = lockoutData.lockedUntil && lockoutData.lockedUntil > now;
        
        return {
            isLocked,
            lockedUntil: lockoutData.lockedUntil,
            remainingTime: isLocked ? Math.ceil((lockoutData.lockedUntil - now) / 1000) : 0,
            attempts: lockoutData.attempts.length
        };
    }
    
    /**
     * Middleware to check account lockout
     */
    static checkLockout() {
        return (req, res, next) => {
            const email = req.body.email;
            
            if (!email) {
                return next();
            }
            
            const lockStatus = this.isLocked(email);
            
            if (lockStatus.isLocked) {
                return res.status(423).json({
                    error: 'Account is temporarily locked due to too many failed login attempts',
                    code: 'ACCOUNT_LOCKED',
                    lockedUntil: new Date(lockStatus.lockedUntil).toISOString(),
                    remainingTime: lockStatus.remainingTime
                });
            }
            
            // Store lockout check result for use in login route
            req.lockoutStatus = lockStatus;
            next();
        };
    }
    
    /**
     * Get lockout status for all accounts (admin use only)
     */
    static getAllLockouts() {
        const now = Date.now();
        const lockouts = [];
        
        for (const [email, data] of accountLockouts.entries()) {
            if (data.lockedUntil && data.lockedUntil > now) {
                lockouts.push({
                    email,
                    attempts: data.attempts.length,
                    lockedUntil: new Date(data.lockedUntil).toISOString(),
                    remainingTime: Math.ceil((data.lockedUntil - now) / 1000)
                });
            }
        }
        
        return lockouts;
    }
    
    /**
     * Manually unlock an account (admin use)
     */
    static unlockAccount(email) {
        const key = email.toLowerCase();
        accountLockouts.delete(key);
        console.log(`🔓 Account manually unlocked: ${email}`);
        return { success: true, message: `Account ${email} has been unlocked` };
    }
}

// Clean up expired lockouts periodically
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [email, data] of accountLockouts.entries()) {
        // Remove entries with expired lockouts and no recent attempts
        if ((!data.lockedUntil || data.lockedUntil <= now) && 
            data.attempts.every(attemptTime => now - attemptTime > LOCKOUT_CONFIG.resetWindow * 1000)) {
            accountLockouts.delete(email);
            cleaned++;
        }
    }
    
    if (cleaned > 0) {
        console.log(`🧹 Cleaned up ${cleaned} expired lockout entries`);
    }
}, 5 * 60 * 1000); // Run every 5 minutes

module.exports = AccountLockout; 