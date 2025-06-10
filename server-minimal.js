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

// Main page
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    
    // Check if rich index.html exists
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        // Fallback to basic page if index.html not found
        res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Aslan - Payment Infrastructure</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 2rem; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; }
        .status { color: #10b981; font-weight: bold; }
        .lion { font-size: 2rem; }
        pre { background: #f3f4f6; padding: 1rem; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🦁 Aslan Payment Infrastructure</h1>
        <p class="status">✅ Server is running successfully!</p>
        
        <h2>Status</h2>
        <ul>
            <li>Environment: <strong>${process.env.NODE_ENV || 'development'}</strong></li>
            <li>Port: <strong>${port}</strong></li>
            <li>Uptime: <strong>${Math.floor(process.uptime())} seconds</strong></li>
            <li>Version: <strong>1.0.0-minimal</strong></li>
        </ul>
        
        <h2>Available Endpoints</h2>
        <ul>
            <li><code>GET /health</code> - Health check</li>
            <li><code>GET /test</code> - Simple test</li>
            <li><code>GET /api/status</code> - API status</li>
        </ul>
        
        <h2>Test the API</h2>
        <pre>curl https://aslanpay-production.up.railway.app/health</pre>
        
        <p><em>"Like the great lion of Narnia, Aslan guides AI agents to accomplish their missions"</em> 🦁</p>
    </div>
</body>
</html>
        `);
    }
});

// Serve static files
try {
    if (fs.existsSync('public')) {
        app.use(express.static('public'));
        console.log('✅ Static files enabled');
    }
} catch (error) {
    console.log('⚠️  Static files disabled:', error.message);
}

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