// Email service with multiple provider support
// Supports: Resend (recommended), SendGrid, Nodemailer (SMTP), Console (development)

const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.providers = this.initializeProviders();
        this.currentProvider = 0;
    }

    initializeProviders() {
        const providers = [];

        // SendGrid configuration
        if (process.env.SENDGRID_API_KEY) {
            providers.push({
                name: 'SendGrid',
                type: 'sendgrid',
                config: {
                    service: 'SendGrid',
                    auth: {
                        user: 'apikey',
                        pass: process.env.SENDGRID_API_KEY
                    }
                }
            });
        }

        // Mailgun configuration
        if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
            providers.push({
                name: 'Mailgun',
                type: 'mailgun',
                config: {
                    service: 'Mailgun',
                    auth: {
                        user: process.env.MAILGUN_USERNAME || 'postmaster@' + process.env.MAILGUN_DOMAIN,
                        pass: process.env.MAILGUN_API_KEY
                    }
                }
            });
        }

        // Generic SMTP configuration
        if (process.env.SMTP_HOST) {
            providers.push({
                name: 'SMTP',
                type: 'smtp',
                config: {
                    host: process.env.SMTP_HOST,
                    port: process.env.SMTP_PORT || 587,
                    secure: process.env.SMTP_SECURE === 'true',
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                }
            });
        }

        // Console fallback (for development)
        providers.push({
            name: 'Console',
            type: 'console',
            config: {}
        });

        return providers;
    }

    async createTransporter(provider) {
        if (provider.type === 'console') {
            return {
                sendMail: async (mailOptions) => {
                    console.log('\n📧 EMAIL WOULD BE SENT:');
                    console.log('From:', mailOptions.from);
                    console.log('To:', mailOptions.to);
                    console.log('Subject:', mailOptions.subject);
                    console.log('Content:', mailOptions.text || 'HTML content provided');
                    console.log('---\n');
                    return { messageId: 'console-' + Date.now() };
                }
            };
        }

        return nodemailer.createTransporter(provider.config);
    }

    /**
     * Send email with automatic provider fallback
     */
    async sendEmail(options) {
        const { to, subject, text, html } = options;
        
        const fromEmail = process.env.FROM_EMAIL || 'noreply@aslanpay.xyz';
        const fromName = process.env.FROM_NAME || 'Aslan';

        const mailOptions = {
            from: `${fromName} <${fromEmail}>`,
            to,
            subject,
            text,
            html
        };

        // Try each provider in order
        for (let i = 0; i < this.providers.length; i++) {
            const providerIndex = (this.currentProvider + i) % this.providers.length;
            const provider = this.providers[providerIndex];

            try {
                console.log(`📧 Attempting to send email via ${provider.name}...`);
                
                const transporter = await this.createTransporter(provider);
                const result = await transporter.sendMail(mailOptions);
                
                console.log(`✅ Email sent successfully via ${provider.name}`);
                
                // Update current provider to this successful one
                this.currentProvider = providerIndex;
                
                return {
                    success: true,
                    provider: provider.name,
                    messageId: result.messageId
                };

            } catch (error) {
                console.error(`❌ Failed to send via ${provider.name}:`, error.message);
                
                // If this is the last provider, throw the error
                if (i === this.providers.length - 1) {
                    throw new Error(`All email providers failed. Last error: ${error.message}`);
                }
                
                // Continue to next provider
                continue;
            }
        }
    }

    /**
     * Send email verification
     */
    async sendVerificationEmail(email, token) {
        const subject = 'Verify your Aslan account';
        const verificationUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
        
        const html = this.getVerificationEmailTemplate(verificationUrl);
        const text = this.getVerificationEmailText(verificationUrl);

        return this.sendEmail({
            to: email,
            subject,
            html,
            text
        });
    }

    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(email, token) {
        const subject = 'Reset your Aslan password';
        const resetUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
        
        const html = this.getPasswordResetTemplate(resetUrl);
        const text = this.getPasswordResetText(resetUrl);

        return this.sendEmail({
            to: email,
            subject,
            html,
            text
        });
    }

    /**
     * Send welcome email (SaaS version with API key)
     */
    async sendWelcomeEmail(email, name, options = {}) {
        const { apiKey, organizationName, dashboardUrl } = options;
        const subject = apiKey ? '🦁 Welcome to Aslan! Your API key is ready' : 'Welcome to Aslan!';
        
        const html = this.getWelcomeEmailTemplate(name, options);
        const text = this.getWelcomeEmailText(name, options);

        return this.sendEmail({
            to: email,
            subject,
            html,
            text
        });
    }

    // Email Templates

    getVerificationEmailTemplate(verificationUrl) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Verify Your Email</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f9f9; padding: 30px 20px; border-radius: 0 0 8px 8px; }
                .button { display: inline-block; background: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                .logo { font-size: 24px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🦁 Aslan</div>
                </div>
                <div class="content">
                    <h2>Verify Your Email Address</h2>
                    <p>Thanks for signing up for Aslan! Please verify your email address to complete your account setup.</p>
                    <p>Click the button below to verify your email:</p>
                    <a href="${verificationUrl}" class="button">Verify Email Address</a>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
                    <p>This link will expire in 24 hours.</p>
                </div>
                <div class="footer">
                    <p>© 2024 Aslan Technologies. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    getVerificationEmailText(verificationUrl) {
        return `
Verify Your Email Address

Thanks for signing up for Aslan! Please verify your email address to complete your account setup.

Visit this link to verify your email:
${verificationUrl}

This link will expire in 24 hours.

© 2024 Aslan Technologies. All rights reserved.
        `.trim();
    }

    getPasswordResetTemplate(resetUrl) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Reset Your Password</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f9f9; padding: 30px 20px; border-radius: 0 0 8px 8px; }
                .button { display: inline-block; background: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                .logo { font-size: 24px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🦁 Aslan</div>
                </div>
                <div class="content">
                    <h2>Reset Your Password</h2>
                    <p>We received a request to reset your password for your Aslan account.</p>
                    <p>Click the button below to reset your password:</p>
                    <a href="${resetUrl}" class="button">Reset Password</a>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #666;">${resetUrl}</p>
                    <p>This link will expire in 1 hour.</p>
                    <p>If you didn't request a password reset, you can safely ignore this email.</p>
                </div>
                <div class="footer">
                    <p>© 2024 Aslan Technologies. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    getPasswordResetText(resetUrl) {
        return `
Reset Your Password

We received a request to reset your password for your Aslan account.

Visit this link to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

© 2024 Aslan Technologies. All rights reserved.
        `.trim();
    }

    getWelcomeEmailTemplate(name, options = {}) {
        const { apiKey, organizationName, dashboardUrl } = options;
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Welcome to Aslan</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f9f9; padding: 30px 20px; border-radius: 0 0 8px 8px; }
                .button { display: inline-block; background: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
                .button-secondary { display: inline-block; background: white; color: #333; border: 2px solid #ddd; padding: 10px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                .logo { font-size: 24px; font-weight: bold; }
                .feature { margin: 15px 0; padding: 10px; background: white; border-radius: 4px; }
                .api-key-box { background: #e8f4fd; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; border-radius: 4px; }
                .code-block { background: #1a1a1a; color: #e2e8f0; padding: 15px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 12px; word-break: break-all; margin: 15px 0; }
                .warning-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🦁 Aslan</div>
                    <h1>Welcome to Aslan!</h1>
                </div>
                <div class="content">
                    <h2>Hi ${name || 'there'}! 👋</h2>
                    <p>Welcome to Aslan! Your account for <strong>${organizationName || 'your organization'}</strong> is ready to process payments. 🎉</p>
                    
                    ${apiKey ? `
                    <div class="api-key-box">
                        <h3 style="color: #1976D2; margin: 0 0 10px 0; font-size: 16px;">🔑 Your API Key</h3>
                        <p style="margin: 0 0 10px 0; font-size: 14px;">Here's your production-ready API key. Keep it secure!</p>
                        <div class="code-block">${apiKey}</div>
                        <p style="color: #666; font-size: 12px; margin: 0;">⚠️ This is the only time you'll see this key. Save it somewhere safe!</p>
                    </div>
                    
                    <p>You can start processing payments immediately:</p>
                    <div class="code-block">curl -X POST https://api.aslanpay.com/v1/authorize \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "amount": 2500,
    "description": "My first payment"
  }'</div>
                    ` : ''}
                    
                    <h3>🚀 What you can do now:</h3>
                    <div class="feature">
                        <strong>⚡ Start Processing Payments</strong><br>
                        Use your API key to authorize payments instantly
                    </div>
                    <div class="feature">
                        <strong>📊 Monitor Your Dashboard</strong><br>
                        Track transactions, usage, and analytics in real-time
                    </div>
                    <div class="feature">
                        <strong>🛡️ Enterprise Security</strong><br>
                        Bank-grade security with PCI compliance built-in
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${dashboardUrl || baseUrl + '/dashboard.html'}" class="button">Go to Dashboard 🚀</a>
                        <a href="${baseUrl}/docs.html" class="button-secondary">View Docs 📚</a>
                    </div>
                    
                    ${apiKey ? `
                    <div class="warning-box">
                        <h4 style="color: #856404; margin: 0 0 8px 0; font-size: 14px;">🎁 Free Sandbox Account</h4>
                        <p style="color: #856404; font-size: 13px; margin: 0;">
                            Your account starts with $100/day spending limit for testing. 
                            <a href="${baseUrl}/#pricing" style="color: #856404;">Upgrade to Production</a> for unlimited processing.
                        </p>
                    </div>
                    ` : ''}
                    
                    <p>Need help? Check out our <a href="${baseUrl}/docs.html">documentation</a>, try our <a href="${baseUrl}/demo.html">live demo</a>, or reply to this email.</p>
                    
                    <p style="margin-top: 30px;">
                        Best regards,<br>
                        The Aslan Team 🦁<br>
                        <em>Built for the AI-first future</em>
                    </p>
                </div>
                <div class="footer">
                    <p>© 2024 Aslan Technologies. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    getWelcomeEmailText(name, options = {}) {
        const { apiKey, organizationName, dashboardUrl } = options;
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        
        return `
Welcome to Aslan! 🦁

Hi ${name || 'there'}!

Welcome to Aslan! Your account for ${organizationName || 'your organization'} is ready to process payments.

${apiKey ? `
🔑 Your API Key: ${apiKey}
⚠️  This is the only time you'll see this key. Save it somewhere safe!

Start processing payments immediately:
curl -X POST https://api.aslanpay.com/v1/authorize \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{"amount": 2500, "description": "My first payment"}'
` : ''}

🚀 What you can do now:
- Start processing payments with your API key
- Monitor your dashboard for real-time analytics
- Enjoy enterprise-grade security with PCI compliance

Get started:
Dashboard: ${dashboardUrl || baseUrl + '/dashboard.html'}
Documentation: ${baseUrl}/docs.html
Demo: ${baseUrl}/demo.html

${apiKey ? `
🎁 Your account starts with $100/day spending limit for testing.
Upgrade to Production for unlimited processing: ${baseUrl}/#pricing
` : ''}

Need help? Check out our documentation or reply to this email.

Best regards,
The Aslan Team 🦁
Built for the AI-first future

© 2024 Aslan Technologies. All rights reserved.
        `.trim();
    }

    /**
     * Test email configuration
     */
    async testConfiguration() {
        console.log('🧪 Testing email configuration...');
        console.log(`📧 Available providers: ${this.providers.map(p => p.name).join(', ')}`);
        
        try {
            const result = await this.sendEmail({
                to: 'test@example.com',
                subject: 'Aslan Email Service Test',
                text: 'This is a test email from Aslan email service.',
                html: '<h1>Test Email</h1><p>This is a test email from Aslan email service.</p>'
            });
            
            console.log('✅ Email configuration test successful!');
            return result;
        } catch (error) {
            console.error('❌ Email configuration test failed:', error.message);
            throw error;
        }
    }
}

// Export a singleton instance
module.exports = new EmailService(); 