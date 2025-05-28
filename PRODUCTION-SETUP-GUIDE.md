# Production Setup Guide

This guide will help you deploy Aslan to production with PostgreSQL database and proper security configurations.

## 🔧 Prerequisites

- Node.js 18+ installed
- PostgreSQL 14+ installed and running
- A domain name with SSL certificate (aslanpay.xyz)
- Stripe production account
- Email service (SendGrid recommended)

## 📋 Step 1: Environment Setup

1. **Copy the production environment template:**
   ```bash
   cp env-production-template .env
   ```

2. **Configure your environment variables:**
   Edit `.env` and set all the required values:

   ### Critical Security Settings (MUST CHANGE!)
   ```env
   NODE_ENV=production
   JWT_SECRET=your_super_secure_jwt_secret_here_minimum_256_bits
   SESSION_SECRET=your_session_secret_change_in_production
   ```

   ### Database (PostgreSQL)
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/aslan_prod"
   ```

   ### Stripe Production Keys
   ```env
   STRIPE_SECRET_KEY="sk_live_..."
   STRIPE_PUBLISHABLE_KEY="pk_live_..."
   STRIPE_WEBHOOK_SECRET="whsec_..."
   ```

   ### CORS Origins
   ```env
   CORS_ORIGINS="https://aslanpay.xyz,https://www.aslanpay.xyz"
   ```

## 🗄️ Step 2: Database Setup

1. **Create PostgreSQL database:**
   ```sql
   CREATE DATABASE aslan_prod;
   CREATE USER aslan_user WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE aslan_prod TO aslan_user;
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Generate Prisma client:**
   ```bash
   npm run db:generate
   ```

4. **Run database migrations:**
   ```bash
   npm run db:migrate
   ```

## 🚀 Step 3: Application Deployment

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Start the production server:**
   ```bash
   npm start
   ```

   Or with PM2 for process management:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "aslan"
   pm2 startup
   pm2 save
   ```

## 🔒 Step 4: Security Configuration

### Nginx Reverse Proxy (Recommended)

Create `/etc/nginx/sites-available/aslan`:

```nginx
server {
    listen 80;
    server_name aslanpay.xyz www.aslanpay.xyz;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name aslanpay.xyz www.aslanpay.xyz;

    ssl_certificate /path/to/ssl/certificate.crt;
    ssl_certificate_key /path/to/ssl/private.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_dhparam /path/to/dhparam.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/aslan /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Firewall Configuration

```bash
# UFW firewall
sudo ufw enable
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw allow 5432  # PostgreSQL (only if external access needed)
```

## 📧 Step 5: Stripe Webhook Setup

1. **Configure Stripe webhooks:**
   - Go to your Stripe dashboard
   - Navigate to Developers > Webhooks
   - Add endpoint: `https://aslanpay.xyz/api/webhook`
   - Select events: `subscription.*`, `invoice.*`, `customer.*`
   - Copy the webhook secret to your `.env` file

## 📊 Step 6: Monitoring & Logging

### Application Monitoring
```bash
# Monitor with PM2
pm2 monit

# View logs
pm2 logs aslan
```

### Database Monitoring
```bash
# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log

# Database performance
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
```

### Health Check Endpoint
Monitor application health at: `https://aslanpay.xyz/api/health`

## 🔄 Step 7: Backup Strategy

### Database Backups
```bash
# Create backup script
cat > backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/aslan"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="aslan_prod"

mkdir -p $BACKUP_DIR
pg_dump $DB_NAME > $BACKUP_DIR/aslan_backup_$DATE.sql
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
EOF

chmod +x backup-db.sh

# Schedule daily backups
echo "0 2 * * * /path/to/backup-db.sh" | crontab -
```

## 🚨 Step 8: Verification

### Test Production Setup

1. **Health check:**
   ```bash
   curl https://aslanpay.xyz/api/health
   ```

2. **Database connectivity:**
   ```bash
   npm run db:studio
   ```

3. **Stripe integration:**
   ```bash
   curl -X POST https://aslanpay.xyz/api/setup-products
   ```

### Load Testing
```bash
# Install artillery for load testing
npm install -g artillery

# Create load test
cat > load-test.yml << 'EOF'
config:
  target: 'https://aslanpay.xyz'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "Health check"
    requests:
      - get:
          url: "/api/health"
EOF

# Run load test
artillery run load-test.yml
```

## 🔧 Troubleshooting

### Common Issues

1. **Database connection failed:**
   - Check PostgreSQL is running: `sudo systemctl status postgresql`
   - Verify connection string in `.env`
   - Check firewall rules

2. **Stripe webhook errors:**
   - Verify webhook secret matches Stripe dashboard
   - Check endpoint URL is accessible
   - Review webhook logs in Stripe dashboard

3. **Authentication issues:**
   - Ensure JWT_SECRET is set and secure
   - Check cookie settings for HTTPS
   - Verify CORS origins are correct

### Logs Location
- Application logs: `pm2 logs aslan`
- Nginx logs: `/var/log/nginx/`
- PostgreSQL logs: `/var/log/postgresql/`

## 📈 Performance Optimization

### Database Optimization
```sql
-- Add database indexes for better performance
CREATE INDEX CONCURRENTLY idx_api_keys_user_id ON api_keys(userId);
CREATE INDEX CONCURRENTLY idx_sessions_user_id ON sessions(userId);
CREATE INDEX CONCURRENTLY idx_transactions_user_id ON transactions(userId);
CREATE INDEX CONCURRENTLY idx_audit_logs_created_at ON audit_logs(createdAt);
```

### Application Tuning
- Enable Node.js clustering for multi-core support
- Configure Redis for session storage (optional)
- Set up CDN for static assets
- Enable gzip compression in Nginx

## 🔐 Security Checklist

- [ ] Strong JWT and session secrets set
- [ ] PostgreSQL access restricted
- [ ] HTTPS enabled with strong SSL configuration
- [ ] Firewall configured
- [ ] Regular security updates applied
- [ ] Stripe webhook endpoint secured
- [ ] CORS origins restricted to your domains
- [ ] Rate limiting enabled
- [ ] Audit logging enabled
- [ ] Regular backups scheduled

## 🎯 Production Monitoring

Set up monitoring for:
- Application uptime
- Database performance
- API response times
- Error rates
- Stripe webhook delivery
- SSL certificate expiration
- Disk space usage

## 📞 Support

For production support:
- Check logs first: `pm2 logs aslan`
- Database issues: Check PostgreSQL logs
- Stripe issues: Review Stripe dashboard
- SSL issues: Verify certificate validity

Your Aslan production deployment is now ready! 🎉 