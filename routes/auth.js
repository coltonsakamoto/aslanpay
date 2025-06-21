const express = require('express');
const passport = require('passport');
const database = require('../config/database');
const authMiddleware = require('../middleware/auth');
const emailService = require('../services/email');
const AccountLockout = require('../middleware/account-lockout');
const InputValidation = require('../middleware/input-validation');
const { 
    validateSession, 
    validateSessionSimple,
    rateLimitLogin, 
    rateLimitPasswordReset, 
    generateToken 
} = require('../middleware/auth');

const router = express.Router();

// ========================================
// SIMPLIFIED SIGNUP FOR STAGING
// ========================================
router.post('/signup', async (req, res) => {
    try {
        const { email, password, name, organizationName } = req.body;
        
        console.log('🚀 Signup attempt for:', email);
        
        // Validation
        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                error: 'Email, password, and name are required',
                code: 'MISSING_FIELDS'
            });
        }
        
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 8 characters long',
                code: 'WEAK_PASSWORD'
            });
        }
        
        // Create user with database
        const user = await database.createUser({
            email: email.toLowerCase(),
            password,
            name,
            provider: 'email'
        });
        
        console.log('✅ User created:', user.id);
        
        // Create session
        const sessionId = await database.createSession(user.id);
        const token = generateToken(sessionId);
        
        // Set HTTP-only cookie
        res.cookie('agentpay_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
        });
        
        console.log('✅ Signup successful for:', email);
        
        res.status(201).json({
            success: true,
            message: 'Account created successfully!',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                organizationName: organizationName || `${name}'s Organization`
            }
        });
        
    } catch (error) {
        if (error.message === 'User already exists') {
            return res.status(409).json({
                success: false,
                error: 'An account with this email already exists',
                code: 'EMAIL_EXISTS'
            });
        }
        
        console.error('❌ Signup error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during signup',
            code: 'SIGNUP_ERROR'
        });
    }
});

// ========================================
// SIMPLIFIED LOGIN FOR STAGING
// ========================================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log('🔐 Login attempt for:', email);
        
        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required',
                code: 'MISSING_CREDENTIALS'
            });
        }
        
        // Verify credentials
        const user = await database.verifyPassword(email.toLowerCase(), password);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password',
                code: 'INVALID_CREDENTIALS'
            });
        }
        
        // Create session
        const sessionId = await database.createSession(user.id);
        const token = generateToken(sessionId);
        
        // Set HTTP-only cookie
        res.cookie('agentpay_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
        });
        
        console.log('✅ Login successful for:', user.email);
        
        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                emailVerified: user.emailVerified
            }
        });
        
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during login',
            code: 'LOGIN_ERROR'
        });
    }
});

// ========================================
// AUTH STATUS CHECK
// ========================================
router.get('/status', async (req, res) => {
    try {
        const token = req.cookies?.agentpay_session;
        
        if (!token) {
            return res.json({
                authenticated: false,
                user: null
            });
        }
        
        // Verify JWT token
        const jwt = require('jsonwebtoken');
        let decoded;
        try {
            decoded = jwt.verify(token, authMiddleware.JWT_SECRET);
        } catch (err) {
            return res.json({
                authenticated: false,
                user: null
            });
        }
        
        // Check session in database
        const session = await database.getSession(decoded.sessionId);
        if (!session) {
            return res.json({
                authenticated: false,
                user: null
            });
        }
        
        // Get user data
        const user = await database.getUserById(session.userId);
        if (!user) {
            return res.json({
                authenticated: false,
                user: null
            });
        }
        
        res.json({
            authenticated: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                emailVerified: user.emailVerified
            }
        });
        
    } catch (error) {
        console.error('❌ Auth status error:', error);
        res.json({
            authenticated: false,
            user: null
        });
    }
});

// ========================================
// LOGOUT
// ========================================
router.post('/logout', async (req, res) => {
    try {
        const token = req.cookies?.agentpay_session;
        
        if (token) {
            // Verify and get session ID
            const jwt = require('jsonwebtoken');
            try {
                const decoded = jwt.verify(token, authMiddleware.JWT_SECRET);
                await database.revokeSession(decoded.sessionId);
            } catch (err) {
                // Token invalid, but continue with logout
            }
        }
        
        // Clear cookie
        res.clearCookie('agentpay_session');
        
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
        
    } catch (error) {
        console.error('❌ Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Logout error',
            code: 'LOGOUT_ERROR'
        });
    }
});

// ========================================
// USER PROFILE
// ========================================
router.get('/me', validateSessionSimple, (req, res) => {
    try {
        res.json({ 
            user: {
                id: req.user.id,
                email: req.user.email,
                name: req.user.name,
                emailVerified: req.user.emailVerified,
                subscriptionPlan: req.user.subscriptionPlan,
                subscriptionStatus: req.user.subscriptionStatus
            }
        });
    } catch (error) {
        console.error('❌ Get current user error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// ========================================
// PASSWORD RESET (Placeholder)
// ========================================
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                error: 'Email is required',
                code: 'MISSING_EMAIL'
            });
        }
        
        // For staging, just return success (don't actually send emails)
        console.log('🔄 Password reset requested for:', email);
        
        // Always return success to prevent email enumeration
        res.json({
            message: 'If an account with that email exists, a password reset link has been sent.'
        });
        
    } catch (error) {
        console.error('❌ Password reset request error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

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
        
        console.error('❌ Password reset error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// ========================================
// EMAIL VERIFICATION (Placeholder)  
// ========================================
router.post('/verify-email', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({
                error: 'Verification token is required',
                code: 'MISSING_TOKEN'
            });
        }
        
        const success = await database.verifyEmail(token);
        
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
        console.error('❌ Email verification error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

// ========================================
// LEGACY ENDPOINTS FOR COMPATIBILITY
// ========================================

// Legacy register endpoint (redirects to signup)
router.post('/register', (req, res) => {
    // Redirect to the new signup endpoint
    req.url = '/signup';
    router.handle(req, res);
});

module.exports = router; 