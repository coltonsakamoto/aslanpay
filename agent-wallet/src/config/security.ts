import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface SecurityConfig {
  // Stripe Configuration
  stripe: {
    secretKey: string;
    publishableKey: string;
  };
  
  // Lightning Network Configuration
  lightning: {
    socket: string;
    macaroon: string;
    certPath: string;
    testSocket: string;
    testMacaroon: string;
  };
  
  // JWT Configuration
  jwt: {
    secret: string;
    expiresIn: string;
  };
  
  // CORS Configuration
  cors: {
    origin: string[];
    credentials: boolean;
  };
  
  // Rate Limiting Configuration
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
  };
  
  // Application Configuration
  app: {
    port: number;
    nodeEnv: string;
    testMode: boolean;
    usdPerSat: number;
  };
}

export const securityConfig: SecurityConfig = {
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_TYooMQauvdEDq54NiTphI7jx',
  },
  
  lightning: {
    socket: process.env.LN_SOCKET || 'mynode.m.voltageapp.io:10009',
    macaroon: process.env.LN_MACAROON || '',
    certPath: process.env.LN_CERT_PATH || '../certs/tls.cert',
    testSocket: process.env.LN_TEST_SOCKET || 'testnet-lnd1.voltageapp.io:10009',
    testMacaroon: process.env.LN_TEST_MACAROON || '',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    skipSuccessfulRequests: false,
  },
  
  app: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
    testMode: process.env.TEST_MODE === 'true',
    usdPerSat: parseFloat(process.env.USD_PER_SAT || '0.00035'),
  },
};

// Validation function to ensure required environment variables are set
export function validateSecurityConfig(): void {
  const requiredVars = [
    'STRIPE_SECRET_KEY',
    'JWT_SECRET',
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => console.error(`  - ${varName}`));
    console.error('\n💡 Please add these to your .env file');
    process.exit(1);
  }
  
  // Warn about Lightning Network configuration
  if (!process.env.LN_MACAROON) {
    console.warn('⚠️  LN_MACAROON not set - Lightning payments will use hardcoded fallback');
  }
  
  if (securityConfig.app.nodeEnv === 'production') {
    // Additional production checks
    if (securityConfig.stripe.publishableKey.includes('test')) {
      console.error('❌ Production mode detected but using test Stripe keys!');
      process.exit(1);
    }
    
    if (securityConfig.cors.origin.includes('localhost')) {
      console.warn('⚠️  Production mode with localhost CORS origin detected');
    }
  }
  
  console.log('✅ Security configuration validated');
}

export default securityConfig; 