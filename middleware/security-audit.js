const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Security Audit Logging System
 * Tracks important security events for compliance and investigation
 */
class SecurityAudit {
    static LOG_LEVELS = {
        INFO: 'INFO',
        WARNING: 'WARNING',
        CRITICAL: 'CRITICAL',
        ALERT: 'ALERT'
    };

    static EVENT_TYPES = {
        // Authentication events
        LOGIN_SUCCESS: 'LOGIN_SUCCESS',
        LOGIN_FAILED: 'LOGIN_FAILED',
        LOGOUT: 'LOGOUT',
        ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
        ACCOUNT_UNLOCKED: 'ACCOUNT_UNLOCKED',
        PASSWORD_RESET_REQUEST: 'PASSWORD_RESET_REQUEST',
        PASSWORD_RESET_SUCCESS: 'PASSWORD_RESET_SUCCESS',
        
        // API Key events
        API_KEY_CREATED: 'API_KEY_CREATED',
        API_KEY_REVEALED: 'API_KEY_REVEALED',
        API_KEY_ROTATED: 'API_KEY_ROTATED',
        API_KEY_REVOKED: 'API_KEY_REVOKED',
        API_KEY_INVALID: 'API_KEY_INVALID',
        
        // Authorization events
        AUTHORIZATION_SUCCESS: 'AUTHORIZATION_SUCCESS',
        AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',
        PERMISSION_DENIED: 'PERMISSION_DENIED',
        
        // Security events
        CSRF_VIOLATION: 'CSRF_VIOLATION',
        RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
        SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
        DEBUG_ACCESS: 'DEBUG_ACCESS',
        ADMIN_ACTION: 'ADMIN_ACTION',
        
        // Data access events
        SENSITIVE_DATA_ACCESS: 'SENSITIVE_DATA_ACCESS',
        BULK_DATA_EXPORT: 'BULK_DATA_EXPORT',
        
        // System events
        SECURITY_CONFIG_CHANGE: 'SECURITY_CONFIG_CHANGE',
        SYSTEM_ERROR: 'SYSTEM_ERROR'
    };

    // In-memory buffer for recent logs (use proper logging service in production)
    static recentLogs = [];
    static MAX_RECENT_LOGS = 1000;

    /**
     * Log a security event
     */
    static async log(eventType, level, details) {
        const logEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            eventType,
            level,
            details: {
                ...details,
                // Add request context if available
                ip: details.ip || 'unknown',
                userAgent: details.userAgent || 'unknown',
                userId: details.userId || null,
                sessionId: details.sessionId || null
            },
            // Add hash for integrity verification
            hash: null
        };

        // Calculate hash for integrity
        const dataToHash = JSON.stringify({
            timestamp: logEntry.timestamp,
            eventType: logEntry.eventType,
            level: logEntry.level,
            details: logEntry.details
        });
        logEntry.hash = crypto.createHash('sha256').update(dataToHash).digest('hex');

        // Add to recent logs buffer
        this.recentLogs.unshift(logEntry);
        if (this.recentLogs.length > this.MAX_RECENT_LOGS) {
            this.recentLogs = this.recentLogs.slice(0, this.MAX_RECENT_LOGS);
        }

        // Write to file (in production, use proper log aggregation)
        try {
            await this.writeToFile(logEntry);
        } catch (error) {
            console.error('Failed to write security log to file:', error);
        }

        // Alert on critical events
        if (level === this.LOG_LEVELS.CRITICAL || level === this.LOG_LEVELS.ALERT) {
            this.triggerAlert(logEntry);
        }

        // Console output for development
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[SECURITY ${level}] ${eventType}:`, details);
        }

        return logEntry;
    }

    /**
     * Write log entry to file
     */
    static async writeToFile(logEntry) {
        const logDir = path.join(process.cwd(), 'logs', 'security');
        const date = new Date();
        const filename = `security-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.log`;
        const filepath = path.join(logDir, filename);

        // Ensure log directory exists
        await fs.mkdir(logDir, { recursive: true });

        // Append log entry
        const logLine = JSON.stringify(logEntry) + '\n';
        await fs.appendFile(filepath, logLine, 'utf8');
    }

    /**
     * Trigger alert for critical events
     */
    static triggerAlert(logEntry) {
        // In production, this would send alerts via email, Slack, PagerDuty, etc.
        console.error(`🚨 SECURITY ALERT: ${logEntry.eventType}`, logEntry.details);
        
        // You could integrate with services like:
        // - Send email via emailService
        // - Post to Slack webhook
        // - Trigger PagerDuty incident
        // - Send SMS via Twilio
    }

    /**
     * Express middleware to log requests
     */
    static requestLogger() {
        return (req, res, next) => {
            // Extract request context
            req.auditContext = {
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.headers['user-agent'],
                userId: req.user?.id,
                sessionId: req.session?.id,
                method: req.method,
                path: req.path,
                requestId: crypto.randomUUID()
            };

            // Log response on finish
            const originalSend = res.send;
            res.send = function(data) {
                res.send = originalSend;
                
                // Log security-relevant responses
                if (res.statusCode === 401) {
                    SecurityAudit.log(
                        SecurityAudit.EVENT_TYPES.AUTHORIZATION_FAILED,
                        SecurityAudit.LOG_LEVELS.WARNING,
                        {
                            ...req.auditContext,
                            statusCode: res.statusCode,
                            path: req.path
                        }
                    );
                } else if (res.statusCode === 403) {
                    SecurityAudit.log(
                        SecurityAudit.EVENT_TYPES.PERMISSION_DENIED,
                        SecurityAudit.LOG_LEVELS.WARNING,
                        {
                            ...req.auditContext,
                            statusCode: res.statusCode,
                            path: req.path
                        }
                    );
                } else if (res.statusCode === 429) {
                    SecurityAudit.log(
                        SecurityAudit.EVENT_TYPES.RATE_LIMIT_EXCEEDED,
                        SecurityAudit.LOG_LEVELS.WARNING,
                        {
                            ...req.auditContext,
                            statusCode: res.statusCode,
                            path: req.path
                        }
                    );
                }
                
                return originalSend.call(this, data);
            };

            next();
        };
    }

    /**
     * Get recent security logs (for admin dashboard)
     */
    static getRecentLogs(filters = {}) {
        let logs = [...this.recentLogs];

        // Apply filters
        if (filters.eventType) {
            logs = logs.filter(log => log.eventType === filters.eventType);
        }
        if (filters.level) {
            logs = logs.filter(log => log.level === filters.level);
        }
        if (filters.userId) {
            logs = logs.filter(log => log.details.userId === filters.userId);
        }
        if (filters.startDate) {
            logs = logs.filter(log => new Date(log.timestamp) >= new Date(filters.startDate));
        }
        if (filters.endDate) {
            logs = logs.filter(log => new Date(log.timestamp) <= new Date(filters.endDate));
        }

        return logs;
    }

    /**
     * Get security metrics (for monitoring)
     */
    static getMetrics(timeWindow = 3600000) { // Default 1 hour
        const now = Date.now();
        const cutoff = new Date(now - timeWindow);
        
        const recentLogs = this.recentLogs.filter(
            log => new Date(log.timestamp) >= cutoff
        );

        const metrics = {
            timeWindow,
            totalEvents: recentLogs.length,
            byLevel: {},
            byEventType: {},
            failedLogins: 0,
            accountLockouts: 0,
            rateLimitHits: 0,
            suspiciousActivities: 0
        };

        // Count by level
        for (const level of Object.values(this.LOG_LEVELS)) {
            metrics.byLevel[level] = recentLogs.filter(log => log.level === level).length;
        }

        // Count by event type
        for (const log of recentLogs) {
            metrics.byEventType[log.eventType] = (metrics.byEventType[log.eventType] || 0) + 1;
            
            // Special counters
            if (log.eventType === this.EVENT_TYPES.LOGIN_FAILED) metrics.failedLogins++;
            if (log.eventType === this.EVENT_TYPES.ACCOUNT_LOCKED) metrics.accountLockouts++;
            if (log.eventType === this.EVENT_TYPES.RATE_LIMIT_EXCEEDED) metrics.rateLimitHits++;
            if (log.eventType === this.EVENT_TYPES.SUSPICIOUS_ACTIVITY) metrics.suspiciousActivities++;
        }

        return metrics;
    }

    /**
     * Verify log integrity
     */
    static verifyLogIntegrity(logEntry) {
        const dataToHash = JSON.stringify({
            timestamp: logEntry.timestamp,
            eventType: logEntry.eventType,
            level: logEntry.level,
            details: logEntry.details
        });
        const calculatedHash = crypto.createHash('sha256').update(dataToHash).digest('hex');
        
        return calculatedHash === logEntry.hash;
    }
}

module.exports = SecurityAudit; 