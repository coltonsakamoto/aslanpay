require('dotenv').config();

const express = require('express');
const path = require('path');

console.log('🚀 AslanPay Root Server Starting...');
console.log('📍 Environment:', process.env.NODE_ENV || 'development');
console.log('📍 Port:', process.env.PORT || 3000);

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Health check endpoint - available immediately
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        service: 'AslanPay', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Load the main API server
console.log('🔧 Loading API server from api/server.js...');
try {
    const apiServer = require('./api/server');
    
    // Mount the API server
    app.use('/', apiServer);
    
    console.log('✅ API server loaded successfully');
} catch (error) {
    console.error('❌ Failed to load API server:', error.message);
    console.error('Stack:', error.stack);
    
    // Emergency fallback
    app.get('*', (req, res) => {
        res.status(500).json({
            error: 'Server configuration error',
            message: 'API server failed to load',
            timestamp: new Date().toISOString()
        });
    });
}

// Global error handler
app.use((error, req, res, next) => {
    console.error('🚨 Unhandled error:', error.message);
    res.status(500).json({
        error: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(port, () => {
    console.log(`🚀 AslanPay server running on port ${port}`);
    console.log(`🌍 Health check: http://localhost:${port}/health`);
    console.log(`🌍 Frontend: http://localhost:${port}/`);
    console.log(`🌍 API: http://localhost:${port}/api/status`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    process.exit(0);
});

module.exports = app;