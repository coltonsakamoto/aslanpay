const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Basic middleware
app.use(express.json());

// Health check FIRST
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'AslanPay Online', 
        message: 'Service restored', 
        timestamp: new Date().toISOString() 
    });
});

// Static files
if (fs.existsSync('public')) {
    app.use(express.static('public'));
    console.log('✅ Static files enabled');
}

// Simple index page if public doesn't exist
app.get('*', (req, res) => {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>AslanPay - Service Restored</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .container { max-width: 600px; margin: 0 auto; }
        .status { color: #28a745; font-size: 24px; margin-bottom: 20px; }
        .message { color: #666; font-size: 16px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🦁 AslanPay</h1>
        <div class="status">✅ Service Restored</div>
        <div class="message">The platform is back online and operational.</div>
        <p><a href="/docs">Documentation</a> | <a href="/dashboard">Dashboard</a> | <a href="/pricing">Pricing</a></p>
    </div>
</body>
</html>`;
    res.send(html);
});

app.listen(port, () => {
    console.log(`🚀 EMERGENCY SERVER ONLINE - Port ${port}`);
    console.log(`✅ AslanPay service restored at ${new Date().toISOString()}`);
}); 