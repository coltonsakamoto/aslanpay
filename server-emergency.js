require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https:"],
            fontSrc: ["'self'", "https:", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'self'"],
        },
    },
}));
app.use(cors());

// Static files
app.use(express.static('public'));

// Simple health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK' });
});

// Import database and routes
const database = require('./config/database');
const { validateSession } = require('./middleware/auth');
const apiKeyRoutes = require('./routes/api-keys');

// Use API key routes
app.use('/api/keys', apiKeyRoutes);

// Basic routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Auth routes
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }

        const user = await database.verifyPassword(email, password);
        
        if (!user) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        const sessionId = await database.createSession(user.id);
        const token = require('./middleware/auth').generateToken(sessionId);
        
        res.cookie('agentpay_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({
            message: 'Login successful',
            user: database.sanitizeUser(user)
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('agentpay_session');
    res.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/me', validateSession, (req, res) => {
    res.json({
        user: database.sanitizeUser(req.user)
    });
});

// Test endpoint
app.get('/api/v1/test', require('./middleware/auth').validateApiKey, (req, res) => {
    res.json({
        message: '🎉 API Key is working correctly!',
        status: 'operational',
        validation: 'passed'
    });
});

// Start server
app.listen(port, () => {
    console.log(`🚀 Emergency server running on port ${port}`);
    console.log(`🌐 Access at: http://localhost:${port}`);
}); 