require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Set basic production defaults
if (process.env.NODE_ENV === 'production') {
    process.env.JWT_SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex');
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex');
    console.log('🚀 Starting in PRODUCTION mode');
} else {
    console.log('🧪 Starting in DEVELOPMENT mode');
}

// Bulletproof error handling
process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error.message);
    if (process.env.NODE_ENV === 'production') {
        console.log('⚠️  Continuing in production mode...');
    } else {
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection:', reason);
    if (process.env.NODE_ENV === 'production') {
        console.log('⚠️  Continuing in production mode...');
    }
});

// Basic middleware
app.use(express.json({ limit: '10mb' }));

// Serve static files FIRST - so index.html can be served
try {
    if (fs.existsSync('public')) {
        app.use(express.static('public'));
        console.log('✅ Static files enabled - rich homepage active');
    }
} catch (error) {
    console.log('⚠️  Static files disabled:', error.message);
}

// BULLETPROOF health check - FIRST priority
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        service: 'aslan-minimal', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0-minimal'
    });
});

// Simple test endpoint
app.get('/test', (req, res) => {
    res.json({
        message: '✅ Aslan server is running!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        port: port
    });
});

// API status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        service: 'Aslan Payment Infrastructure',
        status: 'operational',
        timestamp: new Date().toISOString(),
        version: '1.0.0-minimal',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        components: {
            server: { status: 'operational' },
            health: { status: 'operational' }
        }
    });
});

// NOTE: No manual homepage route - let static files serve public/index.html

// Comparison page route
app.get('/comparison', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'comparison.html'));
    } catch (error) {
        res.status(404).json({ error: 'Comparison page not found' });
    }
});

app.get('/vs-stripe', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'comparison.html'));
    } catch (error) {
        res.status(404).json({ error: 'Comparison page not found' });
    }
});

// Catch-all for 404s
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        message: 'This is a minimal Aslan server. Available endpoints: /health, /test, /api/status',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(port, () => {
    console.log(`🦁 ASLAN MINIMAL SERVER RUNNING`);
    console.log(`📍 Port: ${port}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`⏰ Started: ${new Date().toISOString()}`);
    console.log(`🔗 Health check: http://localhost:${port}/health`);
    console.log('');
    console.log('🦁 Like the great lion of Narnia, Aslan guides AI agents to accomplish their missions');
    console.log('✅ DEPLOYMENT SUCCESSFUL - Server ready to receive requests!');
}); 