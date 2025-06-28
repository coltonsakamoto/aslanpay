require('dotenv').config();

console.log('🚀 AslanPay Production Server Starting...');
console.log('📍 Environment:', process.env.NODE_ENV || 'development');
console.log('📍 Port:', process.env.PORT || 3000);

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Load the API server
try {
    console.log('🔧 Loading API server from api/server.js...');
    const apiServer = require('./api/server');
    
    // Use the API server as middleware
    app.use('/', apiServer);
    
    console.log('✅ AslanPay API server loaded successfully');
    console.log('📍 Available endpoints:');
    console.log('   - /v1/purchase-direct (AI agent purchases)');
    console.log('   - /api/demo/purchase (Demo purchases)'); 
    console.log('   - /api/keys (API key management)');
    console.log('   - /health (Health check)');
    console.log('   - /api/auth/* (User authentication)');
    
} catch (error) {
    console.error('❌ Failed to load API server:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
}

// Start the server
app.listen(port, () => {
    console.log(`🌟 AslanPay production server running on port ${port}`);
    console.log(`🌐 Available at: ${process.env.NODE_ENV === 'production' ? 'https://aslanpay.xyz' : `http://localhost:${port}`}`);
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('🚨 Unhandled server error:', error.message);
    res.status(500).json({
        error: 'Internal server error',
        timestamp: new Date().toISOString()
    });
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