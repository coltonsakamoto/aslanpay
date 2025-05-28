import { Router, Request, Response } from 'express';
import { securityConfig } from '../config/security';

const router = Router();

// Endpoint to get frontend configuration
router.get('/frontend-config', (req: Request, res: Response) => {
  try {
    // Only expose safe, frontend-needed configuration
    const frontendConfig = {
      stripe: {
        publishableKey: securityConfig.stripe.publishableKey,
      },
      app: {
        environment: securityConfig.app.nodeEnv,
        testMode: securityConfig.app.testMode,
      },
      // Never expose sensitive keys like:
      // - JWT_SECRET
      // - STRIPE_SECRET_KEY  
      // - Lightning macaroons
      // - Database credentials
    };

    res.json(frontendConfig);
  } catch (error) {
    console.error('Error fetching frontend config:', error);
    res.status(500).json({
      error: {
        code: 'CONFIG_ERROR',
        message: 'Failed to fetch configuration',
      },
    });
  }
});

// Health check endpoint with basic system info
router.get('/health', (req: Request, res: Response) => {
  const healthInfo = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: securityConfig.app.nodeEnv,
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor(process.uptime()),
    // Don't expose internal system details in production
    ...(securityConfig.app.nodeEnv === 'development' && {
      nodeVersion: process.version,
      memory: process.memoryUsage(),
    }),
  };

  res.json(healthInfo);
});

export default router; 