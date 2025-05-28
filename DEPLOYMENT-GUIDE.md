# 🚀 AgentPay Production Deployment Guide

## 📋 **Prerequisites**

### **Required Services**
- [ ] **Stripe Account** (payment processing)
- [ ] **Lightning Node** (Voltage or self-hosted)
- [ ] **Twilio Account** (SMS/calling)
- [ ] **PostgreSQL Database** (production)
- [ ] **Redis Instance** (rate limiting)
- [ ] **Domain & SSL Certificate**

### **Optional Integrations**
- [ ] **Namecheap API** (domain registration)
- [ ] **DigitalOcean API** (VPS hosting)
- [ ] **Tango Card API** (gift cards)
- [ ] **AWS Marketplace** (credits)
- [ ] **Sentry** (error monitoring)

## 🔧 **Local Development Setup**

```bash
# 1. Clone and install
git clone https://github.com/your-org/agentpay
cd agentpay/agent-wallet
npm install

# 2. Database setup
npx prisma generate
npx prisma db push

# 3. Environment configuration
cp .env.example .env
# Fill in your API keys and secrets

# 4. Start development server
npm run dev
```

## 🚀 **Production Deployment**

### **1. Environment Configuration**

```bash
# Production .env file
NODE_ENV=production
PORT=3000
JWT_SECRET=your-super-long-random-secret-here

# Database (PostgreSQL recommended)
DATABASE_URL=postgresql://user:password@localhost:5432/agentpay

# Payments
STRIPE_SECRET_KEY=sk_live_your_live_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Lightning Network
LN_SOCKET=your-lightning-node:10009
LN_MACAROON=your_production_macaroon
LN_CERT_PATH=/certs/tls.cert

# Communications
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Service Integrations
NAMECHEAP_API_KEY=your_namecheap_key
DIGITALOCEAN_API_TOKEN=your_do_token
TANGO_API_KEY=your_tango_key

# Monitoring
SENTRY_DSN=your_sentry_dsn
LOG_LEVEL=info

# Security
CORS_ORIGIN=https://app.agentpay.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### **2. Docker Deployment**

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  agentpay:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/agentpay
    depends_on:
      - db
      - redis
    restart: unless-stopped
    
  db:
    image: postgres:14
    environment:
      POSTGRES_DB: agentpay
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - agentpay
    restart: unless-stopped

volumes:
  postgres_data:
```

### **3. Kubernetes Deployment**

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agentpay
spec:
  replicas: 3
  selector:
    matchLabels:
      app: agentpay
  template:
    metadata:
      labels:
        app: agentpay
    spec:
      containers:
      - name: agentpay
        image: agentpay:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: agentpay-secrets
              key: database-url
        - name: STRIPE_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: agentpay-secrets
              key: stripe-secret
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

## 🔒 **Security Hardening**

### **1. Rate Limiting (Redis)**

```typescript
// config/redis.ts
import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL);

// Enhanced rate limiting with Redis
export class RedisRateLimit {
  static async checkLimit(key: string, limit: number, window: number): Promise<boolean> {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, window);
    }
    return current <= limit;
  }
}
```

### **2. Environment Variable Validation**

```typescript
// config/validation.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  LN_SOCKET: z.string().includes(':'),
  LN_MACAROON: z.string().min(50)
});

export const env = envSchema.parse(process.env);
```

### **3. API Key Management**

```typescript
// middleware/apiKeys.ts
export class ApiKeyManager {
  static async validateApiKey(req: Request, res: Response, next: NextFunction) {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }
    
    // Validate against database
    const validKey = await prisma.apiKey.findUnique({
      where: { key: apiKey as string, isActive: true }
    });
    
    if (!validKey) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    // Rate limit by API key
    const allowed = await RedisRateLimit.checkLimit(
      `api:${apiKey}`, 
      validKey.rateLimit, 
      3600
    );
    
    if (!allowed) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    
    req.apiKey = validKey;
    next();
  }
}
```

## 📊 **Monitoring & Observability**

### **1. Health Checks**

```typescript
// routes/health.ts
router.get('/health', async (req, res) => {
  const checks = {
    database: false,
    lightning: false,
    stripe: false,
    redis: false
  };
  
  try {
    // Database check
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
    
    // Lightning node check
    if (lnd) {
      await getWalletInfo({ lnd });
      checks.lightning = true;
    }
    
    // Stripe check
    await stripe.balance.retrieve();
    checks.stripe = true;
    
    // Redis check
    await redis.ping();
    checks.redis = true;
    
  } catch (error) {
    console.error('Health check failed:', error);
  }
  
  const healthy = Object.values(checks).every(Boolean);
  
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version
  });
});
```

### **2. Metrics Collection**

```typescript
// middleware/metrics.ts
import prometheus from 'prom-client';

// Define metrics
const httpRequests = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status']
});

const transactionCount = new prometheus.Counter({
  name: 'transactions_total',
  help: 'Total transactions processed',
  labelNames: ['type', 'status']
});

const transactionValue = new prometheus.Histogram({
  name: 'transaction_value_usd',
  help: 'Transaction values in USD',
  buckets: [0.01, 0.1, 1, 10, 100, 1000]
});

export { httpRequests, transactionCount, transactionValue };
```

## 🚨 **Error Handling & Logging**

### **1. Structured Logging**

```typescript
// utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

### **2. Sentry Integration**

```typescript
// utils/sentry.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1
});

export { Sentry };
```

## 🔄 **Database Migrations**

```bash
# Production migration workflow
npx prisma migrate deploy
npx prisma generate
```

## 📈 **Performance Optimization**

### **1. Database Indexing**

```sql
-- Add indexes for performance
CREATE INDEX idx_payments_agent_created ON payments(agent_id, created_at);
CREATE INDEX idx_payments_wallet_status ON payments(wallet_id, status);
CREATE INDEX idx_agents_wallet ON agents(wallet_id);
```

### **2. Connection Pooling**

```typescript
// config/database.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['query'] : ['error']
});
```

## 🛡️ **Backup Strategy**

```bash
# Daily database backup
#!/bin/bash
pg_dump $DATABASE_URL > "backup-$(date +%Y%m%d).sql"
aws s3 cp "backup-$(date +%Y%m%d).sql" s3://agentpay-backups/
```

## 📋 **Deployment Checklist**

### **Pre-Deployment**
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database migrations run
- [ ] Health checks passing
- [ ] Load testing completed
- [ ] Security scan passed

### **Post-Deployment**
- [ ] Monitor error rates
- [ ] Check transaction success rates
- [ ] Verify Lightning node connectivity
- [ ] Test payment flows
- [ ] Monitor resource usage
- [ ] Update documentation

## 🔍 **Troubleshooting**

### **Common Issues**

1. **Lightning Node Connection Failed**
   ```bash
   # Check connectivity
   curl -k https://your-node:10009
   # Verify macaroon permissions
   ```

2. **Database Connection Issues**
   ```bash
   # Test connection
   psql $DATABASE_URL -c "SELECT 1"
   # Check connection pool
   ```

3. **High Memory Usage**
   ```bash
   # Monitor Node.js heap
   node --inspect app.js
   # Check for memory leaks
   ```

---

## 📞 **Support**

- **Documentation**: https://docs.agentpay.com
- **Discord**: https://discord.gg/agentpay
- **Email**: support@agentpay.com
- **Status Page**: https://status.agentpay.com 