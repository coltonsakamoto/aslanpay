require('dotenv').config();

console.log('🚀 AslanPay Complete System Starting...');
console.log('📍 Environment:', process.env.NODE_ENV || 'development');
console.log('📍 Port:', process.env.PORT || 3000);

// Try to load the complete working system
try {
    console.log('🔧 Loading complete working system from agent-wallet...');
    
    // Register ts-node to handle TypeScript files
    require('ts-node').register({
        project: './agent-wallet/tsconfig.json',
        transpileOnly: true
    });
    
    // Load the complete working server
    const workingServer = require('./agent-wallet/src/index.ts');
    
    console.log('✅ Complete AgentPay system loaded successfully');
    console.log('📍 Available endpoints:');
    console.log('   - /v1/purchase-direct (Real AI agent purchases)');
    console.log('   - /api/demo/purchase (Demo purchases)'); 
    console.log('   - /api/keys (API key management)');
    console.log('   - /health (Health check)');
    
    // The agent-wallet server will handle everything
    
} catch (error) {
    console.error('❌ Failed to load complete system:', error.message);
    console.error('Stack:', error.stack);
    
    // Emergency fallback - load basic wrapper
    console.log('🚨 Loading emergency fallback...');
    
    try {
        const apiServer = require('./api/server');
        const express = require('express');
        const app = express();
        const port = process.env.PORT || 3000;
        
        app.use('/', apiServer);
        
        app.listen(port, () => {
            console.log(`🚨 Emergency server running on port ${port}`);
        });
        
    } catch (fallbackError) {
        console.error('❌ Even fallback failed:', fallbackError.message);
        process.exit(1);
    }
}

// Global error handler
app.use((error, req, res, next) => {
    console.error('🚨 Unhandled error:', error.message);
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