#!/bin/bash

# SSL Setup Script for Aslan (aslanpay.xyz)
# This script sets up SSL certificates using Let's Encrypt

set -e  # Exit on any error

echo "🔒 Setting up SSL for Aslan (aslanpay.xyz)"
echo "============================================"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Domain configuration
DOMAIN="aslanpay.xyz"
DOMAIN_WWW="www.aslanpay.xyz"
EMAIL="support@aslanpay.xyz"

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run this script as root (sudo)"
    exit 1
fi

# Check if domain is pointing to this server
print_status "Checking DNS configuration..."
SERVER_IP=$(curl -s ifconfig.me)
DOMAIN_IP=$(dig +short $DOMAIN)

if [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
    print_warning "DNS may not be properly configured"
    print_warning "Server IP: $SERVER_IP"
    print_warning "Domain IP: $DOMAIN_IP"
    echo "Continue anyway? (y/n)"
    read -r response
    if [ "$response" != "y" ]; then
        exit 1
    fi
fi

# Install Certbot if not installed
if ! command -v certbot &> /dev/null; then
    print_status "Installing Certbot..."
    
    # For Ubuntu/Debian
    if command -v apt &> /dev/null; then
        apt update
        apt install -y certbot python3-certbot-nginx
    # For CentOS/RHEL
    elif command -v yum &> /dev/null; then
        yum install -y epel-release
        yum install -y certbot python3-certbot-nginx
    else
        print_error "Unsupported package manager. Please install certbot manually."
        exit 1
    fi
fi

# Install Nginx if not installed
if ! command -v nginx &> /dev/null; then
    print_status "Installing Nginx..."
    
    if command -v apt &> /dev/null; then
        apt install -y nginx
    elif command -v yum &> /dev/null; then
        yum install -y nginx
    fi
    
    systemctl start nginx
    systemctl enable nginx
fi

# Create basic Nginx configuration
print_status "Creating Nginx configuration..."

cat > /etc/nginx/sites-available/aslan << EOF
server {
    listen 80;
    server_name $DOMAIN $DOMAIN_WWW;
    
    # Let's Encrypt challenge location
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN $DOMAIN_WWW;
    
    # SSL configuration will be added by Certbot
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";
    
    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # API rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}

# Rate limiting zones
http {
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
}
EOF

# Enable the site
if [ ! -L /etc/nginx/sites-enabled/aslan ]; then
    ln -s /etc/nginx/sites-available/aslan /etc/nginx/sites-enabled/
fi

# Remove default site if it exists
if [ -L /etc/nginx/sites-enabled/default ]; then
    rm /etc/nginx/sites-enabled/default
fi

# Test Nginx configuration
print_status "Testing Nginx configuration..."
nginx -t

if [ $? -ne 0 ]; then
    print_error "Nginx configuration test failed"
    exit 1
fi

# Reload Nginx
systemctl reload nginx

# Obtain SSL certificate
print_status "Obtaining SSL certificate from Let's Encrypt..."

certbot --nginx \
    -d $DOMAIN \
    -d $DOMAIN_WWW \
    --email $EMAIL \
    --agree-tos \
    --non-interactive \
    --redirect

if [ $? -eq 0 ]; then
    print_status "SSL certificate obtained successfully!"
else
    print_error "Failed to obtain SSL certificate"
    exit 1
fi

# Set up automatic renewal
print_status "Setting up automatic certificate renewal..."

# Add renewal cron job if it doesn't exist
if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
fi

# Test automatic renewal
certbot renew --dry-run

if [ $? -eq 0 ]; then
    print_status "Automatic renewal test passed!"
else
    print_warning "Automatic renewal test failed - please check manually"
fi

# Create SSL status check script
cat > /usr/local/bin/ssl-status.sh << 'EOF'
#!/bin/bash

DOMAIN="aslanpay.xyz"
CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"

if [ -f "$CERT_PATH" ]; then
    EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_PATH" | cut -d= -f2)
    EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
    CURRENT_EPOCH=$(date +%s)
    DAYS_UNTIL_EXPIRY=$(( (EXPIRY_EPOCH - CURRENT_EPOCH) / 86400 ))
    
    echo "SSL Certificate Status for $DOMAIN:"
    echo "Expires: $EXPIRY"
    echo "Days until expiry: $DAYS_UNTIL_EXPIRY"
    
    if [ $DAYS_UNTIL_EXPIRY -lt 30 ]; then
        echo "⚠️  Certificate expires soon!"
    else
        echo "✅ Certificate is valid"
    fi
else
    echo "❌ SSL certificate not found"
fi
EOF

chmod +x /usr/local/bin/ssl-status.sh

# Final status
echo ""
print_status "SSL setup completed successfully!"
echo ""
echo "🔒 Your Aslan application is now secured with SSL:"
echo "   • Primary domain: https://$DOMAIN"
echo "   • WWW domain: https://$DOMAIN_WWW"
echo "   • Automatic renewal: Enabled"
echo ""
echo "📋 Useful commands:"
echo "   • Check SSL status: /usr/local/bin/ssl-status.sh"
echo "   • Test renewal: sudo certbot renew --dry-run"
echo "   • View certificates: sudo certbot certificates"
echo ""
echo "🦁 Your Aslan application is now ready for production!" 