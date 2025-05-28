const express = require('express');
const passport = require('passport');
const database = require('../config/database');
const authMiddleware = require('../middleware/auth');
const emailService = require('../services/email');
const { 
    validateSession, 
    validateSessionSimple,
    rateLimitLogin, 
    rateLimitPasswordReset, 
    generateToken 
} = require('../middleware/auth');

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        
        // Validation
        if (!email || !password || !name) {
            return res.status(400).json({
                error: 'Email, password, and name are required',
                code: 'MISSING_FIELDS'
            });
        }
        
        if (password.length < 8) {
            return res.status(400).json({
                error: 'Password must be at least 8 characters long',
                code: 'WEAK_PASSWORD'
            });
        }
        
        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Invalid email format',
                code: 'INVALID_EMAIL'
            });
        }
        
        // Create user
        const user = await database.createUser({
            email: email.toLowerCase(),
            password,
            name,
            provider: 'email'
        });
        
        // Create email verification token
        const verificationToken = database.createEmailVerification(user.id, user.email);
        
        // Send verification email
        await emailService.sendVerificationEmail(user.email, verificationToken);
        
        // Create session
        const sessionId = database.createSession(user.id);
        const token = generateToken(sessionId);
        
        // Set HTTP-only cookie
        res.cookie('session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            sameSite: 'strict'
        });
        
        res.status(201).json({
            user,
            message: 'Account created successfully. Please check your email to verify your account.',
            emailSent: true
        });
        
    } catch (error) {
        if (error.message === 'User already exists') {
            return res.status(409).json({
                error: 'An account with this email already exists',
                code: 'USER_EXISTS'
            });
        }
        
        console.error('Registration error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Login user
router.post('/login', rateLimitLogin, async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required',
                code: 'MISSING_CREDENTIALS'
            });
        }
        
        // Verify credentials
        const user = await database.verifyPassword(email.toLowerCase(), password);
        
        if (!user) {
            return res.status(401).json({
                error: 'Invalid email or password',
                code: 'INVALID_CREDENTIALS'
            });
        }
        
        // Create session
        const sessionId = database.createSession(user.id);
        const token = generateToken(sessionId);
        
        // Set HTTP-only cookie
        res.cookie('session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            sameSite: 'strict'
        });
        
        res.json({
            user,
            message: 'Login successful'
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Logout user
router.post('/logout', validateSession, (req, res) => {
    try {
        // Revoke session
        database.revokeSession(req.session.id);
        
        // Clear cookie
        res.clearCookie('session');
        
        res.json({ message: 'Logout successful' });
        
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Get current user
router.get('/me', validateSessionSimple, (req, res) => {
    res.json({ user: req.user });
});

// Request password reset
router.post('/forgot-password', rateLimitPasswordReset, async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                error: 'Email is required',
                code: 'MISSING_EMAIL'
            });
        }
        
        try {
            const resetToken = database.createPasswordReset(email.toLowerCase());
            await emailService.sendPasswordResetEmail(email, resetToken);
        } catch (error) {
            // Don't reveal if email exists or not for security
            console.log('Password reset error:', error.message);
        }
        
        // Always return success to prevent email enumeration
        res.json({
            message: 'If an account with that email exists, a password reset link has been sent.'
        });
        
    } catch (error) {
        console.error('Password reset request error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        
        if (!token || !password) {
            return res.status(400).json({
                error: 'Token and password are required',
                code: 'MISSING_FIELDS'
            });
        }
        
        if (password.length < 8) {
            return res.status(400).json({
                error: 'Password must be at least 8 characters long',
                code: 'WEAK_PASSWORD'
            });
        }
        
        await database.resetPassword(token, password);
        
        res.json({
            message: 'Password reset successful. You can now login with your new password.'
        });
        
    } catch (error) {
        if (error.message === 'Invalid or expired reset token') {
            return res.status(400).json({
                error: 'Invalid or expired reset token',
                code: 'INVALID_TOKEN'
            });
        }
        
        console.error('Password reset error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Verify email
router.post('/verify-email', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({
                error: 'Verification token is required',
                code: 'MISSING_TOKEN'
            });
        }
        
        const success = database.verifyEmail(token);
        
        if (!success) {
            return res.status(400).json({
                error: 'Invalid or expired verification token',
                code: 'INVALID_TOKEN'
            });
        }
        
        res.json({
            message: 'Email verified successfully!'
        });
        
    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Resend verification email
router.post('/resend-verification', validateSession, async (req, res) => {
    try {
        if (req.user.emailVerified) {
            return res.status(400).json({
                error: 'Email is already verified',
                code: 'ALREADY_VERIFIED'
            });
        }
        
        const verificationToken = database.createEmailVerification(req.user.id, req.user.email);
        await emailService.sendVerificationEmail(req.user.email, verificationToken);
        
        res.json({
            message: 'Verification email sent successfully'
        });
        
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// OAuth callback (placeholder for Google/GitHub OAuth)
router.post('/oauth/callback', async (req, res) => {
    try {
        const { provider, email, name, providerId } = req.body;
        
        if (!provider || !email || !name) {
            return res.status(400).json({
                error: 'Provider, email, and name are required',
                code: 'MISSING_OAUTH_DATA'
            });
        }
        
        // Check if user exists
        let user = database.getUserByEmail(email.toLowerCase());
        
        if (!user) {
            // Create new user from OAuth
            user = await database.createUser({
                email: email.toLowerCase(),
                name,
                provider,
                providerId
            });
            
            // Send welcome email
            await emailService.sendWelcomeEmail(user.email, user.name);
        }
        
        // Create session
        const sessionId = database.createSession(user.id);
        const token = generateToken(sessionId);
        
        // Set HTTP-only cookie
        res.cookie('session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            sameSite: 'strict'
        });
        
        res.json({
            user,
            message: 'OAuth login successful'
        });
        
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Google OAuth routes
router.get('/google', (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(503).json({
            error: 'Google OAuth is not configured',
            code: 'OAUTH_NOT_CONFIGURED',
            message: 'Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables'
        });
    }
    passport.authenticate('google', { 
        scope: ['profile', 'email'] 
    })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.redirect('/auth.html?error=oauth_not_configured');
    }
    
    passport.authenticate('google', { session: false }, async (err, user) => {
        try {
            if (err || !user) {
                return res.redirect('/auth.html?error=oauth_failed');
            }
            
            // Create session for the user
            const sessionId = database.createSession(user.id);
            const token = generateToken(sessionId);
            
            // Set HTTP-only cookie
            res.cookie('session', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                sameSite: 'strict'
            });
            
            // Redirect to dashboard
            res.redirect('/dashboard.html?oauth=success');
            
        } catch (error) {
            console.error('Google OAuth callback error:', error);
            res.redirect('/auth.html?error=oauth_failed');
        }
    })(req, res, next);
});

// GitHub OAuth routes
router.get('/github', (req, res, next) => {
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
        return res.status(503).json({
            error: 'GitHub OAuth is not configured',
            code: 'OAUTH_NOT_CONFIGURED',
            message: 'Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables'
        });
    }
    passport.authenticate('github', { 
        scope: ['user:email'] 
    })(req, res, next);
});

router.get('/github/callback', (req, res, next) => {
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
        return res.redirect('/auth.html?error=oauth_not_configured');
    }
    
    passport.authenticate('github', { session: false }, async (err, user) => {
        try {
            if (err || !user) {
                return res.redirect('/auth.html?error=oauth_failed');
            }
            
            // Create session for the user
            const sessionId = database.createSession(user.id);
            const token = generateToken(sessionId);
            
            // Set HTTP-only cookie
            res.cookie('session', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                sameSite: 'strict'
            });
            
            // Redirect to dashboard
            res.redirect('/dashboard.html?oauth=success');
            
        } catch (error) {
            console.error('GitHub OAuth callback error:', error);
            res.redirect('/auth.html?error=oauth_failed');
        }
    })(req, res, next);
});

module.exports = router; 