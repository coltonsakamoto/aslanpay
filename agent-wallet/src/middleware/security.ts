import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
import { body, param, validationResult } from 'express-validator';
import { securityConfig } from '../config/security';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting configurations for different endpoints
export const createRateLimit = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
    windowMs,
    max,
    message: message || {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// General API rate limiting
export const generalRateLimit = createRateLimit(
  securityConfig.rateLimit.windowMs, // 15 minutes
  securityConfig.rateLimit.maxRequests, // 100 requests
  'Too many API requests, please try again later'
);

// Strict rate limiting for sensitive endpoints
export const strictRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes  
  10, // 10 requests only
  'Too many attempts on sensitive endpoint'
);

// Wallet creation rate limiting
export const walletCreationLimit = createRateLimit(
  60 * 60 * 1000, // 1 hour
  5, // 5 wallets per hour
  'Too many wallets created, please try again later'
);

// Payment rate limiting
export const paymentRateLimit = createRateLimit(
  5 * 60 * 1000, // 5 minutes
  20, // 20 payments per 5 minutes
  'Too many payment attempts, please try again later'
);

// Slow down middleware for brute force protection
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per windowMs without delay
  delayMs: 100, // Add 100ms delay after delayAfter is reached
  maxDelayMs: 2000, // Maximum delay of 2 seconds
});

// Security headers configuration
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      scriptSrc: ["'self'", "https://js.stripe.com", "https://cdn.tailwindcss.com"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      frameSrc: ["https://js.stripe.com"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
});

// Input validation schemas
export const validateWalletCreation = [
  // No specific validation needed for wallet creation, but we can add IP tracking
];

export const validateWalletFunding = [
  param('id').isUUID().withMessage('Invalid wallet ID format'),
  body('usd')
    .isFloat({ min: 0.01, max: 10000 })
    .withMessage('USD amount must be between $0.01 and $10,000'),
];

export const validateAgentCreation = [
  body('walletId').isUUID().withMessage('Invalid wallet ID format'),
  body('dailyUsdLimit')
    .isFloat({ min: 1, max: 1000 })
    .withMessage('Daily limit must be between $1 and $1,000'),
];

export const validatePayment = [
  body('agentToken').isLength({ min: 10 }).withMessage('Invalid agent token'),
  body('invoice').optional().isLength({ min: 10 }).withMessage('Invalid invoice format'),
  body('sats').optional().isInt({ min: 1, max: 1000000 }).withMessage('Sats must be between 1 and 1,000,000'),
];

export const validatePurchase = [
  body('agentToken').isLength({ min: 10 }).withMessage('Invalid agent token'),
  body('service').isIn(['sms', 'domain', 'gift-card', 'vps', 'saas']).withMessage('Invalid service type'),
  body('params').isObject().withMessage('Parameters must be an object'),
];

// Validation result handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: errors.array().map(err => ({
          field: (err as any).param || 'unknown',
          message: err.msg,
          value: (err as any).value || 'unknown',
        })),
      },
    });
  }
  next();
};

// Enhanced error handling middleware
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Log the error for debugging (in production, use proper logging service)
  console.error('Security Error:', {
    timestamp: new Date().toISOString(),
    ip: req.ip || 'unknown',
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    error: err.message,
    stack: securityConfig.app.nodeEnv === 'development' ? err.stack : undefined,
  });

  // Sanitize error responses based on environment
  if (securityConfig.app.nodeEnv === 'production') {
    // Generic error message for production
    if (err.status >= 400 && err.status < 500) {
      // Client errors - can be more specific
      return res.status(err.status).json({
        error: {
          code: err.code || 'CLIENT_ERROR',
          message: err.message || 'Invalid request',
        },
      });
    } else {
      // Server errors - generic message
      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      });
    }
  } else {
    // Development - more detailed errors
    return res.status(err.status || 500).json({
      error: {
        code: err.code || 'UNKNOWN_ERROR',
        message: err.message,
        stack: err.stack,
        details: err.details,
      },
    });
  }
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentLength: res.get('Content-Length'),
    };
    
    // Log based on status code
    if (res.statusCode >= 400) {
      console.error('Request Error:', logData);
    } else {
      console.log('Request:', logData);
    }
  });
  
  next();
};

// IP-based suspicious activity detection
const suspiciousActivity = new Map<string, { requests: number; lastRequest: number }>();

export const detectSuspiciousActivity = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = req.ip || 'unknown';
  const now = Date.now();
  const timeWindow = 60 * 1000; // 1 minute
  const maxRequests = 60; // 60 requests per minute is suspicious
  
  const activity = suspiciousActivity.get(clientIP) || { requests: 0, lastRequest: now };
  
  // Reset counter if time window passed
  if (now - activity.lastRequest > timeWindow) {
    activity.requests = 1;
    activity.lastRequest = now;
  } else {
    activity.requests++;
  }
  
  suspiciousActivity.set(clientIP, activity);
  
  // Block if too many requests
  if (activity.requests > maxRequests) {
    console.warn('Suspicious activity detected:', {
      ip: clientIP,
      requests: activity.requests,
      timeWindow: '1 minute',
      userAgent: req.get('User-Agent'),
    });
    
    return res.status(429).json({
      error: {
        code: 'SUSPICIOUS_ACTIVITY',
        message: 'Too many requests detected. Please try again later.',
      },
    });
  }
  
  next();
};

// CORS configuration
export const corsOptions = {
  origin: securityConfig.cors.origin,
  credentials: securityConfig.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400, // 24 hours
};

// Security middleware stack for easy application
export const securityMiddleware = [
  securityHeaders,
  generalRateLimit,
  speedLimiter,
  detectSuspiciousActivity,
  requestLogger,
];

export default {
  createRateLimit,
  generalRateLimit,
  strictRateLimit,
  walletCreationLimit,
  paymentRateLimit,
  speedLimiter,
  securityHeaders,
  validateWalletCreation,
  validateWalletFunding,
  validateAgentCreation,
  validatePayment,
  validatePurchase,
  handleValidationErrors,
  errorHandler,
  requestLogger,
  detectSuspiciousActivity,
  corsOptions,
  securityMiddleware,
};

interface AuthenticatedRequest extends Request {
  agent?: any; // Use any to match Prisma's actual return type
}

export class SecurityMiddleware {
  
  // Rate limiting middleware
  static rateLimit(windowMs: number = 15 * 60 * 1000, max: number = 100) {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = req.ip || 'unknown';
      const now = Date.now();
      
      // Clean up old entries
      for (const [ip, data] of rateLimitStore.entries()) {
        if (now > data.resetTime) {
          rateLimitStore.delete(ip);
        }
      }
      
      const entry = rateLimitStore.get(key) || { count: 0, resetTime: now + windowMs };
      
      if (now > entry.resetTime) {
        entry.count = 0;
        entry.resetTime = now + windowMs;
      }
      
      entry.count++;
      rateLimitStore.set(key, entry);
      
      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': max.toString(),
        'X-RateLimit-Remaining': Math.max(0, max - entry.count).toString(),
        'X-RateLimit-Reset': new Date(entry.resetTime).toISOString()
      });
      
      if (entry.count > max) {
        return res.status(429).json({
          success: false,
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((entry.resetTime - now) / 1000)
        });
      }
      
      next();
    };
  }
  
  // Agent token authentication
  static authenticateAgent() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const token = req.headers.authorization?.replace('Bearer ', '') || req.body.agentToken;
        
        if (!token) {
          return res.status(401).json({
            success: false,
            error: 'Agent token required',
            code: 'MISSING_TOKEN'
          });
        }
        
        // Verify JWT token
        const JWT_SECRET = process.env.JWT_SECRET!;
        const payload = jwt.verify(token, JWT_SECRET) as any;
        
        // Get agent from database
        const agent = await prisma.agent.findUnique({
          where: { token },
          include: { wallet: true }
        });
        
        if (!agent) {
          return res.status(401).json({
            success: false,
            error: 'Invalid or expired token',
            code: 'INVALID_TOKEN'
          });
        }
        
        // Check if token is expired
        if (payload.exp && Date.now() >= payload.exp * 1000) {
          return res.status(401).json({
            success: false,
            error: 'Token expired',
            code: 'TOKEN_EXPIRED'
          });
        }
        
        // Attach agent to request
        req.agent = agent;
        next();
        
      } catch (error) {
        return res.status(401).json({
          success: false,
          error: 'Invalid token',
          code: 'INVALID_TOKEN'
        });
      }
    };
  }
  
  // Fraud detection middleware
  static fraudDetection() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const agent = req.agent;
        if (!agent) return next();
        
        const { service, params } = req.body;
        
        // Check for suspicious patterns
        const suspiciousPatterns = [
          // Large gift card purchases
          service === 'gift-card' && params.amount > 500,
          // Multiple VPS purchases in short time
          service === 'vps' && await this.checkRecentPurchases(agent.id, 'vps', 5, 60 * 60 * 1000),
          // International phone numbers for SMS
          service === 'sms' && params.to && !params.to.startsWith('+1'),
          // Domain registration with suspicious TLDs
          service === 'domain' && params.domain && /\.(tk|ml|ga|cf)$/.test(params.domain)
        ];
        
        if (suspiciousPatterns.some(Boolean)) {
          console.warn('🚨 Suspicious activity detected:', {
            agentId: agent.id,
            service,
            params,
            ip: req.ip,
            userAgent: req.headers['user-agent']
          });
          
          // Log to database
          await prisma.payment.create({
            data: {
              walletId: agent.walletId,
              agentId: agent.id,
              invoice: 'fraud_check',
              amountSat: 0,
              type: 'fraud_check',
              status: 'flagged',
              metadata: JSON.stringify({
                service,
                params,
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                reason: 'suspicious_pattern'
              })
            }
          });
          
          // For now, just log and continue. In production, you might block or require additional verification
        }
        
        next();
        
      } catch (error) {
        console.error('Fraud detection error:', error);
        next(); // Continue even if fraud detection fails
      }
    };
  }
  
  // Check recent purchases of a specific type
  private static async checkRecentPurchases(
    agentId: string, 
    type: string, 
    count: number, 
    timeWindow: number
  ): Promise<boolean> {
    const since = new Date(Date.now() - timeWindow);
    
    const recentPurchases = await prisma.payment.count({
      where: {
        agentId,
        status: 'completed',
        createdAt: {
          gte: since
        }
      }
    });
    
    return recentPurchases >= count;
  }
  
  // Spending limit validation
  static validateSpendingLimits() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const agent = req.agent;
        if (!agent) return next();
        
        const { service, params } = req.body;
        
        // Calculate transaction amount
        let transactionAmount = 0;
        
        switch (service) {
          case 'sms':
            transactionAmount = 0.0075;
            break;
          case 'call':
            transactionAmount = 0.022;
            break;
          case 'domain':
            transactionAmount = 12.99 * (params.years || 1);
            break;
          case 'gift-card':
            transactionAmount = params.amount;
            break;
          case 'vps':
            const vpsRates = { basic: 5.99, standard: 12.99, premium: 24.99, enterprise: 49.99 };
            transactionAmount = (vpsRates[params.plan as keyof typeof vpsRates] || 5.99) * (params.months || 1);
            break;
          case 'aws-credits':
            transactionAmount = params.amount;
            break;
          default:
            transactionAmount = 0;
        }
        
        const amountCents = Math.round(transactionAmount * 100);
        
        // Check wallet balance
        if (amountCents > agent.wallet.balanceUSD) {
          return res.status(400).json({
            success: false,
            error: `Insufficient balance. Need $${transactionAmount}, have $${agent.wallet.balanceUSD / 100}`,
            code: 'INSUFFICIENT_BALANCE',
            required: transactionAmount,
            available: agent.wallet.balanceUSD / 100
          });
        }
        
        // Check daily spending limit
        const dailyLimitUSD = agent.limitSat * 0.00035; // Convert sats to USD
        const spentTodayUSD = agent.spentTodaySat * 0.00035;
        
        if (spentTodayUSD + transactionAmount > dailyLimitUSD) {
          return res.status(400).json({
            success: false,
            error: `Daily limit exceeded. Limit: $${dailyLimitUSD.toFixed(2)}, spent today: $${spentTodayUSD.toFixed(2)}, attempting: $${transactionAmount}`,
            code: 'DAILY_LIMIT_EXCEEDED',
            dailyLimit: dailyLimitUSD,
            spentToday: spentTodayUSD,
            attemptingToSpend: transactionAmount
          });
        }
        
        // Check velocity limits (max 10 transactions per hour)
        const recentTransactions = await prisma.payment.count({
          where: {
            agentId: agent.id,
            createdAt: {
              gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
            },
            status: 'completed'
          }
        });
        
        if (recentTransactions >= 10) {
          return res.status(429).json({
            success: false,
            error: 'Transaction velocity limit exceeded. Max 10 transactions per hour.',
            code: 'VELOCITY_LIMIT_EXCEEDED',
            recentTransactions,
            limit: 10
          });
        }
        
        // Attach calculated amount to request for use in purchase handler
        (req as any).calculatedAmount = transactionAmount;
        
        next();
        
      } catch (error) {
        console.error('Spending limit validation error:', error);
        return res.status(500).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR'
        });
      }
    };
  }
  
  // Input sanitization
  static sanitizeInput() {
    return (req: Request, res: Response, next: NextFunction) => {
      const sanitize = (obj: any): any => {
        if (typeof obj === 'string') {
          return obj.trim().substring(0, 1000); // Limit string length
        }
        if (typeof obj === 'object' && obj !== null) {
          const sanitized: any = {};
          for (const key in obj) {
            if (obj.hasOwnProperty(key) && typeof key === 'string') {
              sanitized[key.substring(0, 100)] = sanitize(obj[key]); // Limit key length
            }
          }
          return sanitized;
        }
        return obj;
      };
      
      req.body = sanitize(req.body);
      req.query = sanitize(req.query);
      
      next();
    };
  }
  
  // CORS headers
  static corsHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://agentpay.com',
        'https://app.agentpay.com'
      ];
      
      const origin = req.headers.origin;
      if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
      
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
      
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }
      
      next();
    };
  }
} 