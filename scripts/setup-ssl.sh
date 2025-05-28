#!/bin/bash

# SSL Certificate Setup with Let's Encrypt for AslanPay
# Updated for aslanpay.xyz domain

DOMAIN="aslanpay.xyz"

echo "🔒 Setting up SSL certificate for ${DOMAIN}"

# Install certbot if not already installed
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing certbot..."
    sudo apt update
    sudo apt install -y certbot python3-certbot-nginx
fi

# Obtain certificate for both root domain and www subdomain
echo "📜 Obtaining SSL certificate..."
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --agree-tos --non-interactive

# Setup auto-renewal
echo "🔄 Setting up automatic renewal..."
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -

# Test renewal process
echo "🧪 Testing renewal process..."
sudo certbot renew --dry-run

echo "✅ SSL certificate setup complete for ${DOMAIN}"
echo ""
echo "🌐 Your site should now be available at:"
echo "   • https://${DOMAIN}"
echo "   • https://www.${DOMAIN}"
echo ""
echo "🔄 Certificate will auto-renew every 12 hours" 