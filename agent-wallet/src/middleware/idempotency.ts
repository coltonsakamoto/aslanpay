import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';

interface IdempotentRequest extends Request {
  idempotencyKey?: string;
  requestHash?: string;
}

export class IdempotencyService {
  
  /**
   * Generate idempotency key from request content
   */
  static generateRequestHash(req: Request): string {
    const payload = {
      method: req.method,
      path: req.path,
      body: req.body,
      // Include timestamp window (5 minute buckets) to prevent indefinite replays
      timeWindow: Math.floor(Date.now() / (5 * 60 * 1000))
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  /**
   * Idempotency middleware for authorization endpoints
   */
  static idempotencyMiddleware() {
    return async (req: IdempotentRequest, res: Response, next: NextFunction) => {
      try {
        // Only apply to POST requests for authorization
        if (req.method !== 'POST' || !req.path.includes('/authorize')) {
          return next();
        }

        // Generate request hash
        const requestHash = this.generateRequestHash(req);
        req.requestHash = requestHash;

        // Check for existing request with same hash
        const existingRequest = await prisma.idempotencyRecord.findFirst({
          where: {
            requestHash: requestHash,
            createdAt: {
              gte: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes
            }
          },
          orderBy: { createdAt: 'desc' }
        });

        if (existingRequest) {
          console.log(`🔄 IDEMPOTENCY: Duplicate request detected - ${requestHash}`);
          
          // Return cached response
          if (existingRequest.response) {
            const cachedResponse = JSON.parse(existingRequest.response);
            return res.status(existingRequest.statusCode || 200).json({
              ...cachedResponse,
              idempotent: true,
              originalRequestTime: existingRequest.createdAt,
              message: 'Duplicate request - returning cached response'
            });
          }
        }

        // Add custom response handler to cache successful responses
        const originalJson = res.json;
        res.json = function(body: any) {
          // Cache successful authorization responses
          if (res.statusCode >= 200 && res.statusCode < 300) {
            setImmediate(async () => {
              try {
                await prisma.idempotencyRecord.create({
                  data: {
                    requestHash: requestHash,
                    response: JSON.stringify(body),
                    statusCode: res.statusCode,
                    endpoint: req.path,
                    method: req.method
                  }
                });
              } catch (error) {
                console.error('Failed to cache idempotency record:', error);
              }
            });
          }
          
          return originalJson.call(this, body);
        };

        next();

      } catch (error) {
        console.error('Idempotency middleware error:', error);
        next(); // Continue on error, don't block requests
      }
    };
  }

  /**
   * Cleanup old idempotency records
   */
  static async cleanupOldRecords() {
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
      
      const deleted = await prisma.idempotencyRecord.deleteMany({
        where: {
          createdAt: { lt: cutoff }
        }
      });
      
      console.log(`🧹 Cleaned up ${deleted.count} old idempotency records`);
    } catch (error) {
      console.error('Idempotency cleanup error:', error);
    }
  }

  /**
   * Webhook idempotency protection (for merchant webhooks)
   */
  static webhookIdempotency() {
    return async (req: IdempotentRequest, res: Response, next: NextFunction) => {
      try {
        // Extract webhook signature/id from headers
        const webhookId = req.headers['x-webhook-id'] || 
                         req.headers['stripe-signature'] ||
                         req.headers['x-signature'];
        
        if (!webhookId) {
          return res.status(400).json({
            error: 'Missing webhook signature/ID header',
            code: 'MISSING_WEBHOOK_ID'
          });
        }

        // Check for duplicate webhook
        const existingWebhook = await prisma.webhookLog.findFirst({
          where: {
            webhookId: webhookId as string,
            createdAt: {
              gte: new Date(Date.now() - 60 * 60 * 1000) // 1 hour
            }
          }
        });

        if (existingWebhook) {
          console.log(`🔄 WEBHOOK REPLAY DETECTED: ${webhookId}`);
          
          return res.status(200).json({
            success: true,
            message: 'Webhook already processed',
            originalProcessedAt: existingWebhook.createdAt,
            idempotent: true
          });
        }

        // Log webhook for replay protection
        await prisma.webhookLog.create({
          data: {
            webhookId: webhookId as string,
            endpoint: req.path,
            payload: JSON.stringify(req.body),
            headers: JSON.stringify(req.headers)
          }
        });

        next();

      } catch (error) {
        console.error('Webhook idempotency error:', error);
        next();
      }
    };
  }
}

// Auto-cleanup every hour
setInterval(() => {
  IdempotencyService.cleanupOldRecords();
}, 60 * 60 * 1000); 