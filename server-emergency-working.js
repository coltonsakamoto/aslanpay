require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 3000;

// Basic middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// Database
const database = require('./database-production.js');

// JWT functions
function getJWTSecret() {
    return process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex');
}

// Session validation
async function validateSession(req, res, next) {
    try {
        const token = req.cookies?.agentpay_session;
        if (!token) {
            return res.status(401).json({ error: 'No session' });
        }
        
        const decoded = jwt.verify(token, getJWTSecret());
        const session = await database.getSession(decoded.sessionId);
        if (!session) {
            return res.status(401).json({ error: 'Session expired' });
        }
        
        const user = await database.getUserById(session.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        
        req.session = session;
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid session' });
    }
}

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
});

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
        const user = await database.verifyPassword(email, password);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const sessionId = await database.createSession(user.id);
        const token = jwt.sign({ sessionId }, getJWTSecret(), { expiresIn: '7d' });
        
        res.cookie('agentpay_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({ user, message: 'Login successful' });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

app.get('/api/auth/me', validateSession, (req, res) => {
    res.json({ user: req.user });
});

// API KEYS ROUTES - THE CRITICAL ONES FOR BUTTONS
app.get('/api/keys', validateSession, async (req, res) => {
    try {
        const apiKeys = await database.getApiKeysByUserId(req.user.id);
        res.json({ apiKeys, total: apiKeys.length });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load API keys' });
    }
});

app.post('/api/keys', validateSession, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Name required' });
        }
        
        const apiKey = await database.createApiKey(req.user.id, name);
        res.json({ apiKey, message: 'Created successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create API key' });
    }
});

// ROTATE BUTTON - CRITICAL
app.post('/api/keys/:keyId/rotate', validateSession, async (req, res) => {
    try {
        const { keyId } = req.params;
        
        const userKeys = await database.getApiKeysByUserId(req.user.id);
        const keyExists = userKeys.find(k => k.id === keyId);
        
        if (!keyExists) {
            return res.status(404).json({ error: 'Key not found' });
        }
        
        const newKey = await database.rotateApiKey(req.user.id, keyId);
        res.json({ 
            apiKey: newKey,
            message: 'Key rotated successfully'
        });
    } catch (error) {
        console.error('Rotate error:', error);
        res.status(500).json({ error: 'Failed to rotate key' });
    }
});

// REVOKE BUTTON - CRITICAL  
app.delete('/api/keys/:keyId', validateSession, async (req, res) => {
    try {
        const { keyId } = req.params;
        
        const userKeys = await database.getApiKeysByUserId(req.user.id);
        const keyExists = userKeys.find(k => k.id === keyId);
        
        if (!keyExists) {
            return res.status(404).json({ error: 'Key not found' });
        }
        
        await database.revokeApiKey(req.user.id, keyId);
        res.json({ message: 'Key revoked successfully' });
    } catch (error) {
        console.error('Revoke error:', error);
        res.status(500).json({ error: 'Failed to revoke key' });
    }
});

app.listen(port, () => {
    console.log(`🚀 EMERGENCY server running on port ${port}`);
    console.log(`🔥 BUTTONS SHOULD WORK NOW!`);
}); 