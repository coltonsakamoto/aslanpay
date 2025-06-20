const express = require('express');
const path = require('path');
const app = express();

// --- Health-check for Railway ---
app.get('/health', (_req, res) => res.status(200).send('ok'));

// Basic middleware
app.use(express.json());

// Serve static frontend files FIRST (before API routes)
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Main page routes - serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

app.get('/docs', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/docs.html'));
});

app.get('/demo', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/demo.html'));
});

app.get('/auth', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/auth.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/signup.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/dashboard.html'));
});

app.get('/pricing', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/pricing.html'));
});

app.get('/comparison', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/comparison.html'));
});

app.get('/security', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/security.html'));
});

app.get('/checkout', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/checkout.html'));
});

app.get('/status', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/status.html'));
});

// API Status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: 'OK',
        service: 'AslanPay API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Main authorization endpoint (simplified but functional)
app.post('/api/v1/authorize', (req, res) => {
    const { amount, service = 'unknown', description, apiKey } = req.body;
    
    // Basic validation
    if (!amount || amount <= 0) {
        return res.status(400).json({
            error: 'Invalid amount',
            code: 'INVALID_AMOUNT'
        });
    }
    
    if (!apiKey) {
        return res.status(401).json({
            error: 'API key required',
            code: 'MISSING_API_KEY'
        });
    }
    
    // Simple authorization logic
    const approved = amount <= 100; // Approve amounts <= $100
    const approvalId = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    res.json({
        approved,
        amount,
        service,
        description,
        approvalId,
        timestamp: new Date().toISOString(),
        limits: {
            maxAmount: 100,
            dailyLimit: 1000
        }
    });
});

// API Keys management endpoints
app.get('/api/keys', (req, res) => {
    res.json({
        message: 'API Keys endpoint',
        action: 'list',
        keys: []
    });
});

app.post('/api/keys', (req, res) => {
    const { name, permissions = ['read'] } = req.body;
    
    if (!name) {
        return res.status(400).json({
            error: 'Key name required'
        });
    }
    
    const apiKey = `ak_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
    
    res.json({
        message: 'API key created',
        keyId: `key_${Date.now()}`,
        apiKey,
        name,
        permissions,
        created: new Date().toISOString()
    });
});

// Spending controls endpoint
app.get('/api/keys/spending-controls', (req, res) => {
    res.json({
        dailyLimit: 100,
        transactionLimit: 25,
        maxTransactions: 10,
        emergencyStop: false,
        lastUpdated: new Date().toISOString()
    });
});

// Auth endpoints
app.get('/api/auth/status', (req, res) => {
    res.json({
        authenticated: false,
        message: 'Authentication status'
    });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({
            error: 'Email and password required'
        });
    }
    
    res.json({
        message: 'Login endpoint',
        email,
        token: `token_${Date.now()}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
});

// Demo authorization endpoint
app.post('/api/demo-authorize', (req, res) => {
    const { amount = 50, service = 'demo' } = req.body;
    
    res.json({
        approved: true,
        amount,
        service,
        demo: true,
        approvalId: `demo_${Date.now()}`,
        message: 'Demo authorization successful'
    });
});

// Basic API route - with proper formatting for browsers
app.get('/api', (req, res) => {
    const apiInfo = { 
        message: 'Aslan API is running', 
        status: 'OK',
        version: '1.0.0',
        endpoints: [
            'GET /health',
            'GET /api/status', 
            'POST /api/v1/authorize',
            'GET /api/keys',
            'POST /api/keys',
            'GET /api/keys/spending-controls',
            'GET /api/auth/status',
            'POST /api/auth/login',
            'POST /api/demo-authorize'
        ]
    };
    
    // Check if request is from a browser (has text/html in Accept header)
    const acceptsHtml = req.get('Accept') && req.get('Accept').includes('text/html');
    
    if (acceptsHtml) {
        // Return formatted HTML for browsers
        res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AslanPay API</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; background: #f8f9fa; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; margin-bottom: 30px; }
        .status { color: #27ae60; font-weight: bold; font-size: 18px; margin-bottom: 20px; }
        .endpoints { background: #f8f9fa; padding: 20px; border-radius: 5px; margin-top: 20px; }
        .endpoint { font-family: 'Monaco', 'Consolas', monospace; background: #fff; padding: 8px 12px; margin: 5px 0; border-radius: 3px; border-left: 3px solid #3498db; }
        .json-link { margin-top: 20px; }
        .json-link a { color: #3498db; text-decoration: none; }
        .json-link a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 AslanPay API</h1>
        <div class="status">✅ Status: ${apiInfo.status}</div>
        <p><strong>Version:</strong> ${apiInfo.version}</p>
        <p><strong>Message:</strong> ${apiInfo.message}</p>
        
        <div class="endpoints">
            <h3>Available Endpoints:</h3>
            ${apiInfo.endpoints.map(endpoint => `<div class="endpoint">${endpoint}</div>`).join('')}
        </div>
        
        <div class="json-link">
            <p><a href="/api?format=json">View raw JSON</a> | <a href="/docs">Documentation</a> | <a href="/demo">Try Demo</a></p>
        </div>
    </div>
</body>
</html>`);
    } else {
        // Return JSON for API clients (pretty formatted)
        res.set('Content-Type', 'application/json');
        res.send(JSON.stringify(apiInfo, null, 2));
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('API listening on', PORT));
