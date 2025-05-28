// Email service with multiple provider support
// Supports: Resend (recommended), SendGrid, Nodemailer (SMTP), Console (development)

class EmailService {
    constructor() {
        this.provider = this.detectProvider();
        this.initializeProvider();
    }

    detectProvider() {
        if (process.env.RESEND_API_KEY) return 'resend';
        if (process.env.SENDGRID_API_KEY) return 'sendgrid';
        if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return 'smtp';
        return 'console'; // Development fallback
    }

    initializeProvider() {
        switch (this.provider) {
            case 'resend':
                this.initializeResend();
                break;
            case 'sendgrid':
                this.initializeSendGrid();
                break;
            case 'smtp':
                this.initializeNodemailer();
                break;
            case 'console':
                console.log('📧 Email service: Using console output (development mode)');
                console.log('   Set RESEND_API_KEY, SENDGRID_API_KEY, or SMTP credentials for production');
                break;
        }
    }

    initializeResend() {
        try {
            const { Resend } = require('resend');
            this.resend = new Resend(process.env.RESEND_API_KEY);
            console.log('📧 Email service: Resend initialized');
        } catch (error) {
            console.warn('⚠️  Resend not available, falling back to console output');
            this.provider = 'console';
        }
    }

    initializeSendGrid() {
        try {
            const sgMail = require('@sendgrid/mail');
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            this.sendgrid = sgMail;
            console.log('📧 Email service: SendGrid initialized');
        } catch (error) {
            console.warn('⚠️  SendGrid not available, falling back to console output');
            this.provider = 'console';
        }
    }

    initializeNodemailer() {
        try {
            const nodemailer = require('nodemailer');
            this.transporter = nodemailer.createTransporter({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });
            console.log('📧 Email service: SMTP (Nodemailer) initialized');
        } catch (error) {
            console.warn('⚠️  SMTP not available, falling back to console output');
            this.provider = 'console';
        }
    }

    async sendVerificationEmail(email, token) {
        const subject = 'Verify your Autonomy account';
        const verificationLink = `${this.getBaseUrl()}/verify-email?token=${token}`;
        
        const html = this.generateVerificationEmailHTML(verificationLink);
        const text = this.generateVerificationEmailText(verificationLink);

        return await this.sendEmail({
            to: email,
            subject,
            html,
            text
        });
    }

    async sendPasswordResetEmail(email, token) {
        const subject = 'Reset your Autonomy password';
        const resetLink = `${this.getBaseUrl()}/reset-password?token=${token}`;
        
        const html = this.generatePasswordResetEmailHTML(resetLink);
        const text = this.generatePasswordResetEmailText(resetLink);

        return await this.sendEmail({
            to: email,
            subject,
            html,
            text
        });
    }

    async sendWelcomeEmail(email, name) {
        const subject = 'Welcome to Autonomy!';
        const dashboardLink = `${this.getBaseUrl()}/dashboard.html`;
        
        const html = this.generateWelcomeEmailHTML(name, dashboardLink);
        const text = this.generateWelcomeEmailText(name, dashboardLink);

        return await this.sendEmail({
            to: email,
            subject,
            html,
            text
        });
    }

    async sendEmail({ to, subject, html, text }) {
        const fromEmail = process.env.FROM_EMAIL || 'noreply@useautonomy.co';
        const fromName = process.env.FROM_NAME || 'Autonomy';

        switch (this.provider) {
            case 'resend':
                return await this.sendWithResend({ from: `${fromName} <${fromEmail}>`, to, subject, html, text });
            case 'sendgrid':
                return await this.sendWithSendGrid({ from: { email: fromEmail, name: fromName }, to, subject, html, text });
            case 'smtp':
                return await this.sendWithNodemailer({ from: `${fromName} <${fromEmail}>`, to, subject, html, text });
            case 'console':
                return this.sendWithConsole({ to, subject, html, text });
        }
    }

    async sendWithResend({ from, to, subject, html, text }) {
        try {
            const result = await this.resend.emails.send({
                from,
                to,
                subject,
                html,
                text
            });
            console.log(`📧 Email sent via Resend to ${to}: ${subject}`);
            return result;
        } catch (error) {
            console.error('❌ Resend email error:', error);
            throw error;
        }
    }

    async sendWithSendGrid({ from, to, subject, html, text }) {
        try {
            const msg = {
                to,
                from,
                subject,
                text,
                html
            };
            await this.sendgrid.send(msg);
            console.log(`📧 Email sent via SendGrid to ${to}: ${subject}`);
            return true;
        } catch (error) {
            console.error('❌ SendGrid email error:', error);
            throw error;
        }
    }

    async sendWithNodemailer({ from, to, subject, html, text }) {
        try {
            const result = await this.transporter.sendMail({
                from,
                to,
                subject,
                text,
                html
            });
            console.log(`📧 Email sent via SMTP to ${to}: ${subject}`);
            return result;
        } catch (error) {
            console.error('❌ SMTP email error:', error);
            throw error;
        }
    }

    sendWithConsole({ to, subject, html, text }) {
        console.log(`\n📧 Email (${this.provider}): ${subject}`);
        console.log(`📮 To: ${to}`);
        console.log(`📝 Text: ${text}`);
        console.log(`🔗 (In production, this would be sent via email provider)\n`);
        return true;
    }

    getBaseUrl() {
        return process.env.BASE_URL || 'http://localhost:3000';
    }

    // Email Templates
    generateVerificationEmailHTML(verificationLink) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
                .header { background: #0066FF; color: white; padding: 20px; text-align: center; }
                .content { padding: 30px; background: #f9f9f9; }
                .button { background: #0066FF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; }
                .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Autonomy</h1>
                </div>
                <div class="content">
                    <h2>Verify Your Email Address</h2>
                    <p>Thanks for signing up for Autonomy! Please verify your email address to complete your account setup.</p>
                    <p>
                        <a href="${verificationLink}" class="button">Verify Email Address</a>
                    </p>
                    <p>Or copy and paste this link: <br>
                    <a href="${verificationLink}">${verificationLink}</a></p>
                    <p>This link will expire in 24 hours.</p>
                </div>
                <div class="footer">
                    <p>© 2024 Autonomy Inc. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>`;
    }

    generateVerificationEmailText(verificationLink) {
        return `
Verify Your Email Address

Thanks for signing up for Autonomy! Please verify your email address to complete your account setup.

Click here to verify: ${verificationLink}

This link will expire in 24 hours.

---
© 2024 Autonomy Inc. All rights reserved.
        `.trim();
    }

    generatePasswordResetEmailHTML(resetLink) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
                .header { background: #0066FF; color: white; padding: 20px; text-align: center; }
                .content { padding: 30px; background: #f9f9f9; }
                .button { background: #0066FF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; }
                .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
                .warning { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 6px; margin: 15px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Autonomy</h1>
                </div>
                <div class="content">
                    <h2>Reset Your Password</h2>
                    <p>We received a request to reset your password for your Autonomy account.</p>
                    <p>
                        <a href="${resetLink}" class="button">Reset Password</a>
                    </p>
                    <p>Or copy and paste this link: <br>
                    <a href="${resetLink}">${resetLink}</a></p>
                    <div class="warning">
                        <strong>Security Note:</strong> This link will expire in 1 hour. If you didn't request this reset, please ignore this email.
                    </div>
                </div>
                <div class="footer">
                    <p>© 2024 Autonomy Inc. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>`;
    }

    generatePasswordResetEmailText(resetLink) {
        return `
Reset Your Password

We received a request to reset your password for your Autonomy account.

Click here to reset: ${resetLink}

This link will expire in 1 hour. If you didn't request this reset, please ignore this email.

---
© 2024 Autonomy Inc. All rights reserved.
        `.trim();
    }

    generateWelcomeEmailHTML(name, dashboardLink) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
                .header { background: #0066FF; color: white; padding: 20px; text-align: center; }
                .content { padding: 30px; background: #f9f9f9; }
                .button { background: #0066FF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 5px; }
                .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
                .feature { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to Autonomy!</h1>
                </div>
                <div class="content">
                    <h2>Hi ${name}! 👋</h2>
                    <p>Welcome to Autonomy, the payment infrastructure for AI agents. You're now ready to enable autonomous transactions for your AI systems.</p>
                    
                    <div class="feature">
                        <h3>🚀 Get Started</h3>
                        <p>Your account comes with a default API key and sandbox access. Start building immediately!</p>
                    </div>
                    
                    <div class="feature">
                        <h3>⚡ Sub-400ms Authorization</h3>
                        <p>Lightning-fast payment validation that won't slow down your AI agents.</p>
                    </div>
                    
                    <div class="feature">
                        <h3>🛡️ Enterprise Security</h3>
                        <p>Built-in spending controls, rate limiting, and complete audit trails.</p>
                    </div>
                    
                    <p>
                        <a href="${dashboardLink}" class="button">Go to Dashboard</a>
                        <a href="https://useautonomy.co/docs" class="button">View Documentation</a>
                    </p>
                </div>
                <div class="footer">
                    <p>© 2024 Autonomy Inc. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>`;
    }

    generateWelcomeEmailText(name, dashboardLink) {
        return `
Welcome to Autonomy!

Hi ${name}!

Welcome to Autonomy, the payment infrastructure for AI agents. You're now ready to enable autonomous transactions for your AI systems.

🚀 Get Started
Your account comes with a default API key and sandbox access. Start building immediately!

⚡ Sub-400ms Authorization
Lightning-fast payment validation that won't slow down your AI agents.

🛡️ Enterprise Security
Built-in spending controls, rate limiting, and complete audit trails.

Dashboard: ${dashboardLink}
Documentation: https://useautonomy.co/docs

---
© 2024 Autonomy Inc. All rights reserved.
        `.trim();
    }
}

module.exports = new EmailService(); 