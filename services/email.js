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
     * Send welcome email
     */
    async sendWelcomeEmail(email, name) {
        const subject = 'Welcome to Aslan!';
        
        const html = this.getWelcomeEmailTemplate(name);
        const text = this.getWelcomeEmailText(name);

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

    getWelcomeEmailTemplate(name) {
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
                .button { display: inline-block; background: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                .logo { font-size: 24px; font-weight: bold; }
                .feature { margin: 15px 0; padding: 10px; background: white; border-radius: 4px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🦁 Aslan</div>
                    <h1>Welcome to Aslan!</h1>
                </div>
                <div class="content">
                    <h2>Hi ${name || 'there'}!</h2>
                    <p>Welcome to Aslan, the payment infrastructure for AI agents. You're now ready to enable autonomous transactions for your AI systems.</p>
                    
                    <h3>🚀 What you can do now:</h3>
                    <div class="feature">
                        <strong>🔧 Set up your first AI agent</strong><br>
                        Configure spending limits and payment controls
                    </div>
                    <div class="feature">
                        <strong>💳 Add payment methods</strong><br>
                        Securely store cards for autonomous transactions
                    </div>
                    <div class="feature">
                        <strong>📊 Monitor transactions</strong><br>
                        Real-time analytics and spending insights
                    </div>
                    
                    <p>Ready to get started?</p>
                    <a href="https://aslanpay.xyz/demo" class="button">Try the Demo</a>
                    <a href="https://aslanpay.xyz/docs" class="button">View Documentation</a>
                    
                    <p>If you have any questions, our team is here to help at support@aslanpay.xyz</p>
                </div>
                <div class="footer">
                    <p>© 2024 Aslan Technologies. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    getWelcomeEmailText(name) {
        return `
Welcome to Aslan!

Hi ${name || 'there'}!

Welcome to Aslan, the payment infrastructure for AI agents. You're now ready to enable autonomous transactions for your AI systems.

What you can do now:
- Set up your first AI agent with spending limits and payment controls
- Add payment methods securely for autonomous transactions  
- Monitor transactions with real-time analytics and spending insights

Get started:
Demo: https://aslanpay.xyz/demo
Documentation: https://aslanpay.xyz/docs

If you have any questions, our team is here to help at support@aslanpay.xyz

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

module.exports = EmailService; 