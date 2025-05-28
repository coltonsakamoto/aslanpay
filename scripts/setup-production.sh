#!/bin/bash

# AgentPay Production Setup Script
# This script automates the basic setup for production deployment

set -e  # Exit on any error

echo "🚀 AgentPay Production Setup"
echo "=============================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -c2-)
REQUIRED_VERSION="18.0.0"
if ! printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V -C; then
    print_error "Node.js version $NODE_VERSION is too old. Please upgrade to 18+."
    exit 1
fi

print_status "Node.js version: $NODE_VERSION ✓"

# Check if PostgreSQL is available
if ! command -v psql &> /dev/null; then
    print_warning "PostgreSQL is not installed. Please install PostgreSQL 14+ for production."
fi

# Check if .env file exists
if [ ! -f .env ]; then
    if [ -f env-production-template ]; then
        print_status "Creating .env from template..."
        cp env-production-template .env
        print_warning "Please edit .env file with your actual production values!"
        print_warning "IMPORTANT: Change JWT_SECRET and SESSION_SECRET!"
    else
        print_error ".env file not found and no template available"
        exit 1
    fi
else
    print_status ".env file exists ✓"
fi

# Install dependencies
print_status "Installing Node.js dependencies..."
npm install

# Generate Prisma client
print_status "Generating Prisma client..."
npm run db:generate

# Check if DATABASE_URL is set for production
if [ "$NODE_ENV" = "production" ]; then
    if ! grep -q "postgresql://" .env; then
        print_warning "DATABASE_URL not set for PostgreSQL in .env"
        print_warning "Please update DATABASE_URL for production deployment"
    fi
fi

# Build application
print_status "Building application..."
npm run build

# Create PM2 ecosystem file
print_status "Creating PM2 ecosystem file..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'agentpay',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G'
  }]
}
EOF

# Create logs directory
mkdir -p logs

# Create systemd service file
print_status "Creating systemd service file..."
cat > agentpay.service << 'EOF'
[Unit]
Description=AgentPay Application
After=network.target postgresql.service

[Service]
Type=forking
User=nodejs
WorkingDirectory=/path/to/agentpay
ExecStart=/usr/bin/pm2 start ecosystem.config.js --env production
ExecReload=/usr/bin/pm2 reload ecosystem.config.js --env production
ExecStop=/usr/bin/pm2 stop ecosystem.config.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

print_status "Service file created: agentpay.service"
print_warning "Update WorkingDirectory in agentpay.service before installing"

# Create backup script
print_status "Creating backup script..."
mkdir -p scripts

cat > scripts/backup-database.sh << 'EOF'
#!/bin/bash

# AgentPay Database Backup Script
# Run this daily to backup your PostgreSQL database

BACKUP_DIR="/backups/agentpay"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="agentpay_prod"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
pg_dump $DB_NAME > $BACKUP_DIR/agentpay_backup_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/agentpay_backup_$DATE.sql

# Remove backups older than 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: agentpay_backup_$DATE.sql.gz"
EOF

chmod +x scripts/backup-database.sh

# Create monitoring script
cat > scripts/health-check.sh << 'EOF'
#!/bin/bash

# AgentPay Health Check Script
# Use this to monitor your application

HEALTH_URL="http://localhost:3000/api/health"

response=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $response -eq 200 ]; then
    echo "✅ AgentPay is healthy"
    exit 0
else
    echo "❌ AgentPay health check failed (HTTP $response)"
    exit 1
fi
EOF

chmod +x scripts/health-check.sh

# Create SSL certificate script
cat > scripts/setup-ssl.sh << 'EOF'
#!/bin/bash

# SSL Certificate Setup with Let's Encrypt
# Replace 'yourdomain.com' with your actual domain

DOMAIN="yourdomain.com"

# Install certbot
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN

# Setup auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -

echo "SSL certificate setup complete for $DOMAIN"
EOF

chmod +x scripts/setup-ssl.sh

# Check security settings
print_status "Checking security configuration..."

# Check JWT secret
if grep -q "your_super_secure_jwt_secret_here" .env; then
    print_error "JWT_SECRET is still using default value! Please change it."
fi

if grep -q "your_session_secret_change_in_production" .env; then
    print_error "SESSION_SECRET is still using default value! Please change it."
fi

# Security recommendations
print_status "Setup completed! 🎉"
echo ""
print_warning "IMPORTANT: Next steps before going live:"
echo "1. Edit .env with your actual production values"
echo "2. Set strong JWT_SECRET and SESSION_SECRET (use: openssl rand -hex 32)"
echo "3. Configure PostgreSQL database and update DATABASE_URL"
echo "4. Set your Stripe production keys"
echo "5. Update CORS_ORIGINS with your domain"
echo "6. Run database migrations: npm run db:migrate"
echo "7. Install and configure Nginx reverse proxy"
echo "8. Setup SSL certificates with scripts/setup-ssl.sh"
echo "9. Install systemd service: sudo cp agentpay.service /etc/systemd/system/"
echo "10. Enable and start service: sudo systemctl enable agentpay && sudo systemctl start agentpay"
echo ""
print_status "For detailed instructions, see: PRODUCTION-SETUP-GUIDE.md"
echo ""
print_status "To start in development mode: npm run dev"
print_status "To start in production mode: pm2 start ecosystem.config.js"
echo ""
print_status "Useful commands:"
echo "- Health check: scripts/health-check.sh"
echo "- Database backup: scripts/backup-database.sh"
echo "- View logs: pm2 logs agentpay"
echo "- Monitor: pm2 monit" 