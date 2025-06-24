// AslanPay API Server - Load the complete working system
console.log('🚀 Loading complete AslanPay system from agent-wallet...');

try {
    // Load the complete working server from agent-wallet
    const workingServer = require('../agent-wallet/src/index.ts');
    
    console.log('✅ Complete AslanPay system loaded successfully');
    console.log('📍 Available endpoints:');
    console.log('   - /v1/purchase-direct (Real AI agent purchases)');
    console.log('   - /api/demo/purchase (Demo purchases)'); 
    console.log('   - /api/keys (API key management)');
    console.log('   - /health (Health check)');
    
    // Export the working server
    module.exports = workingServer;
    
} catch (error) {
    console.error('❌ Failed to load complete system:', error.message);
    console.error('Stack:', error.stack);
    
    // Emergency fallback - basic Express server
    const express = require('express');
    const app = express();
    
    app.use(express.json());
    
    app.get('/health', (req, res) => {
        res.json({
            status: 'ERROR',
            message: 'Complete system failed to load',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    });
    
    app.get('*', (req, res) => {
        res.status(500).json({
            error: 'System not available',
            message: 'Complete AgentPay system failed to load',
            timestamp: new Date().toISOString()
        });
    });
    
    module.exports = app;
} 